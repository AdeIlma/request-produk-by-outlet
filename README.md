# Request Produk Outlet → Tim Forecasting (OUTLET 23)

Website internal untuk staff outlet mengirim request produk ke tim forecasting, plus dashboard rekap untuk tim forecasting. Tampilan dan komponen sama dengan website Customer Feedback OUTLET 23, **tanpa WhatsApp**.

```
Staff outlet  →  index.html      →  Apps Script  →  Sheet OUTLET_REQUEST
Tim forecast  →  dashboard.html  →  Apps Script (login)  →  Sheet OUTLET_REQUEST
```

Website ini **terpisah** dari Customer Feedback: repo GitHub, Google Spreadsheet, dan Apps Script sendiri.

## Struktur

```
outlet-request/
├── index.html      Form request (staff outlet)
├── request.js      Logika form
├── dashboard.html  Dashboard tim forecasting (login)
├── dashboard.js    Rekap per produk + semua request + export CSV
├── auth.js         Login & sesi (token)
├── data.js         Daftar outlet & kategori produk
├── config.js       URL Apps Script (tanpa password)
├── style.css       Design system OUTLET 23
├── assets/logo-outlet23.png
└── appsscript/Code.gs
```

## Form request (index.html)

| Field | Wajib | Keterangan |
|---|---|---|
| Outlet | ✓ | Pencarian outlet; bisa di-prefill QR `?outlet=KEMANG` |
| Nama PIC / pengaju | ✓ | Staff yang mengajukan |
| Nama / produk yang diinginkan | ✓ | Merek, varian, ukuran |
| Kategori | ✓ | Beer, Vodka, Whisky, Tequila, Gin, Wine, Cocktail / Mix, Non Alcohol, Lainnya |
| Alasan / detail | – | Teks bebas |

Outlet dan nama PIC diingat di perangkat, jadi request berikutnya lebih cepat. Setelah terkirim ada tombol **Buat Request Lain**.

## Sheet `OUTLET_REQUEST`

```
Timestamp | Region | Outlet | PIC | Product Request | Product Category | Request Note | Status
```

Kolom **Status** berupa dropdown (Baru, Ditinjau, Disetujui, Ditolak, Sudah tersedia) dan diubah tim forecasting langsung di sheet. Dashboard ikut menampilkan dan memfilter status.

## Dashboard (dashboard.html)

- Filter: tanggal, region, outlet, kategori, status.
- Ringkasan: total request, 7 hari terakhir, jumlah outlet pengaju, produk teratas.
- **Rekap per Produk**: produk digabung (tanpa beda huruf besar/kecil), jumlah request, jumlah outlet, tanggal terakhir. Klik baris → lihat detail request produk itu.
- **Semua Request**: tanggal, outlet, PIC, produk, catatan, status.
- Pencarian, pagination, Export CSV (sesuai tab dan filter).

## Setup

1. Buat **Google Spreadsheet baru** (misal `Request Produk Outlet`).
2. **Extensions → Apps Script** → tempel `appsscript/Code.gs` → **Save**.
3. Jalankan fungsi **`setup`** sekali, izinkan akses. Reload spreadsheet → muncul menu **OUTLET 23 Forecasting**.
4. Menu **Set Password Super Admin** (username default `admin`, password min. 8 karakter, disimpan sebagai hash di Script Properties).
5. Akun tim forecasting: isi sheet `TEAM_USERS` (`Username | Password | Name | Active`). Password yang diketik otomatis diubah jadi hash `sha256$…`; set `Active = TRUE`.
6. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → copy URL `/exec`.
7. Isi URL di `config.js` (hanya URL, jangan ada password).
8. Upload folder ke **repo GitHub baru** → aktifkan GitHub Pages (atau Netlify).
9. Test: kirim request dari `index.html`, lalu login di `dashboard.html`.

Setiap kali `Code.gs` diubah: **Deploy → Manage deployments → Edit → New version**.

## QR per outlet

`https://<domain>/outlet-request/?outlet=DTG%20JKT%20-%20KEMANG` atau `?outlet=KEMANG`.

## Menambah outlet

Edit `OUTLET_DATA` di `data.js`. Daftar outlet ini sama dengan website Customer Feedback; jika ada outlet baru, update di kedua website.

## Keamanan

- Tidak ada password di website maupun `config.js`.
- Password Super Admin: hash di Script Properties. Password `TEAM_USERS`: hash (salted SHA-256, 1.500 iterasi).
- Sesi: token 6 jam di CacheService; akun yang di-set `Active = FALSE` langsung tidak bisa mengakses data.
- 5x login gagal → username dikunci 10 menit.
- Form memakai honeypot sederhana untuk menyaring bot. Form tetap bisa diakses siapa pun yang punya link, jadi bagikan link hanya ke staff outlet.
