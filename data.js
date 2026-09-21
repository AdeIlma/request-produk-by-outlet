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

