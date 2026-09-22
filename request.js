/* =========================================================
   OUTLET 23 — REQUEST PRODUK OUTLET → TIM FORECASTING (v2)
   Wizard 5 langkah: Outlet → PIC → Jenis Request → Detail → Review
   → Kirim → Terkirim. Tanpa WhatsApp.
   - Outlet & nama PIC diingat di perangkat (localStorage).
   - Draft (data + langkah) disimpan di sessionStorage agar
     tidak hilang saat refresh.
   - QR per outlet: ?outlet=NAMA_OUTLET → outlet langsung terpilih.
   - Master produk: master-product.js (lihat data.js → MasterProduct).
   ========================================================= */
(function () {
    'use strict';

    const TEXT_MAX = 500;
    const PIC_MIN = 2;
    const PIC_MAX = 100;
    const REQUEST_TIMEOUT_MS = 20000;
    const DRAFT_KEY = 'o23_outlet_req_draft_v2';
    const REMEMBER_KEY = 'o23_outlet_req_remember_v1';
    const HISTORY_KEY = 'o23_outlet_req_history_v2';
    const HISTORY_MAX = 5;
    const PRODUCT_RESULT_LIMIT = 60;

    const STEPS = [
        { n: 1, key: 'outlet', label: 'Outlet' },
        { n: 2, key: 'pic', label: 'PIC' },
        { n: 3, key: 'type', label: 'Request' },
        { n: 4, key: 'detail', label: 'Detail' },
        { n: 5, key: 'review', label: 'Review' }
    ];

    const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
    const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
    const ICON_CHEVRON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    const ICON_ALERT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>';
    const ICON_ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    const ICON_LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
    const TYPE_ICONS = {
        plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
        package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8l-9-4-9 4 9 4 9-4zM3 8v8l9 4 9-4V8"/><path d="M12 12v8"/><circle cx="17.5" cy="17.5" r="3.2" fill="#fff"/><path d="M20 20l1.8 1.8"/></svg>',
        box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16v13H4z"/><path d="M4 7l2-3h12l2 3"/><path d="M9 12h6"/></svg>'
    };

    const $ = (sel) => document.querySelector(sel);
    const els = {
        form: $('#screenForm'),
        thanks: $('#screenThanks'),
        stepper: $('#stepper'),
        area: $('#formArea'),
        footer: $('#formFooter'),
        back: $('#btnBack'),
        next: $('#btnNext'),
        error: $('#errorBanner'),
        errorText: $('#errorText'),
        errorDetail: $('#errorDetail'),
        retry: $('#btnRetry'),
        thanksLead: $('#thanksLead'),
        thanksSummary: $('#thanksSummary'),
        thanksHistory: $('#thanksHistory'),
        again: $('#btnAgain'),
        done: $('#btnDone')
    };

    let uid = 0;
    let step = 1;
    let direction = 'next';
    let submitting = false;
    let lastSent = null;      // payload terakhir yang berhasil dikirim
    let lastResult = null;    // respons server (requestId, timestamp)

    function blank() {
        return {
            outlet: '', region: '', pic: '',
            requestType: '',
            // produk dari master (EXISTING_PRODUCT / STOCK_BUFFER)
            productCode: '', productName: '', category: '', subcategory: '', unit: '',
            // produk baru (NEW_PRODUCT)
            newProductName: '', newCategory: '',
            // stock buffer
            currentBuffer: '', requestedBuffer: '',
            reason: '',
            website: ''   // honeypot
        };
    }
    let data = blank();

    /* ---------- Util ---------- */
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function normalize(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }
    function isConfigured() {
        const url = (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_APPS_SCRIPT_URL) || '';
        return /^https:\/\//i.test(url) && url.indexOf('YOUR_') === -1;
    }
    function typeMeta(value) {
        return REQUEST_TYPES.find((t) => t.value === value) || null;
    }
    function toInt(v) {
        const s = String(v == null ? '' : v).replace(/[^\d]/g, '');
        return s === '' ? null : parseInt(s, 10);
    }
    function fmtQty(n) { return n == null ? '–' : n.toLocaleString('id-ID') + ' Qty'; }
    function fmtDiff(n) { return n == null ? '–' : (n > 0 ? '+' : '') + n.toLocaleString('id-ID') + ' Qty'; }
    function catLabel(s) { return s ? MasterProduct.label(s) : ''; }
    function needsMaster() { return data.requestType === 'EXISTING_PRODUCT' || data.requestType === 'STOCK_BUFFER'; }

    function renderBrand() {
        const name = (typeof CONFIG !== 'undefined' && CONFIG.BRAND_NAME) || 'OUTLET 23';
        const logo = (typeof CONFIG !== 'undefined' && CONFIG.LOGO_URL) || '';
        document.querySelectorAll('[data-brand]').forEach((node) => {
            if (logo) {
                node.classList.add('has-logo');
                node.innerHTML = '<img src="' + esc(logo) + '" alt="' + esc(name) + '">';
            } else {
                node.textContent = name;
            }
        });
    }

    /* ---------- Penyimpanan lokal ---------- */
    function saveDraft() {
        try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step: step, data: data })); } catch (e) { /* abaikan */ }
    }
    function loadDraft() {
        try {
            const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
            if (!d || !d.data) return;
            const b = blank();
            Object.keys(b).forEach((k) => { if (typeof d.data[k] === 'string') b[k] = d.data[k]; });
            if (b.outlet && !findRegionByOutlet(b.outlet)) { b.outlet = ''; b.region = ''; }
            if (b.outlet) b.region = findRegionByOutlet(b.outlet);
            if (b.requestType && !typeMeta(b.requestType)) b.requestType = '';
            data = b;
            const s = Number(d.step);
            if (s >= 1 && s <= STEPS.length) step = s;
        } catch (e) { /* abaikan */ }
    }
    function clearDraft() {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* abaikan */ }
    }
    function remember() {
        try { localStorage.setItem(REMEMBER_KEY, JSON.stringify({ outlet: data.outlet, pic: data.pic })); } catch (e) { /* abaikan */ }
    }
    function applyRemembered() {
        try {
            const r = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
            if (!r) return;
            if (!data.outlet && r.outlet && findRegionByOutlet(r.outlet)) { data.outlet = r.outlet; data.region = findRegionByOutlet(r.outlet); }
            if (!data.pic && typeof r.pic === 'string') data.pic = r.pic.slice(0, PIC_MAX);
        } catch (e) { /* abaikan */ }
    }
    /* ?outlet=DTG%20JTG%20-%20MULAWARMAN atau ?outlet=MULAWARMAN */
    function applyUrlOutlet() {
        const q = (new URLSearchParams(location.search).get('outlet') || '').trim().toLowerCase();
        if (!q) return false;
        const all = getAllOutlets();
        const m = all.find((o) => o.toLowerCase() === q) || all.find((o) => shortOutletName(o).toLowerCase() === q);
        if (!m) return false;
        data.outlet = m;
        data.region = findRegionByOutlet(m);
        return true;
    }

    /* ---------- Riwayat request di perangkat ini ---------- */
    function getHistory() {
        try {
            const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            return Array.isArray(h) ? h.filter((x) => x && x.product && x.t) : [];
        } catch (e) { return []; }
    }
    function addHistory(b, res) {
        try {
            const h = [{
                id: (res && res.requestId) || '', type: b.requestType, product: b.productName,
                outlet: b.outlet, t: Date.now()
            }].concat(getHistory()).slice(0, HISTORY_MAX);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
        } catch (e) { /* abaikan */ }
    }
    function timeAgo(t) {
        const m = Math.round((Date.now() - t) / 60000);
        if (m < 1) return 'baru saja';
        if (m < 60) return m + ' menit lalu';
        const h = Math.round(m / 60);
        if (h < 24) return h + ' jam lalu';
        const d = Math.round(h / 24);
        return d + ' hari lalu';
    }

    /* =========================================================
       KOMPONEN
       ========================================================= */

    /* Card langkah: nomor + judul + pertanyaan */
    function stepCard(parent, num, title, question, extraClass) {
        const card = el('section', 'wz-card' + (extraClass ? ' ' + extraClass : ''));
        card.innerHTML =
            '<header class="wz-card-head">' +
                '<span class="wz-num" aria-hidden="true">' + esc(num) + '</span>' +
                '<div class="wz-card-titles">' +
                    '<h1 class="wz-card-title" id="stepTitle">' + esc(title) + '</h1>' +
                    (question ? '<p class="wz-card-q">' + esc(question) + '</p>' : '') +
                '</div>' +
            '</header>';
        const body = el('div', 'wz-card-body');
        card.appendChild(body);
        parent.appendChild(card);
        return body;
    }

    /* Field: label + hint + input + error (dipakai validate()) */
    function field(parent, id, label, hint, opts) {
        opts = opts || {};
        const lid = 'f_' + id + '_' + (++uid);
        const wrap = el('div', 'fx-field' + (opts.cls ? ' ' + opts.cls : ''));
        wrap.dataset.block = id;
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-labelledby', lid);
        wrap.innerHTML = '<div class="fx-label-row"><span class="fx-label" id="' + lid + '">' + esc(label) + '</span>' +
            (opts.optional ? '<span class="q-opt">Opsional</span>' : '') +
            (opts.readonly ? '<span class="q-opt q-opt-lock">' + ICON_LOCK + ' Otomatis</span>' : '') + '</div>' +
            (hint ? '<p class="fx-hint">' + esc(hint) + '</p>' : '');
        const body = el('div', 'fx-input');
        body.dataset.labelledby = lid;
        wrap.appendChild(body);
        const err = el('p', 'q-error');
        err.id = lid + '_err';
        err.setAttribute('aria-live', 'polite');
        wrap.appendChild(err);
        parent.appendChild(wrap);
        return body;
    }

    function textInputField(obj, key, placeholder, labelledby, onInput, opts) {
        opts = opts || {};
        const input = el('input', 'text-input');
        input.type = 'text';
        input.maxLength = opts.maxLength || 120;
        input.autocomplete = opts.autocomplete || 'off';
        input.placeholder = placeholder;
        input.value = obj[key];
        if (labelledby) input.setAttribute('aria-labelledby', labelledby);
        input.addEventListener('input', () => { obj[key] = input.value; onInput(); });
        return input;
    }

    function textareaField(obj, key, placeholder, labelledby, onInput) {
        const box = el('div', 'textarea-wrap');
        box.innerHTML = '<textarea class="text-area" rows="4" maxlength="' + TEXT_MAX + '" placeholder="' + esc(placeholder) + '"' +
                        (labelledby ? ' aria-labelledby="' + labelledby + '"' : '') + '></textarea>' +
                        '<div class="text-foot"><span class="char-count"></span></div>';
        const ta = box.querySelector('textarea');
        const count = box.querySelector('.char-count');
        ta.value = obj[key];
        const sync = () => { count.textContent = ta.value.length + ' / ' + TEXT_MAX; count.classList.toggle('is-max', ta.value.length >= TEXT_MAX); };
        ta.addEventListener('input', () => { obj[key] = ta.value; sync(); onInput(); });
        sync();
        return box;
    }

    /* Input angka (integer ≥ 0) dengan suffix Qty. Huruf, minus, desimal dibuang saat diketik. */
    function qtyField(obj, key, placeholder, labelledby, onInput) {
        const wrap = el('div', 'qty-wrap');
        wrap.innerHTML = '<input class="text-input qty-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="' + esc(placeholder) + '"' +
            (labelledby ? ' aria-labelledby="' + labelledby + '"' : '') + '><span class="qty-suffix" aria-hidden="true">Qty</span>';
        const input = wrap.querySelector('input');
        input.value = obj[key];
        input.addEventListener('input', () => {
            const clean = input.value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
            if (clean !== input.value) input.value = clean;
            obj[key] = clean;
            onInput();
        });
        input.addEventListener('keydown', (e) => {
            if (['-', '+', 'e', 'E', '.', ','].indexOf(e.key) !== -1) e.preventDefault();
        });
        return wrap;
    }

    /* Select biasa (native) untuk kategori produk baru */
    function selectField(obj, key, options, placeholder, labelledby, onInput) {
        const wrap = el('div', 'select-wrap');
        const sel = el('select', 'text-input select-input');
        if (labelledby) sel.setAttribute('aria-labelledby', labelledby);
        sel.innerHTML = '<option value="">' + esc(placeholder) + '</option>' +
            options.map((o) => '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>').join('');
        sel.value = obj[key];
        if (sel.value !== obj[key]) { obj[key] = ''; }
        sel.addEventListener('change', () => { obj[key] = sel.value; onInput(); });
        wrap.appendChild(sel);
        wrap.appendChild(el('span', 'select-chevron', ICON_CHEVRON));
        return wrap;
    }

    /* Field read-only (kategori otomatis) */
    function readonlyField(main, sub) {
        const box = el('div', 'ro-field' + (main ? '' : ' is-empty'));
        box.setAttribute('aria-readonly', 'true');
        box.innerHTML = main
            ? '<span class="ro-main">' + esc(main) + '</span>' + (sub ? '<span class="ro-sub">' + esc(sub) + '</span>' : '')
            : '<span class="ro-placeholder">Terisi otomatis setelah produk dipilih</span>';
        return box;
    }

    /* ---------- STEP 1: Outlet picker (daftar inline + search) ---------- */
    function outletPicker(target, onChange, labelledby) {
        const wrap = el('div', 'outlet-picker');
        const listId = 'outletList_' + (++uid);
        wrap.innerHTML =
            '<div class="search-box search-box-lg">' +
                '<span class="search-icon" aria-hidden="true">' + ICON_SEARCH + '</span>' +
                '<input type="search" placeholder="Cari nama outlet, misal: Gejayan" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Cari outlet" aria-controls="' + listId + '">' +
            '</div>' +
            '<div class="outlet-list" id="' + listId + '" role="listbox" aria-label="Daftar outlet"' + (labelledby ? ' aria-labelledby="' + labelledby + '"' : '') + '></div>' +
            '<div class="outlet-selected" hidden></div>';
        const input = wrap.querySelector('input');
        const list = wrap.querySelector('.outlet-list');
        const selected = wrap.querySelector('.outlet-selected');

        function drawSelected() {
            if (target.outlet) {
                selected.hidden = false;
                selected.innerHTML = '<span class="os-check">' + ICON_CHECK + '</span>' +
                    '<div class="os-text"><strong>' + esc(shortOutletName(target.outlet)) + '</strong>' +
                    '<span>Region ' + esc(regionLabel(target.region)) + ' &middot; ' + esc(target.outlet) + '</span></div>';
            } else {
                selected.hidden = true;
                selected.innerHTML = '';
            }
        }

        function drawList() {
            const terms = normalize(input.value).split(' ').filter(Boolean);
            let html = '';
            let found = 0;
            getRegions().forEach((region) => {
                const label = regionLabel(region);
                const items = OUTLET_DATA[region].filter((o) => {
                    if (!terms.length) return true;
                    const hay = normalize(o + ' ' + label + ' ' + region);
                    return terms.every((t) => hay.indexOf(t) !== -1);
                });
                if (!items.length) return;
                found += items.length;
                html += '<div class="ol-group" role="group" aria-label="' + esc(label) + '"><div class="ol-group-title">' + esc(label) + '<span>' + items.length + '</span></div>';
                items.forEach((o) => {
                    const sel = o === target.outlet;
                    html += '<button type="button" class="ol-option' + (sel ? ' is-selected' : '') + '" role="option" aria-selected="' + sel + '" data-outlet="' + esc(o) + '">' +
                            '<span>' + esc(shortOutletName(o)) + '</span>' +
                            '<span class="ol-check">' + ICON_CHECK + '</span></button>';
                });
                html += '</div>';
            });
            list.innerHTML = found ? html :
                '<div class="combo-empty"><strong>Outlet tidak ditemukan</strong><span>Coba ketik nama kota atau sebagian nama outlet.</span></div>';
        }

        function choose(outlet) {
            target.outlet = outlet;
            target.region = findRegionByOutlet(outlet);
            drawSelected();
            list.querySelectorAll('.ol-option').forEach((b) => {
                const on = b.dataset.outlet === outlet;
                b.classList.toggle('is-selected', on);
                b.setAttribute('aria-selected', String(on));
            });
            onChange();
        }

        input.addEventListener('input', drawList);
        input.addEventListener('keydown', (e) => {
            const options = list.querySelectorAll('.ol-option');
            if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); options[0].focus(); }
            else if (e.key === 'Enter' && options.length === 1) { e.preventDefault(); choose(options[0].dataset.outlet); }
        });
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('.ol-option');
            if (btn) choose(btn.dataset.outlet);
        });
        list.addEventListener('keydown', (e) => {
            const options = Array.from(list.querySelectorAll('.ol-option'));
            const i = options.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' && i < options.length - 1) { e.preventDefault(); options[i + 1].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? options[i - 1] : input).focus(); }
        });

        drawList();
        drawSelected();
        // gulir ke outlet terpilih (misal dari QR / remember)
        setTimeout(() => {
            const cur = list.querySelector('.ol-option.is-selected');
            if (cur) cur.scrollIntoView({ block: 'center' });
        }, 0);
        return wrap;
    }

    /* ---------- STEP 3: Kartu jenis request ---------- */
    function typeCards(target, onChange) {
        const grid = el('div', 'type-grid');
        grid.setAttribute('role', 'radiogroup');
        grid.setAttribute('aria-label', 'Jenis request');
        grid.innerHTML = REQUEST_TYPES.map((t) => {
            const on = target.requestType === t.value;
            return '<button type="button" class="type-card' + (on ? ' is-selected' : '') + '" role="radio" aria-checked="' + on + '" data-type="' + esc(t.value) + '">' +
                '<span class="tc-icon" aria-hidden="true">' + (TYPE_ICONS[t.icon] || '') + '</span>' +
                '<span class="tc-body">' +
                    '<span class="tc-title">' + esc(t.label) + '</span>' +
                    '<span class="tc-desc">' + esc(t.desc) + '</span>' +
                    '<span class="tc-badge">' + esc(t.badge) + '</span>' +
                '</span>' +
                '<span class="tc-arrow" aria-hidden="true">' + ICON_ARROW + '</span>' +
                '<span class="tc-check" aria-hidden="true">' + ICON_CHECK + '</span>' +
            '</button>';
        }).join('');

        function choose(v) {
            if (target.requestType !== v) {
                // ganti jenis → reset detail agar tidak ada field tersisa dari jenis lain
                target.requestType = v;
                resetDetail();
            }
            grid.querySelectorAll('.type-card').forEach((b) => {
                const on = b.dataset.type === v;
                b.classList.toggle('is-selected', on);
                b.setAttribute('aria-checked', String(on));
            });
            onChange();
        }
        grid.addEventListener('click', (e) => {
            const b = e.target.closest('.type-card');
            if (b) choose(b.dataset.type);
        });
        grid.addEventListener('keydown', (e) => {
            const cards = Array.from(grid.querySelectorAll('.type-card'));
            const i = cards.indexOf(document.activeElement);
            if (i === -1) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); const n = cards[(i + 1) % cards.length]; n.focus(); choose(n.dataset.type); }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); const n = cards[(i - 1 + cards.length) % cards.length]; n.focus(); choose(n.dataset.type); }
        });
        return grid;
    }

    function resetDetail() {
        ['productCode', 'productName', 'category', 'subcategory', 'unit', 'newProductName', 'newCategory', 'currentBuffer', 'requestedBuffer', 'reason'].forEach((k) => { data[k] = ''; });
    }

    /* ---------- STEP 4: Combobox produk dari master ---------- */
    function productField(target, onPick, labelledby, opts) {
        opts = opts || {};
        const wrap = el('div', 'combo combo-product');
        const listId = 'productList_' + (++uid);
        wrap.innerHTML =
            '<button type="button" class="combo-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + listId + '"' +
                (labelledby ? ' aria-labelledby="' + labelledby + ' ' + listId + '_val"' : '') + '>' +
                '<span class="combo-value" id="' + listId + '_val"></span>' +
                '<span class="combo-chevron">' + ICON_CHEVRON + '</span>' +
            '</button>' +
            '<div class="combo-panel" hidden>' +
                '<div class="search-box">' +
                    '<span class="search-icon" aria-hidden="true">' + ICON_SEARCH + '</span>' +
                    '<input type="search" placeholder="Cari nama produk, kode, atau kategori" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Cari produk">' +
                '</div>' +
                '<div class="combo-list combo-list-product" id="' + listId + '" role="listbox" aria-label="Daftar produk"></div>' +
                '<div class="combo-foot" hidden></div>' +
            '</div>';

        const trigger = wrap.querySelector('.combo-trigger');
        const value = wrap.querySelector('.combo-value');
        const panel = wrap.querySelector('.combo-panel');
        const input = wrap.querySelector('input');
        const list = wrap.querySelector('.combo-list');
        const foot = wrap.querySelector('.combo-foot');

        function skeleton() {
            trigger.disabled = true;
            trigger.classList.add('is-loading');
            value.classList.remove('is-placeholder');
            value.innerHTML = '<span class="skel skel-main"></span><span class="skel skel-sub"></span>';
        }
        function drawValue() {
            trigger.disabled = false;
            trigger.classList.remove('is-loading');
            if (target.productName) {
                value.classList.remove('is-placeholder');
                value.innerHTML = '<span class="combo-main">' + esc(target.productName) + '</span>' +
                    '<span class="combo-sub">' + esc([catLabel(target.subcategory), target.productCode, target.unit].filter(Boolean).join(' · ')) + '</span>';
            } else {
                value.classList.add('is-placeholder');
                value.textContent = 'Pilih produk dari master';
            }
        }

        function drawList() {
            const q = input.value;
            const results = MasterProduct.search(q, PRODUCT_RESULT_LIMIT);
            if (!results.length) {
                list.innerHTML = '<div class="combo-empty"><strong>Produk tidak ditemukan</strong>' +
                    '<span>Produk yang kamu cari belum ditemukan di master menu.</span>' +
                    (opts.allowNewProduct ? '<button type="button" class="btn-link-new" data-act="new">Ajukan sebagai Produk Baru ' + ICON_ARROW + '</button>' : '') +
                    '</div>';
                foot.hidden = true;
                return;
            }
            list.innerHTML = results.map((it) => {
                const sel = it.code ? it.code === target.productCode : it.name === target.productName;
                return '<button type="button" class="combo-option po' + (sel ? ' is-selected' : '') + '" role="option" aria-selected="' + sel + '" data-id="' + it.id + '">' +
                    '<span class="po-text"><span class="po-name">' + esc(it.name) + '</span>' +
                    '<span class="po-meta">' + esc([catLabel(it.subcategory), it.code || '—', it.unit].filter(Boolean).join(' · ')) + '</span></span>' +
                    (sel ? '<span class="combo-check">' + ICON_CHECK + '</span>' : '') + '</button>';
            }).join('');
            const total = MasterProduct.countMatches(q);
            if (total > results.length) {
                foot.hidden = false;
                foot.textContent = 'Menampilkan ' + results.length + ' dari ' + total.toLocaleString('id-ID') + ' produk. Ketik lebih spesifik untuk mempersempit.';
            } else {
                foot.hidden = false;
                foot.textContent = total + ' produk' + (q.trim() ? ' cocok' : ' di master');
            }
        }

        function open() {
            if (!MasterProduct.isReady()) return;
            panel.hidden = false;
            wrap.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            input.value = '';
            drawList();
            setTimeout(() => input.focus(), 30);
        }
        function close(focusTrigger) {
            panel.hidden = true;
            wrap.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            if (focusTrigger) trigger.focus();
        }
        function choose(it) {
            target.productCode = it.code;
            target.productName = it.name;
            target.category = it.category;
            target.subcategory = it.subcategory;
            target.unit = it.unit;
            drawValue();
            close(true);
            onPick(it);
        }

        trigger.addEventListener('click', () => (panel.hidden ? open() : close(false)));
        input.addEventListener('input', drawList);
        input.addEventListener('keydown', (e) => {
            const options = list.querySelectorAll('.combo-option');
            if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); options[0].focus(); }
            else if (e.key === 'Enter' && options.length === 1) { e.preventDefault(); choose(MasterProduct.all()[Number(options[0].dataset.id)]); }
            else if (e.key === 'Escape') { e.preventDefault(); close(true); }
        });
        list.addEventListener('click', (e) => {
            const nb = e.target.closest('[data-act="new"]');
            if (nb) { close(false); if (opts.onSuggestNew) opts.onSuggestNew(input.value); return; }
            const btn = e.target.closest('.combo-option');
            if (btn) choose(MasterProduct.all()[Number(btn.dataset.id)]);
        });
        list.addEventListener('keydown', (e) => {
            const options = Array.from(list.querySelectorAll('.combo-option'));
            const i = options.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' && i < options.length - 1) { e.preventDefault(); options[i + 1].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? options[i - 1] : input).focus(); }
            else if (e.key === 'Escape') { e.preventDefault(); close(true); }
        });
        document.addEventListener('click', (e) => {
            if (!panel.hidden && !wrap.contains(e.target)) close(false);
        });

        if (MasterProduct.isReady()) drawValue();
        else {
            skeleton();
            MasterProduct.load().then(() => {
                // validasi ulang produk yang tersimpan di draft
                if (target.productName) {
                    const it = (target.productCode && MasterProduct.find(target.productCode)) || MasterProduct.findByName(target.productName);
                    if (it) { target.category = it.category; target.subcategory = it.subcategory; target.unit = it.unit; target.productCode = it.code; target.productName = it.name; }
                    else { target.productCode = target.productName = target.category = target.subcategory = target.unit = ''; }
                }
                drawValue();
                onPick(null, true);
            }).catch(() => {
                trigger.disabled = false;
                trigger.classList.remove('is-loading');
                value.classList.add('is-placeholder');
                value.innerHTML = '<span class="combo-main combo-err">Master produk gagal dimuat</span><span class="combo-sub">Muat ulang halaman, lalu coba lagi.</span>';
            });
        }
        return wrap;
    }

    /* Blok konfirmasi ganti ke Produk Baru (dari empty state pencarian) */
    function suggestNewProduct(container, typedName) {
        let box = container.querySelector('.switch-confirm');
        if (box) box.remove();
        box = el('div', 'switch-confirm');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', 'Ubah jenis request');
        box.innerHTML = '<div class="sc-text"><strong>Ubah ke request Produk Baru?</strong>' +
            '<span>Jenis request akan diganti menjadi <b>Produk Baru</b>' + (typedName.trim() ? ' dengan nama “' + esc(typedName.trim()) + '”' : '') + '. Data produk yang sudah dipilih akan dikosongkan.</span></div>' +
            '<div class="sc-actions"><button type="button" class="btn btn-secondary btn-sm" data-act="cancel">Batal</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-act="ok">Ya, ubah ke Produk Baru</button></div>';
        box.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-act]');
            if (!b) return;
            if (b.dataset.act === 'ok') {
                data.requestType = 'NEW_PRODUCT';
                resetDetail();
                data.newProductName = typedName.trim().slice(0, 120);
                saveDraft();
                render();
            } else {
                box.remove();
            }
        });
        container.appendChild(box);
        box.querySelector('[data-act="ok"]').focus();
    }

    /* Perbandingan stock buffer */
    function bufferCompare(parent) {
        const box = el('div', 'buf-compare');
        box.setAttribute('aria-live', 'polite');
        parent.appendChild(box);
        function draw() {
            const cur = toInt(data.currentBuffer);
            const req = toInt(data.requestedBuffer);
            if (cur == null || req == null) { box.hidden = true; box.innerHTML = ''; return; }
            const diff = req - cur;
            const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
            box.hidden = false;
            box.className = 'buf-compare is-' + dir;
            box.innerHTML =
                '<div class="bc-col"><span class="bc-label">Stock Buffer Saat Ini</span><strong>' + esc(fmtQty(cur)) + '</strong></div>' +
                '<div class="bc-arrow" aria-hidden="true">' + ICON_ARROW + '</div>' +
                '<div class="bc-col"><span class="bc-label">Request Baru</span><strong>' + esc(fmtQty(req)) + '</strong></div>' +
                '<div class="bc-diff"><span class="bc-label">Perubahan</span><strong>' + esc(dir === 'same' ? 'Tidak berubah' : fmtDiff(diff)) + '</strong></div>';
        }
        draw();
        return draw;
    }

    /* =========================================================
       VALIDASI
       ========================================================= */
    function validate(rules, container, show) {
        let firstBad = null;
        rules.forEach((r) => {
            const blk = container.querySelector('[data-block="' + r.id + '"]');
            if (!blk) return;
            const ok = r.valid();
            const errEl = blk.querySelector('.q-error');
            if (show || ok) {
                blk.classList.toggle('has-error', !ok);
                errEl.innerHTML = ok ? '' : ICON_ALERT + '<span>' + esc(typeof r.msg === 'function' ? r.msg() : r.msg) + '</span>';
                blk.querySelectorAll('input, textarea, select, .combo-trigger, .outlet-list, .type-grid').forEach((inp) => {
                    if (ok) { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); }
                    else { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', errEl.id); }
                });
            }
            if (!ok && !firstBad) firstBad = blk;
        });
        return firstBad;
    }

    function scrollToBlock(blk) {
        const top = blk.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        const focusable = blk.querySelector('input:not([type="hidden"]), select, .combo-trigger, textarea, .type-card, .ol-option');
        if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 350);
        blk.classList.remove('shake');
        void blk.offsetWidth;
        blk.classList.add('shake');
    }

    function rulesFor(s) {
        const pic = () => data.pic.trim();
        switch (s) {
            case 1: return [{ id: 'outlet', valid: () => !!data.outlet && !!data.region, msg: 'Pilih outlet terlebih dahulu.' }];
            case 2: return [{
                id: 'pic',
                valid: () => pic().length >= PIC_MIN && pic().length <= PIC_MAX,
                msg: () => (pic().length ? (pic().length < PIC_MIN ? 'Nama PIC minimal ' + PIC_MIN + ' karakter.' : 'Nama PIC maksimal ' + PIC_MAX + ' karakter.') : 'Nama PIC wajib diisi.')
            }];
            case 3: return [{ id: 'requestType', valid: () => !!typeMeta(data.requestType), msg: 'Pilih jenis request.' }];
            case 4: {
                const r = [];
                if (data.requestType === 'NEW_PRODUCT') {
                    r.push({ id: 'newProductName', valid: () => data.newProductName.trim().length >= 2, msg: 'Nama produk wajib diisi.' });
                    r.push({ id: 'newCategory', valid: () => !!data.newCategory, msg: 'Pilih kategori produk.' });
                } else {
                    r.push({ id: 'product', valid: () => !!data.productName && (!!data.productCode || !!MasterProduct.findByName(data.productName)), msg: 'Pilih produk dari master menu.' });
                }
                if (data.requestType === 'STOCK_BUFFER') {
                    r.push({ id: 'currentBuffer', valid: () => toInt(data.currentBuffer) != null, msg: () => (data.currentBuffer === '' ? 'Isi stock buffer saat ini.' : 'Stock buffer harus berupa angka.') });
                    r.push({ id: 'requestedBuffer', valid: () => toInt(data.requestedBuffer) != null, msg: () => (data.requestedBuffer === '' ? 'Isi stock buffer yang di-request.' : 'Stock buffer harus berupa angka.') });
                }
                r.push({ id: 'reason', valid: () => data.reason.trim().length >= 3, msg: 'Alasan request wajib diisi.' });
                return r;
            }
            default: return [];
        }
    }

    function stepValid(s) { return rulesFor(s).every((r) => r.valid()); }

    function onChange() {
        saveDraft();
        validate(rulesFor(step), els.area, els.area.dataset.touched === '1');
    }

    /* =========================================================
       RENDER LANGKAH
       ========================================================= */
    function renderStepper() {
        const pct = Math.round(((step - 1) / (STEPS.length - 1)) * 100);
        const cur = STEPS[step - 1];
        els.stepper.innerHTML =
            '<ol class="stp-track">' + STEPS.map((s) => {
                const state = s.n < step ? 'done' : s.n === step ? 'active' : 'todo';
                return '<li class="stp-item is-' + state + '"' + (s.n === step ? ' aria-current="step"' : '') + '>' +
                    '<span class="stp-dot">' + (state === 'done' ? ICON_CHECK : '<span>' + String(s.n).padStart(2, '0') + '</span>') + '</span>' +
                    '<span class="stp-label">' + esc(s.label) + '</span></li>';
            }).join('') + '</ol>' +
            '<div class="stp-mobile">' +
                '<div class="stp-meta"><span class="stp-count">Langkah ' + step + ' dari ' + STEPS.length + '</span>' +
                '<span class="stp-name">' + esc(stepTitleOf(step)) + '</span></div>' +
                '<div class="progress-bar" role="progressbar" aria-valuemin="1" aria-valuemax="' + STEPS.length + '" aria-valuenow="' + step + '" aria-label="Langkah ' + step + ' dari ' + STEPS.length + '">' +
                '<div class="progress-fill" style="width:' + Math.max(pct, 6) + '%"></div></div>' +
            '</div>';
    }
    function stepTitleOf(s) {
        return ['Pilih Outlet', 'Data Pengaju', 'Jenis Request', 'Detail Request', 'Review Request'][s - 1] || '';
    }

    function renderNav() {
        const last = step === STEPS.length;
        els.back.hidden = step === 1;
        els.back.innerHTML = last ? '<span aria-hidden="true">←</span> Edit' : '<span aria-hidden="true">←</span> Kembali';
        els.next.className = 'btn btn-primary' + (step === 1 ? ' is-only' : '');
        if (last) els.next.innerHTML = '<span class="btn-ico" aria-hidden="true">' + ICON_CHECK + '</span> Kirim Request';
        else if (step === 3) els.next.innerHTML = 'Lanjut ke Detail <span aria-hidden="true">→</span>';
        else if (step === 4) els.next.innerHTML = 'Review Request <span aria-hidden="true">→</span>';
        else els.next.innerHTML = 'Lanjut <span aria-hidden="true">→</span>';
        // langkah 3: tombol muncul aktif setelah kartu dipilih
        els.next.disabled = step === 3 && !data.requestType;
    }

    function render() {
        els.area.innerHTML = '';
        els.area.dataset.touched = '';
        hideError();
        renderStepper();
        renderNav();
        const c = el('div', 'wz-step ' + (direction === 'back' ? 'enter-back' : 'enter-next'));
        els.area.appendChild(c);
        ({ 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4, 5: renderStep5 })[step](c);

        // Honeypot anti-bot (tidak terlihat pengguna)
        const hp = el('div', 'hp-field');
        hp.setAttribute('aria-hidden', 'true');
        hp.innerHTML = '<label>Website <input type="text" tabindex="-1" autocomplete="off"></label>';
        hp.querySelector('input').addEventListener('input', (e) => { data.website = e.target.value; });
        c.appendChild(hp);
        saveDraft();
    }

    /* STEP 1 — Outlet */
    function renderStep1(c) {
        const body = stepCard(c, '01', 'Pilih Outlet', 'Outlet mana yang mengajukan request?');
        const f = field(body, 'outlet', 'Outlet', '', { cls: 'fx-field-bare' });
        f.appendChild(outletPicker(data, onChange, f.dataset.labelledby));
    }

    /* STEP 2 — PIC */
    function renderStep2(c) {
        const body = stepCard(c, '02', 'Data Pengaju', 'Siapa yang mengajukan request ini?');
        const ctx = el('div', 'wz-context');
        ctx.innerHTML = '<span class="wz-ctx-label">Outlet</span><strong>' + esc(shortOutletName(data.outlet)) + '</strong><span class="wz-ctx-sub">Region ' + esc(regionLabel(data.region)) + '</span>' +
            '<button type="button" class="wz-ctx-edit" data-goto="1">Ganti</button>';
        body.appendChild(ctx);
        const f = field(body, 'pic', 'Nama / PIC', 'Masukkan nama PIC yang dapat dihubungi jika Tim Forecasting membutuhkan informasi tambahan.');
        const input = textInputField(data, 'pic', 'Masukkan nama PIC', f.dataset.labelledby, onChange, { maxLength: PIC_MAX, autocomplete: 'name' });
        input.classList.add('text-input-lg');
        f.appendChild(input);
        setTimeout(() => { if (!data.pic) input.focus({ preventScroll: true }); }, 250);
    }

    /* STEP 3 — Jenis request */
    function renderStep3(c) {
        const body = stepCard(c, '03', 'Jenis Request', 'Jenis request apa yang ingin diajukan?');
        const f = field(body, 'requestType', 'Jenis request', '', { cls: 'fx-field-bare' });
        f.appendChild(typeCards(data, () => { onChange(); renderNav(); }));
    }

    /* STEP 4 — Detail (conditional per jenis) */
    function renderStep4(c) {
        const t = typeMeta(data.requestType);
        if (!t) { goTo(3); return; }
        const body = stepCard(c, '04', 'Detail Request ' + t.label, null, 'wz-card-detail');
        const chip = el('div', 'wz-typechip', '<span class="tc-icon sm" aria-hidden="true">' + (TYPE_ICONS[t.icon] || '') + '</span><span>' + esc(t.label) + '</span><em>' + esc(t.badge) + '</em>' +
            '<button type="button" class="wz-ctx-edit" data-goto="3">Ganti jenis</button>');
        body.appendChild(chip);
        const grid = el('div', 'wz-detail-grid');
        body.appendChild(grid);

        if (data.requestType === 'NEW_PRODUCT') {
            const fName = field(grid, 'newProductName', 'Nama Produk Baru', '', { cls: 'span-2' });
            fName.appendChild(textInputField(data, 'newProductName', 'Contoh: Absolut Raspberry 700ML', fName.dataset.labelledby, onChange, { maxLength: 120 }));

            const fCat = field(grid, 'newCategory', 'Kategori', 'Pilih kategori yang paling mendekati.', { cls: 'span-2' });
            const catOpts = () => {
                const subs = MasterProduct.isReady() ? MasterProduct.subcategories() : PRODUCT_CATEGORIES.map((x) => x.value.toUpperCase());
                const list = subs.map((s) => ({ value: s, label: catLabel(s) }));
                if (!subs.some((s) => s === 'LAINNYA')) list.push({ value: 'LAINNYA', label: 'Lainnya' });
                return list;
            };
            const drawCat = () => { fCat.innerHTML = ''; fCat.appendChild(selectField(data, 'newCategory', catOpts(), 'Pilih kategori', fCat.dataset.labelledby, onChange)); };
            drawCat();
            if (!MasterProduct.isReady()) MasterProduct.load().then(drawCat).catch(() => {});

            const fReason = field(grid, 'reason', 'Alasan Request', 'Contoh: permintaan customer, kebutuhan promo, produk kompetitor, kebutuhan outlet, atau permintaan dari area.', { cls: 'span-2' });
            fReason.appendChild(textareaField(data, 'reason', 'Jelaskan alasan produk ini perlu ditambahkan.', fReason.dataset.labelledby, onChange));
            return;
        }

        // EXISTING_PRODUCT & STOCK_BUFFER: produk dari master
        const fProd = field(grid, 'product', 'Nama Produk', 'Cari berdasarkan nama, kode produk, atau kategori.', { cls: 'span-2' });
        const fCat = field(grid, 'category', 'Kategori', '', { cls: 'span-2', readonly: true });
        const drawCat = () => {
            fCat.innerHTML = '';
            fCat.appendChild(readonlyField(catLabel(data.subcategory), data.category ? catLabel(data.category) + (data.unit ? ' · ' + data.unit : '') : ''));
        };
        fProd.appendChild(productField(data, (it, silent) => { drawCat(); if (!silent) onChange(); else saveDraft(); }, fProd.dataset.labelledby, {
            allowNewProduct: true,
            onSuggestNew: (typed) => suggestNewProduct(fProd, typed)
        }));
        drawCat();

        if (data.requestType === 'STOCK_BUFFER') {
            const fCur = field(grid, 'currentBuffer', 'Stock Buffer Saat Ini', '');
            const fReq = field(grid, 'requestedBuffer', 'Stock Buffer yang Di-request', '');
            const cmpWrap = el('div', 'span-2');
            grid.appendChild(cmpWrap);
            const redrawCmp = bufferCompare(cmpWrap);
            const onQty = () => { redrawCmp(); onChange(); };
            fCur.appendChild(qtyField(data, 'currentBuffer', 'Contoh: 10', fCur.dataset.labelledby, onQty));
            fReq.appendChild(qtyField(data, 'requestedBuffer', 'Contoh: 20', fReq.dataset.labelledby, onQty));
            const fReason = field(grid, 'reason', 'Alasan Perubahan Stock Buffer', '', { cls: 'span-2' });
            fReason.appendChild(textareaField(data, 'reason', 'Jelaskan alasan perubahan stock buffer.', fReason.dataset.labelledby, onChange));
        } else {
            const fReason = field(grid, 'reason', 'Alasan Request', '', { cls: 'span-2' });
            fReason.appendChild(textareaField(data, 'reason', 'Jelaskan alasan request produk ini.', fReason.dataset.labelledby, onChange));
        }
    }

    /* STEP 5 — Review */
    function renderStep5(c) {
        const t = typeMeta(data.requestType) || { label: '–' };
        const body = stepCard(c, '05', 'Review Request', 'Pastikan data sudah benar sebelum dikirim.');
        const sec = (title, gotoStep, rows) =>
            '<section class="rv-section"><header class="rv-head"><h2>' + esc(title) + '</h2>' +
            '<button type="button" class="wz-ctx-edit" data-goto="' + gotoStep + '">Edit</button></header>' +
            '<dl class="rv-list">' + rows.filter((r) => r).map((r) =>
                '<div class="rv-row' + (r[2] ? ' ' + r[2] : '') + '"><dt>' + esc(r[0]) + '</dt><dd>' + (r[3] ? r[1] : esc(r[1])) + '</dd></div>').join('') + '</dl></section>';

        let detail;
        if (data.requestType === 'NEW_PRODUCT') {
            detail = [['Produk', data.newProductName.trim()], ['Kategori', catLabel(data.newCategory)]];
        } else {
            detail = [['Produk', data.productName], ['Kode Produk', data.productCode || '—'], ['Kategori', catLabel(data.subcategory) + (data.category ? ' · ' + catLabel(data.category) : '')], ['Unit', data.unit || '—']];
            if (data.requestType === 'STOCK_BUFFER') {
                const cur = toInt(data.currentBuffer), req = toInt(data.requestedBuffer);
                const diff = cur != null && req != null ? req - cur : null;
                detail.push(['Stock Saat Ini', fmtQty(cur)], ['Request Baru', fmtQty(req)],
                    ['Perubahan', diff == null ? '–' : diff === 0 ? 'Tidak berubah' : fmtDiff(diff), diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : '']);
            }
        }
        detail.push(['Alasan', '<q>' + esc(data.reason.trim()) + '</q>', 'rv-reason', true]);

        body.innerHTML =
            sec('Informasi Pengaju', 1, [['Outlet', shortOutletName(data.outlet)], ['Region', regionLabel(data.region)], ['PIC', data.pic.trim()]]) +
            sec('Jenis Request', 3, [['Jenis', t.label]]) +
            sec('Detail', 4, detail);
        // tombol Edit "Informasi Pengaju" → langkah 1 (outlet) ; PIC di langkah 2 bisa lewat Lanjut
    }

    /* =========================================================
       NAVIGASI
       ========================================================= */
    function goTo(s, dir) {
        direction = dir || (s > step ? 'next' : 'back');
        step = Math.min(Math.max(1, s), STEPS.length);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function next() {
        if (submitting) return;
        els.area.dataset.touched = '1';
        const bad = validate(rulesFor(step), els.area, true);
        if (bad) { scrollToBlock(bad); return; }
        if (step === 2) remember();
        if (step === STEPS.length) { submit(); return; }
        // pastikan langkah sebelumnya valid (mis. draft lama)
        goTo(step + 1, 'next');
    }
    function back() {
        if (submitting) return;
        goTo(step - 1, 'back');
    }

    /* Klik "Edit / Ganti" di dalam konten */
    els.area.addEventListener('click', (e) => {
        const b = e.target.closest('[data-goto]');
        if (b) goTo(Number(b.dataset.goto));
    });
    els.area.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const t = e.target;
        if (t.matches('input.text-input, input.qty-input')) { e.preventDefault(); next(); }
    });

    /* =========================================================
       SUBMIT
       ========================================================= */
    function showError(detail) {
        els.errorDetail.textContent = detail || '';
        els.errorDetail.hidden = !detail;
        els.error.hidden = false;
    }
    function hideError() { els.error.hidden = true; }

    function setBusy(on) {
        submitting = on;
        els.next.disabled = on;
        els.back.disabled = on;
        els.next.setAttribute('aria-busy', String(on));
        if (on) els.next.innerHTML = '<span class="spinner" aria-hidden="true"></span> Mengirim...';
        else renderNav();
    }

    /* Payload → Apps Script. Nama field konsisten dengan Code.gs. */
    function payload() {
        const isNew = data.requestType === 'NEW_PRODUCT';
        const isBuf = data.requestType === 'STOCK_BUFFER';
        const cur = isBuf ? toInt(data.currentBuffer) : null;
        const req = isBuf ? toInt(data.requestedBuffer) : null;
        return {
            requestType: data.requestType,
            region: data.region,
            outlet: data.outlet,
            pic: data.pic.trim(),
            productName: isNew ? data.newProductName.trim() : data.productName,
            productCode: isNew ? '' : data.productCode,
            category: isNew ? '' : data.category,
            subcategory: isNew ? data.newCategory : data.subcategory,
            unit: isNew ? '' : data.unit,
            newProductName: isNew ? data.newProductName.trim() : '',
            currentBufferQty: cur,
            requestedBufferQty: req,
            bufferDifference: cur != null && req != null ? req - cur : null,
            reason: data.reason.trim(),
            website: data.website
        };
    }

    async function submit() {
        if (submitting) return;
        // validasi seluruh langkah (bukan hanya review)
        for (let s = 1; s <= 4; s++) {
            if (!stepValid(s)) { goTo(s); els.area.dataset.touched = '1'; const bad = validate(rulesFor(s), els.area, true); if (bad) scrollToBlock(bad); return; }
        }
        hideError();
        setBusy(true);
        const body = payload();
        try {
            if (!isConfigured()) throw new Error('URL Google Apps Script belum diatur di config.js.');
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            let res;
            try {
                res = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(body),
                    redirect: 'follow',
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timer);
            }
            let json;
            try { json = await res.json(); } catch (e) { throw new Error('Respons server tidak valid.'); }
            if (!json || json.success !== true) throw new Error((json && json.message) || 'Data ditolak oleh server.');

            lastSent = body;
            lastResult = json;
            remember();
            addHistory(body, json);
            clearDraft();
            setBusy(false);
            showThanks();
        } catch (err) {
            console.error('[Request] Gagal kirim:', err);
            setBusy(false);
            showError(err && err.name === 'AbortError' ? 'Koneksi terlalu lama. Cek internet, lalu coba lagi.'
                : (err && err.message && err.message !== 'Failed to fetch' && err.message !== 'Load failed' ? err.message : 'Cek koneksi internet, lalu coba lagi.'));
        }
    }

    /* =========================================================
       LAYAR
       ========================================================= */
    function show(name) {
        els.form.classList.toggle('is-active', name === 'form');
        els.thanks.classList.toggle('is-active', name === 'thanks');
        document.body.dataset.screen = name;
        window.scrollTo(0, 0);
    }

    function showThanks() {
        const b = lastSent;
        const r = lastResult || {};
        els.thanksLead.textContent = 'Request dari ' + shortOutletName(b.outlet) + ' sudah diterima oleh Tim Forecasting.';
        const items = [];
        if (r.requestId) items.push(['Request ID', r.requestId, 'is-id']);
        if (r.timestamp) items.push(['Waktu', r.timestamp]);
        items.push(['Outlet', shortOutletName(b.outlet)], ['Jenis Request', requestTypeLabel(b.requestType)], ['Produk', b.productName]);
        if (b.requestType === 'STOCK_BUFFER') items.push(['Stock Buffer', fmtQty(b.currentBufferQty) + ' → ' + fmtQty(b.requestedBufferQty) + ' (' + fmtDiff(b.bufferDifference) + ')']);
        items.push(['PIC', b.pic]);
        els.thanksSummary.innerHTML = items.map((it) => '<div' + (it[2] ? ' class="' + it[2] + '"' : '') + '><dt>' + esc(it[0]) + '</dt><dd>' + esc(it[1]) + '</dd></div>').join('');

        const hist = getHistory().slice(1);
        if (hist.length) {
            els.thanksHistory.hidden = false;
            els.thanksHistory.innerHTML = '<h2 class="rh-title">Request sebelumnya dari perangkat ini</h2><ul class="rh-list">' +
                hist.map((h) => '<li><span class="rh-product">' + esc(h.product) + '</span><span class="rh-meta">' +
                    esc([requestTypeLabel(h.type), shortOutletName(h.outlet), timeAgo(h.t)].join(' · ')) + '</span></li>').join('') + '</ul>';
        } else {
            els.thanksHistory.hidden = true;
        }
        show('thanks');
    }

    function startNew(keepIdentity) {
        const keep = keepIdentity ? { outlet: data.outlet || (lastSent && lastSent.outlet) || '', pic: data.pic || (lastSent && lastSent.pic) || '' } : null;
        data = blank();
        if (keep) {
            data.outlet = keep.outlet;
            data.region = keep.outlet ? findRegionByOutlet(keep.outlet) : '';
            data.pic = keep.pic;
        }
        clearDraft();
        hideError();
        // outlet & PIC sudah diingat → langsung ke pilih jenis request
        step = keep && keep.outlet && keep.pic ? 3 : keep && keep.outlet ? 2 : 1;
        direction = 'next';
        render();
        show('form');
    }

    /* Pastikan input aktif tidak tertutup keyboard mobile */
    document.addEventListener('focusin', (e) => {
        const t = e.target;
        if (window.innerWidth >= 760 || !t.matches('input[type="text"], input[type="search"], textarea, select')) return;
        setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    });

    els.next.addEventListener('click', next);
    els.back.addEventListener('click', back);
    els.retry.addEventListener('click', submit);
    els.again.addEventListener('click', () => startNew(true));
    els.done.addEventListener('click', () => { lastSent = null; lastResult = null; startNew(true); });

    /* ---------- Init ---------- */
    renderBrand();
    loadDraft();
    const fromUrl = applyUrlOutlet();
    applyRemembered();
    if (fromUrl && step === 1) step = 2;          // QR outlet → user tinggal isi PIC
    if (step > 1 && !stepValid(1)) step = 1;      // jaga-jaga draft rusak
    if (step > 3 && !stepValid(3)) step = 3;
    render();
    // Prefetch master produk di latar belakang agar dropdown langsung siap
    MasterProduct.load().catch(() => {});
})();
