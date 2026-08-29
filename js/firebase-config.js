/**
 * TB. SERBA GUNA - FIREBASE & STORAGE MANAGER
 * Mengelola koneksi Cloud Firestore dan fallback Offline LocalStorage.
 */

const STORAGE_KEYS = {
  FIREBASE_CONFIG: "TB_SERBAGUNA_FIREBASE_CONFIG",
  STORE_PROFILE: "TB_SERBAGUNA_STORE_PROFILE",
  TRANSACTIONS: "TB_SERBAGUNA_TRANSACTIONS",
  THEME: "TB_SERBAGUNA_THEME"
};

// Konfigurasi Asli Proyek Firebase Toko Bangunan "Serba Guna"
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAVR4STJgpVEwI-sNcw8F2eBWG722Jgy9k",
  authDomain: "serba-guna-43564.firebaseapp.com",
  projectId: "serba-guna-43564",
  storageBucket: "serba-guna-43564.firebasestorage.app",
  messagingSenderId: "39559954410",
  appId: "1:39559954410:web:b9a5a5a9cd0456ac03fc93",
  measurementId: "G-286FFY6W5G"
};

class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.isCloudActive = false;
    this.unsubscribeListener = null;
    this.collectionName = "tb_serbaguna_transactions";
    this.productsCollectionName = "tb_serbaguna_products";
    this.settingsCollectionName = "tb_serbaguna_settings";
    this.unsubscribeProdListener = null;
    this.unsubscribeSettingsListener = null;
    this.config = this.getSavedConfig() || DEFAULT_FIREBASE_CONFIG;
  }

  // Ambil config tersimpan dari localStorage atau default
  getSavedConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("Gagal membaca config Firebase lokal:", e);
      return null;
    }
  }

  // Simpan config ke localStorage
  saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
      this.config = config;
      return true;
    } catch (e) {
      console.error("Gagal menyimpan config Firebase:", e);
      return false;
    }
  }

  // Hapus config Firebase dan kembali ke mode offline
  clearConfig() {
    localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
    this.config = null;
    this.isCloudActive = false;
    this.db = null;
    this.app = null;
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }
    if (this.unsubscribeProdListener) {
      this.unsubscribeProdListener();
      this.unsubscribeProdListener = null;
    }
    if (this.unsubscribeSettingsListener) {
      this.unsubscribeSettingsListener();
      this.unsubscribeSettingsListener = null;
    }
    this.notifyStatusChange(false, "Beralih ke mode offline lokal");
  }

  // Inisialisasi Firebase App
  async init(customConfig = null) {
    const configToUse = customConfig || this.config;
    if (!configToUse || !configToUse.apiKey || !configToUse.projectId) {
      this.isCloudActive = false;
      this.notifyStatusChange(false, "Mode Penyimpanan Offline (LocalStorage)");
      return false;
    }

    try {
      if (typeof firebase === "undefined") {
        console.warn("Firebase SDK tidak terdeteksi di window.");
        this.isCloudActive = false;
        return false;
      }

      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(configToUse);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.firestore();
      
      try {
        await this.db.collection(this.collectionName).limit(1).get();
        this.isCloudActive = true;
        this.notifyStatusChange(true, `Terhubung ke Cloud Firebase: ${configToUse.projectId}`);
        return true;
      } catch (authOrRuleError) {
        console.warn("Peringatan koneksi Firestore:", authOrRuleError.message);
        this.isCloudActive = true;
        this.notifyStatusChange(true, `Firestore Aktif (${configToUse.projectId})`);
        return true;
      }
    } catch (err) {
      console.error("Inisialisasi Firebase gagal:", err);
      this.isCloudActive = false;
      this.notifyStatusChange(false, `Gagal terhubung Firebase: ${err.message}`);
      return false;
    }
  }

  // Dispatch event status koneksi ke UI
  notifyStatusChange(isConnected, message) {
    const event = new CustomEvent("firebase-status-change", {
      detail: {
        isConnected,
        message,
        projectId: this.config ? this.config.projectId : null
      }
    });
    window.dispatchEvent(event);
  }

  // ==================== 1. TRANSAKSI REAL-TIME ====================
  listenToTransactions(onDataChanged, onError) {
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }

    if (!this.isCloudActive || !this.db) {
      return null;
    }

    try {
      this.unsubscribeListener = this.db.collection(this.collectionName)
        .orderBy("date", "desc")
        .onSnapshot(
          (snapshot) => {
            const transactions = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              transactions.push({
                ...data,
                id: doc.id
              });
            });
            if (onDataChanged) onDataChanged(transactions);
          },
          (error) => {
            console.error("Error pada Real-Time listener Firestore:", error);
            if (onError) onError(error);
          }
        );
      return this.unsubscribeListener;
    } catch (err) {
      console.error("Gagal membuat listener Firestore:", err);
      return null;
    }
  }

  async saveTransaction(transaction) {
    if (!this.isCloudActive || !this.db) return false;
    try {
      const docRef = this.db.collection(this.collectionName).doc(transaction.id);
      await docRef.set(transaction, { merge: true });
      return true;
    } catch (err) {
      console.error("Gagal menyimpan transaksi ke Cloud:", err);
      throw err;
    }
  }

  async deleteTransaction(transactionId) {
    if (!this.isCloudActive || !this.db) return false;
    try {
      await this.db.collection(this.collectionName).doc(transactionId).delete();
      return true;
    } catch (err) {
      console.error("Gagal menghapus transaksi dari Cloud:", err);
      throw err;
    }
  }

  async uploadLocalBatch(localTransactions) {
    if (!this.isCloudActive || !this.db) return false;
    const batch = this.db.batch();
    localTransactions.forEach(tx => {
      const ref = this.db.collection(this.collectionName).doc(tx.id);
      batch.set(ref, tx, { merge: true });
    });
    await batch.commit();
    return true;
  }

  // ==================== 2. MASTER BARANG & STOK REAL-TIME ====================
  listenToProducts(onDataChanged, onError) {
    if (this.unsubscribeProdListener) {
      this.unsubscribeProdListener();
      this.unsubscribeProdListener = null;
    }

    if (!this.isCloudActive || !this.db) return null;

    try {
      this.unsubscribeProdListener = this.db.collection(this.productsCollectionName)
        .onSnapshot(
          (snapshot) => {
            const products = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              products.push({
                ...data,
                id: doc.id
              });
            });
            if (onDataChanged) onDataChanged(products);
          },
          (error) => {
            console.error("Error listener Firestore products:", error);
            if (onError) onError(error);
          }
        );
      return this.unsubscribeProdListener;
    } catch (err) {
      console.error("Gagal membuat listener Firestore products:", err);
      return null;
    }
  }

  async saveProduct(product) {
    if (!this.isCloudActive || !this.db) return false;
    try {
      const docRef = this.db.collection(this.productsCollectionName).doc(product.id);
      await docRef.set(product, { merge: true });
      return true;
    } catch (err) {
      console.error("Gagal menyimpan produk ke Cloud:", err);
      return false;
    }
  }

  async deleteProduct(productId) {
    if (!this.isCloudActive || !this.db) return false;
    try {
      await this.db.collection(this.productsCollectionName).doc(productId).delete();
      return true;
    } catch (err) {
      console.error("Gagal menghapus produk di Cloud:", err);
      return false;
    }
  }

  async uploadLocalProducts(localProducts) {
    if (!this.isCloudActive || !this.db || !localProducts.length) return false;
    try {
      const batch = this.db.batch();
      localProducts.forEach(p => {
        const ref = this.db.collection(this.productsCollectionName).doc(p.id);
        batch.set(ref, p, { merge: true });
      });
      await batch.commit();
      return true;
    } catch (err) {
      console.error("Gagal upload batch produk:", err);
      return false;
    }
  }

  // ==================== 3. PENGATURAN & PROFIL TOKO REAL-TIME ====================
  listenToSettings(onDataChanged, onError) {
    if (this.unsubscribeSettingsListener) {
      this.unsubscribeSettingsListener();
      this.unsubscribeSettingsListener = null;
    }

    if (!this.isCloudActive || !this.db) return null;

    try {
      this.unsubscribeSettingsListener = this.db.collection(this.settingsCollectionName).doc("store_profile")
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              if (onDataChanged) onDataChanged(doc.data());
            }
          },
          (error) => {
            console.error("Error listener settings Firestore:", error);
            if (onError) onError(error);
          }
        );
      return this.unsubscribeSettingsListener;
    } catch (err) {
      console.error("Gagal membuat listener settings:", err);
      return null;
    }
  }

  async saveSettings(settingsData) {
    if (!this.isCloudActive || !this.db) return false;
    try {
      await this.db.collection(this.settingsCollectionName).doc("store_profile").set(settingsData, { merge: true });
      return true;
    } catch (err) {
      console.error("Gagal menyimpan settings ke Cloud:", err);
      return false;
    }
  }

  async clearAllCloudData() {
    if (!this.isCloudActive || !this.db) return false;
    try {
      // 1. Hapus semua transaksi dari Cloud Firestore
      const txSnap = await this.db.collection(this.collectionName).get();
      const batch1 = this.db.batch();
      txSnap.forEach(doc => batch1.delete(doc.ref));
      await batch1.commit();

      // 2. Hapus semua master barang dari Cloud Firestore
      const prodSnap = await this.db.collection(this.productsCollectionName).get();
      const batch2 = this.db.batch();
      prodSnap.forEach(doc => batch2.delete(doc.ref));
      await batch2.commit();

      return true;
    } catch (e) {
      console.warn("Gagal membersihkan database Cloud Firebase:", e);
      return false;
    }
  }
}

// Global Singleton Instance
window.firebaseService = new FirebaseService();
