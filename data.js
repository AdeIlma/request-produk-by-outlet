/* =========================================================
   DATA MASTER — Request Produk Outlet → Tim Forecasting
   Daftar outlet SAMA dengan website Customer Feedback.
   Jika ada outlet baru, update di kedua website (data.js).
   ========================================================= */

const OUTLET_DATA = {
    "REGION JOGJA": [
        "DTG JOG - GEJAYAN", "DTG JOG - TIMOHO", "DTG JOG - PAKEM", "DTG JOG - PALAGAN",
        "DTG JOG - BABARSARI", "DTG JOG - KALASAN", "DTG JOG - JL. MAGELANG", "DTG JOG - MAGUWOHARJO",
        "DTG JOG - TEGALREJO", "DTG JOG - J23", "DTG JOG - PRAWIROTAMAN", "DTG JOG - PREMIUM GEJAYAN",
        "DTG JOG - DENGGUNG", "DTG JOG - GODEAN", "DTG JOG - QUEEN BAR", "DTG JOG - CANDI GEBANG",
        "DTG JOG - SEYEGAN", "DTG JOG - JL. KALIURANG", "DTG JOG - KRANGGAN/TUGU", "DTG JOG - GAMPING ONLINE",
        "DTG JOG - MONJALI", "DTG JOG - TAMSIS ONLINE", "DTG JOG - DTG STORE", "DTG JOG - PARANGTRITIS",
        "DTG JOG - BANTUL UTARA", "DTG JOG - KASIHAN", "DTG JOG - TAMANAN", "DTG JOG - WONOSARI",
        "DTG JOG - SEMANU", "DTG JOG - JL. KABUPATEN ONLINE", "DTG JOG - GANJURAN ONLINE", "DTG JOG - PLAYEN ONLINE",
        "DTG JOG - JL. WONOSARI", "DTG JOG - PIYUNGAN ONLINE", "DTG JOG - WATES", "DTG JOG - SENTOLO",
        "DTG JOG - TEMON", "DTG JOG - PAINGAN ONLINE", "DTG JOG - MAGELANG", "DTG JOG - MUNTILAN",
        "DTG JOG - BOROBUDUR", "DTG JOG - WONOSOBO", "DTG JOG - TEMANGGUNG", "DTG JOG - PURWOKERTO BANYUMAS RAYA",
        "DTG JOG - CILACAP BANYUMAS RAYA", "DTG JOG - PURBALINGGA BANYUMAS RAYA", "DTG JOG - KEBUMEN BANYUMAS RAYA",
        "DTG JOG - BANJARNEGARA BANYUMAS RAYA", "DTG JOG - BATURADEN BANYUMAS RAYA", "DTG JOG - BRALING BANYUMAS RAYA",
        "DTG JOG - KLATEN", "DTG JOG - WONOGIRI", "DTG JOG - FAJAR INDAH", "DTG JOG - SRAGEN", "DTG JOG - PRACIMANTORO"
    ],
    "REGION JATENG": [
        "DTG JTG - MULAWARMAN", "DTG JTG - PEDURUNGAN", "DTG JTG - BSB", "DTG JTG - SEMARANG BARAT",
        "DTG JTG - SRIWIJAYA", "DTG JTG - BANDUNGAN", "DTG JTG - KEDUNG MUNDU", "DTG JTG - ANJASMORO",
        "DTG JTG - HARBOUR", "DTG JTG - SAMPANGAN", "DTG JTG - UNGARAN", "DTG JTG - KALIWUNGU",
        "DTG JTG - TUGU MUDA", "DTG JTG - SIMPANG LIMA", "DTG JTG - PONCOL", "DTG JTG - PATTIMURA",
        "DTG JTG - PUDAK PAYUNG", "DTG JTG - KOPENG", "DTG JTG - SALATIGA", "DTG JTG - TERAS BOYOLALI",
        "DTG JTG - BOYOLALI", "DTG JTG - PEMALANG", "DTG JTG - PEKALONGAN", "DTG JTG - PEMALANG KOTA",
        "DTG JTG - WELERI", "DTG JTG - TEGAL", "DTG JTG - JEPARA", "DTG JTG - REMBANG",
        "DTG JTG - PURWODADI", "DTG JTG - PATI", "DTG JTG - CEPU", "DTG JTG - BLORA"
    ],
    "REGION JATIM": [
        "DTG JTM - BOJONEGORO", "DTG JTM - NGAGEL", "DTG JTM - KAPAS KRAMPUNG", "DTG JTM - BUKIT PALMA",
        "DTG JTM - KREMBANGAN", "DTG JTM - DIPONEGORO", "DTG JTM - TENGGILIS", "DTG JTM - DARMO",
        "DTG JTM - MOJOSARI", "DTG JTM - SIDOARJO", "DTG JTM - MOJOKERTO", "DTG JTM - BATU MALANG",
        "DTG JTM - MALANG KOTA", "DTG JTM - TUMPANG MALANG", "DTG JTM - BLITAR", "DTG JTM - TULUNGAGUNG",
        "DTG JTM - KEDIRI", "DTG JTM - WLINGI", "DTG JTM - NGAWI", "DTG JTM - MADIUN",
        "DTG JTM - PONOROGO", "DTG JTM - NGANJUK", "DTG JTM - PROBOLINGGO", "DTG JTM - LUMAJANG",
        "DTG JTM - KAHURIPAN", "DTG JTM - WIYUNG", "DTG JTM - RUNGKUT", "DTG JTM - LAMONGAN",
        "DTG JTM - KENJERAN", "DTG JTM - HIDDEN BAR", "DTG JTM - JEMBER"
    ],
    "REGION BALI": [
        "DTG BLI - LEGIAN", "DTG BLI - RENON", "DTG BLI - SESETAN", "DTG BLI - MARLBORO",
        "DTG BLI - DALUNG", "DTG BLI - AYANI UTARA", "DTG BLI - GATSU TIMUR", "DTG BLI - PETITENGET",
        "DTG BLI - CANGGU", "DTG BLI - GWK", "DTG BLI - SEMINYAK", "DTG BLI - TABANAN"
    ],
    "REGION JAKARTA": [
        "DTG JKT - KEMANG", "DTG JKT - KELAPA GADING", "DTG JKT - TEBET"
    ]
};

