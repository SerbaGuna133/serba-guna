/**
 * TB. SERBA GUNA - MASTER DATA (BERSIH / SIAP PAKAI REAL)
 * Auto-cleaner membuang seluruh cache data contoh lama agar web app menjadi 0 bersih.
 */

// Versi database bersih
const APP_DATA_VERSION = "v3.0-TOTAL-ZERO-CLEAN";

// Otomatis bersihkan localStorage dari data contoh lama
(function autoPurgeOldSampleCache() {
  try {
    const currentVer = localStorage.getItem("TB_SERBAGUNA_DATA_VERSION");
    if (currentVer !== APP_DATA_VERSION) {
      localStorage.removeItem("TB_SERBAGUNA_TRANSACTIONS");
      localStorage.removeItem("TB_SERBAGUNA_PRODUCTS");
      localStorage.removeItem("TB_SERBAGUNA_STOCK_LOGS");
      localStorage.removeItem("TB_SERBAGUNA_OPENING_BALANCES");
      localStorage.removeItem("TB_SERBAGUNA_MANUAL_JOURNALS");
      localStorage.setItem("TB_SERBAGUNA_DATA_VERSION", APP_DATA_VERSION);
      console.log("Database TB Serba Guna telah dikosongkan (0 Bersih Total).");
    }
  } catch (e) {
    console.warn("Auto purge cache warning:", e);
  }
})();

const INITIAL_STORE_PROFILE = {
  name: "TB. SERBA GUNA",
  tagline: "Pusat Bahan Bangunan, Besi, Semen & Alat Konstruksi Lengkap",
  address: "Jl. Raya Utama No. 88, Kawasan Niaga Bahan Bangunan",
  phone: "0812-3456-7890",
  email: "tb.serbaguna@gmail.com",
  owner: "Pemilik Toko",
  footerText: "Barang yang sudah dibeli dapat ditukar maksimal 3 hari kerja dengan menyertakan nota asli dan kondisi barang utuh. Terima kasih atas kepercayaan Anda berbelanja di TB. Serba Guna."
};

// 1. Bagan Akun Standar (Chart of Accounts / COA)
const DEFAULT_COA = [
  // 1000 - ASET / AKTIVA
  { code: "1101", name: "Kas Toko (Kasir)", category: "aset_lancar", normalBalance: "debit", isCustom: false },
  { code: "1102", name: "Bank BCA / Transfer", category: "aset_lancar", normalBalance: "debit", isCustom: false },
  { code: "1103", name: "Piutang Usaha (Bon Pelanggan / Proyek)", category: "aset_lancar", normalBalance: "debit", isCustom: false },
  { code: "1104", name: "Persediaan Barang Dagang (Stok Material)", category: "aset_lancar", normalBalance: "debit", isCustom: false },
  { code: "1105", name: "Perlengkapan Toko & Gudang", category: "aset_lancar", normalBalance: "debit", isCustom: false },
  { code: "1201", name: "Kendaraan & Armada Truk/Pick-up", category: "aset_tetap", normalBalance: "debit", isCustom: false },
  { code: "1202", name: "Akumulasi Penyusutan Kendaraan", category: "aset_tetap", normalBalance: "kredit", isCustom: false },
  { code: "1203", name: "Peralatan & Mesin Toko", category: "aset_tetap", normalBalance: "debit", isCustom: false },

  // 2000 - KEWAJIBAN / HUTANG
  { code: "2101", name: "Hutang Usaha (Distributor Material)", category: "kewajiban_lancar", normalBalance: "kredit", isCustom: false },
  { code: "2102", name: "Hutang Gaji & Upah Terutang", category: "kewajiban_lancar", normalBalance: "kredit", isCustom: false },
  { code: "2103", name: "Hutang Operasional Lainnya", category: "kewajiban_lancar", normalBalance: "kredit", isCustom: false },

  // 3000 - EKUITAS / MODAL
  { code: "3101", name: "Modal Pemilik Toko", category: "ekuitas", normalBalance: "kredit", isCustom: false },
  { code: "3102", name: "Prive Pemilik Toko", category: "ekuitas", normalBalance: "debit", isCustom: false },
  { code: "3201", name: "Laba Ditahan / Laba Berjalan", category: "ekuitas", normalBalance: "kredit", isCustom: false },

  // 4000 - PENDAPATAN
  { code: "4101", name: "Pendapatan Penjualan Material Bangunan", category: "pendapatan", normalBalance: "kredit", isCustom: false },
  { code: "4102", name: "Potongan Penjualan & Diskon", category: "pendapatan", normalBalance: "debit", isCustom: false },
  { code: "4103", name: "Retur Penjualan Material", category: "pendapatan", normalBalance: "debit", isCustom: false },
  { code: "4201", name: "Pendapatan Ongkos Kirim Armada Truk", category: "pendapatan", normalBalance: "kredit", isCustom: false },
  { code: "4301", name: "Pendapatan Lain-lain", category: "pendapatan", normalBalance: "kredit", isCustom: false },

  // 5000 - HARGA POKOK PENJUALAN (HPP)
  { code: "5101", name: "Beban Pokok Penjualan (HPP Material)", category: "hpp", normalBalance: "debit", isCustom: false },

  // 6000 - BEBAN OPERASIONAL
  { code: "6101", name: "Beban Gaji Karyawan & Upah Kuli Bongkar", category: "beban_operasional", normalBalance: "debit", isCustom: false },
  { code: "6102", name: "Beban BBM Solar & Servis Truk Toko", category: "beban_operasional", normalBalance: "debit", isCustom: false },
  { code: "6103", name: "Beban Listrik, Air & Internet Toko", category: "beban_operasional", normalBalance: "debit", isCustom: false },
  { code: "6104", name: "Beban Konsumsi & Keperluan Toko", category: "beban_operasional", normalBalance: "debit", isCustom: false },
  { code: "6105", name: "Beban Penyusutan Kendaraan & Aset", category: "beban_operasional", normalBalance: "debit", isCustom: false },
  { code: "6199", name: "Beban Operasional Lain-lain", category: "beban_operasional", normalBalance: "debit", isCustom: false }
];

