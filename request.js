/* =========================================================
   OUTLET 23 — REQUEST PRODUK OUTLET → TIM FORECASTING
   Form internal untuk staff outlet. Tanpa WhatsApp.
   Outlet & nama PIC diingat di perangkat (localStorage) agar
   request berikutnya lebih cepat. QR: ?outlet=NAMA_OUTLET
   ========================================================= */
(function () {
    'use strict';

    const TEXT_MAX = 500;
    const REQUEST_TIMEOUT_MS = 20000;
    const DRAFT_KEY = 'o23_outlet_req_draft_v1';
    const REMEMBER_KEY = 'o23_outlet_req_remember_v1';
    const HISTORY_KEY = 'o23_outlet_req_history_v1';
    const HISTORY_MAX = 5;
    const REQUIRED_MSG = 'Pilih salah satu dulu untuk melanjutkan.';

    const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
    const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
    const ICON_CHEVRON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    const ICON_ALERT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>';

    const $ = (sel) => document.querySelector(sel);
    const els = {
        form: $('#screenForm'),
        thanks: $('#screenThanks'),
        area: $('#formArea'),
        submit: $('#btnSubmit'),
        reset: $('#btnReset'),
        error: $('#errorBanner'),
        errorText: $('#errorText'),
        errorDetail: $('#errorDetail'),
        retry: $('#btnRetry'),
        thanksLead: $('#thanksLead'),
        thanksSummary: $('#thanksSummary'),
        again: $('#btnAgain'),
        done: $('#btnDone')
    };

    let uid = 0;
    let submitting = false;
    let lastSent = null;

    function blank() {
        return { outlet: '', region: '', pic: '', productRequest: '', productCategory: '', requestNote: '', website: '' };
    }
    let data = blank();

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


    function sectionHeader(parent, kicker, title, desc) {
        const h = el('div', 'section-head');
        h.innerHTML = (kicker ? '<div class="rule rule-left"><span>' + esc(kicker) + '</span></div>' : '') +
                      '<h2 class="section-title">' + esc(title) + '</h2>' +
                      (desc ? '<p class="section-desc">' + esc(desc) + '</p>' : '');
        parent.appendChild(h);
    }


    function outletField(target, onChange, labelledby) {
        const wrap = el('div', 'combo');
        const listId = 'outletList_' + (++uid);
        wrap.innerHTML =
            '<button type="button" class="combo-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + listId + '"' +
                (labelledby ? ' aria-labelledby="' + labelledby + ' ' + listId + '_val"' : '') + '>' +
                '<span class="combo-value" id="' + listId + '_val"></span>' +
                '<span class="combo-chevron">' + ICON_CHEVRON + '</span>' +
            '</button>' +
            '<div class="combo-panel" hidden>' +
                '<div class="search-box">' +
                    '<span class="search-icon" aria-hidden="true">' + ICON_SEARCH + '</span>' +
                    '<input type="search" placeholder="Ketik nama outlet, misal: Gejayan" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Cari outlet">' +
                '</div>' +
                '<div class="combo-list" id="' + listId + '" role="listbox" aria-label="Daftar outlet"></div>' +
            '</div>';

        const trigger = wrap.querySelector('.combo-trigger');
        const value = wrap.querySelector('.combo-value');
        const panel = wrap.querySelector('.combo-panel');
        const input = wrap.querySelector('input');
        const list = wrap.querySelector('.combo-list');

        function drawValue() {
            if (target.outlet) {
                value.classList.remove('is-placeholder');
                value.innerHTML = '<span class="combo-main">' + esc(shortOutletName(target.outlet)) + '</span>' +
                                  '<span class="combo-sub">' + esc(regionLabel(target.region)) + ' &middot; ' + esc(target.outlet) + '</span>';
            } else {
                value.classList.add('is-placeholder');
                value.textContent = 'Pilih outlet';
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
                html += '<div class="combo-group" role="group" aria-label="' + esc(label) + '"><div class="combo-group-title">' + esc(label) + '</div>';
                items.forEach((o) => {
                    const sel = o === target.outlet;
                    html += '<button type="button" class="combo-option' + (sel ? ' is-selected' : '') + '" role="option" aria-selected="' + sel + '" data-outlet="' + esc(o) + '">' +
                            '<span>' + esc(shortOutletName(o)) + '</span>' +
                            (sel ? '<span class="combo-check">' + ICON_CHECK + '</span>' : '') + '</button>';
                });
                html += '</div>';
            });
            list.innerHTML = found ? html :
                '<div class="combo-empty"><strong>Outlet tidak ditemukan</strong><span>Coba ketik nama kota atau sebagian nama outlet.</span></div>';
        }

        function open() {
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
        function choose(outlet) {
            target.outlet = outlet;
            target.region = findRegionByOutlet(outlet);
            drawValue();
            close(true);
            onChange();
        }

        trigger.addEventListener('click', () => (panel.hidden ? open() : close(false)));
        input.addEventListener('input', drawList);
        input.addEventListener('keydown', (e) => {
            const options = list.querySelectorAll('.combo-option');
            if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); options[0].focus(); }
            else if (e.key === 'Enter' && options.length === 1) { e.preventDefault(); choose(options[0].dataset.outlet); }
            else if (e.key === 'Escape') { e.preventDefault(); close(true); }
        });
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('.combo-option');
            if (btn) choose(btn.dataset.outlet);
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

        drawValue();
        return wrap;
    }

    function choiceGroup(opts) {
        const order = opts.options.map((o) => o.value);
        const name = 'c_' + opts.key + '_' + (++uid);
        const group = el('div', 'opt-grid');
        group.setAttribute('role', opts.multi ? 'group' : 'radiogroup');
        group.innerHTML = opts.options.map((o) =>
            '<label class="opt' + (opts.multi ? ' is-multi' : '') + '">' +
                '<input type="' + (opts.multi ? 'checkbox' : 'radio') + '" name="' + name + '" value="' + esc(o.value) + '">' +
                '<span class="opt-indicator" aria-hidden="true">' + ICON_CHECK + '</span>' +
                '<span class="opt-label">' + esc(o.label || o.value) + '</span>' +
            '</label>').join('');

        const isOn = (v) => (opts.multi ? opts.obj[opts.key].indexOf(v) !== -1 : opts.obj[opts.key] === v);
        function refresh() {
            group.querySelectorAll('input').forEach((inp) => {
                const on = isOn(inp.value);
                inp.checked = on;
                inp.parentElement.classList.toggle('is-selected', on);
            });
        }

        group.addEventListener('change', (e) => {
            const inp = e.target;
            if (!inp.matches('input')) return;
            const v = inp.value;
            if (opts.multi) {
                let list = opts.obj[opts.key].filter((x) => x !== v);
                if (inp.checked) {
                    if (opts.exclusive) list = v === opts.exclusive ? [] : list.filter((x) => x !== opts.exclusive);
                    list.push(v);
                }
                list.sort((a, b) => order.indexOf(a) - order.indexOf(b));
                opts.obj[opts.key] = list;
            } else {
                opts.obj[opts.key] = v;
            }
            refresh();
            if (opts.onChange) opts.onChange(v);
        });

        refresh();
        return group;
    }

    function textInputField(obj, key, placeholder, labelledby, onChange) {
        const input = el('input', 'text-input');
        input.type = 'text';
        input.maxLength = 120;
        input.autocomplete = 'off';
        input.placeholder = placeholder;
        input.value = obj[key];
        if (labelledby) input.setAttribute('aria-labelledby', labelledby);
        input.addEventListener('input', () => { obj[key] = input.value; onChange(); });
        return input;
    }

    function textareaField(obj, key, placeholder, labelledby, onChange) {
        const box = el('div', 'textarea-wrap');
        box.innerHTML = '<textarea class="text-area" rows="5" maxlength="' + TEXT_MAX + '" placeholder="' + esc(placeholder) + '"' +
                        (labelledby ? ' aria-labelledby="' + labelledby + '"' : '') + '></textarea>' +
                        '<div class="text-foot"><span class="char-count"></span></div>';
        const ta = box.querySelector('textarea');
        const count = box.querySelector('.char-count');
        ta.value = obj[key];
        const sync = () => { count.textContent = ta.value.length + ' / ' + TEXT_MAX; };
        ta.addEventListener('input', () => { obj[key] = ta.value; sync(); onChange(); });
        sync();
        return box;
    }

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
                blk.querySelectorAll('input, textarea, .combo-trigger').forEach((inp) => {
                    if (ok) { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); }
                    else { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', errEl.id); }
                });
            }
            if (!ok && !firstBad) firstBad = blk;
        });
        return firstBad;
    }

    function scrollToBlock(blk) {
        const top = blk.getBoundingClientRect().top + window.scrollY - 92;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        const focusable = blk.querySelector('input:not([type="hidden"]), .combo-trigger, textarea');
        if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 350);
    }

    /* ---------- Penyimpanan lokal ---------- */
    function saveDraft() {
        try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) { /* abaikan */ }
    }
    function loadDraft() {
        try {
            const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
            if (!d) return;
            const b = blank();
            Object.keys(b).forEach((k) => { if (typeof d[k] === 'string') b[k] = d[k]; });
            if (b.outlet && !findRegionByOutlet(b.outlet)) { b.outlet = ''; b.region = ''; }
            if (b.outlet) b.region = findRegionByOutlet(b.outlet);
            data = b;
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
            if (!data.pic && typeof r.pic === 'string') data.pic = r.pic.slice(0, 60);
        } catch (e) { /* abaikan */ }
    }
    function applyUrlOutlet() {
        const q = (new URLSearchParams(location.search).get('outlet') || '').trim().toLowerCase();
        if (!q) return;
        const all = getAllOutlets();
        const m = all.find((o) => o.toLowerCase() === q) || all.find((o) => shortOutletName(o).toLowerCase() === q);
        if (m) { data.outlet = m; data.region = findRegionByOutlet(m); }
    }

    /* ---------- Riwayat request di perangkat ini ---------- */
    function getHistory() {
        try {
            const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            return Array.isArray(h) ? h.filter((x) => x && x.product && x.t) : [];
        } catch (e) { return []; }
    }
    function addHistory(b) {
        try {
            const h = [{ product: b.productRequest, category: b.productCategory, outlet: b.outlet, t: Date.now() }].concat(getHistory()).slice(0, HISTORY_MAX);
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

    /* ---------- Komponen form ---------- */
    function onChange() {
        saveDraft();
        validate(rules(), els.area, els.area.dataset.touched === '1');
    }

    /* Grup berisi beberapa field (satu card) */
    function group(parent, step, title, desc) {
        const card = el('section', 'fx-card');
        card.innerHTML = '<header class="fx-card-head"><span class="fx-step" aria-hidden="true">' + step + '</span>' +
            '<div><h2 class="fx-card-title">' + esc(title) + '</h2>' + (desc ? '<p class="fx-card-desc">' + esc(desc) + '</p>' : '') + '</div></header>';
        const body = el('div', 'fx-card-body');
        card.appendChild(body);
        parent.appendChild(card);
        return body;
    }

    /* Satu field: label + hint + input + pesan error (dipakai validate()) */
    function field(parent, id, label, hint, optional) {
        const lid = 'f_' + id + '_' + (++uid);
        const wrap = el('div', 'fx-field');
        wrap.dataset.block = id;
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-labelledby', lid);
        wrap.innerHTML = '<div class="fx-label-row"><span class="fx-label" id="' + lid + '">' + esc(label) + '</span>' +
            (optional ? '<span class="q-opt">Opsional</span>' : '') + '</div>' +
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

    function renderAside(aside) {
        const hist = getHistory();
        aside.innerHTML =
            '<div class="aside-card">' +
                '<h3 class="aside-title">Tips request yang jelas</h3>' +
                '<ul class="aside-tips">' +
                    '<li>Tulis <strong>merek, varian, dan ukuran</strong>. Contoh: Baileys Original 750 ml.</li>' +
                    '<li>Satu request untuk satu produk.</li>' +
                    '<li>Ceritakan alasannya, misalnya seberapa sering customer menanyakan.</li>' +
                '</ul>' +
            '</div>' +
            '<div class="aside-card">' +
                '<h3 class="aside-title">Request terakhir dari perangkat ini</h3>' +
                (hist.length
                    ? '<ul class="aside-history">' + hist.map((h) =>
                        '<li><span class="ah-product">' + esc(h.product) + '</span>' +
                        '<span class="ah-meta">' + esc(shortOutletName(h.outlet)) + ' · ' + esc(timeAgo(h.t)) + '</span></li>').join('') + '</ul>'
                    : '<p class="aside-empty">Belum ada request yang dikirim dari perangkat ini.</p>') +
            '</div>';
    }

    function render() {
        els.area.innerHTML = '';
        els.area.dataset.touched = '';
        const c = el('div', 'question enter-next');
        els.area.appendChild(c);
        sectionHeader(c, 'Internal · Tim Forecasting', 'Request produk',
            'Laporkan produk yang sering dicari atau diminta customer di outlet kamu. Tim forecasting akan meninjau setiap request.');

        const layout = el('div', 'req-layout');
        const main = el('div', 'req-main-col');
        const aside = el('aside', 'req-aside');
        aside.setAttribute('aria-label', 'Informasi');
        layout.appendChild(main);
        layout.appendChild(aside);
        c.appendChild(layout);

        // 1 — Pengaju
        const g1 = group(main, '1', 'Dari outlet', 'Outlet dan nama pengaju diingat untuk request berikutnya.');
        const row = el('div', 'fx-row');
        g1.appendChild(row);
        const fOutlet = field(row, 'outlet', 'Outlet', '');
        fOutlet.appendChild(outletField(data, onChange, fOutlet.dataset.labelledby));
        const fPic = field(row, 'pic', 'Nama PIC / pengaju', '');
        const pic = textInputField(data, 'pic', 'Contoh: Rina (Supervisor)', fPic.dataset.labelledby, onChange);
        pic.maxLength = 60;
        pic.autocomplete = 'name';
        fPic.appendChild(pic);

        // 2 — Produk
        const g2 = group(main, '2', 'Produk yang diminta', '');
        const fProd = field(g2, 'productRequest', 'Nama produk', 'Merek, varian, dan ukuran');
        fProd.appendChild(textInputField(data, 'productRequest', 'Contoh: Baileys Original 750 ml', fProd.dataset.labelledby, onChange));
        const fCat = field(g2, 'productCategory', 'Kategori', '');
        const cats = choiceGroup({ options: PRODUCT_CATEGORIES, obj: data, key: 'productCategory', onChange: onChange });
        cats.classList.add('opt-grid-cats');
        fCat.appendChild(cats);
        const fNote = field(g2, 'requestNote', 'Alasan / detail request', '', true);
        fNote.appendChild(textareaField(data, 'requestNote', 'Contoh: Sering ditanyakan customer sejak event minggu lalu, sekitar 5–6 orang per hari.', fNote.dataset.labelledby, saveDraft));

        renderAside(aside);

        // Honeypot anti-bot (tidak terlihat oleh pengguna)
        const hp = el('div', 'hp-field');
        hp.setAttribute('aria-hidden', 'true');
        hp.innerHTML = '<label>Website <input type="text" tabindex="-1" autocomplete="off"></label>';
        hp.querySelector('input').addEventListener('input', (e) => { data.website = e.target.value; });
        c.appendChild(hp);
    }

    function rules() {
        return [
            { id: 'outlet', valid: () => !!data.outlet && !!data.region, msg: 'Pilih outlet dulu.' },
            { id: 'pic', valid: () => data.pic.trim().length >= 2, msg: 'Tulis nama PIC / pengaju.' },
            { id: 'productRequest', valid: () => data.productRequest.trim().length >= 2, msg: 'Tulis nama produk yang diminta.' },
            { id: 'productCategory', valid: () => !!data.productCategory, msg: REQUIRED_MSG }
        ];
    }

    /* ---------- Submit ---------- */
    function showError(detail) {
        els.errorDetail.textContent = detail || '';
        els.errorDetail.hidden = !detail;
        els.error.hidden = false;
    }
    function hideError() { els.error.hidden = true; }

    function setBusy(on) {
        submitting = on;
        els.submit.disabled = on;
        els.reset.disabled = on;
        els.submit.setAttribute('aria-busy', String(on));
        els.submit.innerHTML = on ? '<span class="spinner" aria-hidden="true"></span> Kirim Request...' : 'Kirim Request';
    }

    function payload() {
        return {
            region: data.region,
            outlet: data.outlet,
            pic: data.pic.trim(),
            productRequest: data.productRequest.trim(),
            productCategory: data.productCategory,
            requestNote: data.requestNote.trim(),
            website: data.website
        };
    }

    async function submit() {
        if (submitting) return;
        els.area.dataset.touched = '1';
        const bad = validate(rules(), els.area, true);
        if (bad) { scrollToBlock(bad); return; }

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
            remember();
            addHistory(body);
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

    /* ---------- Layar ---------- */
    function show(name) {
        els.form.classList.toggle('is-active', name === 'form');
        els.thanks.classList.toggle('is-active', name === 'thanks');
        document.body.dataset.screen = name;
        window.scrollTo(0, 0);
    }

    function showThanks() {
        const b = lastSent;
        els.thanksLead.textContent = 'Request dari ' + shortOutletName(b.outlet) + ' sudah diterima tim forecasting.';
        const items = [
            ['Produk', b.productRequest],
            ['Kategori', b.productCategory],
            ['Outlet', b.outlet],
            ['PIC', b.pic]
        ];
        els.thanksSummary.innerHTML = items.map((it) => '<div><dt>' + esc(it[0]) + '</dt><dd>' + esc(it[1]) + '</dd></div>').join('');
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
        render();
        show('form');
    }

    /* Pastikan input aktif tidak tertutup keyboard mobile */
    document.addEventListener('focusin', (e) => {
        const t = e.target;
        if (window.innerWidth >= 760 || !t.matches('input[type="text"], input[type="search"], textarea')) return;
        setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    });

    els.submit.addEventListener('click', submit);
    els.retry.addEventListener('click', submit);
    els.reset.addEventListener('click', () => startNew(true));
    els.again.addEventListener('click', () => startNew(true));
    els.done.addEventListener('click', () => { lastSent = null; startNew(true); });

    /* ---------- Init ---------- */
    renderBrand();
    loadDraft();
    applyUrlOutlet();
    applyRemembered();
    render();
})();