/* Label pendek region untuk tampilan & chart */
const REGION_LABELS = {
    "REGION JOGJA": "Jogja",
    "REGION JATENG": "Jateng",
    "REGION JATIM": "Jatim",
    "REGION BALI": "Bali",
    "REGION JAKARTA": "Jakarta"
};

const PRODUCT_CATEGORIES = [
    { value: "Beer" },
    { value: "Vodka" },
    { value: "Whisky" },
    { value: "Tequila" },
    { value: "Gin" },
    { value: "Wine" },
    { value: "Cocktail / Mix" },
    { value: "Non Alcohol" },
    { value: "Lainnya" }
];

/* ---------- Helper bersama ---------- */
function getRegions() {
    return Object.keys(OUTLET_DATA);
}

function getAllOutlets() {
    return getRegions().reduce(function (all, r) { return all.concat(OUTLET_DATA[r]); }, []);
}

function findRegionByOutlet(outlet) {
    var regions = getRegions();
    for (var i = 0; i < regions.length; i++) {
        if (OUTLET_DATA[regions[i]].indexOf(outlet) !== -1) return regions[i];
    }
    return "";
}

function regionLabel(region) {
    return REGION_LABELS[region] || String(region || "").replace(/^REGION\s+/i, "");
}

/* "DTG JTG - MULAWARMAN" → "MULAWARMAN" */
function shortOutletName(outlet) {
    return String(outlet || "").replace(/^DTG\s+[A-Z]+\s*-\s*/i, "");
}


/* =========================================================
   JENIS REQUEST — value yang sama dipakai frontend, Apps Script,
   dan dashboard. JANGAN diubah tanpa mengubah Code.gs.
   ========================================================= */
const REQUEST_TYPES = [
    {
        value: "NEW_PRODUCT",
        label: "Produk Baru",
        badge: "Belum ada di sistem",
        desc: "Produk belum tersedia di sistem dan ingin diajukan untuk ditambahkan.",
        icon: "plus"
    },
    {
        value: "EXISTING_PRODUCT",
        label: "Produk Existing",
        badge: "Sudah ada di sistem",
        desc: "Produk sudah tersedia di sistem, tetapi membutuhkan request atau perubahan tertentu.",
        icon: "package"
    },
    {
        value: "STOCK_BUFFER",
        label: "Stock Buffer",
        badge: "Perubahan stock",
        desc: "Ajukan perubahan jumlah stock buffer untuk produk yang sudah tersedia.",
        icon: "box"
    }
];

function requestTypeLabel(value) {
    var v = String(value || "").toUpperCase();
    for (var i = 0; i < REQUEST_TYPES.length; i++) {
        if (REQUEST_TYPES[i].value === v) return REQUEST_TYPES[i].label;
    }
    return v ? v : "Request Produk";   // baris lama (sebelum ada jenis request)
}

/* =========================================================
   MASTER PRODUCT — single source of truth: master-product.js
   (di-generate dari Master Product.xlsx oleh tools/build_master_product.py).
   Dimuat asynchronous agar halaman utama tetap ringan.
   ========================================================= */