// 2. Kategori Material Bangunan & Operasional
const MATERIAL_CATEGORIES = [
  { id: "semen", name: "Semen & Mortar", icon: "🧱", color: "#d97706", group: "material" },
  { id: "besi", name: "Besi, Baja & Wiremesh", icon: "🏗️", color: "#475569", group: "material" },
  { id: "pasir", name: "Pasir, Batu & Bata", icon: "🪨", color: "#b45309", group: "material" },
  { id: "kayu", name: "Kayu, Triplek & Balok", icon: "🪵", color: "#854d0e", group: "material" },
  { id: "cat", name: "Cat, Thinner & Anti Bocor", icon: "🎨", color: "#0284c7", group: "material" },
  { id: "pipa", name: "Pipa PVC, Kran & Sanitari", icon: "🚰", color: "#0891b2", group: "material" },
  { id: "keramik", name: "Keramik, Granit & Semen Warna", icon: "🔲", color: "#059669", group: "material" },
  { id: "atap", name: "Atap, Genteng & Spandek", icon: "🏠", color: "#e11d48", group: "material" },
  { id: "hardware", name: "Paku, Baut, Gembok & Alat Tukang", icon: "🔨", color: "#6b7280", group: "material" },
  { id: "listrik", name: "Kabel & Perlengkapan Listrik", icon: "💡", color: "#ca8a04", group: "material" },
  { id: "lainnya", name: "Material Lain-lain", icon: "📦", color: "#64748b", group: "material" },
  { id: "ongkir", name: "Ongkos Kirim Truk / Pick-up", icon: "🚚", color: "#16a34a", group: "shipping" },
  { id: "operasional", name: "Operasional & Gaji Karyawan/Kuli", icon: "👥", color: "#dc2626", group: "expense" },
  { id: "armada", name: "BBM Solar & Servis Kendaraan Toko", icon: "⛽", color: "#ea580c", group: "expense" },
  { id: "beban_lain", name: "Biaya Operasional Toko Lainnya", icon: "🧾", color: "#78716c", group: "expense" }
];

// 3. Master Inventori Awal (Kosong 0)
const INITIAL_INVENTORY = [];

// 4. Data Transaksi Awal (Kosong 0)
const INITIAL_TRANSACTIONS = [];

// 5. Saldo Awal Neraca (Kosong 0)
const INITIAL_OPENING_BALANCES = {};
