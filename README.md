# Request Produk Outlet → Tim Forecasting (OUTLET 23) — v2

Website internal untuk staff outlet mengirim request ke tim forecasting, plus dashboard rekap untuk tim forecasting. **Tanpa WhatsApp.**

```
Staff outlet  →  index.html (wizard 5 langkah)  →  Apps Script  →  Sheet OUTLET_REQUEST
Tim forecast  →  dashboard.html (login)          →  Apps Script  →  Sheet OUTLET_REQUEST
```

Website ini **terpisah** dari Customer Feedback: repo GitHub, Google Spreadsheet, dan Apps Script sendiri.

## Struktur

```
outlet-request/
├── index.html            Form request (wizard: Outlet → PIC → Jenis → Detail → Review → Kirim)
├── request.js            Logika wizard, validasi, draft, submit
├── dashboard.html        Dashboard tim forecasting (login)
├── dashboard.js          Rekap per produk + semua request + filter jenis request + export CSV
├── auth.js               Login & sesi (token)
├── data.js               Daftar outlet, jenis request (REQUEST_TYPES), loader master produk (MasterProduct)
├── master-product.js     MASTER PRODUK — di-generate, jangan edit manual (single source of truth)
├── config.js             URL Apps Script (tanpa password)
├── style.css             Design system OUTLET 23 (+ section "REQUEST WIZARD v2")
├── assets/logo-outlet23.png
├── appsscript/Code.gs    Backend (Apps Script)
└── tools/
    ├── build_master_product.py   Generator master-product.js dari Excel
    └── Master Product.xlsx       Sumber master produk (versi terakhir yang dipakai)
```

## Flow form (index.html)

| Langkah | Isi | Validasi |
|---|---|---|
| 01 Pilih Outlet | Search + daftar outlet per region (data `data.js`). QR `?outlet=DTG%20JTG%20-%20MULAWARMAN` atau `?outlet=MULAWARMAN` → outlet langsung terpilih, user masuk ke langkah 02. | Outlet wajib dipilih |
| 02 Data Pengaju | Nama / PIC (prefill dari localStorage). | Wajib, 2–100 karakter |
| 03 Jenis Request | 3 kartu: **Produk Baru** (`NEW_PRODUCT`), **Produk Existing** (`EXISTING_PRODUCT`), **Stock Buffer** (`STOCK_BUFFER`). | Wajib pilih satu |
| 04 Detail | Field mengikuti jenis (conditional rendering), lihat tabel di bawah. | Per field |
| 05 Review | Ringkasan pengaju + jenis + detail, tombol **Edit** per bagian, lalu **Kirim Request**. | Semua langkah divalidasi ulang sebelum kirim |
| Terkirim | Request ID (`REQ-YYYYMMDD-001`), waktu, outlet, jenis, produk; tombol **Buat Request Lain** / **Selesai**; riwayat request dari perangkat ini. | – |

Field per jenis request:

| Jenis | Field yang tampil |
|---|---|
| Produk Baru | Nama Produk Baru (teks) · Kategori (dropdown dari subkategori master + Lainnya) · Alasan Request |
| Produk Existing | Nama Produk (**combobox master**, search nama/kode/kategori) · Kategori (otomatis, read-only) · Alasan Request |
| Stock Buffer | Nama Produk (combobox master) · Kategori (otomatis) · Stock Buffer Saat Ini · Stock Buffer yang Di-request · Perbandingan otomatis (±Qty) · Alasan Perubahan |

Empty state pencarian produk menawarkan **Ajukan sebagai Produk Baru →** dengan konfirmasi (jenis request tidak berubah otomatis).

Draft (data + langkah) disimpan di `sessionStorage`, jadi refresh tidak menghilangkan isian. Outlet & PIC diingat di `localStorage`.

## Master Product (single source of truth)

`master-product.js` di-generate dari `Master Product.xlsx` (kolom `Category | Subcategory | Product Code | Product Name | Unit`) dan dimuat asynchronous oleh `data.js` (`MasterProduct.load()`), dengan skeleton/loading state di combobox.

**Update master produk:**

```bash
pip install openpyxl          # sekali
python tools/build_master_product.py "Master Product.xlsx"
# → menimpa master-product.js, lalu commit & push
```

Script menampilkan jumlah produk, kategori, subkategori, nama duplikat, dan baris yang dilewati. Nama produk yang sama dengan kode berbeda tetap ditampilkan keduanya (kode & unit jadi pembeda di dropdown).

Istilah di master:
- **Category** (`ALCOHOL CLASS C`, `MERCHANDISE`, …) → disimpan di sheet sebagai **Master Category**.
- **Subcategory** (`VODKA`, `WINE`, `WHISKY/EY`, …) → inilah "kategori" yang dilihat user dan disimpan di kolom **Product Category** (kompatibel dengan data v1 yang berisi `Vodka`, `Wine`, dst.).

## Payload ke Apps Script (v2)

