/**
 * TB. SERBA GUNA - TRANSACTION & BUSINESS ENGINE
 * Mengelola kalkulasi finansial, piutang, hutang, cicilan, serta integrasi stok & akuntansi.
 */

class TransactionStore {
  constructor() {
    this.transactions = [];
    this.storeProfile = { ...INITIAL_STORE_PROFILE };
    this.categories = [...MATERIAL_CATEGORIES];
    this.init();
  }

  init() {
    try {
      const savedProfile = localStorage.getItem(STORAGE_KEYS.STORE_PROFILE);
      if (savedProfile) {
        this.storeProfile = { ...this.storeProfile, ...JSON.parse(savedProfile) };
      }
    } catch (e) {
      console.warn("Gagal memuat profil toko:", e);
    }

    try {
      const savedTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (savedTx) {
        this.transactions = JSON.parse(savedTx);
      } else {
        this.transactions = [];
        this.persistLocal();
      }
    } catch (e) {
      console.warn("Gagal memuat transaksi lokal:", e);
      this.transactions = [];
    }
  }

  persistLocal() {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.transactions));
    } catch (e) {
      console.error("Gagal simpan transaksi ke localStorage:", e);
    }
  }

  saveStoreProfile(profileData) {
    this.storeProfile = { ...this.storeProfile, ...profileData };
    try {
      localStorage.setItem(STORAGE_KEYS.STORE_PROFILE, JSON.stringify(this.storeProfile));
      return true;
    } catch (e) {
      console.error("Gagal simpan profil toko:", e);
      return false;
    }
  }

  updateFromCloud(cloudTransactions) {
    if (Array.isArray(cloudTransactions)) {
      this.transactions = cloudTransactions;
      this.persistLocal();
    }
  }

  generateTransactionId() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TX-${yyyy}${mm}${dd}-${rand}`;
  }

  async addTransaction(txData) {
    const newId = txData.id || this.generateTransactionId();
    const now = new Date();
    const dateStr = txData.date || now.toISOString().split('T')[0];
    const timeStr = txData.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const totalAmount = Number(txData.amount) || 0;
    let paidAmount = Number(txData.paidAmount);
    if (isNaN(paidAmount)) {
      paidAmount = (txData.paymentMethod === 'piutang' || txData.paymentMethod === 'hutang') ? 0 : totalAmount;
    }

    const debtAmount = Math.max(0, totalAmount - paidAmount);
    const status = debtAmount === 0 ? "lunas" : "tempo";

    let totalCOGS = 0;
    const items = Array.isArray(txData.items) ? txData.items : [];
    
    if (items.length > 0) {
      items.forEach(it => {
        if (!it.cogs && window.inventoryStore) {
          const prod = window.inventoryStore.products.find(p => p.id === it.id || p.name.toLowerCase() === it.name.toLowerCase());
          if (prod) {
            it.cogs = prod.buyPrice;
          }
        }
        const itemCogs = Number(it.cogs) || (it.price * 0.82);
        totalCOGS += (itemCogs * (Number(it.qty) || 1));
      });
    } else {
      totalCOGS = txData.type === 'in' ? (totalAmount * 0.82) : 0;
    }

    const newTx = {
      id: newId,
      date: dateStr,
      time: timeStr,
      type: txData.type || "in",
      paymentMethod: txData.paymentMethod || "cash",
      category: txData.category || "lainnya",
      title: txData.title.trim(),
      customer: (txData.customer || "").trim(),
      supplier: (txData.supplier || "").trim(),
      phone: (txData.phone || "").trim(),
      amount: totalAmount,
      cogs: totalCOGS,
      paidAmount: paidAmount,
      debtAmount: debtAmount,
      dueDate: txData.dueDate || "",
      status: status,
      notes: (txData.notes || "").trim(),
      items: items,
      payments: Array.isArray(txData.payments) ? txData.payments : (paidAmount > 0 ? [{
        date: dateStr,
        amount: paidAmount,
        note: (txData.paymentMethod === 'piutang' || txData.paymentMethod === 'hutang') ? "Pembayaran Awal / DP" : "Lunas saat transaksi",
        method: txData.paymentMethod
      }] : []),
      createdAt: new Date().toISOString()
    };

    if (window.inventoryStore) {
      if (newTx.type === 'in' && items.length > 0) {
        window.inventoryStore.deductStockFromSale(items, newId);
      } else if (newTx.type === 'out' && items.length > 0) {
        window.inventoryStore.addStockFromPurchase(items, newId);
      }
    }

    this.transactions.unshift(newTx);
    this.persistLocal();

    if (window.firebaseService && window.firebaseService.isCloudActive) {
      try {
        await window.firebaseService.saveTransaction(newTx);
      } catch (err) {
        console.warn("Gagal simpan ke Firebase:", err);
      }
    }

    return newTx;
  }

  async updateTransaction(txId, updatedFields) {
    const idx = this.transactions.findIndex(t => t.id === txId);
    if (idx === -1) return null;

    const oldTx = this.transactions[idx];
    const newTx = { ...oldTx, ...updatedFields };

    newTx.amount = Number(newTx.amount) || 0;
    newTx.paidAmount = Number(newTx.paidAmount) || 0;
    newTx.debtAmount = Math.max(0, newTx.amount - newTx.paidAmount);
    newTx.status = newTx.debtAmount === 0 ? "lunas" : "tempo";

    this.transactions[idx] = newTx;
    this.persistLocal();

    if (window.firebaseService && window.firebaseService.isCloudActive) {
      try {
        await window.firebaseService.saveTransaction(newTx);
      } catch (err) {
        console.warn("Gagal update Firebase:", err);
      }
    }

    return newTx;
  }

  async deleteTransaction(txId) {
    const idx = this.transactions.findIndex(t => t.id === txId);
    if (idx === -1) return false;

    this.transactions.splice(idx, 1);
    this.persistLocal();

    if (window.firebaseService && window.firebaseService.isCloudActive) {
      try {
        await window.firebaseService.deleteTransaction(txId);
      } catch (err) {
        console.warn("Gagal hapus di Firebase:", err);
      }
    }

    return true;
  }

  async addRepayment(txId, paymentData) {
    const tx = this.transactions.find(t => t.id === txId);
    if (!tx) throw new Error("Transaksi tidak ditemukan");

    const payAmount = Number(paymentData.amount) || 0;
    if (payAmount <= 0) throw new Error("Nominal pembayaran harus lebih dari 0");

    const newPaid = (tx.paidAmount || 0) + payAmount;
    const newDebt = Math.max(0, tx.amount - newPaid);
    const newStatus = newDebt === 0 ? "lunas" : "tempo";

    const paymentEntry = {
      date: paymentData.date || new Date().toISOString().split('T')[0],
      amount: payAmount,
      note: paymentData.note || "Cicilan pembayaran",
      method: paymentData.method || "cash",
      receiptNo: `PAY-${Date.now()}`
    };

    if (!Array.isArray(tx.payments)) {
      tx.payments = [];
    }
    tx.payments.push(paymentEntry);
    tx.paidAmount = newPaid;
    tx.debtAmount = newDebt;
    tx.status = newStatus;

    this.persistLocal();

    if (window.firebaseService && window.firebaseService.isCloudActive) {
      try {
        await window.firebaseService.saveTransaction(tx);
      } catch (err) {
        console.warn("Gagal update cicilan ke Firebase:", err);
      }
    }

    return tx;
  }

  getFilteredTransactions({ type = 'all', category = '', search = '', period = '', status = 'all' } = {}) {
    return this.transactions.filter(tx => {
      if (type !== 'all' && tx.type !== type) return false;
      if (status !== 'all' && tx.status !== status) return false;
      if (category && tx.category !== category) return false;

      if (period) {
        if (period.length === 7) {
          if (!tx.date.startsWith(period)) return false;
        } else if (period.length === 10) {
          if (tx.date !== period) return false;
        } else if (period.length === 4) {
          if (!tx.date.startsWith(period)) return false;
        }
      }

      if (search) {
        const q = search.toLowerCase();
        const titleMatch = (tx.title || "").toLowerCase().includes(q);
        const customerMatch = (tx.customer || "").toLowerCase().includes(q);
        const supplierMatch = (tx.supplier || "").toLowerCase().includes(q);
        const notesMatch = (tx.notes || "").toLowerCase().includes(q);
        const idMatch = (tx.id || "").toLowerCase().includes(q);
        const itemMatch = Array.isArray(tx.items) && tx.items.some(it => (it.name || "").toLowerCase().includes(q));
        if (!titleMatch && !customerMatch && !supplierMatch && !notesMatch && !idMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }

  getFinancialStats(period = '') {
    const list = this.getFilteredTransactions({ period });
    const today = new Date().toISOString().split('T')[0];

    let totalRevenue = 0;
    let totalCashIn = 0;
    let totalExpense = 0;
    let totalCashOut = 0;
    let totalReceivables = 0;
    let totalPayables = 0;
    let totalCOGS = 0;
    let overdueReceivablesCount = 0;
    let overduePayablesCount = 0;

    this.transactions.forEach(tx => {
      if (tx.type === 'in' && tx.debtAmount > 0) {
        totalReceivables += tx.debtAmount;
        if (tx.dueDate && tx.dueDate < today) {
          overdueReceivablesCount++;
        }
      } else if (tx.type === 'out' && tx.debtAmount > 0) {
        totalPayables += tx.debtAmount;
        if (tx.dueDate && tx.dueDate < today) {
          overduePayablesCount++;
        }
      }
    });

    list.forEach(tx => {
      if (tx.type === 'in') {
        totalRevenue += tx.amount;
        totalCashIn += (tx.paidAmount || 0);
        totalCOGS += (tx.cogs || 0);
      } else if (tx.type === 'out') {
        totalExpense += tx.amount;
        totalCashOut += (tx.paidAmount || 0);
      }
    });

    const netCash = totalCashIn - totalCashOut;
    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    return {
      totalRevenue,
      totalCashIn,
      totalExpense,
      totalCashOut,
      netCash,
      totalCOGS,
      grossProfit,
      netProfit,
      profitMargin,
      totalReceivables,
      totalPayables,
      overdueReceivablesCount,
      overduePayablesCount,
      transactionCount: list.length
    };
  }

  getReceivablesList() {
    return this.transactions
      .filter(tx => tx.type === 'in' && (tx.debtAmount > 0 || tx.paymentMethod === 'piutang'))
      .sort((a, b) => {
        if (a.debtAmount > 0 && b.debtAmount === 0) return -1;
        if (a.debtAmount === 0 && b.debtAmount > 0) return 1;
        return (a.dueDate || "9999") > (b.dueDate || "9999") ? 1 : -1;
      });
  }

  getPayablesList() {
    return this.transactions
      .filter(tx => tx.type === 'out' && (tx.debtAmount > 0 || tx.paymentMethod === 'hutang'))
      .sort((a, b) => {
        if (a.debtAmount > 0 && b.debtAmount === 0) return -1;
        if (a.debtAmount === 0 && b.debtAmount > 0) return 1;
        return (a.dueDate || "9999") > (b.dueDate || "9999") ? 1 : -1;
      });
  }

  getCategoryBreakdown(type = 'in', period = '') {
    const list = this.getFilteredTransactions({ type, period });
    const breakdown = {};

    MATERIAL_CATEGORIES.forEach(cat => {
      breakdown[cat.id] = {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        amount: 0,
        count: 0
      };
    });

    list.forEach(tx => {
      if (Array.isArray(tx.items) && tx.items.length > 0) {
        tx.items.forEach(it => {
          let catId = 'lainnya';
          if (window.inventoryStore) {
            const prod = window.inventoryStore.products.find(p => (it.id && p.id === it.id) || (it.name && p.name.toLowerCase() === it.name.toLowerCase()));
            if (prod && prod.category) {
              catId = prod.category;
            }
          }
          if (!breakdown[catId]) {
            const catObj = MATERIAL_CATEGORIES.find(c => c.id === catId);
            breakdown[catId] = {
              name: catObj ? catObj.name : catId,
              icon: catObj ? catObj.icon : '📦',
              color: catObj ? catObj.color : '#64748b',
              amount: 0,
              count: 0
            };
          }
          const itemSubtotal = it.subtotal || ((Number(it.qty) || 1) * (Number(it.price) || 0));
          breakdown[catId].amount += itemSubtotal;
          breakdown[catId].count += 1;
        });
      } else {
        const catId = tx.category || 'lainnya';
        if (!breakdown[catId]) {
          breakdown[catId] = {
            name: catId,
            icon: '📦',
            color: '#64748b',
            amount: 0,
            count: 0
          };
        }
        breakdown[catId].amount += tx.amount;
        breakdown[catId].count += 1;
      }
    });

    return Object.values(breakdown).filter(item => item.amount > 0);
  }

  getMonthlyTrends(monthsCount = 6) {
    const result = [];
    const now = new Date();

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const periodKey = `${yyyy}-${mm}`;
      const monthLabel = d.toLocaleString('id-ID', { month: 'short', year: '2-digit' });

      let revenue = 0;
      let expense = 0;
      let cashIn = 0;
      let cashOut = 0;

      this.transactions.forEach(tx => {
        if (tx.date && tx.date.startsWith(periodKey)) {
          if (tx.type === 'in') {
            revenue += tx.amount;
            cashIn += (tx.paidAmount || 0);
          } else {
            expense += tx.amount;
            cashOut += (tx.paidAmount || 0);
          }
        }
      });

      result.push({
        period: periodKey,
        label: monthLabel,
        revenue,
        expense,
        cashIn,
        cashOut,
        netProfit: revenue - expense
      });
    }

    return result;
  }

  formatRupiah(num) {
    const val = Number(num) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  }

  formatDateIndo(dateStr) {
    if (!dateStr) return "-";
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  clearAllData() {
    this.transactions = [];
    this.persistLocal();
  }
}

// Global Store Instance
window.transactionStore = new TransactionStore();
