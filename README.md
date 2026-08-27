# 🏗️ TB. SERBA GUNA - Sistem Keuangan, Pembukuan Akuntansi & Stok Toko Bangunan

Aplikasi Web Lengkap & Siap Produksi untuk **Manajemen Keuangan**, **Inventori & Stok Material**, **Jurnal Umum Otomatis**, **Buku Besar**, **Neraca Lajur 10 Kolom**, **Laporan Laba Rugi**, dan **Neraca Keuangan (Balance Sheet)** khusus Toko Bangunan & Material Konstruksi.

---

## 🌟 Modul & Fitur Lengkap

### 1. 📊 Dashboard Finansial & Inventori
- **6 Indikator Vital**: Saldo Kas & Bank, Omset Penjualan, Nilai Aset Stok Material (HPP), Laba Bersih Akuntansi, Piutang Bon Pelanggan, dan Hutang Distributor.
- **Peringatan Otomatis**: Alert stok menipis (*Low Stock*) & alert bon jatuh tempo.
- **Grafik Interaktif**: Tren Arus Kas 6 Bulan & Komposisi Kategori Material Terlaris.

### 2. 📦 Manajemen Inventori & Stok Material
- **Master Barang**: Semen, Besi Beton SNI, Wiremesh, Pasir, Bata, Cat, Pipa PVC, Atap Spandek, Kayu, dll.
- **Otomatisasi Stok**:
  - Penjualan Kasir -> Otomatis memotong stok barang secara real-time.
  - Pembelian / Kulakan Supplier -> Otomatis menambah stok barang dan memperbarui HPP.
- **Stock Opname**: Koreksi fisik stok gudang dengan riwayat mutasi log.
- **Valuasi Persediaan**: Menghitung total nilai aset gudang berdasarkan harga beli (HPP) dan estimasi omset retail.

### 3. 🧾 Cetak Faktur Resmi & Nota Kasir
- **Faktur Resmi A4 / A5**: Lengkap dengan Kop Toko Bangunan, No. Faktur, Data Pelanggan/Proyek, Tabel Rincian Material (Kode, Qty, Satuan, Harga, Subtotal), Uang Muka (DP), Sisa Bon, Tanggal Jatuh Tempo, dan Kolom Tanda Tangan Penerima, Pengirim, & Kasir.
- **Struk Thermal Kasir**: Format struk kasir ringkas siap cetak.

### 4. 📚 Sistem Pembukuan Akuntansi Penuh (Double-Entry Engine)
- **🏷️ Bagan Akun (Chart of Accounts / COA)**:
  - Tersedia akun standar toko bangunan (Aset Lancar, Aset Tetap, Hutang, Modal, Penjualan, HPP, Beban Operasional).
  - **Fitur Tambah Akun Manual**: Anda dapat menambahkan kode akun dan nama akun baru kapan saja secara bebas.
- **📖 Jurnal Umum (General Journal - Auto)**:
  - Setiap transaksi penjualan kasir, pembelian material, cicilan piutang, dan biaya operasional **otomatis membuat ayat jurnal Debit & Kredit yang seimbang**.
  - Fitur **+ Input Jurnal Penyesuaian Manual** (misal: penyusutan aset, modal awal, prive).
- **📕 Buku Besar (General Ledger - T-Account)**:
  - Otomatis memposting mutasi dari Jurnal Umum ke masing-masing akun.
  - Menampilkan Saldo Awal, riwayat mutasi Debit/Kredit, dan Saldo Akhir Berjalan.
- **📑 Neraca Lajur 10 Kolom (Worksheet - Auto Balanced)**:
  - Kolom 1-2: **Neraca Saldo (Trial Balance)**
  - Kolom 3-4: **Penyesuaian (Adjustments)**
  - Kolom 5-6: **Neraca Saldo Disesuaikan (Adjusted Trial Balance)**
  - Kolom 7-8: **Laba Rugi (Income Statement)**
  - Kolom 9-10: **Neraca Akhir (Balance Sheet)**
  - Dilengkapi baris penutup Laba Bersih yang otomatis menyeimbangkan kolom Laba Rugi dan Neraca.
- **📈 Laporan Laba Rugi Formal**:
  - Pendapatan Penjualan Material & Ongkir dikurangi HPP = Laba Kotor (*Gross Profit*).
  - Laba Kotor dikurangi Beban Operasional = Laba Bersih (*Net Profit*).