```json
{
  "requestType": "STOCK_BUFFER",            // NEW_PRODUCT | EXISTING_PRODUCT | STOCK_BUFFER
  "outlet": "DTG JTG - MULAWARMAN",
  "region": "REGION JATENG",
  "pic": "Ade Ilma",
  "productName": "ABSOLUT VODKA 750ML",     // produk baru: nama yang diketik
  "productCode": "A-SPVD-0034",             // "" untuk produk baru
  "category": "ALCOHOL CLASS C",            // master Category, "" untuk produk baru
  "subcategory": "VODKA",                   // master Subcategory / kategori pilihan user (produk baru)
  "unit": "BTL @750 ML",                    // "" untuk produk baru
  "newProductName": "",                     // hanya NEW_PRODUCT
  "currentBufferQty": 10,                   // hanya STOCK_BUFFER (integer ≥ 0), selain itu null
  "requestedBufferQty": 20,
  "bufferDifference": 10,
  "reason": "Permintaan outlet meningkat dan stock sering habis.",
  "website": ""                             // honeypot, harus kosong
}
```

Respons: `{ "success": true, "requestId": "REQ-20260922-001", "timestamp": "2026-09-22 10:00:00" }`.
Payload v1 (`productRequest`, `productCategory`, `requestNote`) **masih diterima** (Request Type kosong).

## Sheet `OUTLET_REQUEST`

Kolom v1 tidak diubah; kolom v2 ditambahkan di kanan (backward-compatible, data lama tidak disentuh):

```
Timestamp | Region | Outlet | PIC | Product Request | Product Category | Request Note | Status
| Request ID | Request Type | Product Code | Master Category | Unit | New Product Name
| Current Buffer Qty | Requested Buffer Qty | Buffer Difference
```

- `Product Request` = nama produk (master atau produk baru), `Product Category` = subkategori/jenis, `Request Note` = alasan.
- `Request Type` kosong = request lama (v1); dashboard menampilkannya sebagai "Request Produk".
- **Status** tetap dropdown (Baru, Ditinjau, Disetujui, Ditolak, Sudah tersedia) diubah tim forecasting di sheet.

## Dashboard (dashboard.html)

- Filter: tanggal, region, outlet, **jenis request** (Semua / Produk Baru / Produk Existing / Stock Buffer / Request lama), kategori (gabungan nilai di data, tanpa beda huruf besar/kecil), status.
- Ringkasan: total request + breakdown per jenis, 7 hari terakhir, outlet pengaju, produk teratas.
- **Rekap per Produk**: digabung per Product Code (fallback: nama produk), kolom jenis request, klik baris → daftar request produk itu.
- **Semua Request**: Tanggal · Outlet · PIC · Jenis (+ Request ID) · Produk (kategori · kode · unit) · Detail (`10 → 20 Qty (+10)` / Produk baru / catatan) · Status.
- Pencarian (nama, kode, kategori, jenis, Request ID, outlet, PIC, catatan), pagination, Export CSV (kolom v2 ikut).

## Setup / update

Setup baru — sama seperti sebelumnya:

1. Buat **Google Spreadsheet baru**. **Extensions → Apps Script** → tempel `appsscript/Code.gs` → Save.
2. Jalankan fungsi **`setup`** sekali, izinkan akses. Reload spreadsheet → menu **OUTLET 23 Forecasting**.
3. Menu **Set Password Super Admin**; akun tim di sheet `TEAM_USERS` (`Username | Password | Name | Active`).
4. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → copy URL `/exec` ke `config.js`.
5. Upload folder ke repo GitHub → GitHub Pages.

**Update dari v1 ke v2 (spreadsheet yang sudah ada):**

1. Ganti isi `Code.gs` dengan versi baru → Save.
2. Jalankan menu **OUTLET 23 Forecasting → Setup / Cek Sheet** sekali (menambah 9 kolom v2 di kanan; data lama tetap).
3. **Deploy → Manage deployments → Edit → New version**.
4. Push file website yang baru.

## Testing

1. `index.html?outlet=DTG%20JTG%20-%20MULAWARMAN` → langsung langkah 02 dengan outlet Mulawarman / Jateng.
2. Kirim satu request untuk tiap jenis (Produk Baru, Produk Existing, Stock Buffer); cek baris di sheet & Request ID di halaman sukses.
3. Validasi: Lanjut tanpa outlet / PIC kosong / jenis belum dipilih / produk belum dipilih / qty huruf / alasan kosong → error muncul di dekat field.
4. Pencarian produk: `absol`, kode `A-SPVD`, kategori `vodka`; kata tanpa hasil → empty state + tombol Ajukan sebagai Produk Baru (harus konfirmasi).
5. Refresh di tengah pengisian → data & langkah tetap.
6. Dashboard: filter Jenis Request, kolom Detail, request lama tetap tampil, Export CSV.
7. Buka di HP (≤ 400px): single column, tombol full-width, dropdown produk cukup tinggi.

## Keamanan

- Tidak ada password di website maupun `config.js`.
- Password Super Admin: hash di Script Properties. Password `TEAM_USERS`: hash (salted SHA-256, 1.500 iterasi).
- Sesi: token 6 jam di CacheService; 5x login gagal → username dikunci 10 menit.
- Form memakai honeypot sederhana. Form tetap bisa diakses siapa pun yang punya link, jadi bagikan link hanya ke staff outlet.
