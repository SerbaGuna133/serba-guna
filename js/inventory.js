/**
 * TB. SERBA GUNA - INVENTORY & STOCK MANAGER
 * Mengelola Master Barang, Input Stok Masuk/Keluar, Valuasi Persediaan, dan Peringatan Stok.
 */

const STORAGE_KEYS_INVENTORY = {
  PRODUCTS: "TB_SERBAGUNA_PRODUCTS",
  STOCK_LOGS: "TB_SERBAGUNA_STOCK_LOGS"
};

class InventoryStore {
  constructor() {
    this.products = [];
    this.stockLogs = [];
    this.init();
  }

  init() {
    try {
      const savedProducts = localStorage.getItem(STORAGE_KEYS_INVENTORY.PRODUCTS);
      if (savedProducts) {
        this.products = JSON.parse(savedProducts);
      } else {
        this.products = [];
        this.save();
      }
    } catch (e) {
      console.warn("Gagal memuat inventori lokal:", e);
      this.products = [];
    }

    try {
      const savedLogs = localStorage.getItem(STORAGE_KEYS_INVENTORY.STOCK_LOGS);
      if (savedLogs) {
        this.stockLogs = JSON.parse(savedLogs);
      }
    } catch (e) {
      console.warn("Gagal memuat log stok:", e);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEYS_INVENTORY.PRODUCTS, JSON.stringify(this.products));
      localStorage.setItem(STORAGE_KEYS_INVENTORY.STOCK_LOGS, JSON.stringify(this.stockLogs));
    } catch (e) {
      console.error("Gagal menyimpan inventori:", e);
    }
  }

  generateProductId() {
    const nextNum = this.products.length + 1;
    return `PRD-${String(nextNum).padStart(3, '0')}`;
  }

  addProduct(data) {
    const newProduct = {
      id: data.id || this.generateProductId(),
      name: data.name.trim(),
      category: data.category || "lainnya",
      unit: data.unit || "Pcs",
      buyPrice: Number(data.buyPrice) || 0,
      sellPrice: Number(data.sellPrice) || 0,
      stock: Number(data.stock) || 0,
      minStock: Number(data.minStock) || 5,
      location: data.location || "Gudang Utama",
      updatedAt: new Date().toISOString()
    };

    this.products.push(newProduct);
    this.logStockMovement(newProduct.id, newProduct.stock, 'in', 'Inisialisasi Master Barang Baru');
    this.save();
    return newProduct;
  }

  updateProduct(id, updatedFields) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const old = this.products[idx];
    const updated = { ...old, ...updatedFields, updatedAt: new Date().toISOString() };
    this.products[idx] = updated;
    this.save();
    return updated;
  }

  deleteProduct(id) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.products.splice(idx, 1);
    this.save();
    return true;
  }

  adjustStock(id, newQty, reason = "Stock Opname / Koreksi Fisik") {
    const p = this.products.find(item => item.id === id);
    if (!p) return null;

    const diff = newQty - p.stock;
    p.stock = Number(newQty);
    p.updatedAt = new Date().toISOString();

    this.logStockMovement(id, Math.abs(diff), diff >= 0 ? 'in' : 'out', reason);
    this.save();
    return p;
  }

  deductStockFromSale(items, txId = "") {
    if (!Array.isArray(items)) return;

    items.forEach(item => {
      const product = this.products.find(p => p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase());
      if (product) {
        const qty = Number(item.qty) || 0;
        product.stock = Math.max(0, product.stock - qty);
        product.updatedAt = new Date().toISOString();
        this.logStockMovement(product.id, qty, 'out', `Penjualan Nota #${txId}`);
      }
    });

    this.save();
  }

  addStockFromPurchase(items, txId = "") {
    if (!Array.isArray(items)) return;

    items.forEach(item => {
      let product = this.products.find(p => p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase());
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.price) || 0;

      if (product) {
        product.stock += qty;
        if (unitPrice > 0) {
          product.buyPrice = unitPrice;
        }
        product.updatedAt = new Date().toISOString();
        this.logStockMovement(product.id, qty, 'in', `Kulakan Distributor Faktur #${txId}`);
      } else if (item.name && qty > 0) {
        // Otomatis daftarkan barang baru jika belum terdaftar di master
        const newProd = {
          id: this.generateProductId(),
          name: item.name.trim(),
          category: item.category || "lainnya",
          unit: item.unit || "Pcs",
          buyPrice: unitPrice,
          sellPrice: unitPrice > 0 ? (unitPrice * 1.15) : 0,
          stock: qty,
          minStock: 5,
          location: "Gudang Utama",
          updatedAt: new Date().toISOString()
        };
        this.products.push(newProd);
        this.logStockMovement(newProd.id, qty, 'in', `Kulakan Masuk (Item Baru) Faktur #${txId}`);
      }
    });

    this.save();
  }

  logStockMovement(productId, qty, type, note) {
    this.stockLogs.unshift({
      id: `LOG-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      productId,
      qty,
      type,
      note,
      date: new Date().toISOString()
    });

    if (this.stockLogs.length > 500) {
      this.stockLogs.pop();
    }
  }

  getValuation() {
    let totalItemsCount = 0;
    let totalAssetValue = 0;
    let totalRetailValue = 0;
    let lowStockCount = 0;

    this.products.forEach(p => {
      totalItemsCount += p.stock;
      totalAssetValue += (p.stock * p.buyPrice);
      totalRetailValue += (p.stock * p.sellPrice);
      if (p.stock <= p.minStock) {
        lowStockCount++;
      }
    });

    return {
      productsCount: this.products.length,
      totalItemsCount,
      totalAssetValue,
      totalRetailValue,
      potentialProfit: totalRetailValue - totalAssetValue,
      lowStockCount
    };
  }

  getLowStockProducts() {
    return this.products.filter(p => p.stock <= p.minStock);
  }

  getFilteredProducts({ search = '', category = '', lowStockOnly = false } = {}) {
    return this.products.filter(p => {
      if (category && p.category !== category) return false;
      if (lowStockOnly && p.stock > p.minStock) return false;
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const idMatch = p.id.toLowerCase().includes(q);
        const locMatch = (p.location || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !locMatch) return false;
      }
      return true;
    });
  }

  clearAllData() {
    this.products = [];
    this.stockLogs = [];
    this.save();
  }
}

// Global Inventory Store Instance
window.inventoryStore = new InventoryStore();
