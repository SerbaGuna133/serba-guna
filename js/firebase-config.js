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

  // Pasang Real-Time Listener
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

  // Tambah atau Update transaksi di Cloud
  async saveTransaction(transaction) {
    if (!this.isCloudActive || !this.db) {
      return false;
    }
    try {
      const docRef = this.db.collection(this.collectionName).doc(transaction.id);
      await docRef.set(transaction, { merge: true });
      return true;
    } catch (err) {
      console.error("Gagal menyimpan transaksi ke Cloud:", err);
      throw err;
    }
  }

  // Hapus transaksi dari Cloud
  async deleteTransaction(transactionId) {
    if (!this.isCloudActive || !this.db) {
      return false;
    }
    try {
      await this.db.collection(this.collectionName).doc(transactionId).delete();
      return true;
    } catch (err) {
      console.error("Gagal menghapus transaksi dari Cloud:", err);
      throw err;
    }
  }

  // Upload masal data lokal ke Cloud Firebase
  async uploadLocalBatch(localTransactions) {
    if (!this.isCloudActive || !this.db) {
      throw new Error("Firebase belum terhubung!");
    }
    const batch = this.db.batch();
    localTransactions.forEach(tx => {
      const ref = this.db.collection(this.collectionName).doc(tx.id);
      batch.set(ref, tx, { merge: true });
    });
    await batch.commit();
    return true;
  }
}

// Global Singleton Instance
window.firebaseService = new FirebaseService();
