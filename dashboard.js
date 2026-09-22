/* =========================================================
   OUTLET 23 — DASHBOARD TIM FORECASTING
   Rekap request produk dari outlet + daftar semua request.
   ========================================================= */
(function () {
    'use strict';

    const PAGE_SIZE = 25;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const DEFAULT_STATUSES = ['Baru', 'Ditinjau', 'Disetujui', 'Ditolak', 'Sudah tersedia'];
    const LEGACY_TYPE = '';   // baris lama tanpa kolom Request Type

    const S = { raw: [], filtered: [], rekap: [], rows: [], tab: 'rekap', page: 1, search: '', statuses: DEFAULT_STATUSES, ready: false };
    const $ = (id) => document.getElementById(id);

    /* ---------- Utils ---------- */
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function fmtDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
    function fmtDateTime(d) { return fmtDate(d) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    function clean(v) { const s = String(v == null ? '' : v).trim(); return s === '-' ? '' : s; }
    function fmtNum(n) { return n == null ? '–' : n.toLocaleString('id-ID'); }
    function parseTs(s) {
        const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }
    function productKey(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    function catLabel(s) { return s ? MasterProduct.label(s) : ''; }
    function fmtQty(n) { return n == null || n === '' ? '–' : Number(n).toLocaleString('id-ID'); }
    function fmtDiff(n) { if (n == null || n === '') return '–'; n = Number(n); return (n > 0 ? '+' : '') + n.toLocaleString('id-ID'); }
    function toNum(v) { const s = String(v == null ? '' : v).trim(); if (s === '') return null; const n = Number(s); return isFinite(n) ? n : null; }
    function typeClass(t) { return t === 'NEW_PRODUCT' ? 'is-new' : t === 'EXISTING_PRODUCT' ? 'is-existing' : t === 'STOCK_BUFFER' ? 'is-buffer' : 'is-legacy'; }
    function typePill(t) { return '<span class="type-pill ' + typeClass(t) + '">' + esc(requestTypeLabel(t)) + '</span>'; }
    /* Kolom "Detail" di tabel Semua Request */
    function detailHtml(r) {
        if (r.type === 'STOCK_BUFFER') {
            const cls = r.diff > 0 ? 'is-up' : r.diff < 0 ? 'is-down' : '';
            return '<span class="buf-inline ' + cls + '"><strong>' + esc(fmtQty(r.curBuf)) + ' → ' + esc(fmtQty(r.reqBuf)) + ' Qty</strong> <em>(' + esc(fmtDiff(r.diff)) + ')</em></span>';
        }
        if (r.type === 'NEW_PRODUCT') return '<span class="muted">Produk baru</span>';
        if (r.type === 'EXISTING_PRODUCT') return '<span class="muted">Produk existing</span>';
        return '';
    }
    function debounce(fn, ms) { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); }; }
    function optionList(items, allLabel) {
        return '<option value="">' + esc(allLabel || 'Semua') + '</option>' +
            items.map((o) => '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>').join('');
    }
    function renderBrand() {
        const name = (typeof CONFIG !== 'undefined' && CONFIG.BRAND_NAME) || 'OUTLET 23';
        const logo = (typeof CONFIG !== 'undefined' && CONFIG.LOGO_URL) || '';
        document.querySelectorAll('[data-brand]').forEach((node) => {
            if (logo) { node.classList.add('has-logo'); node.innerHTML = '<img src="' + esc(logo) + '" alt="' + esc(name) + '">'; }
            else node.textContent = name;
        });
    }
    function statusClass(s) {
        const x = String(s || '').toLowerCase();
        if (x === 'baru' || !x) return 'is-new';
        if (x === 'disetujui' || x === 'sudah tersedia') return 'is-done';
        return '';
    }

    /* ---------- Notice ---------- */
    function showNotice(type, msg) { const n = $('dashNotice'); n.className = 'notice notice-' + type; n.textContent = msg; n.hidden = false; }
    function hideNotice() { $('dashNotice').hidden = true; }
    function setLoading(on) { $('loadingOverlay').hidden = !on; $('btnRefresh').disabled = on; }

    /* ---------- Login ---------- */
    function showLoginError(msg) { $('loginError').textContent = msg; $('loginError').hidden = false; }

    function initLogin() {
        $('togglePw').addEventListener('click', () => {
            const inp = $('loginPass');
            const show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            $('togglePw').textContent = show ? 'Sembunyi' : 'Lihat';
        });
        $('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = $('loginUser').value.trim();
            const p = $('loginPass').value;
            if (!u || !p) return showLoginError('Username dan password wajib diisi.');
            const btn = $('btnLogin');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Memeriksa...';
            $('loginError').hidden = true;
            try {
                const json = await AdminAuth.login(u, p);
                if (!json || !json.success) return showLoginError((json && json.message) || 'Username atau password salah.');
                $('loginPass').value = '';
                enterDashboard();
            } catch (err) {
                console.error('[Forecast] Login error:', err);
                showLoginError(err && err.message && err.message.indexOf('config.js') !== -1 ? err.message : 'Tidak dapat terhubung ke server. Periksa koneksi, lalu coba lagi.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'LOGIN';
            }
        });
    }

    function enterDashboard() {
        $('loginView').hidden = true;
        $('dashView').hidden = false;
        if (!S.ready) initDashboard();
        loadData();
    }

    /* ---------- Data ---------- */
    async function loadData() {
        hideNotice();
        if (!AdminAuth.isConfigured()) { showNotice('warn', 'URL Google Apps Script belum diisi di config.js.'); return; }
        setLoading(true);
        try {
            const json = await AdminAuth.list();
            if (!json || !json.success) {
                if (json && json.code === 'UNAUTHORIZED') { window.location.reload(); return; }
                showNotice('error', 'Gagal memuat data: ' + ((json && json.message) || 'respons tidak valid.'));
                S.raw = [];
            } else {
                if (Array.isArray(json.statuses) && json.statuses.length) S.statuses = json.statuses;
                S.raw = (json.data || []).map(normalizeRow).filter(Boolean);
                $('lastUpdated').textContent = S.raw.length + ' request · diperbarui ' + fmtDateTime(new Date()) +
                    (json.user && json.user.name ? ' · ' + json.user.name : '');
            }
        } catch (err) {
            console.error('[Forecast] Load error:', err);
            showNotice('error', 'Tidak dapat terhubung ke server. Coba klik Refresh.');
        } finally {
            setLoading(false);
            fillCategoryFilter();
            fillStatusFilter();
            applyFilters();
        }
    }

    function normalizeRow(o, i) {
        const date = parseTs(clean(o['Timestamp']));
        if (!date) return null;
        const outlet = clean(o['Outlet']);
        const type = clean(o['Request Type']).toUpperCase() || LEGACY_TYPE;
        const cur = toNum(o['Current Buffer Qty']);
        const req = toNum(o['Requested Buffer Qty']);
        let diff = toNum(o['Buffer Difference']);
        if (diff == null && cur != null && req != null) diff = req - cur;
        return {
            id: i,
            timestamp: clean(o['Timestamp']),
            date: date,
            ymd: ymd(date),
            region: clean(o['Region']) || findRegionByOutlet(outlet),
            outlet: outlet,
            pic: clean(o['PIC']),
            product: clean(o['Product Request']) || clean(o['New Product Name']),
            category: clean(o['Product Category']),
            note: clean(o['Request Note']),
            status: clean(o['Status']) || 'Baru',
            // v2
            requestId: clean(o['Request ID']),
            type: type,
            typeLabel: requestTypeLabel(type),
            code: clean(o['Product Code']),
            masterCategory: clean(o['Master Category']),
            unit: clean(o['Unit']),
            curBuf: cur,
            reqBuf: req,
            diff: diff
        };
    }

    /* ---------- Filters ---------- */
    function initDashboard() {
        $('fRegion').innerHTML = optionList(getRegions().map((r) => ({ value: r, label: regionLabel(r) })));
        fillOutletFilter();
        $('fType').innerHTML = optionList(REQUEST_TYPES.map((t) => ({ value: t.value, label: t.label })));
        fillCategoryFilter();
        fillStatusFilter();

        $('fRegion').addEventListener('change', () => { fillOutletFilter(); applyFilters(); });
        $('fDate').addEventListener('change', () => { toggleCustomRange(); applyFilters(); });
        ['fOutlet', 'fType', 'fCategory', 'fStatus', 'fFrom', 'fTo'].forEach((id) => $(id).addEventListener('change', applyFilters));
        $('btnReset').addEventListener('click', resetFilters);
        $('search').addEventListener('input', debounce((e) => { S.search = e.target.value; S.page = 1; renderTable(); }, 200));
        $('tabRekap').addEventListener('click', () => setTab('rekap'));
        $('tabList').addEventListener('click', () => setTab('list'));
        const drill = (tr) => {
            $('search').value = tr.dataset.product;
            S.search = tr.dataset.product;
            setTab('list');
        };
        $('rekapBody').addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-product]');
            if (tr) drill(tr);
        });
        $('rekapBody').addEventListener('keydown', (e) => {
            const tr = e.target.closest('tr[data-product]');
            if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); drill(tr); }
        });
        $('pager').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-page]');
            if (!b || b.disabled) return;
            S.page = Number(b.dataset.page);
            renderTable();
        });
        $('btnExport').addEventListener('click', exportCsv);
        $('btnRefresh').addEventListener('click', loadData);
        $('btnLogout').addEventListener('click', async () => { await AdminAuth.logout(); window.location.reload(); });
        S.ready = true;
    }

    function fillOutletFilter() {
        const sel = $('fOutlet');
        const cur = sel.value;
        const region = $('fRegion').value;
        const regions = region ? [region] : getRegions();
        let html = '<option value="">Semua</option>';
        regions.forEach((r) => {
            html += '<optgroup label="' + esc(regionLabel(r)) + '">' +
                OUTLET_DATA[r].map((o) => '<option value="' + esc(o) + '">' + esc(shortOutletName(o)) + '</option>').join('') + '</optgroup>';
        });
        sel.innerHTML = html;
        if (cur && regions.some((r) => OUTLET_DATA[r].indexOf(cur) !== -1)) sel.value = cur;
    }

    /* Kategori: gabungan nilai di data (tanpa beda huruf besar/kecil) + kategori v1 sebagai fallback */
    function fillCategoryFilter() {
        const sel = $('fCategory');
        const cur = sel.value;
        const map = new Map();
        S.raw.forEach((r) => { const k = r.category.toUpperCase(); if (k && !map.has(k)) map.set(k, r.category); });
        if (!map.size) PRODUCT_CATEGORIES.forEach((c) => map.set(c.value.toUpperCase(), c.value));
        const items = Array.from(map.keys()).sort().map((k) => ({ value: k, label: catLabel(k) }));
        sel.innerHTML = optionList(items);
        sel.value = cur;
        // baris lama tanpa jenis request → opsi tambahan di filter jenis
        const hasLegacy = S.raw.some((r) => r.type === LEGACY_TYPE);
        const tsel = $('fType');
        const tcur = tsel.value;
        tsel.innerHTML = optionList(REQUEST_TYPES.map((t) => ({ value: t.value, label: t.label })).concat(hasLegacy ? [{ value: '__LEGACY__', label: 'Request lama (tanpa jenis)' }] : []));
        tsel.value = tcur;
    }

    function fillStatusFilter() {
        const sel = $('fStatus');
        const cur = sel.value;
        const extra = Array.from(new Set(S.raw.map((r) => r.status))).filter((s) => S.statuses.indexOf(s) === -1);
        sel.innerHTML = optionList(S.statuses.concat(extra).map((s) => ({ value: s, label: s })));
        sel.value = cur;
    }

    function toggleCustomRange() {
        const custom = $('fDate').value === 'custom';
        $('customRange').hidden = !custom;
        if (custom && !$('fFrom').value && !$('fTo').value) {
            const t = new Date();
            $('fFrom').value = ymd(addDays(t, -6));
            $('fTo').value = ymd(t);
        }
    }

    function resetFilters() {
        $('fDate').value = 'all';
        ['fRegion', 'fType', 'fCategory', 'fStatus', 'fFrom', 'fTo'].forEach((id) => { $(id).value = ''; });
        fillOutletFilter();
        $('fOutlet').value = '';
        toggleCustomRange();
        $('search').value = '';
        S.search = '';
        applyFilters();
    }

    function applyFilters() {
        const f = { date: $('fDate').value, region: $('fRegion').value, outlet: $('fOutlet').value, type: $('fType').value, cat: $('fCategory').value, status: $('fStatus').value, from: $('fFrom').value, to: $('fTo').value };
        const t = new Date();
        const tY = ymd(t);
        let min = '';
        let max = '';
        if (f.date === 'today') { min = tY; max = tY; }
        else if (f.date === '7') { min = ymd(addDays(t, -6)); max = tY; }
        else if (f.date === '30') { min = ymd(addDays(t, -29)); max = tY; }
        else if (f.date === 'custom') { min = f.from; max = f.to; if (min && max && min > max) { const x = min; min = max; max = x; } }

        S.filtered = S.raw.filter((r) =>
            (!min || r.ymd >= min) && (!max || r.ymd <= max) &&
            (!f.region || r.region === f.region) &&
            (!f.outlet || r.outlet === f.outlet) &&
            (!f.type || (f.type === '__LEGACY__' ? r.type === LEGACY_TYPE : r.type === f.type)) &&
            (!f.cat || r.category.toUpperCase() === f.cat) &&
            (!f.status || r.status === f.status));

        renderSummary();
        S.page = 1;
        renderTable();
    }

    /* ---------- Rekap ---------- */
    function buildRekap(rows) {
        const map = new Map();
        rows.forEach((r) => {
            const key = r.code ? 'code:' + r.code : productKey(r.product);
            if (!key) return;
            let g = map.get(key);
            if (!g) { g = { key: key, code: r.code, product: r.product, categories: new Map(), names: new Map(), types: new Map(), count: 0, outlets: new Set(), last: r.date }; map.set(key, g); }
            g.count++;
            g.types.set(r.type, (g.types.get(r.type) || 0) + 1);
            const nm = r.product.replace(/\s+/g, ' ').trim();
            g.names.set(nm, (g.names.get(nm) || 0) + 1);
            g.outlets.add(r.outlet);
            if (r.category) g.categories.set(r.category.toUpperCase(), (g.categories.get(r.category.toUpperCase()) || 0) + 1);
            if (r.date > g.last) g.last = r.date;
        });
        return Array.from(map.values()).map((g) => {
            let cat = '';
            let best = 0;
            g.categories.forEach((n, c) => { if (n > best) { best = n; cat = c; } });
            let label = g.product;
            let top = 0;
            g.names.forEach((n, nm) => { if (n > top) { top = n; label = nm; } });
            const types = Array.from(g.types.entries()).sort((a, b) => b[1] - a[1]);
            return { key: g.key, code: g.code, product: label, category: cat, types: types, count: g.count, outlets: g.outlets.size, last: g.last };
        }).sort((a, b) => b.count - a.count || b.outlets - a.outlets || b.last - a.last);
    }

    function renderSummary() {
        const rows = S.filtered;
        const t = new Date();
        const weekMin = ymd(addDays(t, -6));
        const tY = ymd(t);
        S.rekap = buildRekap(rows);
        $('sTotal').textContent = fmtNum(rows.length);
        const byType = REQUEST_TYPES.map((t) => fmtNum(rows.filter((r) => r.type === t.value).length) + ' ' + t.label.toLowerCase()).join(' · ');
        $('sTypes').textContent = rows.length ? byType : 'sesuai filter';
        $('sWeek').textContent = fmtNum(rows.filter((r) => r.ymd >= weekMin).length);
        $('sToday').textContent = rows.filter((r) => r.ymd === tY).length + ' hari ini';
        $('sOutlets').textContent = fmtNum(new Set(rows.map((r) => r.outlet)).size);
        $('sProducts').textContent = S.rekap.length + ' produk berbeda';
        const top = S.rekap[0];
        $('sTop').textContent = top ? top.product : '–';
        $('sTop').title = top ? top.product : '';
        $('sTopN').textContent = top ? top.count + ' request · ' + top.outlets + ' outlet' : '';
    }

    /* ---------- Tabel ---------- */
    function setTab(tab) {
        S.tab = tab;
        S.page = 1;
        $('tabRekap').setAttribute('aria-selected', String(tab === 'rekap'));
        $('tabList').setAttribute('aria-selected', String(tab === 'list'));
        $('panelRekap').hidden = tab !== 'rekap';
        $('panelList').hidden = tab !== 'list';
        $('tabHint').textContent = tab === 'rekap'
            ? 'Produk diurutkan dari yang paling banyak direquest. Klik baris untuk melihat detail request.'
            : 'Semua request dari outlet, terbaru di atas.';
        renderTable();
    }

    function matches(text) {
        const q = S.search.trim().toLowerCase();
        return !q || text.toLowerCase().indexOf(q) !== -1;
    }

    function renderTable() {
        let total;
        let start;
        let pageRows;
        if (S.tab === 'rekap') {
            const rows = S.rekap.filter((g) => matches([g.product, g.code, g.category, catLabel(g.category)].join(' ')));
            S.rows = rows;
            total = rows.length;
            const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            if (S.page > pages) S.page = pages;
            start = (S.page - 1) * PAGE_SIZE;
            pageRows = rows.slice(start, start + PAGE_SIZE);
            $('rekapBody').innerHTML = pageRows.length ? pageRows.map((g, i) => {
                const rank = start + i + 1;
                return '<tr data-product="' + esc(g.code || g.product) + '" tabindex="0">' +
                    '<td class="strong cell-subject"><span class="rank' + (rank <= 3 ? ' top' : '') + '">' + rank + '</span>' + esc(g.product) + (g.code ? '<small>' + esc(g.code) + '</small>' : '') + '</td>' +
                    '<td class="nowrap">' + esc(catLabel(g.category) || '–') + '</td>' +
                    '<td class="cell-types">' + g.types.map((t) => '<span class="type-pill ' + typeClass(t[0]) + '">' + esc(requestTypeLabel(t[0])) + (g.types.length > 1 ? ' ' + t[1] : '') + '</span>').join(' ') + '</td>' +
                    '<td class="num strong">' + fmtNum(g.count) + '</td>' +
                    '<td class="num">' + fmtNum(g.outlets) + '</td>' +
                    '<td class="nowrap">' + esc(fmtDate(g.last)) + '</td>' +
                '</tr>';
            }).join('') : '<tr class="empty-row"><td colspan="6">' + (S.raw.length ? 'Tidak ada data yang cocok dengan filter.' : 'Belum ada request dari outlet.') + '</td></tr>';
            renderPager(pages);
        } else {
            const rows = S.filtered.filter((r) => matches([r.product, r.code, r.category, catLabel(r.category), r.typeLabel, r.requestId, r.outlet, shortOutletName(r.outlet), r.pic, r.note, r.status].join(' ')))
                .sort((a, b) => b.date - a.date);
            S.rows = rows;
            total = rows.length;
            const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            if (S.page > pages) S.page = pages;
            start = (S.page - 1) * PAGE_SIZE;
            pageRows = rows.slice(start, start + PAGE_SIZE);
            $('listBody').innerHTML = pageRows.length ? pageRows.map((r) =>
                '<tr>' +
                    '<td class="nowrap">' + esc(fmtDate(r.date)) + '<small>' + pad(r.date.getHours()) + ':' + pad(r.date.getMinutes()) + '</small></td>' +
                    '<td class="nowrap strong">' + esc(shortOutletName(r.outlet)) + '<small>' + esc(regionLabel(r.region)) + '</small></td>' +
                    '<td class="nowrap">' + esc(r.pic || '–') + '</td>' +
                    '<td class="nowrap">' + typePill(r.type) + (r.requestId ? '<small class="req-id">' + esc(r.requestId) + '</small>' : '') + '</td>' +
                    '<td class="cell-subject"><strong>' + esc(r.product) + '</strong><small>' + esc([catLabel(r.category) || '–', r.code || '—', r.unit].filter(Boolean).join(' · ')) + '</small></td>' +
                    '<td class="cell-feedback">' + detailHtml(r) + (r.note ? '<span class="clamp">' + esc(r.note) + '</span>' : '<span class="muted">–</span>') + '</td>' +
                    '<td><span class="status-pill ' + statusClass(r.status) + '">' + esc(r.status) + '</span></td>' +
                '</tr>').join('')
                : '<tr class="empty-row"><td colspan="7">' + (S.raw.length ? 'Tidak ada request yang cocok.' : 'Belum ada request dari outlet.') + '</td></tr>';
            renderPager(pages);
        }
        const unit = S.tab === 'rekap' ? 'produk' : 'request';
        $('tableInfo').textContent = total ? 'Menampilkan ' + (start + 1) + '–' + (start + pageRows.length) + ' dari ' + total + ' ' + unit : 'Menampilkan 0 ' + unit;
    }

    function renderPager(pages) {
        const p = S.page;
        const btn = (label, page, disabled, active, aria) =>
            '<button type="button" class="pg-btn' + (active ? ' is-active' : '') + '" data-page="' + page + '"' +
            (disabled ? ' disabled' : '') + (aria ? ' aria-label="' + aria + '"' : '') + '>' + label + '</button>';
        let html = btn('‹', p - 1, p <= 1, false, 'Halaman sebelumnya');
        for (let i = 1; i <= pages; i++) {
            if (pages > 7 && i !== 1 && i !== pages && Math.abs(i - p) > 1) {
                if (i === 2 || i === pages - 1) html += '<span class="pg-gap">…</span>';
                continue;
            }
            html += btn(i, i, false, i === p);
        }
        html += btn('›', p + 1, p >= pages, false, 'Halaman berikutnya');
        $('pager').innerHTML = html;
    }

    /* ---------- CSV ---------- */
    function csvCell(v) {
        let s = String(v == null ? '' : v);
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    function exportCsv() {
        if (!S.rows.length) { showNotice('warn', 'Tidak ada data untuk di-export dengan filter saat ini.'); return; }
        let head;
        let lines;
        if (S.tab === 'rekap') {
            head = ['Produk', 'Kode Produk', 'Kategori', 'Jenis Request', 'Jumlah Request', 'Jumlah Outlet', 'Terakhir Direquest'];
            lines = S.rows.map((g) => [g.product, g.code, g.category, g.types.map((t) => requestTypeLabel(t[0]) + ' ' + t[1]).join('; '), g.count, g.outlets, ymd(g.last)]);
        } else {
            head = ['Timestamp', 'Request ID', 'Region', 'Outlet', 'PIC', 'Request Type', 'Product Request', 'Product Code', 'Product Category', 'Master Category', 'Unit',
                    'Current Buffer Qty', 'Requested Buffer Qty', 'Buffer Difference', 'Request Note', 'Status'];
            lines = S.rows.map((r) => [r.timestamp, r.requestId, r.region, r.outlet, r.pic, r.type, r.product, r.code, r.category, r.masterCategory, r.unit,
                    r.curBuf == null ? '' : r.curBuf, r.reqBuf == null ? '' : r.reqBuf, r.diff == null ? '' : r.diff, r.note, r.status]);
        }
        const csv = [head].concat(lines).map((row) => row.map(csvCell).join(',')).join('\r\n');
        const now = new Date();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
        a.download = (S.tab === 'rekap' ? 'rekap-request-produk_' : 'request-produk-outlet_') + ymd(now).replace(/-/g, '') + '_' + pad(now.getHours()) + pad(now.getMinutes()) + '.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    }

    /* ---------- Init ---------- */
    renderBrand();
    initLogin();
    if (AdminAuth.get()) enterDashboard();
    else $('loginUser').focus();
})();
