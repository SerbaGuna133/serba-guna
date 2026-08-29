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
        // Auto-assign numeric code & barcode if missing or non-numeric
        let modified = false;
        this.products.forEach((p, idx) => {
          if (!p.code || /[a-zA-Z-]/.test(p.code)) {
            p.code = String(1000 + (idx + 1));
            p.barcode = p.code;
            modified = true;
          }
          if (!p.barcode) {
            p.barcode = p.code;
            modified = true;
          }
        });
        if (modified) this.save();
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

  generateProductCode() {
    let maxNum = 1000;
    this.products.forEach(p => {
      const num = parseInt(p.code, 10);
      if (!isNaN(num) && num >= 1000 && num > maxNum) {
        maxNum = num;
      }
    });
    return String(maxNum + 1);
  }

  findProductByQuery(query) {
    if (!query) return null;
    let q = String(query).trim().toLowerCase();
    
    // Parse [Kode: XXX] or [XXX]
    const codeInBracket = q.match(/\[(?:kode:\s*)?([a-z0-9-]+)\]/i);
    if (codeInBracket && codeInBracket[1]) {
      const bCode = codeInBracket[1].toLowerCase();
      const byBracket = this.products.find(p => 
        (p.code && p.code.toLowerCase() === bCode) ||
        (p.barcode && p.barcode.toLowerCase() === bCode) ||
        p.id.toLowerCase() === bCode
      );
      if (byBracket) return byBracket;
    }

    // 1. Exact match on numeric code, barcode, or id
    const exactCode = this.products.find(p => 
      (p.code && p.code.toLowerCase() === q) ||
      (p.barcode && p.barcode.toLowerCase() === q) ||
      p.id.toLowerCase() === q
    );
    if (exactCode) return exactCode;

    // 2. Exact match on product name
    const exactName = this.products.find(p => p.name.toLowerCase() === q);
    if (exactName) return exactName;

    // 3. Match code at start e.g. "1001 - Kran Sangar"
    const prefixCode = this.products.find(p => 
      p.code && q.startsWith(p.code.toLowerCase())
    );
    if (prefixCode) return prefixCode;

    // 4. Name starts with or includes query
    return this.products.find(p => 
      p.name.toLowerCase().startsWith(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().startsWith(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ) || null;
  }

  addProduct(data) {
    const hasMultiUnit = Boolean(data.hasMultiUnit);
    const packRatio = hasMultiUnit ? Math.max(1, Number(data.packRatio) || 1) : 1;
    const packBuyPrice = hasMultiUnit ? (Number(data.packBuyPrice) || 0) : 0;
    const packSellPrice = hasMultiUnit ? (Number(data.packSellPrice) || 0) : 0;
    
    // Hitung modal eceran otomatis jika modal kemasan diisi
    let baseBuyPrice = Number(data.buyPrice) || 0;
    if (hasMultiUnit && packBuyPrice > 0 && (!baseBuyPrice || baseBuyPrice === 0)) {
      baseBuyPrice = Math.round(packBuyPrice / packRatio);
    }

    const code = (data.code || this.generateProductCode()).trim().toUpperCase();
    const barcode = (data.barcode || code).trim();

    const newProduct = {
      id: data.id || this.generateProductId(),
      code: code,
      barcode: barcode,
      name: data.name.trim(),
      category: data.category || "lainnya",
      unit: (data.unit || "Pcs").trim(),
      buyPrice: baseBuyPrice,
      sellPrice: Number(data.sellPrice) || 0,
      hasMultiUnit: hasMultiUnit,
      packUnit: hasMultiUnit ? (data.packUnit || "Dus").trim() : "",
      packRatio: packRatio,
      packBuyPrice: packBuyPrice,
      packSellPrice: packSellPrice,
      initialStock: Number(data.stock) || 0,
      stock: Number(data.stock) || 0, // Selalu disimpan dalam unit dasar (Pcs)
      minStock: Number(data.minStock) || 5,
      location: data.location || "Gudang Utama",
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.products.push(newProduct);
    this.logStockMovement(newProduct.id, newProduct.stock, 'in', 'Inisialisasi Master Barang Baru');
    this.save();

    if (window.firebaseService && window.firebaseService.isCloudActive) {
      window.firebaseService.saveProduct(newProduct);
    }
    return newProduct;
  }

  updateProduct(id, updatedFields) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const old = this.products[idx];
    const hasMultiUnit = updatedFields.hasMultiUnit !== undefined ? Boolean(updatedFields.hasMultiUnit) : old.hasMultiUnit;
    const packRatio = hasMultiUnit ? Math.max(1, Number(updatedFields.packRatio !== undefined ? updatedFields.packRatio : old.packRatio) || 1) : 1;
    const code = updatedFields.code ? updatedFields.code.trim().toUpperCase() : (old.code || old.id);
    const barcode = updatedFields.barcode ? updatedFields.barcode.trim() : (old.barcode || code);

    const updated = { 
      ...old, 
      ...updatedFields, 
      code,
      barcode,
      hasMultiUnit,
      packRatio,
      updatedAt: new Date().toISOString() 
    };

    this.products[idx] = updated;
    this.save();

    if (window.firebaseService && window.firebaseService.isCloudActive) {
      window.firebaseService.saveProduct(updated);
    }
    return updated;
  }

  deleteProduct(id) {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.products.splice(idx, 1);
    this.save();

    if (window.firebaseService && window.firebaseService.isCloudActive) {
      window.firebaseService.deleteProduct(id);
    }
    return true;
  }

  updateFromCloud(cloudProducts) {
    if (!cloudProducts || !Array.isArray(cloudProducts)) return;
    this.products = cloudProducts;
    this.save();
  }

  getProductUnits(product) {
    if (!product) return [];
    const base = {
      unitName: product.unit || "Pcs",
      ratio: 1,
      buyPrice: Number(product.buyPrice) || 0,
      sellPrice: Number(product.sellPrice) || 0,
      isPack: false,
      label: `🏷️ ${product.unit || 'Pcs'} (Eceran) - Rp ${(Number(product.sellPrice) || 0).toLocaleString('id-ID')}`
    };

    if (product.hasMultiUnit && product.packUnit && (Number(product.packRatio) || 1) > 1) {
      const pack = {
        unitName: product.packUnit,
        ratio: Number(product.packRatio),
        buyPrice: Number(product.packBuyPrice) || (Number(product.buyPrice) * Number(product.packRatio)),
        sellPrice: Number(product.packSellPrice) || (Number(product.sellPrice) * Number(product.packRatio)),
        isPack: true,
        label: `📦 ${product.packUnit} (${product.packRatio} ${product.unit}) - Rp ${(Number(product.packSellPrice) || 0).toLocaleString('id-ID')}`
      };
      return [pack, base]; // Tampilkan kemasan & eceran
    }

    return [base];
  }

  adjustStock(id, newQty, reason = "Stock Opname / Koreksi Fisik") {
    const p = this.products.find(item => item.id === id);
    if (!p) return null;

    const diff = newQty - p.stock;
    p.stock = Number(newQty);
    p.updatedAt = new Date().toISOString();

    this.logStockMovement(id, Math.abs(diff), diff >= 0 ? 'in' : 'out', reason);
    this.save();

    if (window.firebaseService && window.firebaseService.isCloudActive) {
      window.firebaseService.saveProduct(p);
    }
    return p;
  }

  deductStockFromSale(items, txId = "") {
    if (!Array.isArray(items)) return;

    items.forEach(item => {
      const product = this.products.find(p => p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase());
      if (product) {
        const qty = Number(item.qty) || 0;
        const ratio = Number(item.unitRatio) || 1;
        const totalBaseQty = qty * ratio;

        product.stock = Math.max(0, product.stock - totalBaseQty);
        product.updatedAt = new Date().toISOString();

        const unitLabel = item.unit ? `${qty} ${item.unit}` : `${qty} ${product.unit}`;
        this.logStockMovement(product.id, totalBaseQty, 'out', `Penjualan Nota #${txId} (${unitLabel})`);

        if (window.firebaseService && window.firebaseService.isCloudActive) {
          window.firebaseService.saveProduct(product);
        }
      }
    });

    this.save();
  }

  addStockFromPurchase(items, txId = "") {
    if (!Array.isArray(items)) return;

    items.forEach(item => {
      let product = this.products.find(p => p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase());
      const qty = Number(item.qty) || 0;
      const ratio = Number(item.unitRatio) || 1;
      const totalBaseQty = qty * ratio;
      const unitPrice = Number(item.price) || 0;

      if (product) {
        product.stock += totalBaseQty;
        if (unitPrice > 0) {
          // Jika beli kemasan, simpan harga modal kemasan & eceran
          if (ratio > 1) {
            product.packBuyPrice = unitPrice;
            product.buyPrice = Math.round(unitPrice / ratio);
          } else {
            product.buyPrice = unitPrice;
          }
        }
        product.updatedAt = new Date().toISOString();
        const unitLabel = item.unit ? `${qty} ${item.unit}` : `${qty} ${product.unit}`;
        this.logStockMovement(product.id, totalBaseQty, 'in', `Kulakan Distributor Faktur #${txId} (${unitLabel})`);

        if (window.firebaseService && window.firebaseService.isCloudActive) {
          window.firebaseService.saveProduct(product);
        }
      } else if (item.name && qty > 0) {
        // Otomatis daftarkan barang baru jika belum terdaftar di master
        const newProd = {
          id: this.generateProductId(),
          name: item.name.trim(),
          category: item.category || "lainnya",
          unit: item.unit || "Pcs",
          buyPrice: unitPrice,
          sellPrice: unitPrice > 0 ? Math.round(unitPrice * 1.15) : 0,
          hasMultiUnit: false,
          packUnit: "",
          packRatio: 1,
          packBuyPrice: 0,
          packSellPrice: 0,
          stock: totalBaseQty,
          minStock: 5,
          location: "Gudang Utama",
          updatedAt: new Date().toISOString()
        };
        this.products.push(newProd);
        this.logStockMovement(newProd.id, totalBaseQty, 'in', `Kulakan Masuk (Item Baru) Faktur #${txId}`);

        if (window.firebaseService && window.firebaseService.isCloudActive) {
          window.firebaseService.saveProduct(newProd);
        }
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
        const codeMatch = p.code ? p.code.toLowerCase().includes(q) : false;
        const barcodeMatch = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
        const locMatch = (p.location || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !codeMatch && !barcodeMatch && !locMatch) return false;
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