const MasterProduct = (function () {
    var items = null;          // [{category, subcategory, code, name, unit, _hay}]
    var byCode = {};
    var loading = null;
    var listeners = [];
    var meta = {};

    function norm(s) {
        return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    }

    function receive(raw) {
        var rows = (raw && raw.rows) || [];
        meta = { generatedAt: raw && raw.generatedAt, source: raw && raw.source, count: rows.length };
        items = rows.map(function (r, i) {
            var it = { id: i, category: r[0] || "", subcategory: r[1] || "", code: r[2] || "", name: r[3] || "", unit: r[4] || "" };
            it._hay = norm(it.name + " " + it.code + " " + it.subcategory + " " + it.category);
            it._name = norm(it.name);
            return it;
        });
        byCode = {};
        items.forEach(function (it) { if (it.code) byCode[it.code] = it; });
        var ls = listeners; listeners = [];
        ls.forEach(function (fn) { try { fn(items); } catch (e) { /* abaikan */ } });
    }

    /* Muat master-product.js sekali; mengembalikan Promise<items>. */
    function load() {
        if (items) return Promise.resolve(items);
        if (loading) return loading;
        loading = new Promise(function (resolve, reject) {
            listeners.push(resolve);
            if (window.MASTER_PRODUCT_DATA) { receive(window.MASTER_PRODUCT_DATA); return; }
            var s = document.createElement("script");
            s.src = (typeof CONFIG !== "undefined" && CONFIG.MASTER_PRODUCT_URL) || "master-product.js";
            s.async = true;
            s.onload = function () { if (!items) receive(window.MASTER_PRODUCT_DATA || { rows: [] }); };
            s.onerror = function () { loading = null; listeners = []; reject(new Error("Master product gagal dimuat.")); };
            document.head.appendChild(s);
        });
        return loading;
    }

    function isReady() { return !!items; }
    function all() { return items || []; }
    function find(code) { return byCode[code] || null; }
    function findByName(name) {
        var n = norm(name);
        if (!n || !items) return null;
        for (var i = 0; i < items.length; i++) if (items[i]._name === n) return items[i];
        return null;
    }

    /* Cari di name, code, category, subcategory. Nama produk yang cocok di awal diprioritaskan. */
    function search(query, limit) {
        if (!items) return [];
        var terms = norm(query).split(" ").filter(Boolean);
        var max = limit || 60;
        if (!terms.length) return items.slice(0, max);
        // Peringkat: 0 = semua kata ada di nama & nama diawali kata pertama,
        //            1 = semua kata ada di nama, 2 = cocok lewat kode/kategori
        var r0 = [], r1 = [], r2 = [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var ok = true, inName = true;
            for (var t = 0; t < terms.length; t++) {
                if (it._hay.indexOf(terms[t]) === -1) { ok = false; break; }
                if (it._name.indexOf(terms[t]) === -1) inName = false;
            }
            if (!ok) continue;
            if (inName && it._name.indexOf(terms[0]) === 0) r0.push(it);
            else if (inName) r1.push(it);
            else r2.push(it);
            if (r0.length >= max) break;
        }
        return r0.concat(r1, r2).slice(0, max);
    }

    function countMatches(query) {
        if (!items) return 0;
        var terms = norm(query).split(" ").filter(Boolean);
        if (!terms.length) return items.length;
        var n = 0;
        for (var i = 0; i < items.length; i++) {
            var ok = true;
            for (var t = 0; t < terms.length; t++) { if (items[i]._hay.indexOf(terms[t]) === -1) { ok = false; break; } }
            if (ok) n++;
        }
        return n;
    }

    /* Daftar subkategori (jenis produk: VODKA, WINE, ...) dari master — dipakai form Produk Baru & dashboard. */
    function subcategories() {
        var m = {};
        all().forEach(function (it) { if (it.subcategory) m[it.subcategory] = (m[it.subcategory] || 0) + 1; });
        return Object.keys(m).sort(function (a, b) { return m[b] - m[a] || a.localeCompare(b); });
    }
    function categories() {
        var m = {};
        all().forEach(function (it) { if (it.category) m[it.category] = 1; });
        return Object.keys(m).sort();
    }

    /* Label kategori untuk tampilan: "WHISKY/EY" → "Whisky/EY", "NON ALCOHOL" → "Non Alcohol" */
    function label(s) {
        return String(s || "").toLowerCase().replace(/(^|[\s\/\-])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); })
            .replace(/\/Ey\b/, "/EY").replace(/\bRtd\b/g, "RTD").replace(/\bTshirt\b/, "T-Shirt");
    }

    return { load: load, isReady: isReady, all: all, find: find, findByName: findByName, search: search, countMatches: countMatches,
             subcategories: subcategories, categories: categories, label: label, meta: function () { return meta; }, _receive: receive };
})();
