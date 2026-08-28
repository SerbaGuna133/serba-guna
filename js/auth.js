/**
 * TB. SERBA GUNA - AUTHENTICATION & SECURITY MANAGER
 * Mengelola sesi login, peran pengguna (Owner & Kasir), verifikasi sandi, dan proteksi aplikasi.
 */

const STORAGE_KEYS_AUTH = {
  USERS: 'serbaguna_users_v1',
  SESSION: 'serbaguna_session_v1',
  REMEMBER: 'serbaguna_remember_v1'
};

const DEFAULT_USERS = [
  {
    id: 'usr-admin',
    username: 'admin',
    password: 'admin123',
    name: 'Hazel Hudaya (Owner)',
    role: 'owner', // 'owner' (akses penuh) atau 'kasir'
    phone: '0813-5925-4159',
    createdAt: '2026-08-01'
  },
  {
    id: 'usr-kasir',
    username: 'kasir',
    password: 'kasir123',
    name: 'Kasir Toko Utama',
    role: 'kasir',
    phone: '-',
    createdAt: '2026-08-01'
  }
];

class AuthManager {
  constructor() {
    this.users = [];
    this.currentUser = null;
    this.loadUsers();
    this.checkSession();
  }

  loadUsers() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS_AUTH.USERS);
      if (saved) {
        this.users = JSON.parse(saved);
      } else {
        this.users = [...DEFAULT_USERS];
        this.saveUsers();
      }
    } catch (e) {
      console.warn("Gagal memuat pengguna:", e);
      this.users = [...DEFAULT_USERS];
    }
  }

  saveUsers() {
    try {
      localStorage.setItem(STORAGE_KEYS_AUTH.USERS, JSON.stringify(this.users));
    } catch (e) {
      console.error("Gagal simpan pengguna:", e);
    }
  }

  checkSession() {
    try {
      // Cek localStorage dulu (jika 'Ingat Saya' aktif)
      let sessionData = localStorage.getItem(STORAGE_KEYS_AUTH.SESSION);
      if (!sessionData) {
        // Cek sessionStorage
        sessionData = sessionStorage.getItem(STORAGE_KEYS_AUTH.SESSION);
      }

      if (sessionData) {
        const userObj = JSON.parse(sessionData);
        const exists = this.users.find(u => u.username.toLowerCase() === userObj.username.toLowerCase());
        if (exists) {
          this.currentUser = {
            id: exists.id,
            username: exists.username,
            name: exists.name,
            role: exists.role,
            phone: exists.phone
          };
        } else {
          this.currentUser = null;
        }
      } else {
        this.currentUser = null;
      }
    } catch (e) {
      this.currentUser = null;
    }
  }

  ensureFirebaseInitialized() {
    if (typeof firebase === 'undefined') return false;
    if (!firebase.apps.length) {
      const config = (window.firebaseService && window.firebaseService.config) ? window.firebaseService.config : (typeof DEFAULT_FIREBASE_CONFIG !== 'undefined' ? DEFAULT_FIREBASE_CONFIG : null);
      if (config && config.apiKey) {
        try {
          firebase.initializeApp(config);
        } catch (e) {
          console.warn("Inisialisasi Firebase Auth gagal:", e);
        }
      }
    }
    return firebase.apps.length > 0;
  }

  async login(username, password, rememberMe = true) {
    if (!username || !password) {
      throw new Error("Username/Email dan Password wajib diisi.");
    }

    const cleanInput = username.trim().toLowerCase();
    const isEmailFormat = cleanInput.includes('@');
    const emailToUse = isEmailFormat ? cleanInput : `${cleanInput}@serbaguna.com`;

    this.ensureFirebaseInitialized();

    // 1. Coba Autentikasi Cloud Firebase jika SDK tersedia
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
      try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(emailToUse, password.trim());
        const fbUser = userCredential.user;

        const role = (cleanInput === 'admin' || emailToUse.startsWith('admin') || emailToUse.startsWith('owner')) ? 'owner' : 'kasir';
        const name = role === 'owner' ? 'Hazel Hudaya (Owner)' : (fbUser.displayName || fbUser.email.split('@')[0]);

        this.currentUser = {
          id: fbUser.uid,
          username: cleanInput,
          email: fbUser.email,
          name: name,
          role: role,
          isFirebase: true
        };

        const sessionPayload = JSON.stringify(this.currentUser);
        if (rememberMe) {
          localStorage.setItem(STORAGE_KEYS_AUTH.SESSION, sessionPayload);
          localStorage.setItem(STORAGE_KEYS_AUTH.REMEMBER, 'true');
        } else {
          sessionStorage.setItem(STORAGE_KEYS_AUTH.SESSION, sessionPayload);
          localStorage.removeItem(STORAGE_KEYS_AUTH.SESSION);
          localStorage.removeItem(STORAGE_KEYS_AUTH.REMEMBER);
        }

        return this.currentUser;
      } catch (fbErr) {
        console.warn("Firebase auth error code:", fbErr.code, fbErr.message);

        // Jika pengguna memasukkan format email (berarti memang akun Firebase), tampilkan error Firebase yang jelas!
        if (isEmailFormat) {
          let errorMsg = fbErr.message;
          if (fbErr.code === 'auth/user-not-found') {
            errorMsg = `Email "${emailToUse}" belum terdaftar di menu Users Firebase.`;
          } else if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
            errorMsg = "Password yang Anda masukkan salah. Pastikan password sesuai dengan saat dibuat di Firebase.";
          } else if (fbErr.code === 'auth/operation-not-allowed') {
            errorMsg = "Metode Email/Password belum diaktifkan (Enable) di Firebase Console > Authentication > Sign-in method.";
          } else if (fbErr.code === 'auth/invalid-email') {
            errorMsg = "Format alamat email tidak valid.";
          } else if (fbErr.code === 'auth/too-many-requests') {
            errorMsg = "Terlalu banyak percobaan login gagal. Silakan tunggu beberapa saat.";
          } else if (fbErr.code === 'auth/network-request-failed') {
            errorMsg = "Koneksi internet bermasalah. Periksa jaringan Anda.";
          }
          throw new Error(`Firebase Auth: ${errorMsg}`);
        }
      }
    }

    // 2. Fallback Verifikasi Kredensial Lokal (Offline / Default Users)
    const user = this.users.find(u => u.username.toLowerCase() === cleanInput || (u.email && u.email.toLowerCase() === cleanInput));

    if (!user) {
      throw new Error("Akun tidak ditemukan. Gunakan email Firebase Anda yang lengkap (misal: nama@gmail.com) atau username 'admin' / 'kasir'.");
    }

    if (user.password !== password.trim()) {
      throw new Error("Password atau PIN yang Anda masukkan salah.");
    }

    this.currentUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
      isFirebase: false
    };

    const sessionPayload = JSON.stringify(this.currentUser);
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEYS_AUTH.SESSION, sessionPayload);
      localStorage.setItem(STORAGE_KEYS_AUTH.REMEMBER, 'true');
    } else {
      sessionStorage.setItem(STORAGE_KEYS_AUTH.SESSION, sessionPayload);
      localStorage.removeItem(STORAGE_KEYS_AUTH.SESSION);
      localStorage.removeItem(STORAGE_KEYS_AUTH.REMEMBER);
    }

    return this.currentUser;
  }

  async logout() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      try {
        await firebase.auth().signOut();
      } catch (e) {
        console.warn("Firebase signOut error:", e);
      }
    }

    this.currentUser = null;
    localStorage.removeItem(STORAGE_KEYS_AUTH.SESSION);
    sessionStorage.removeItem(STORAGE_KEYS_AUTH.SESSION);
    localStorage.removeItem(STORAGE_KEYS_AUTH.REMEMBER);
    return true;
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async changePassword(username, oldPassword, newPassword) {
    // Jika user Firebase sedang login
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      try {
        await firebase.auth().currentUser.updatePassword(newPassword.trim());
      } catch (e) {
        console.warn("Gagal update password di Firebase:", e.message);
      }
    }

    const user = this.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (user) {
      if (user.password !== oldPassword.trim()) {
        throw new Error("Password lama Anda tidak sesuai.");
      }

      if (!newPassword || newPassword.trim().length < 4) {
        throw new Error("Password baru minimal harus 4 karakter.");
      }

      user.password = newPassword.trim();
      this.saveUsers();
    }

    return true;
  }

  resetToDefaultUsers() {
    this.users = [...DEFAULT_USERS];
    this.saveUsers();
    return true;
  }
}

// Inisialisasi global auth manager
window.authManager = new AuthManager();