- **⚖️ Laporan Neraca Keuangan (Balance Sheet)**:
  - Keseimbangan posisi **Total Aset (Aktiva) = Total Kewajiban + Ekuitas Modal (Pasiva)**.

### 5. 📑 Piutang Bon Pelanggan & 🤝 Hutang Distributor
- Rekap bon proyek kontraktor/tukang dengan tracking cicilan dan jatuh tempo.
- Rekap faktur hutang tempo kulakan distributor semen/besi.

### 6. ☁️ Integrasi Cloud Firebase (Email Toko)
- Data tersimpan dan tersinkronisasi antar perangkat secara real-time.
- Fallback offline (*LocalStorage*) jika tanpa koneksi internet.
- Cadangan database lengkap (*Full Backup JSON*) dan Restore.

---

## 🚀 Panduan 1: Publish ke GitHub Pages (Akun Email Toko)

1. Buka [github.com](https://github.com/) dan login menggunakan **akun GitHub email toko Anda**.
2. Klik tombol **New repository** > Beri nama: `serba-guna` > Pilih **Public** > Klik **Create repository**.
3. Upload seluruh file di dalam folder `Serba-Guna` ini:
   ```bash
   cd "Serba-Guna"
   git init
   git remote add origin https://github.com/<USERNAME-GITHUB-TOKO>/serba-guna.git
   git add .
   git commit -m "feat: Sistem Akuntansi Lengkap & Stok TB Serba Guna"
   git branch -M main
   git push -u origin main
   ```
4. Buka menu **Settings** di repo GitHub > Menu **Pages** (di sidebar kiri) > Pada bagian *Branch*, pilih **main** > Klik **Save**.
5. Dalam 1-2 menit, web app langsung online di:
   > 🌐 **`https://<username-toko>.github.io/serba-guna/`**

---

## 🔥 Panduan 2: Setup Database Firebase Firestore (Email Toko)

1. Buka [console.firebase.google.com](https://console.firebase.google.com/) login dengan **email toko Anda**.
2. Klik **Add project** > Beri nama: `tb-serba-guna` > Klik **Continue**.
3. Buka menu **Build** > **Firestore Database** > Klik **Create database** > Pilih lokasi `asia-southeast2 (Jakarta)` > Pilih **Start in test mode** > Klik **Create**.
4. Di tab **Rules**, gunakan aturan berikut lalu klik **Publish**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
5. Buka **Project Settings** (ikon gir) > Tab **General** > Bagian *Your apps* > Klik ikon Web (**`</>`**) > Daftarkan web app > Salin kode `firebaseConfig`.
6. Buka aplikasi web TB. Serba Guna > Menu **⚙️ Pengaturan** > Masukkan `API Key`, `Project ID`, `Auth Domain`, `App ID` > Klik **🔗 Hubungkan & Sinkronkan**.

---

## 📁 Struktur Berkas Proyek

```
Serba-Guna/
├── index.html              # Antarmuka SPA Lengkap (POS, Stok, Akuntansi, Laporan)
├── README.md               # Panduan Lengkap Setup & Penggunaan
├── css/
│   └── style.css           # Desain UI Modern (Glassmorphism, Dark/Light, Print Nota & Neraca)
└── js/
    ├── sample-data.js      # Master Bagan Akun (COA), Data Stok Awal & Transaksi
    ├── inventory.js        # Engine Manajemen Stok, Valuasi & Potong Stok Real-Time
    ├── accounting-engine.js# Engine Akuntansi: Jurnal Auto, Buku Besar, Neraca Lajur 10 Kolom, Neraca
    ├── firebase-config.js  # Service Koneksi Firebase Firestore & Offline LocalStorage
    ├── transactions.js     # Engine Transaksi Kasir, Piutang, Hutang & Integrasi HPP
    ├── charts.js           # Visualisasi Grafik Interaktif Chart.js
    ├── export.js           # Ekspor Excel (Jurnal, Buku Besar, Neraca Lajur) & Cetak Faktur Resmi
    └── app.js              # Controller Master Navigasi SPA & Interaksi Form
```

---

© 2026 **TB. SERBA GUNA** - Solusi Pembukuan Finansial, Akuntansi & Stok Bahan Bangunan Terpadu.
