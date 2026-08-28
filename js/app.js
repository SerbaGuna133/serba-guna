/**
 * TB. SERBA GUNA - MASTER APPLICATION CONTROLLER
 * Menghubungkan Navigasi SPA, Kasir POS, Inventori Stok, Jurnal Umum,
 * Buku Besar, Neraca Lajur 10 Kolom, Laporan Neraca & Laba Rugi, serta Bagan Akun (COA).
 */

class AppController {
  constructor() {
    this.store = window.transactionStore;
    this.inventory = window.inventoryStore;
    this.accounting = window.accountingEngine;
    this.charts = window.financeCharts;
    this.export = window.exportManager;
    this.firebase = window.firebaseService;
    this.auth = window.authManager;

    this.currentTab = 'dashboard';
    this.selectedPeriod = '';
    this.editingTxId = null;
    this.editingProdId = null;

    this.init();
  }

  async init() {
    this.initTheme();
    this.populateCategoryOptions();
    this.populateCOAOptions();
    this.bindEvents();

    // Periksa status login pengguna
    const isAuthed = this.checkAuthStatus();

    if (this.firebase.config) {
      await this.firebase.init();
      this.firebase.listenToTransactions(
        (cloudData) => {
          this.store.updateFromCloud(cloudData);
          this.refreshCurrentView();
          this.showToast("Data tersinkronisasi dari Cloud Firebase!", "info");
        },
        (err) => console.warn("Listener cloud error:", err)
      );
    }

    this.updateCloudStatusBadge();
    this.updateStoreProfileHeader();
    if (isAuthed) {
      this.switchTab('dashboard');
    }
  }

  // ==================== AUTH & SESSION ====================
  checkAuthStatus() {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');

    if (!this.auth || !this.auth.isLoggedIn()) {
      if (loginScreen) loginScreen.style.display = 'flex';
      if (appContainer) appContainer.style.display = 'none';
      return false;
    } else {
      if (loginScreen) loginScreen.style.display = 'none';
      if (appContainer) appContainer.style.display = 'block';
      this.updateUserSessionHeader();
      return true;
    }
  }

  updateUserSessionHeader() {
    const user = this.auth.getCurrentUser();
    if (!user) return;

    const avatarEl = document.getElementById('headerUserAvatar');
    const nameEl = document.getElementById('headerUserName');
    if (avatarEl) avatarEl.textContent = user.role === 'owner' ? '👑' : '💼';
    if (nameEl) nameEl.textContent = user.name;
  }

  async handleLogin(e) {
    if (e) e.preventDefault();
    const alertBox = document.getElementById('loginAlert');
    const userInp = document.getElementById('loginUsername');
    const passInp = document.getElementById('loginPassword');
    const remInp = document.getElementById('loginRememberMe');
    const submitBtn = document.getElementById('btnLoginSubmit');

    const username = userInp ? userInp.value.trim() : '';
    const password = passInp ? passInp.value.trim() : '';
    const rememberMe = remInp ? remInp.checked : true;

    try {
      if (alertBox) alertBox.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Memverifikasi...';
      }

      const user = await this.auth.login(username, password, rememberMe);

      const loginScreen = document.getElementById('loginScreen');
      const appContainer = document.getElementById('appContainer');
      if (loginScreen) loginScreen.style.display = 'none';
      if (appContainer) appContainer.style.display = 'block';

      this.updateUserSessionHeader();
      this.refreshCurrentView();
      this.showToast(`Selamat datang kembali, ${user.name}! 👋`);
    } catch (err) {
      if (alertBox) {
        alertBox.textContent = err.message;
        alertBox.style.display = 'block';
      } else {
        alert(err.message);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Masuk ke Aplikasi';
      }
    }
  }

  async handleLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dan mengunci aplikasi TB. Serba Guna?")) {
      await this.auth.logout();
      const loginScreen = document.getElementById('loginScreen');
      const appContainer = document.getElementById('appContainer');
      if (loginScreen) loginScreen.style.display = 'flex';
      if (appContainer) appContainer.style.display = 'none';

      const passInp = document.getElementById('loginPassword');
      if (passInp) passInp.value = '';

      this.showToast("Anda telah keluar dari aplikasi.", "warning");
    }
  }

  fillLoginPreset(username, password) {
    const userInp = document.getElementById('loginUsername');
    const passInp = document.getElementById('loginPassword');
    if (userInp) userInp.value = username;
    if (passInp) passInp.value = password;
    this.handleLogin();
  }

  togglePasswordVisibility() {
    const passInp = document.getElementById('loginPassword');
    const btn = document.getElementById('btnTogglePassword');
    if (!passInp) return;

    if (passInp.type === 'password') {
      passInp.type = 'text';
      if (btn) btn.textContent = '🙈';
    } else {
      passInp.type = 'password';
      if (btn) btn.textContent = '👁️';
    }
  }

  async handleChangePassword(e) {
    if (e) e.preventDefault();
    const userSelect = document.getElementById('pwdUserSelect')?.value;
    const newName = document.getElementById('pwdDisplayName')?.value;
    const oldPass = document.getElementById('pwdOld')?.value;
    const newPass = document.getElementById('pwdNew')?.value;

    try {
      let updatedItems = [];

      // 1. Update nama jika diisi
      if (newName && newName.trim()) {
        this.auth.updateProfile(userSelect, newName.trim());
        this.updateUserSessionHeader();
        updatedItems.push("nama tampilan");
      }

      // 2. Update password jika diisi
      if (newPass && newPass.trim()) {
        if (!oldPass || !oldPass.trim()) {
          alert("Silakan masukkan password lama Anda untuk mengubah kata sandi baru.");
          return;
        }
        await this.auth.changePassword(userSelect, oldPass, newPass);
        updatedItems.push("kata sandi");
      }

      if (updatedItems.length > 0) {
        document.getElementById('formChangePassword')?.reset();
        this.showToast(`Berhasil memperbarui ${updatedItems.join(' dan ')} akun ${userSelect}!`);
      } else {
        this.showToast("Silakan isi nama baru atau password baru yang ingin diubah.", "warning");
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // ==================== TEMA ====================
  initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    this.charts.updateAll(this.selectedPeriod);
    this.showToast(`Mode tema diubah ke: ${newTheme === 'dark' ? 'Gelap 🌙' : 'Terang ☀️'}`);
  }

  updateStoreProfileHeader() {
    const profile = this.store.storeProfile;
    const nameEl = document.getElementById('headerStoreName');
    const taglineEl = document.getElementById('headerStoreTagline');
    if (nameEl) nameEl.textContent = profile.name;
    if (taglineEl) taglineEl.textContent = profile.tagline;
  }

  updateCloudStatusBadge() {
    const pill = document.getElementById('cloudStatusPill');
    const text = document.getElementById('cloudStatusText');
    const settingsLabel = document.getElementById('settingsCloudStatusLabel');
    if (!pill || !text) return;

    if (this.firebase.isCloudActive) {
      pill.className = 'cloud-status-badge online';
      text.textContent = 'Cloud Firebase';
      if (settingsLabel) {
        settingsLabel.innerHTML = `🟢 Terhubung ke Project: <strong>${this.firebase.config.projectId}</strong>`;
        settingsLabel.style.color = 'var(--success)';
      }
    } else {
      pill.className = 'cloud-status-badge offline';
      text.textContent = 'Mode Offline';
      if (settingsLabel) {
        settingsLabel.innerHTML = `🟡 Mode Penyimpanan Lokal (Offline LocalStorage)`;
        settingsLabel.style.color = 'var(--warning)';
      }
    }
  }

  updateNavBadges() {
    const recList = this.store.getReceivablesList().filter(r => r.debtAmount > 0);
    const payList = this.store.getPayablesList().filter(p => p.debtAmount > 0);
    const lowStockList = this.inventory ? this.inventory.getLowStockProducts() : [];

    const recBadge = document.getElementById('navBadgeReceivables');
    const payBadge = document.getElementById('navBadgePayables');
    const invBadge = document.getElementById('navBadgeInventory');

    if (recBadge) recBadge.textContent = recList.length;
    if (payBadge) payBadge.textContent = payList.length;
    if (invBadge) invBadge.textContent = lowStockList.length;
  }

  populateCategoryOptions() {
    // 1. Filter Transaksi
    const txFilter = document.getElementById('txCategoryFilter');
    if (txFilter) {
      txFilter.innerHTML = '<option value="">Semua Kategori Material</option>';
      MATERIAL_CATEGORIES.filter(c => c.group === 'material').forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.icon} ${c.name}`;
        txFilter.appendChild(opt);
      });
    }

    // 2. Filter Inventori & Modal Tambah Barang Master (HANYA Barang Fisik Material)
    const invSelects = [
      document.getElementById('invCategoryFilter'),
      document.getElementById('modalProdCategory')
    ];

    invSelects.forEach(select => {
      if (!select) return;
      const isFilter = select.id.includes('Filter');
      select.innerHTML = isFilter ? '<option value="">Semua Kategori Material</option>' : '';

      MATERIAL_CATEGORIES.filter(c => c.group === 'material').forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = `${cat.icon} ${cat.name}`;
        select.appendChild(opt);
      });
    });
  }

  populateCOAOptions() {
    const ledgerSelect = document.getElementById('ledgerAccountSelect');
    if (!ledgerSelect) return;

    ledgerSelect.innerHTML = '<option value="all">Semua Akun Buku Besar</option>';
    this.accounting.coa.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.code;
      opt.textContent = `${acc.code} - ${acc.name}`;
      ledgerSelect.appendChild(opt);
    });
  }

  // ==================== NAVIGASI TAB ====================
  switchTab(tabId) {
    this.currentTab = tabId;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSection = document.getElementById(`view${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`)
      || document.getElementById(`view${tabId.toUpperCase()}`)
      || document.getElementById(`view${tabId.toLowerCase()}`)
      || document.getElementById(`view${tabId}`);

    if (targetSection) {
      targetSection.classList.add('active');
    }

    this.refreshCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  refreshCurrentView() {
    this.updateNavBadges();

    switch (this.currentTab) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'transactions':
        this.renderTransactionsTable();
        break;
      case 'inventory':
        this.renderInventoryView();
        break;
      case 'receivables':
        this.renderReceivablesView();
        break;
      case 'payables':
        this.renderPayablesView();
        break;
      case 'journal':
        this.renderJournalView();
        break;
      case 'ledger':
        this.renderLedgerView();
        break;
      case 'worksheet':
        this.renderWorksheetView();
        break;
      case 'reports':
        this.renderReportsView();
        break;
      case 'coa':
        this.renderCOAView();
        break;
      case 'settings':
        this.renderSettingsView();
        break;
    }
  }

  // ==================== VIEW 1: DASHBOARD ====================
  renderDashboard() {
    const stats = this.store.getFinancialStats(this.selectedPeriod);
    const invVal = this.inventory ? this.inventory.getValuation() : { totalAssetValue: 0, lowStockCount: 0 };

    const elCash = document.getElementById('kpiNetCash');
    if (elCash) {
      elCash.textContent = this.store.formatRupiah(stats.netCash);
      elCash.className = `stat-value ${stats.netCash < 0 ? 'text-danger' : 'text-success'}`;
    }

    document.getElementById('kpiRevenue').textContent = this.store.formatRupiah(stats.totalRevenue);
    document.getElementById('kpiInventoryVal').textContent = this.store.formatRupiah(invVal.totalAssetValue);
    document.getElementById('kpiLowStockAlert').textContent = `${invVal.lowStockCount} item stok menipis (⚠️ Low Stock)`;

    const elProfit = document.getElementById('kpiNetProfit');
    if (elProfit) {
      elProfit.textContent = this.store.formatRupiah(stats.netProfit);
      elProfit.className = `stat-value ${stats.netProfit < 0 ? 'text-danger' : 'text-success'}`;
    }
    document.getElementById('kpiProfitMargin').textContent = `${stats.profitMargin}%`;
    document.getElementById('kpiReceivables').textContent = this.store.formatRupiah(stats.totalReceivables);
    document.getElementById('kpiPayables').textContent = this.store.formatRupiah(stats.totalPayables);

    const overdueRecEl = document.getElementById('kpiOverdueReceivables');
    if (overdueRecEl) {
      overdueRecEl.textContent = stats.overdueReceivablesCount > 0 
        ? `⚠️ ${stats.overdueReceivablesCount} bon jatuh tempo`
        : `✅ Tidak ada bon jatuh tempo`;
    }

    const overduePayEl = document.getElementById('kpiOverduePayables');
    if (overduePayEl) {
      overduePayEl.textContent = stats.overduePayablesCount > 0
        ? `⚠️ ${stats.overduePayablesCount} faktur jatuh tempo`
        : `✅ Jadwal tempo aman`;
    }

    const recentList = this.store.getFilteredTransactions({ period: this.selectedPeriod }).slice(0, 6);
    const tbody = document.getElementById('tbodyRecentTransactions');
    if (tbody) {
      if (recentList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">Belum ada data transaksi di periode ini.</td></tr>`;
      } else {
        tbody.innerHTML = recentList.map(tx => this.generateTxTableRowHTML(tx)).join('');
      }
    }

    setTimeout(() => {
      this.charts.updateAll(this.selectedPeriod);
    }, 50);
  }

  // ==================== VIEW 2: TRANSAKSI & BUKU KAS ====================
  renderTransactionsTable() {
    const search = document.getElementById('txSearchInput')?.value || '';
    const type = document.getElementById('txTypeFilter')?.value || 'all';
    const category = document.getElementById('txCategoryFilter')?.value || '';
    const status = document.getElementById('txStatusFilter')?.value || 'all';

    const list = this.store.getFilteredTransactions({
      search, type, category, status, period: this.selectedPeriod
    });

    const tbody = document.getElementById('tbodyAllTransactions');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted" style="padding: 3rem;">Tidak ada transaksi yang cocok dengan filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(tx => {
      const catObj = MATERIAL_CATEGORIES.find(c => c.id === tx.category) || { name: tx.category, icon: '📦' };
      const isPiutang = tx.paymentMethod === 'piutang';
      const isHutang = tx.paymentMethod === 'hutang';

      let methodBadge = `<span class="badge badge-gray">Tunai</span>`;
      if (tx.paymentMethod === 'transfer') methodBadge = `<span class="badge badge-info">Transfer</span>`;
      if (isPiutang) methodBadge = `<span class="badge badge-warning">Bon Piutang</span>`;
      if (isHutang) methodBadge = `<span class="badge badge-purple">Hutang Distributor</span>`;

      const statusBadge = tx.status === 'lunas' 
        ? `<span class="badge badge-success">Lunas</span>` 
        : `<span class="badge badge-danger">Tempo (${this.store.formatDateIndo(tx.dueDate)})</span>`;

      return `
        <tr>
          <td class="font-mono text-xs"><strong>${tx.id}</strong></td>
          <td>${this.store.formatDateIndo(tx.date)}</td>
          <td><span class="category-pill">${catObj.icon} ${catObj.name}</span></td>
          <td>
            <strong>${tx.title}</strong>
            ${tx.notes ? `<div class="text-xs text-muted mt-1">${tx.notes}</div>` : ''}
          </td>
          <td>${tx.customer || tx.supplier || '-'}</td>
          <td>${methodBadge}</td>
          <td class="text-right font-bold ${tx.type === 'in' ? 'text-success' : 'text-danger'}">
            ${tx.type === 'in' ? '+' : '-'} ${this.store.formatRupiah(tx.amount)}
          </td>
          <td class="text-right">${this.store.formatRupiah(tx.paidAmount)}</td>
          <td class="text-right font-semibold ${tx.debtAmount > 0 ? 'text-danger' : 'text-muted'}">
            ${this.store.formatRupiah(tx.debtAmount)}
          </td>
          <td>${statusBadge}</td>
          <td class="text-center">
            <div class="table-actions justify-between">
              <button class="btn-icon-only" onclick="window.app.openReceiptModal('${tx.id}')" title="Cetak Nota / Faktur">🖨️</button>
              ${tx.debtAmount > 0 ? `
                <button class="btn-icon-only" onclick="window.app.openRepaymentModal('${tx.id}')" title="Bayar Cicilan" style="color: var(--success);">💵</button>
              ` : ''}
              <button class="btn-icon-only" onclick="window.app.deleteTransaction('${tx.id}')" title="Hapus Transaksi" style="color: var(--danger);">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  generateTxTableRowHTML(tx) {
    const catObj = MATERIAL_CATEGORIES.find(c => c.id === tx.category) || { name: tx.category, icon: '📦' };
    const methodLabel = tx.paymentMethod === 'cash' ? '💵 Tunai' :
      tx.paymentMethod === 'transfer' ? '💳 Transfer' :
      tx.paymentMethod === 'piutang' ? '📑 Bon Proyek' : '🤝 Hutang Tempo';

    return `
      <tr>
        <td>${this.store.formatDateIndo(tx.date)} <span class="text-xs text-muted">${tx.time || ''}</span></td>
        <td><span class="category-pill">${catObj.icon} ${catObj.name}</span></td>
        <td><strong>${tx.title}</strong></td>
        <td>${tx.customer || tx.supplier || 'Umum'}</td>
        <td><small>${methodLabel}</small></td>
        <td class="text-right font-bold ${tx.type === 'in' ? 'text-success' : 'text-danger'}">
          ${tx.type === 'in' ? '+' : '-'} ${this.store.formatRupiah(tx.amount)}
        </td>
        <td>
          <span class="badge ${tx.status === 'lunas' ? 'badge-success' : 'badge-danger'}">
            ${tx.status === 'lunas' ? 'LUNAS' : 'TEMPO'}
          </span>
        </td>
        <td class="text-center">
          <button class="btn-icon-only btn-sm" onclick="window.app.openReceiptModal('${tx.id}')" title="Cetak Nota">🖨️</button>
        </td>
      </tr>
    `;
  }

  // ==================== VIEW 3: INVENTORI & STOK ====================
  renderInventoryView() {
    const search = document.getElementById('invSearchInput')?.value || '';
    const category = document.getElementById('invCategoryFilter')?.value || '';
    const lowStockOnly = document.getElementById('invLowStockOnly')?.checked || false;

    const val = this.inventory.getValuation();
    document.getElementById('invValAsset').textContent = this.store.formatRupiah(val.totalAssetValue);
    document.getElementById('invValRetail').textContent = this.store.formatRupiah(val.totalRetailValue);
    document.getElementById('invValMargin').textContent = this.store.formatRupiah(val.potentialProfit);
    document.getElementById('invValLowCount').textContent = `${val.lowStockCount} Barang`;
    document.getElementById('invTotalItemsCount').textContent = `${val.totalItemsCount} Unit Material di Gudang (${val.productsCount} Jenis)`;

    const list = this.inventory.getFilteredProducts({ search, category, lowStockOnly });
    const tbody = document.getElementById('tbodyInventory');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding: 3rem;">Tidak ada barang yang cocok dengan pencarian.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const catObj = MATERIAL_CATEGORIES.find(c => c.id === p.category) || { name: p.category, icon: '📦' };
      const isLow = p.stock <= p.minStock;

      return `
        <tr>
          <td class="font-mono text-xs"><strong>${p.id}</strong></td>
          <td>
            <strong>${p.name}</strong>
            ${p.hasMultiUnit ? `<div style="font-size: 0.72rem; color: #d97706; font-weight: 600; margin-top: 0.15rem;">📦 1 ${p.packUnit} = ${p.packRatio} ${p.unit}</div>` : ''}
          </td>
          <td><span class="category-pill">${catObj.icon} ${catObj.name}</span></td>
          <td>
            <strong>${p.unit}</strong>
            ${p.hasMultiUnit ? `<div class="text-xs text-muted">/ ${p.packUnit}</div>` : ''}
          </td>
          <td class="text-right">
            ${this.store.formatRupiah(p.buyPrice)}
            ${p.hasMultiUnit && p.packBuyPrice ? `<div class="text-xs text-muted font-normal">${this.store.formatRupiah(p.packBuyPrice)}/${p.packUnit}</div>` : ''}
          </td>
          <td class="text-right font-bold text-success">
            ${this.store.formatRupiah(p.sellPrice)}
            ${p.hasMultiUnit && p.packSellPrice ? `<div class="text-xs text-muted font-normal" style="color: #b45309;">${this.store.formatRupiah(p.packSellPrice)}/${p.packUnit}</div>` : ''}
          </td>
          <td class="text-center font-bold" style="font-size: 0.95rem;">
            ${p.stock} <small class="font-normal text-muted">${p.unit}</small>
            ${p.hasMultiUnit && p.packRatio > 1 ? `<div class="text-xs text-muted font-normal">≈ ${(p.stock / p.packRatio).toFixed(1)} ${p.packUnit}</div>` : ''}
          </td>
          <td>
            <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">
              ${isLow ? '⚠️ STOK MENIPIS' : '✅ TERSEDIA'}
            </span>
          </td>
          <td><small class="text-muted">${p.location || '-'}</small></td>
          <td class="text-center">
            <div class="table-actions justify-between">
              <button class="btn-icon-only btn-sm" onclick="window.app.openEditProductModal('${p.id}')" title="Edit Barang">✏️</button>
              <button class="btn-icon-only btn-sm" onclick="window.app.openStockOpnameModal('${p.id}')" title="Stock Opname (Koreksi)">⚙️</button>
              <button class="btn-icon-only btn-sm text-danger" onclick="window.app.deleteProduct('${p.id}')" title="Hapus Barang">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==================== VIEW 4 & 5: PIUTANG & HUTANG ====================
  renderReceivablesView() {
    const search = document.getElementById('recSearchInput')?.value || '';
    const filter = document.getElementById('recStatusFilter')?.value || 'active';
    const today = new Date().toISOString().split('T')[0];

    let list = this.store.getReceivablesList();
    if (filter === 'active') list = list.filter(r => r.debtAmount > 0);
    else if (filter === 'overdue') list = list.filter(r => r.debtAmount > 0 && r.dueDate && r.dueDate < today);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => (r.customer || '').toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q) || (r.phone || '').toLowerCase().includes(q));
    }

    const allReceivables = this.store.getReceivablesList();
    const totalDebt = allReceivables.reduce((acc, curr) => acc + curr.debtAmount, 0);
    const totalPaid = allReceivables.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
    const overdueCount = allReceivables.filter(r => r.debtAmount > 0 && r.dueDate && r.dueDate < today).length;

    document.getElementById('recSummaryTotal').textContent = this.store.formatRupiah(totalDebt);
    document.getElementById('recSummaryPaid').textContent = this.store.formatRupiah(totalPaid);
    document.getElementById('recSummaryOverdue').textContent = `${overdueCount} Bon`;
    document.getElementById('recSummaryCount').textContent = `${allReceivables.filter(r => r.debtAmount > 0).length} Bon Belum Lunas`;

    const container = document.getElementById('receivablesGrid');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `<div class="card text-center text-muted" style="grid-column: 1 / -1; padding: 3rem;">Tidak ada data piutang bon yang cocok.</div>`;
      return;
    }

    container.innerHTML = list.map(tx => {
      const isOverdue = tx.debtAmount > 0 && tx.dueDate && tx.dueDate < today;
      const pctPaid = tx.amount > 0 ? Math.min(100, ((tx.paidAmount / tx.amount) * 100)).toFixed(0) : 0;

      return `
        <div class="debt-card ${isOverdue ? 'accent-red' : ''}">
          <div>
            <div class="debt-card-header">
              <div>
                <div class="debt-customer-name">👤 ${tx.customer || 'Pelanggan Tanpa Nama'}</div>
                <div class="debt-project-title">${tx.title}</div>
                ${tx.phone ? `<div class="text-xs text-muted mt-1">📞 Telp: ${tx.phone}</div>` : ''}
              </div>
              <span class="badge ${tx.debtAmount === 0 ? 'badge-success' : isOverdue ? 'badge-danger' : 'badge-warning'}">
                ${tx.debtAmount === 0 ? 'LUNAS' : isOverdue ? 'JATUH TEMPO' : 'BELUM LUNAS'}
              </span>
            </div>

            <div class="debt-amounts-box mt-3">
              <div>
                <div class="amount-item-label">Total Bon</div>
                <div class="amount-item-val">${this.store.formatRupiah(tx.amount)}</div>
              </div>
              <div>
                <div class="amount-item-label">Sisa Tagihan</div>
                <div class="amount-item-val ${tx.debtAmount > 0 ? 'text-danger' : 'text-success'}">${this.store.formatRupiah(tx.debtAmount)}</div>
              </div>
              <div style="grid-column: span 2;">
                <div class="d-flex justify-between text-xs text-muted">
                  <span>Sudah Dibayar: ${this.store.formatRupiah(tx.paidAmount)}</span>
                  <span>${pctPaid}%</span>
                </div>
                <div class="progress-bar-wrap">
                  <div class="progress-bar-fill" style="width: ${pctPaid}%;"></div>
                </div>
              </div>
            </div>

            ${tx.dueDate ? `
              <div class="debt-due-alert mt-2 ${isOverdue ? 'text-danger' : 'text-muted'}">
                📅 Jatuh Tempo: ${this.store.formatDateIndo(tx.dueDate)} ${isOverdue ? '<strong>(JATUH TEMPO!)</strong>' : ''}
              </div>
            ` : ''}
          </div>

          <div class="debt-card-actions">
            ${tx.debtAmount > 0 ? `
              <button class="btn btn-success btn-sm flex-1" onclick="window.app.openRepaymentModal('${tx.id}')">
                💵 Bayar Cicilan
              </button>
            ` : ''}
            <button class="btn btn-outline btn-sm" onclick="window.app.openReceiptModal('${tx.id}')" title="Cetak Faktur">
              🖨️ Cetak Faktur
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderPayablesView() {
    const search = document.getElementById('paySearchInput')?.value || '';
    const filter = document.getElementById('payStatusFilter')?.value || 'active';
    const today = new Date().toISOString().split('T')[0];

    let list = this.store.getPayablesList();
    if (filter === 'active') list = list.filter(p => p.debtAmount > 0);
    else if (filter === 'overdue') list = list.filter(p => p.debtAmount > 0 && p.dueDate && p.dueDate < today);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.supplier || '').toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q) || (p.phone || '').toLowerCase().includes(q));
    }

    const allPayables = this.store.getPayablesList();
    const totalDebt = allPayables.reduce((acc, curr) => acc + curr.debtAmount, 0);
    const totalPaid = allPayables.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
    const overdueCount = allPayables.filter(p => p.debtAmount > 0 && p.dueDate && p.dueDate < today).length;

    document.getElementById('paySummaryTotal').textContent = this.store.formatRupiah(totalDebt);
    document.getElementById('paySummaryPaid').textContent = this.store.formatRupiah(totalPaid);
    document.getElementById('paySummaryOverdue').textContent = `${overdueCount} Faktur`;
    document.getElementById('paySummaryCount').textContent = `${allPayables.filter(p => p.debtAmount > 0).length} Faktur Belum Lunas`;

    const container = document.getElementById('payablesGrid');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `<div class="card text-center text-muted" style="grid-column: 1 / -1; padding: 3rem;">Tidak ada data hutang distributor yang cocok.</div>`;
      return;
    }

    container.innerHTML = list.map(tx => {
      const isOverdue = tx.debtAmount > 0 && tx.dueDate && tx.dueDate < today;
      const pctPaid = tx.amount > 0 ? Math.min(100, ((tx.paidAmount / tx.amount) * 100)).toFixed(0) : 0;

      return `
        <div class="debt-card ${isOverdue ? 'accent-red' : ''}">
          <div>
            <div class="debt-card-header">
              <div>
                <div class="debt-customer-name">🏭 ${tx.supplier || 'Distributor'}</div>
                <div class="debt-project-title">${tx.title}</div>
                ${tx.phone ? `<div class="text-xs text-muted mt-1">📞 Kontak: ${tx.phone}</div>` : ''}
              </div>
              <span class="badge ${tx.debtAmount === 0 ? 'badge-success' : isOverdue ? 'badge-danger' : 'badge-purple'}">
                ${tx.debtAmount === 0 ? 'LUNAS' : isOverdue ? 'JATUH TEMPO' : 'TEMPO AKTIF'}
              </span>
            </div>

            <div class="debt-amounts-box mt-3">
              <div>
                <div class="amount-item-label">Total Faktur</div>
                <div class="amount-item-val">${this.store.formatRupiah(tx.amount)}</div>
              </div>
              <div>
                <div class="amount-item-label">Sisa Hutang</div>
                <div class="amount-item-val ${tx.debtAmount > 0 ? 'text-danger' : 'text-success'}">${this.store.formatRupiah(tx.debtAmount)}</div>
              </div>
              <div style="grid-column: span 2;">
                <div class="d-flex justify-between text-xs text-muted">
                  <span>Sudah Dibayar: ${this.store.formatRupiah(tx.paidAmount)}</span>
                  <span>${pctPaid}%</span>
                </div>
                <div class="progress-bar-wrap">
                  <div class="progress-bar-fill" style="width: ${pctPaid}%;"></div>
                </div>
              </div>
            </div>

            ${tx.dueDate ? `
              <div class="debt-due-alert mt-2 ${isOverdue ? 'text-danger' : 'text-muted'}">
                📅 Jatuh Tempo: ${this.store.formatDateIndo(tx.dueDate)} ${isOverdue ? '<strong>(JATUH TEMPO!)</strong>' : ''}
              </div>
            ` : ''}
          </div>

          <div class="debt-card-actions">
            ${tx.debtAmount > 0 ? `
              <button class="btn btn-primary btn-sm flex-1" onclick="window.app.openRepaymentModal('${tx.id}')">
                💵 Bayar Hutang
              </button>
            ` : ''}
            <button class="btn btn-outline btn-sm" onclick="window.app.openReceiptModal('${tx.id}')" title="Cetak Bukti">
              🖨️ Cetak Bukti
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==================== VIEW 6: JURNAL UMUM ====================
  renderJournalView() {
    const journals = this.accounting.getAllJournals(this.selectedPeriod);
    const tbody = document.getElementById('tbodyJournals');
    if (!tbody) return;

    if (journals.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 3rem;">Belum ada ayat jurnal pada periode ini.</td></tr>`;
      return;
    }

    let totDebit = 0;
    let totCredit = 0;
    let rowsHTML = "";

    journals.forEach(j => {
      j.lines.forEach((l, idx) => {
        const acc = this.accounting.getAccount(l.accountCode);
        const deb = Number(l.debit) || 0;
        const cre = Number(l.credit) || 0;
        totDebit += deb;
        totCredit += cre;

        const isFirstLine = idx === 0;
        const isIndent = cre > 0;

        let actionCellHTML = '';
        if (isFirstLine) {
          if (!j.isAuto) {
            actionCellHTML = `
              <td class="text-center" rowspan="${j.lines.length}" style="vertical-align: middle; border-left: 1px solid var(--border-color);">
                <div class="table-actions justify-center">
                  <button class="btn-icon-only btn-sm" onclick="window.app.openEditManualJournalModal('${j.id}')" title="Edit Jurnal">✏️</button>
                  <button class="btn-icon-only btn-sm text-danger" onclick="window.app.deleteManualJournal('${j.id}')" title="Hapus Jurnal">🗑️</button>
                </div>
              </td>
            `;
          } else {
            actionCellHTML = `
              <td class="text-center text-muted text-xs" rowspan="${j.lines.length}" style="vertical-align: middle; border-left: 1px solid var(--border-color);">
                <span class="badge badge-gray text-xs" title="Otomatis dari Transaksi / Stok (Diedit di menu Buku Kas / Stok)">Otomatis</span>
              </td>
            `;
          }
        }

        rowsHTML += `
          <tr style="${isFirstLine ? 'border-top: 1px solid var(--border-color);' : ''}">
            <td class="text-muted text-xs">${isFirstLine ? this.store.formatDateIndo(j.date) : ''}</td>
            <td class="font-mono text-xs">${isFirstLine ? `<strong>${j.voucherNo}</strong>` : ''}</td>
            <td class="font-mono text-xs"><strong>${l.accountCode}</strong></td>
            <td style="padding-left: ${isIndent ? '2rem' : '0.75rem'};">
              <strong>${acc.name}</strong>
              <div class="text-xs text-muted">${l.desc || j.desc}</div>
            </td>
            <td class="text-right font-mono font-semibold ${deb > 0 ? 'text-success' : 'text-muted'}">
              ${deb > 0 ? this.store.formatRupiah(deb) : '-'}
            </td>
            <td class="text-right font-mono font-semibold ${cre > 0 ? 'text-danger' : 'text-muted'}">
              ${cre > 0 ? this.store.formatRupiah(cre) : '-'}
            </td>
            ${actionCellHTML}
          </tr>
        `;
      });
    });

    // Baris Total Balance Check
    const isBalanced = Math.abs(totDebit - totCredit) < 1;
    rowsHTML += `
      <tr style="background: var(--bg-subtle); border-top: 2px solid var(--border-color); font-weight: 800;">
        <td colspan="4" class="text-right">TOTAL JURNAL (DEBIT & KREDIT):</td>
        <td class="text-right font-mono font-bold text-success">${this.store.formatRupiah(totDebit)}</td>
        <td class="text-right font-mono font-bold text-danger">${this.store.formatRupiah(totCredit)}</td>
        <td></td>
      </tr>
      <tr>
        <td colspan="7" class="text-center" style="padding: 0.5rem;">
          <span class="badge ${isBalanced ? 'badge-success' : 'badge-danger'}">
            ${isBalanced ? '✅ JURNAL UMUM SEIMBANG (DEBIT = KREDIT)' : '⚠️ PERHATIAN: TOTAL DEBIT & KREDIT TIDAK SEIMBANG'}
          </span>
        </td>
      </tr>
    `;

    tbody.innerHTML = rowsHTML;
  }

  // ==================== VIEW 7: BUKU BESAR (GENERAL LEDGER) ====================
  renderLedgerView() {
    const selectedAccountCode = document.getElementById('ledgerAccountSelect')?.value || 'all';
    const ledgerData = this.accounting.getGeneralLedger(this.selectedPeriod);
    const container = document.getElementById('ledgerContainer');
    if (!container) return;

    const accountsToRender = selectedAccountCode === 'all' 
      ? Object.values(ledgerData).filter(acc => acc.entries.length > 0 || acc.openingBalance > 0)
      : [ledgerData[selectedAccountCode]].filter(Boolean);

    if (accountsToRender.length === 0) {
      container.innerHTML = `<div class="card text-center text-muted" style="padding: 3rem;">Tidak ada mutasi buku besar pada akun yang dipilih.</div>`;
      return;
    }

    container.innerHTML = accountsToRender.map(acc => {
      return `
        <div class="ledger-account-card">
          <div class="ledger-header">
            <div class="ledger-account-title">
              <span class="badge badge-purple font-mono">${acc.code}</span>
              <span>${acc.name}</span>
            </div>
            <div class="ledger-balance-badge ${acc.endingBalance >= 0 ? 'badge-success' : 'badge-danger'}">
              Saldo Akhir: ${this.store.formatRupiah(Math.abs(acc.endingBalance))} (${acc.normalBalance.toUpperCase()})
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table" style="font-size: 0.78rem;">
              <thead>
                <tr>
                  <th style="width: 100px;">Tanggal</th>
                  <th style="width: 120px;">No. Bukti</th>
                  <th>Keterangan Transaksi</th>
                  <th class="text-right" style="width: 130px;">Debit (Dr)</th>
                  <th class="text-right" style="width: 130px;">Kredit (Cr)</th>
                  <th class="text-right" style="width: 150px;">Saldo Berjalan</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background: var(--bg-subtle);">
                  <td>-</td>
                  <td>-</td>
                  <td><em>Saldo Awal Akun</em></td>
                  <td class="text-right font-mono">${acc.normalBalance === 'debit' ? this.store.formatRupiah(acc.openingBalance) : '-'}</td>
                  <td class="text-right font-mono">${acc.normalBalance === 'kredit' ? this.store.formatRupiah(acc.openingBalance) : '-'}</td>
                  <td class="text-right font-mono font-bold">${this.store.formatRupiah(acc.openingBalance)}</td>
                </tr>
                ${acc.entries.map(e => `
                  <tr>
                    <td>${this.store.formatDateIndo(e.date)}</td>
                    <td class="font-mono text-xs">${e.voucherNo}</td>
                    <td>${e.desc}</td>
                    <td class="text-right font-mono font-semibold ${e.debit > 0 ? 'text-success' : 'text-muted'}">${e.debit > 0 ? this.store.formatRupiah(e.debit) : '-'}</td>
                    <td class="text-right font-mono font-semibold ${e.credit > 0 ? 'text-danger' : 'text-muted'}">${e.credit > 0 ? this.store.formatRupiah(e.credit) : '-'}</td>
                    <td class="text-right font-mono font-bold">${this.store.formatRupiah(e.runningBalance)}</td>
                  </tr>
                `).join('')}
                <tr class="table-total-row">
                  <td colspan="3"><strong>TOTAL MUTASI & SALDO AKHIR:</strong></td>
                  <td class="text-right font-mono text-success"><strong>${this.store.formatRupiah(acc.totalDebit)}</strong></td>
                  <td class="text-right font-mono text-danger"><strong>${this.store.formatRupiah(acc.totalCredit)}</strong></td>
                  <td class="text-right font-mono font-bold" style="font-size: 0.9rem;"><strong>${this.store.formatRupiah(acc.endingBalance)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==================== VIEW 8: NERACA LAJUR 10 KOLOM ====================
  renderWorksheetView() {
    const ws = this.accounting.getWorksheet10Column(this.selectedPeriod);
    const tbody = document.getElementById('tbodyWorksheet10');
    if (!tbody) return;

    const t = ws.totals;
    let rowsHTML = ws.rows.map(r => `
      <tr>
        <td class="font-mono text-xs"><strong>${r.code}</strong></td>
        <td><strong>${r.name}</strong></td>
        <td class="text-right font-mono">${r.tbDebit > 0 ? this.store.formatRupiah(r.tbDebit) : '-'}</td>
        <td class="text-right font-mono">${r.tbCredit > 0 ? this.store.formatRupiah(r.tbCredit) : '-'}</td>
        <td class="text-right font-mono text-muted">${r.adjDebit > 0 ? this.store.formatRupiah(r.adjDebit) : '-'}</td>
        <td class="text-right font-mono text-muted">${r.adjCredit > 0 ? this.store.formatRupiah(r.adjCredit) : '-'}</td>
        <td class="text-right font-mono">${r.atbDebit > 0 ? this.store.formatRupiah(r.atbDebit) : '-'}</td>
        <td class="text-right font-mono">${r.atbCredit > 0 ? this.store.formatRupiah(r.atbCredit) : '-'}</td>
        <td class="text-right font-mono text-danger">${r.isDebit > 0 ? this.store.formatRupiah(r.isDebit) : '-'}</td>
        <td class="text-right font-mono text-success">${r.isCredit > 0 ? this.store.formatRupiah(r.isCredit) : '-'}</td>
        <td class="text-right font-mono font-semibold">${r.bsDebit > 0 ? this.store.formatRupiah(r.bsDebit) : '-'}</td>
        <td class="text-right font-mono font-semibold">${r.bsCredit > 0 ? this.store.formatRupiah(r.bsCredit) : '-'}</td>
      </tr>
    `).join('');

    // Baris Total Sebelum Laba
    rowsHTML += `
      <tr class="total-row-highlight">
        <td colspan="2" class="text-right">TOTAL SEMENTARA</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totTB_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totTB_Credit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totAdj_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totAdj_Credit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totATB_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totATB_Credit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totIS_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totIS_Credit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totBS_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totBS_Credit)}</td>
      </tr>
      <tr class="table-warning-row" style="font-weight: 800;">
        <td colspan="2" class="text-right" style="color: var(--warning);">LABA BERSIH TAHUN BERJALAN</td>
        <td colspan="6"></td>
        <td class="text-right font-mono text-success">${t.netIncome > 0 ? this.store.formatRupiah(t.netIncome) : '-'}</td>
        <td class="text-right font-mono text-danger">${t.netIncome < 0 ? this.store.formatRupiah(Math.abs(t.netIncome)) : '-'}</td>
        <td class="text-right font-mono text-danger">${t.netIncome < 0 ? this.store.formatRupiah(Math.abs(t.netIncome)) : '-'}</td>
        <td class="text-right font-mono text-success">${t.netIncome > 0 ? this.store.formatRupiah(t.netIncome) : '-'}</td>
      </tr>
      <tr class="balanced-row">
        <td colspan="2" class="text-right">TOTAL SEIMBANG (BALANCED)</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totTB_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totTB_Credit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totAdj_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totAdj_Credit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totATB_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.totATB_Credit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.balancedIS_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.balancedIS_Credit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.balancedBS_Debit)}</td>
        <td class="text-right font-mono">${this.store.formatRupiah(t.balancedBS_Credit)}</td>
      </tr>
    `;

    tbody.innerHTML = rowsHTML;
  }

  // ==================== VIEW 9: LAPORAN LABA RUGI & NERACA ====================
  renderReportsView() {
    const inc = this.accounting.getIncomeStatement(this.selectedPeriod);
    const bs = this.accounting.getBalanceSheet(this.selectedPeriod);

    // Render Laba Rugi
    document.getElementById('reportNetProfitVal').textContent = this.store.formatRupiah(inc.netProfit);
    document.getElementById('reportMarginVal').textContent = `Margin Laba: ${inc.netMargin}%`;
    document.getElementById('reportPeriodSubtitle').textContent = `Periode: ${this.selectedPeriod || 'Semua Waktu'}`;

    const tbodyRev = document.getElementById('tbodyReportRevenue');
    if (tbodyRev) {
      tbodyRev.innerHTML = inc.revenues.map(r => `
        <tr>
          <td>${r.code} - ${r.name}</td>
          <td class="text-right font-semibold text-success">${this.store.formatRupiah(r.amount)}</td>
        </tr>
      `).join('') + `
        <tr class="table-total-row">
          <td><strong>TOTAL PENDAPATAN</strong></td>
          <td class="text-right font-bold text-success">${this.store.formatRupiah(inc.totalRevenue)}</td>
        </tr>
      `;
    }

    const tbodyExp = document.getElementById('tbodyReportExpense');
    if (tbodyExp) {
      let expHTML = "";
      if (inc.cogs.length > 0) {
        expHTML += `
          <tr class="table-warning-row">
            <td colspan="2"><strong>Harga Pokok Penjualan (HPP):</strong></td>
          </tr>
          ${inc.cogs.map(c => `
            <tr>
              <td style="padding-left: 1.5rem;">${c.code} - ${c.name}</td>
              <td class="text-right font-semibold text-danger">(${this.store.formatRupiah(c.amount)})</td>
            </tr>
          `).join('')}
        `;
      }
      expHTML += `
        <tr class="table-section-header">
          <td colspan="2"><strong>Beban Operasional Toko:</strong></td>
        </tr>
        ${inc.expenses.map(e => `
          <tr>
            <td style="padding-left: 1.5rem;">${e.code} - ${e.name}</td>
            <td class="text-right font-semibold text-danger">(${this.store.formatRupiah(e.amount)})</td>
          </tr>
        `).join('')}
        <tr class="table-total-row">
          <td><strong>TOTAL HPP & BEBAN</strong></td>
          <td class="text-right font-bold text-danger">(${this.store.formatRupiah(inc.totalCOGS + inc.totalExpenses)})</td>
        </tr>
      `;
      tbodyExp.innerHTML = expHTML;
    }

    // Render Neraca Keuangan (Balance Sheet)
    const tbodyAssets = document.getElementById('tbodyBalanceSheetAssets');
    if (tbodyAssets) {
      tbodyAssets.innerHTML = `
        <tr class="table-section-header"><td colspan="2"><strong>1. Aset Lancar:</strong></td></tr>
        ${bs.currentAssets.map(a => `
          <tr>
            <td style="padding-left: 1.25rem;">${a.code} - ${a.name}</td>
            <td class="text-right font-mono font-semibold">${this.store.formatRupiah(a.amount)}</td>
          </tr>
        `).join('')}
        <tr class="table-section-header"><td colspan="2"><strong>2. Aset Tetap:</strong></td></tr>
        ${bs.fixedAssets.map(a => `
          <tr>
            <td style="padding-left: 1.25rem;">${a.code} - ${a.name}</td>
            <td class="text-right font-mono font-semibold ${a.isContra ? 'text-danger' : ''}">
              ${a.isContra ? `(${this.store.formatRupiah(a.amount)})` : this.store.formatRupiah(a.amount)}
            </td>
          </tr>
        `).join('')}
      `;
      document.getElementById('bsTotalAssetsVal').textContent = this.store.formatRupiah(bs.totalAssets);
    }

    const tbodyLiab = document.getElementById('tbodyBalanceSheetLiabilities');
    if (tbodyLiab) {
      tbodyLiab.innerHTML = `
        <tr class="table-section-header"><td colspan="2"><strong>1. Kewajiban / Hutang:</strong></td></tr>
        ${bs.currentLiabilities.map(l => `
          <tr>
            <td style="padding-left: 1.25rem;">${l.code} - ${l.name}</td>
            <td class="text-right font-mono font-semibold text-danger">${this.store.formatRupiah(l.amount)}</td>
          </tr>
        `).join('')}
        <tr class="table-section-header"><td colspan="2"><strong>2. Ekuitas / Modal:</strong></td></tr>
        ${bs.equity.map(e => `
          <tr>
            <td style="padding-left: 1.25rem;">${e.code} - ${e.name}</td>
            <td class="text-right font-mono font-semibold ${e.isCalculated ? 'text-success font-bold' : ''}">${this.store.formatRupiah(e.amount)}</td>
          </tr>
        `).join('')}
      `;
      document.getElementById('bsTotalLiabilitiesVal').textContent = this.store.formatRupiah(bs.totalLiabilitiesAndEquity);
    }

    const banner = document.getElementById('bsBalanceStatusBanner');
    if (banner) {
      banner.innerHTML = `
        <span class="badge ${bs.isBalanced ? 'badge-success' : 'badge-danger'}" style="font-size: 0.85rem; padding: 0.4rem 1rem;">
          ${bs.isBalanced ? '✅ NERACA KEUANGAN SEIMBANG (BALANCED: AKTIVA = PASIVA)' : `⚠️ NERACA SELISIH ${this.store.formatRupiah(Math.abs(bs.difference))}`}
        </span>
      `;
    }
  }

  // ==================== VIEW 10: BAGAN AKUN (COA) ====================
  renderCOAView() {
    const tbody = document.getElementById('tbodyCOA');
    if (!tbody) return;

    tbody.innerHTML = this.accounting.coa.map(acc => {
      const openBal = Number(this.accounting.openingBalances[acc.code]) || 0;
      const catLabel = {
        aset_lancar: 'Aset Lancar',
        aset_tetap: 'Aset Tetap',
        kewajiban_lancar: 'Kewajiban Lancar',
        ekuitas: 'Ekuitas / Modal',
        pendapatan: 'Pendapatan',
        hpp: 'HPP',
        beban_operasional: 'Beban Operasional'
      }[acc.category] || acc.category;

      return `
        <tr>
          <td class="font-mono font-bold text-xs">${acc.code}</td>
          <td><strong>${acc.name}</strong></td>
          <td><span class="badge badge-gray">${catLabel}</span></td>
          <td>
            <span class="badge ${acc.normalBalance === 'debit' ? 'badge-success' : 'badge-purple'}">
              ${acc.normalBalance.toUpperCase()}
            </span>
          </td>
          <td class="text-right font-mono">${this.store.formatRupiah(openBal)}</td>
          <td>
            <span class="badge ${acc.isCustom ? 'badge-info' : 'badge-gray'}">
              ${acc.isCustom ? 'Manual / Kustom' : 'Sistem Standar'}
            </span>
          </td>
          <td class="text-center">
            <div class="table-actions justify-center">
              <button class="btn-icon-only btn-sm" onclick="window.app.openEditCOAModal('${acc.code}')" title="Edit Akun COA">✏️</button>
              <button class="btn-icon-only btn-sm text-danger" onclick="window.app.deleteCOAAccount('${acc.code}')" title="Hapus Akun COA">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==================== VIEW 11: PENGATURAN ====================
  renderSettingsView() {
    const profile = this.store.storeProfile;
    document.getElementById('settingStoreName').value = profile.name || '';
    document.getElementById('settingStoreTagline').value = profile.tagline || '';
    document.getElementById('settingStoreAddress').value = profile.address || '';
    document.getElementById('settingStorePhone').value = profile.phone || '';
    document.getElementById('settingStoreEmail').value = profile.email || '';
    document.getElementById('settingStoreOwner').value = profile.owner || '';
    document.getElementById('settingStoreFooter').value = profile.footerText || '';

    const fb = this.firebase.config || {};
    document.getElementById('fbApiKey').value = fb.apiKey || '';
    document.getElementById('fbProjectId').value = fb.projectId || '';
    document.getElementById('fbAuthDomain').value = fb.authDomain || '';
    document.getElementById('fbStorageBucket').value = fb.storageBucket || '';
    document.getElementById('fbAppId').value = fb.appId || '';

    this.updateCloudStatusBadge();
  }

  // ==================== MODAL OPERATIONS ====================
  openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('active');
  }

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('active');
  }

  // 1. MODAL KASIR PENJUALAN MATERIAL (POS)
  openNewSaleModal() {
    this.editingTxId = null;
    const form = document.getElementById('formNewSale');
    if (form) form.reset();

    const dateInput = document.getElementById('saleDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const customerInput = document.getElementById('saleCustomerName');
    if (customerInput) customerInput.value = 'Pelanggan Umum';

    const pctInput = document.getElementById('saleDiscountPercent');
    if (pctInput) pctInput.value = '';

    const discInput = document.getElementById('saleDiscountAmount');
    if (discInput) discInput.value = '';

    const hintEl = document.getElementById('saleDiscountSummaryHint');
    if (hintEl) {
      hintEl.textContent = 'Ketik persen (misal: 25%) atau nominal rupiah';
      hintEl.className = 'text-xs text-muted';
    }

    const subtotalInput = document.getElementById('saleSubtotalAmount');
    if (subtotalInput) subtotalInput.value = 0;

    const tenderedInput = document.getElementById('saleTenderedAmount');
    if (tenderedInput) tenderedInput.value = '';

    const changeDisplay = document.getElementById('saleChangeAmountDisplay');
    if (changeDisplay) {
      changeDisplay.textContent = 'Rp 0';
      changeDisplay.className = 'font-bold text-muted';
    }

    const container = document.getElementById('saleItemsBuilderContainer');
    if (container) container.innerHTML = '';
    this.addSaleItemRow();

    this.handleSalePaymentMethodChange();
    this.openModal('modalNewSale');
  }

  addSaleItemRow(name = '', qty = 1, unit = 'Pcs', price = 0, productId = '', unitRatio = 1) {
    const container = document.getElementById('saleItemsBuilderContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'items-builder-row';

    const productsList = this.inventory ? this.inventory.products : [];
    const datalistId = `dl-sale-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    const matched = productsList.find(p => (productId && p.id === productId) || (name && p.name.toLowerCase() === name.toLowerCase()));
    const units = matched ? this.inventory.getProductUnits(matched) : [];

    let unitControlHTML = '';
    if (units.length > 1) {
      unitControlHTML = `
        <select class="form-control item-unit-select">
          ${units.map(u => `<option value="${u.unitName}" data-ratio="${u.ratio}" data-price="${u.sellPrice}" data-buy="${u.buyPrice}" ${u.unitName === unit ? 'selected' : ''}>${u.label}</option>`).join('')}
        </select>
      `;
    } else {
      unitControlHTML = `<input type="text" class="form-control item-unit" placeholder="Satuan" value="${unit || 'Pcs'}" />`;
    }

    row.innerHTML = `
      <div>
        <input type="text" list="${datalistId}" class="form-control item-name" placeholder="Ketik / cari nama material..." value="${name}" required />
        <datalist id="${datalistId}">
          ${productsList.map(p => {
            const packInfo = p.hasMultiUnit ? ` | 📦 1 ${p.packUnit}=${p.packRatio} ${p.unit}` : '';
            return `<option value="${p.name}" data-id="${p.id}" data-unit="${p.unit}" data-price="${p.sellPrice}" data-buy="${p.buyPrice}">Stok: ${p.stock} ${p.unit}${packInfo} | Rp ${p.sellPrice}</option>`;
          }).join('')}
        </datalist>
        <input type="hidden" class="item-product-id" value="${productId || (matched ? matched.id : '')}" />
        <input type="hidden" class="item-unit-ratio" value="${unitRatio || 1}" />
        <input type="hidden" class="item-cogs" value="0" />
        <div class="item-stock-badge"></div>
      </div>
      <div>
        <input type="number" class="form-control item-qty" placeholder="Qty" value="${qty}" min="0.1" step="any" required />
        <div class="item-qty-warning text-xs text-danger font-bold" style="display: none; margin-top: 2px;"></div>
      </div>
      <div class="item-unit-wrapper">${unitControlHTML}</div>
      <input type="number" class="form-control item-price" placeholder="Harga Jual (Rp)" value="${price}" min="0" step="100" required />
      <button type="button" class="btn-icon-only text-danger btn-remove-item" title="Hapus Baris" style="margin-top: 5px;">✕</button>
    `;

    const nameInput = row.querySelector('.item-name');
    const qtyInput = row.querySelector('.item-qty');
    const unitWrapper = row.querySelector('.item-unit-wrapper');
    const stockBadge = row.querySelector('.item-stock-badge');
    const qtyWarning = row.querySelector('.item-qty-warning');

    const validateAndRenderStock = (prod) => {
      if (!prod) {
        stockBadge.innerHTML = '';
        if (qtyWarning) qtyWarning.style.display = 'none';
        qtyInput.classList.remove('stock-exceeded');
        return;
      }

      const currentQty = parseFloat(qtyInput.value) || 0;
      const ratio = parseFloat(row.querySelector('.item-unit-ratio')?.value) || 1;
      const requiredBase = currentQty * ratio;

      if (prod.stock <= 0) {
        stockBadge.innerHTML = `<span class="text-danger font-bold">❌ Stok Habis (0 ${prod.unit})</span>`;
      } else if (prod.hasMultiUnit && prod.packRatio > 1) {
        stockBadge.innerHTML = `<span class="text-success font-semibold">📦 Sisa: <strong>${prod.stock} ${prod.unit}</strong> (≈ ${(prod.stock / prod.packRatio).toFixed(1)} ${prod.packUnit})</span>`;
      } else {
        stockBadge.innerHTML = `<span class="text-success font-semibold">📦 Sisa: <strong>${prod.stock} ${prod.unit}</strong></span>`;
      }

      if (requiredBase > prod.stock) {
        qtyInput.classList.add('stock-exceeded');
        if (qtyWarning) {
          qtyWarning.style.display = 'block';
          qtyWarning.textContent = `⚠️ Kurang ${requiredBase - prod.stock} ${prod.unit}`;
        }
      } else {
        qtyInput.classList.remove('stock-exceeded');
        if (qtyWarning) qtyWarning.style.display = 'none';
      }
    };

    const updateUnitControl = (prod) => {
      if (!prod) {
        unitWrapper.innerHTML = `<input type="text" class="form-control item-unit" placeholder="Satuan" value="Pcs" />`;
        row.querySelector('.item-unit-ratio').value = 1;
        validateAndRenderStock(null);
        return;
      }

      const availableUnits = this.inventory.getProductUnits(prod);
      if (availableUnits.length > 1) {
        unitWrapper.innerHTML = `
          <select class="form-control item-unit-select">
            ${availableUnits.map(u => `<option value="${u.unitName}" data-ratio="${u.ratio}" data-price="${u.sellPrice}" data-buy="${u.buyPrice}">${u.label}</option>`).join('')}
          </select>
        `;
        const sel = unitWrapper.querySelector('.item-unit-select');
        const selectedOpt = sel.options[sel.selectedIndex];
        row.querySelector('.item-unit-ratio').value = selectedOpt.dataset.ratio || 1;
        row.querySelector('.item-price').value = selectedOpt.dataset.price || prod.sellPrice;
        row.querySelector('.item-cogs').value = selectedOpt.dataset.buy || prod.buyPrice;

        sel.addEventListener('change', (e) => {
          const opt = e.target.options[e.target.selectedIndex];
          row.querySelector('.item-unit-ratio').value = opt.dataset.ratio || 1;
          row.querySelector('.item-price').value = opt.dataset.price || 0;
          row.querySelector('.item-cogs').value = opt.dataset.buy || 0;
          validateAndRenderStock(prod);
          this.recalculateSaleItemsTotal();
        });
      } else {
        unitWrapper.innerHTML = `<input type="text" class="form-control item-unit" placeholder="Satuan" value="${prod.unit || 'Pcs'}" />`;
        row.querySelector('.item-unit-ratio').value = 1;
        row.querySelector('.item-price').value = prod.sellPrice;
        row.querySelector('.item-cogs').value = prod.buyPrice;
      }
      validateAndRenderStock(prod);
      this.recalculateSaleItemsTotal();
    };

    nameInput.addEventListener('input', (e) => {
      const val = e.target.value;
      const found = productsList.find(p => p.name.toLowerCase() === val.toLowerCase());
      if (found) {
        row.querySelector('.item-product-id').value = found.id;
        updateUnitControl(found);
      } else {
        validateAndRenderStock(null);
      }
    });

    qtyInput.addEventListener('input', () => {
      const prodId = row.querySelector('.item-product-id')?.value;
      const prod = productsList.find(p => p.id === prodId);
      validateAndRenderStock(prod);
      this.recalculateSaleItemsTotal();
    });

    row.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => this.recalculateSaleItemsTotal());
    });

    const initialSel = row.querySelector('.item-unit-select');
    if (initialSel) {
      initialSel.addEventListener('change', (e) => {
        const opt = e.target.options[e.target.selectedIndex];
        row.querySelector('.item-unit-ratio').value = opt.dataset.ratio || 1;
        row.querySelector('.item-price').value = opt.dataset.price || 0;
        row.querySelector('.item-cogs').value = opt.dataset.buy || 0;
        const prodId = row.querySelector('.item-product-id')?.value;
        const prod = productsList.find(p => p.id === prodId);
        validateAndRenderStock(prod);
        this.recalculateSaleItemsTotal();
      });
    }

    if (matched) {
      validateAndRenderStock(matched);
    }

    row.querySelector('.btn-remove-item').addEventListener('click', () => {
      row.remove();
      this.recalculateSaleItemsTotal();
    });

    container.appendChild(row);
  }

  recalculateSaleItemsTotal() {
    const container = document.getElementById('saleItemsBuilderContainer');
    if (!container) return;

    let subtotal = 0;
    const rows = container.querySelectorAll('.items-builder-row');
    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
      const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
      subtotal += (qty * price);
    });

    const elSubtotal = document.getElementById('saleSubtotalAmount');
    if (elSubtotal) elSubtotal.value = subtotal;

    const pctInput = document.getElementById('saleDiscountPercent');
    const pct = parseFloat(pctInput?.value) || 0;
    const amountInput = document.getElementById('saleDiscountAmount');
    let discount = 0;

    if (pct > 0) {
      discount = Math.round((subtotal * pct) / 100);
      if (amountInput) amountInput.value = discount > 0 ? discount : '';
      const hintEl = document.getElementById('saleDiscountSummaryHint');
      if (hintEl) {
        hintEl.textContent = `💡 Potongan ${pct}% = Hemat ${this.store.formatRupiah(discount)}`;
        hintEl.className = 'text-xs font-semibold text-danger';
      }
    } else {
      discount = parseFloat(amountInput?.value) || 0;
    }

    const total = Math.max(0, subtotal - discount);
    const elTotal = document.getElementById('saleTotalAmount');
    if (elTotal) elTotal.value = total;

    this.handleSaleAmountChange();
  }

  handleSaleDiscountPercentChange() {
    const subtotal = parseFloat(document.getElementById('saleSubtotalAmount')?.value) || 0;
    const pct = parseFloat(document.getElementById('saleDiscountPercent')?.value) || 0;
    const hintEl = document.getElementById('saleDiscountSummaryHint');
    const amountInput = document.getElementById('saleDiscountAmount');

    if (pct > 0 && subtotal > 0) {
      const discountVal = Math.round((subtotal * pct) / 100);
      if (amountInput) amountInput.value = discountVal;
      if (hintEl) {
        hintEl.textContent = `💡 Potongan ${pct}% = Hemat ${this.store.formatRupiah(discountVal)}`;
        hintEl.className = 'text-xs font-semibold text-danger';
      }
    } else if (pct === 0) {
      if (amountInput) amountInput.value = '';
      if (hintEl) {
        hintEl.textContent = 'Ketik persen (misal: 25%) atau nominal rupiah';
        hintEl.className = 'text-xs text-muted';
      }
    }

    this.handleSaleAmountChange();
  }

  handleSaleDiscountAmountChange() {
    const subtotal = parseFloat(document.getElementById('saleSubtotalAmount')?.value) || 0;
    const discountVal = parseFloat(document.getElementById('saleDiscountAmount')?.value) || 0;
    const hintEl = document.getElementById('saleDiscountSummaryHint');
    const pctInput = document.getElementById('saleDiscountPercent');

    if (discountVal > 0 && subtotal > 0) {
      const pct = (discountVal / subtotal) * 100;
      const formattedPct = pct % 1 === 0 ? pct : Number(pct.toFixed(1));
      if (pctInput) pctInput.value = formattedPct;
      if (hintEl) {
        hintEl.textContent = `💡 Potongan ${formattedPct}% = Hemat ${this.store.formatRupiah(discountVal)}`;
        hintEl.className = 'text-xs font-semibold text-danger';
      }
    } else if (discountVal === 0) {
      if (pctInput) pctInput.value = '';
      if (hintEl) {
        hintEl.textContent = 'Ketik persen (misal: 25%) atau nominal rupiah';
        hintEl.className = 'text-xs text-muted';
      }
    }

    this.handleSaleAmountChange();
  }

  handleSalePaymentMethodChange() {
    const method = document.getElementById('salePaymentMethod')?.value || 'cash';
    const groupPaid = document.getElementById('groupSalePaidAmount');
    const groupDueDate = document.getElementById('groupSaleDueDate');
    const groupDebtCalc = document.getElementById('groupSaleDebtCalc');
    const groupCash = document.getElementById('groupSaleCashTendered');
    const groupChange = document.getElementById('groupSaleChangeDisplay');

    if (method === 'piutang') {
      if (groupCash) groupCash.style.display = 'none';
      if (groupChange) groupChange.style.display = 'none';
      if (groupPaid) groupPaid.style.display = 'block';
      if (groupDueDate) groupDueDate.style.display = 'block';
      if (groupDebtCalc) groupDebtCalc.style.display = 'block';
      const dueInput = document.getElementById('saleDueDate');
      if (dueInput && !dueInput.value) {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        dueInput.value = d.toISOString().split('T')[0];
      }
    } else {
      if (groupCash) groupCash.style.display = 'block';
      if (groupChange) groupChange.style.display = 'block';
      if (groupPaid) groupPaid.style.display = 'none';
      if (groupDueDate) groupDueDate.style.display = 'none';
      if (groupDebtCalc) groupDebtCalc.style.display = 'none';
    }

    this.handleSaleAmountChange();
  }

  handleSaleAmountChange() {
    const subtotal = parseFloat(document.getElementById('saleSubtotalAmount')?.value) || 0;
    const discount = parseFloat(document.getElementById('saleDiscountAmount')?.value) || 0;
    const totalAmount = Math.max(0, subtotal - discount);

    const elTotal = document.getElementById('saleTotalAmount');
    if (elTotal && parseFloat(elTotal.value) !== totalAmount) {
      elTotal.value = totalAmount;
    }

    const method = document.getElementById('salePaymentMethod')?.value || 'cash';

    if (method === 'piutang') {
      const dp = parseFloat(document.getElementById('saleDebtDP')?.value) || 0;
      const debt = Math.max(0, totalAmount - dp);
      const debtEl = document.getElementById('saleDebtDisplay');
      if (debtEl) debtEl.textContent = this.store.formatRupiah(debt);
    } else {
      const tenderedInput = document.getElementById('saleTenderedAmount');
      const changeDisplay = document.getElementById('saleChangeAmountDisplay');
      const tendered = parseFloat(tenderedInput?.value) || 0;

      if (!changeDisplay) return;

      if (tendered <= 0) {
        changeDisplay.textContent = 'Rp 0';
        changeDisplay.className = 'font-bold text-muted';
      } else if (tendered >= totalAmount) {
        const kembalian = tendered - totalAmount;
        changeDisplay.textContent = this.store.formatRupiah(kembalian);
        changeDisplay.className = 'font-bold text-success';
      } else {
        const kurang = totalAmount - tendered;
        changeDisplay.textContent = `⚠️ Kurang: ${this.store.formatRupiah(kurang)}`;
        changeDisplay.className = 'font-bold text-danger';
      }
    }
  }

  // 2. MODAL KULAKAN & TAMBAH STOK BARANG (PERSIS SEPERTI FORM MASTER BARANG)
  openNewPurchaseModal(prefilledProductId = null) {
    this.editingTxId = null;
    const form = document.getElementById('formNewPurchase');
    if (form) form.reset();

    const dateInput = document.getElementById('purchaseDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    const supplierInput = document.getElementById('purchaseSupplierName');
    if (supplierInput) supplierInput.value = 'Distributor Pabrik';

    // Populate dropdown Master Barang
    const prodSelect = document.getElementById('purchaseProductSelect');
    if (prodSelect) {
      const products = this.inventory ? this.inventory.products : [];
      prodSelect.innerHTML = '<option value="">-- Pilih Barang yang Akan Ditambah Stoknya --</option>' +
        products.map(p => {
          const packInfo = p.hasMultiUnit && p.packUnit ? ` (1 ${p.packUnit} = ${p.packRatio} ${p.unit})` : '';
          return `<option value="${p.id}" ${p.id === prefilledProductId ? 'selected' : ''}>${p.name} — Sisa: ${p.stock} ${p.unit}${packInfo}</option>`;
        }).join('');
    }

    this.handlePurchaseProductSelectChange();
    this.handlePurchasePaymentMethodChange();
    this.openModal('modalNewPurchase');
  }

  handlePurchaseProductSelectChange() {
    const selId = document.getElementById('purchaseProductSelect')?.value;
    const prod = this.inventory ? this.inventory.products.find(p => p.id === selId) : null;

    const catDisplay = document.getElementById('purchaseProdCategoryDisplay');
    const unitDisplay = document.getElementById('purchaseProdUnitDisplay');
    const curStockDisplay = document.getElementById('purchaseCurrentStockDisplay');
    const buyPriceInput = document.getElementById('purchaseBuyPrice');
    const sellPriceInput = document.getElementById('purchaseSellPrice');
    const multiWrap = document.getElementById('purchaseMultiUnitWrap');
    const ratioBadge = document.getElementById('purchasePackRatioBadge');
    const unitChoice = document.getElementById('purchaseUnitChoice');
    const packBuyInput = document.getElementById('purchasePackBuyPrice');

    if (!prod) {
      if (catDisplay) catDisplay.value = '';
      if (unitDisplay) unitDisplay.value = '';
      if (curStockDisplay) curStockDisplay.value = '0';
      if (buyPriceInput) buyPriceInput.value = '';
      if (sellPriceInput) sellPriceInput.value = '';
      if (multiWrap) multiWrap.style.display = 'none';
      this.recalculatePurchaseForm();
      return;
    }

    const catObj = MATERIAL_CATEGORIES.find(c => c.id === prod.category);
    if (catDisplay) catDisplay.value = catObj ? `${catObj.icon || ''} ${catObj.name}` : prod.category;
    if (unitDisplay) unitDisplay.value = prod.unit || 'Pcs';
    if (curStockDisplay) curStockDisplay.value = `${prod.stock} ${prod.unit}`;
    if (buyPriceInput) buyPriceInput.value = prod.buyPrice || 0;
    if (sellPriceInput) sellPriceInput.value = prod.sellPrice || 0;

    if (prod.hasMultiUnit && prod.packUnit) {
      if (multiWrap) multiWrap.style.display = 'block';
      if (ratioBadge) ratioBadge.textContent = `1 ${prod.packUnit} = ${prod.packRatio} ${prod.unit}`;
      if (unitChoice) {
        unitChoice.innerHTML = `
          <option value="base">${prod.unit} (Eceran)</option>
          <option value="pack" selected>${prod.packUnit} (Grosir / Dus — Isi ${prod.packRatio} ${prod.unit})</option>
        `;
      }
      if (packBuyInput) {
        packBuyInput.value = prod.packBuyPrice || (prod.buyPrice * (prod.packRatio || 1));
      }
    } else {
      if (multiWrap) multiWrap.style.display = 'none';
    }

    this.recalculatePurchaseForm();
  }

  recalculatePurchaseForm() {
    const selId = document.getElementById('purchaseProductSelect')?.value;
    const prod = this.inventory ? this.inventory.products.find(p => p.id === selId) : null;

    const totalAssetEl = document.getElementById('purchaseTotalAssetVal');
    const newStockEl = document.getElementById('purchaseNewStockPreview');

    if (!prod) {
      if (totalAssetEl) totalAssetEl.textContent = 'Rp 0';
      if (newStockEl) newStockEl.textContent = '0 Pcs';
      return;
    }

    const qty = parseFloat(document.getElementById('purchaseAddQty')?.value) || 0;
    const unitChoiceVal = document.getElementById('purchaseUnitChoice')?.value || 'base';
    const isPack = (prod.hasMultiUnit && unitChoiceVal === 'pack');
    const ratio = isPack ? (prod.packRatio || 1) : 1;

    const baseQtyAdded = qty * ratio;
    const buyPrice = isPack
      ? (parseFloat(document.getElementById('purchasePackBuyPrice')?.value) || (prod.buyPrice * ratio))
      : (parseFloat(document.getElementById('purchaseBuyPrice')?.value) || prod.buyPrice);

    const totalCost = qty * buyPrice;
    const newStock = (Number(prod.stock) || 0) + baseQtyAdded;

    if (totalAssetEl) totalAssetEl.textContent = this.store.formatRupiah(totalCost);
    if (newStockEl) {
      const packSuffix = prod.hasMultiUnit && prod.packRatio > 1 ? ` (≈ ${(newStock / prod.packRatio).toFixed(1)} ${prod.packUnit})` : '';
      newStockEl.textContent = `${newStock} ${prod.unit}${packSuffix}`;
    }

    const method = document.getElementById('purchasePaymentMethod')?.value || 'cash';
    if (method === 'hutang') {
      const dp = parseFloat(document.getElementById('purchasePaidAmount')?.value) || 0;
      const debt = Math.max(0, totalCost - dp);
      const debtEl = document.getElementById('purchaseDebtDisplay');
      if (debtEl) debtEl.textContent = this.store.formatRupiah(debt);
    }
  }

  handlePurchasePaymentMethodChange() {
    const method = document.getElementById('purchasePaymentMethod')?.value || 'cash';
    const panelDebt = document.getElementById('groupPurchaseDebtPanel');

    if (method === 'hutang') {
      if (panelDebt) panelDebt.style.display = 'block';
      const dueInput = document.getElementById('purchaseDueDate');
      if (dueInput && !dueInput.value) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        dueInput.value = d.toISOString().split('T')[0];
      }
    } else {
      if (panelDebt) panelDebt.style.display = 'none';
    }

    this.recalculatePurchaseForm();
  }

  openNewTransactionModal() {
    this.openNewSaleModal();
  }

  // 2. Modal Master Produk Inventori
  recalculateProductModalAsset() {
    const buyPrice = parseFloat(document.getElementById('modalProdBuyPrice')?.value) || 0;
    const sellPrice = parseFloat(document.getElementById('modalProdSellPrice')?.value) || 0;
    const stock = parseFloat(document.getElementById('modalProdStock')?.value) || 0;

    const totalAsset = buyPrice * stock;
    const totalRetail = sellPrice * stock;

    const elAsset = document.getElementById('modalProdTotalAssetVal');
    const elRetail = document.getElementById('modalProdTotalRetailVal');

    if (elAsset) elAsset.textContent = this.store.formatRupiah(totalAsset);
    if (elRetail) elRetail.textContent = this.store.formatRupiah(totalRetail);
  }

  toggleMultiUnitFields() {
    const chk = document.getElementById('modalProdHasMultiUnit');
    const wrap = document.getElementById('multiUnitFieldsWrap');
    if (!chk || !wrap) return;

    if (chk.checked) {
      wrap.style.display = 'block';
    } else {
      wrap.style.display = 'none';
    }
  }

  recalculatePackToRetailBuyPrice() {
    const hasMulti = document.getElementById('modalProdHasMultiUnit')?.checked;
    if (!hasMulti) return;

    const packBuy = parseFloat(document.getElementById('modalProdPackBuyPrice')?.value) || 0;
    const ratio = parseFloat(document.getElementById('modalProdPackRatio')?.value) || 1;
    const helper = document.getElementById('modalPackBuyHelper');

    if (packBuy > 0 && ratio > 0) {
      const perPcs = Math.round(packBuy / ratio);
      if (helper) helper.textContent = `Modal per unit eceran: ${this.store.formatRupiah(perPcs)} / pcs`;
      
      const buyPriceInput = document.getElementById('modalProdBuyPrice');
      if (buyPriceInput && (!buyPriceInput.value || parseFloat(buyPriceInput.value) === 0)) {
        buyPriceInput.value = perPcs;
      }
    } else if (helper) {
      helper.textContent = 'Modal eceran otomatis dihitung per pcs';
    }
    this.recalculateProductModalAsset();
  }

  openNewProductModal() {
    this.editingProdId = null;
    const form = document.getElementById('formNewProduct');
    if (form) form.reset();
    document.getElementById('modalProductTitle').textContent = `📦 Tambah Master Barang Material`;
    
    const multiChk = document.getElementById('modalProdHasMultiUnit');
    if (multiChk) multiChk.checked = false;
    this.toggleMultiUnitFields();

    this.recalculateProductModalAsset();
    this.openModal('modalNewProduct');
  }

  openEditProductModal(productId) {
    const p = this.inventory.products.find(item => item.id === productId);
    if (!p) return;

    this.editingProdId = productId;
    document.getElementById('modalProductTitle').textContent = `✏️ Edit Barang: ${p.name}`;
    document.getElementById('modalProdName').value = p.name;
    document.getElementById('modalProdCategory').value = p.category;
    document.getElementById('modalProdUnit').value = p.unit;
    document.getElementById('modalProdBuyPrice').value = p.buyPrice;
    document.getElementById('modalProdSellPrice').value = p.sellPrice;
    document.getElementById('modalProdStock').value = p.stock;
    document.getElementById('modalProdMinStock').value = p.minStock;
    document.getElementById('modalProdLocation').value = p.location || '';

    const multiChk = document.getElementById('modalProdHasMultiUnit');
    if (multiChk) multiChk.checked = Boolean(p.hasMultiUnit);
    document.getElementById('modalProdPackUnit').value = p.packUnit || '';
    document.getElementById('modalProdPackRatio').value = p.packRatio || 1;
    document.getElementById('modalProdPackBuyPrice').value = p.packBuyPrice || '';
    document.getElementById('modalProdPackSellPrice').value = p.packSellPrice || '';

    this.toggleMultiUnitFields();
    this.recalculatePackToRetailBuyPrice();
    this.recalculateProductModalAsset();
    this.openModal('modalNewProduct');
  }

  openStockOpnameModal(productId) {
    const p = this.inventory.products.find(item => item.id === productId);
    if (!p) return;

    const newQty = prompt(`Stock Opname untuk: ${p.name}\nStok sistem saat ini: ${p.stock} ${p.unit}\n\nMasukkan jumlah fisik stok aktual di gudang:`, p.stock);
    if (newQty !== null && !isNaN(parseFloat(newQty))) {
      this.inventory.adjustStock(p.id, parseFloat(newQty), "Stock Opname Fisik Gudang");
      this.renderInventoryView();
      this.showToast(`Stok ${p.name} disesuaikan menjadi ${newQty} ${p.unit}`);
    }
  }

  deleteProduct(productId) {
    if (confirm("Apakah Anda yakin ingin menghapus barang ini dari master inventori?")) {
      this.inventory.deleteProduct(productId);
      this.renderInventoryView();
      this.showToast("Barang berhasil dihapus!");
    }
  }

  // 3. Modal Tambah / Edit Akun COA
  openNewCOAModal() {
    this.editingCOACode = null;
    const form = document.getElementById('formNewCOA');
    if (form) form.reset();

    const titleEl = document.querySelector('#modalNewCOA .modal-title');
    if (titleEl) titleEl.textContent = '🏷️ Tambah Akun Bagan Akun (COA) Baru';

    const codeInput = document.getElementById('modalCOACode');
    if (codeInput) {
      codeInput.readOnly = false;
    }

    this.openModal('modalNewCOA');
  }

  openEditCOAModal(code) {
    const acc = this.accounting.getAccount(code);
    if (!acc) {
      this.showToast("Data akun COA tidak ditemukan.", "danger");
      return;
    }

    this.editingCOACode = code;
    const titleEl = document.querySelector('#modalNewCOA .modal-title');
    if (titleEl) titleEl.textContent = `✏️ Edit Akun COA: ${acc.code} - ${acc.name}`;

    const codeInput = document.getElementById('modalCOACode');
    if (codeInput) {
      codeInput.value = acc.code;
      codeInput.readOnly = true;
    }

    document.getElementById('modalCOAName').value = acc.name;
    document.getElementById('modalCOACategory').value = acc.category;
    document.getElementById('modalCOANormal').value = acc.normalBalance;
    document.getElementById('modalCOAOpening').value = this.accounting.openingBalances[acc.code] || 0;

    this.openModal('modalNewCOA');
  }

  deleteCOAAccount(code) {
    const acc = this.accounting.getAccount(code);
    const accName = acc ? acc.name : code;
    if (confirm(`Apakah Anda yakin ingin menghapus akun COA ${code} - ${accName}?\n\nPerhatian: Akun ini tidak akan lagi muncul di pilihan jurnal dan laporan keuangan.`)) {
      try {
        if (this.accounting.deleteAccount(code)) {
          this.populateCOAOptions();
          this.renderCOAView();
          this.showToast(`Akun COA ${code} berhasil dihapus!`, 'warning');
        }
      } catch (e) {
        alert(e.message);
      }
    }
  }

  // 4. Modal Jurnal Penyesuaian Manual
  openManualJournalModal() {
    this.editingJournalId = null;
    const form = document.getElementById('formManualJournal');
    if (form) form.reset();

    const titleEl = document.querySelector('#modalManualJournal .modal-title');
    if (titleEl) titleEl.textContent = '📖 Input Jurnal Penyesuaian Manual (Double-Entry)';

    document.getElementById('modalJrnDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalJrnVoucher').value = `JV-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(100+Math.random()*900)}`;

    const container = document.getElementById('journalLinesContainer');
    if (container) {
      container.innerHTML = '';
      this.addJournalLineRow();
      this.addJournalLineRow();
    }

    this.recalculateJournalModal();
    this.openModal('modalManualJournal');
  }

  openEditManualJournalModal(journalId) {
    const journal = this.accounting.manualJournals.find(j => j.id === journalId);
    if (!journal) {
      this.showToast("Data jurnal manual tidak ditemukan.", "danger");
      return;
    }

    this.editingJournalId = journalId;
    const titleEl = document.querySelector('#modalManualJournal .modal-title');
    if (titleEl) titleEl.textContent = `✏️ Edit Jurnal Penyesuaian: ${journal.voucherNo}`;

    document.getElementById('modalJrnDate').value = journal.date;
    document.getElementById('modalJrnVoucher').value = journal.voucherNo;
    document.getElementById('modalJrnDesc').value = journal.desc || '';

    const container = document.getElementById('journalLinesContainer');
    if (container) {
      container.innerHTML = '';
      journal.lines.forEach(l => {
        this.addJournalLineRow(l.accountCode, l.debit, l.credit, l.desc || '');
      });
    }

    this.recalculateJournalModal();
    this.openModal('modalManualJournal');
  }

  deleteManualJournal(journalId) {
    if (confirm("Apakah Anda yakin ingin menghapus ayat jurnal penyesuaian ini? Data buku besar dan neraca akan otomatis menyesuaikan.")) {
      if (this.accounting.deleteManualJournal(journalId)) {
        this.refreshCurrentView();
        this.showToast("Ayat jurnal manual berhasil dihapus!", "warning");
      }
    }
  }

  addJournalLineRow(accountCode = '', debit = 0, credit = 0, desc = '') {
    const container = document.getElementById('journalLinesContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'items-builder-row';
    row.style.gridTemplateColumns = '2fr 1fr 1fr 1.5fr auto';

    row.innerHTML = `
      <select class="form-control jrn-account" required>
        ${this.accounting.coa.map(a => `<option value="${a.code}" ${a.code === accountCode ? 'selected' : ''}>${a.code} - ${a.name}</option>`).join('')}
      </select>
      <input type="number" class="form-control jrn-debit" placeholder="Debit" value="${debit}" min="0" step="100" />
      <input type="number" class="form-control jrn-credit" placeholder="Kredit" value="${credit}" min="0" step="100" />
      <input type="text" class="form-control jrn-desc" placeholder="Keterangan" value="${desc}" />
      <button type="button" class="btn-icon-only text-danger btn-remove-jrn-line" title="Hapus">✕</button>
    `;

    row.querySelectorAll('input, select').forEach(inp => {
      inp.addEventListener('input', () => this.recalculateJournalModal());
      inp.addEventListener('change', () => this.recalculateJournalModal());
    });

    row.querySelector('.btn-remove-jrn-line').addEventListener('click', () => {
      row.remove();
      this.recalculateJournalModal();
    });

    container.appendChild(row);
  }

  recalculateJournalModal() {
    const container = document.getElementById('journalLinesContainer');
    if (!container) return;

    let totDeb = 0;
    let totCre = 0;

    container.querySelectorAll('.items-builder-row').forEach(r => {
      totDeb += (parseFloat(r.querySelector('.jrn-debit')?.value) || 0);
      totCre += (parseFloat(r.querySelector('.jrn-credit')?.value) || 0);
    });

    document.getElementById('modalJrnTotDebit').textContent = this.store.formatRupiah(totDeb);
    document.getElementById('modalJrnTotCredit').textContent = this.store.formatRupiah(totCre);

    const isBalanced = Math.abs(totDeb - totCre) < 1 && totDeb > 0;
    const badge = document.getElementById('modalJrnBalanceBadge');
    if (badge) {
      badge.innerHTML = `
        <span class="badge ${isBalanced ? 'badge-success' : 'badge-danger'}">
          ${isBalanced ? '✅ SEIMBANG (BALANCED)' : '⚠️ BELUM SEIMBANG'}
        </span>
      `;
    }
  }

  // 5. Modal Bayar Cicilan Piutang / Hutang
  openRepaymentModal(txId) {
    const tx = this.store.transactions.find(t => t.id === txId);
    if (!tx) {
      this.showToast("Data tagihan bon/hutang tidak ditemukan.", "danger");
      return;
    }

    const form = document.getElementById('formRepayment');
    if (form) form.reset();

    const isCustomer = tx.type === 'in';
    const contactName = isCustomer ? (tx.customer || 'Pelanggan Bon') : (tx.supplier || 'Distributor');

    document.getElementById('modalRepayTitle').textContent = isCustomer 
      ? `💵 Catat Pembayaran Cicilan Bon Pelanggan`
      : `🤝 Catat Pembayaran Hutang Supplier / Pabrik`;

    document.getElementById('repayTxId').value = tx.id;
    document.getElementById('repayTxCustomer').textContent = `${isCustomer ? '👤 Pelanggan: ' : '🏭 Supplier: '} ${contactName}`;
    document.getElementById('repayTxTitle').textContent = `Nota #${tx.id}: ${tx.title}`;
    document.getElementById('repayTxDebtDisplay').textContent = this.store.formatRupiah(tx.debtAmount);

    const amountInput = document.getElementById('repayAmount');
    amountInput.value = tx.debtAmount;
    amountInput.max = tx.debtAmount;

    document.getElementById('repayDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('repayNote').value = `Pelunasan cicilan: ${tx.title}`;

    this.openModal('modalRepayment');
  }

  // 6. Cetak Nota / Struk Thermal POS & Faktur
  openReceiptModal(txId, format = 'thermal-80') {
    this.currentReceiptTxId = txId;
    this.currentReceiptFormat = format;
    this.renderReceiptPreview();
    this.openModal('modalReceiptPreview');
  }

  switchReceiptFormat(format) {
    this.currentReceiptFormat = format;
    this.renderReceiptPreview();
  }

  renderReceiptPreview() {
    if (!this.currentReceiptTxId) return;

    ['btnFormatThermal80', 'btnFormatThermal58', 'btnFormatA4'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
      }
    });

    let html = '';
    if (this.currentReceiptFormat === 'thermal-58') {
      const btn = document.getElementById('btnFormatThermal58');
      if (btn) { btn.classList.add('btn-primary'); btn.classList.remove('btn-outline'); }
      html = this.export.generateThermalReceiptHTML(this.currentReceiptTxId, '58mm');
    } else if (this.currentReceiptFormat === 'a4') {
      const btn = document.getElementById('btnFormatA4');
      if (btn) { btn.classList.add('btn-primary'); btn.classList.remove('btn-outline'); }
      html = this.export.generateOfficialInvoiceHTML(this.currentReceiptTxId);
    } else {
      const btn = document.getElementById('btnFormatThermal80');
      if (btn) { btn.classList.add('btn-primary'); btn.classList.remove('btn-outline'); }
      html = this.export.generateThermalReceiptHTML(this.currentReceiptTxId, '80mm');
    }

    const container = document.getElementById('receiptPreviewContent');
    if (container) container.innerHTML = html;
  }

  printReceiptDoc() {
    if (this.currentReceiptFormat && this.currentReceiptFormat.startsWith('thermal')) {
      document.body.classList.add('printing-thermal');
    } else {
      document.body.classList.remove('printing-thermal');
    }

    window.print();

    setTimeout(() => {
      document.body.classList.remove('printing-thermal');
    }, 1000);
  }

  openReportModal(period = null) {
    const p = period || this.selectedPeriod;
    const html = this.export.generateFinancialReportHTML(p);
    document.getElementById('reportPreviewContent').innerHTML = html;
    this.openModal('modalReportPreview');
  }

  openBalanceSheetPDF(period = null) {
    const p = period || this.selectedPeriod;
    const html = this.export.generateBalanceSheetPrintHTML(p);
    document.getElementById('reportPreviewContent').innerHTML = html;
    this.openModal('modalReportPreview');
  }

  openFirebaseModal() {
    this.switchTab('settings');
  }

  // ==================== EVENT LISTENERS ====================
  bindEvents() {
    // Auth & Login Form Events
    document.getElementById('formLogin')?.addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('btnLogout')?.addEventListener('click', () => this.handleLogout());
    document.getElementById('btnTogglePassword')?.addEventListener('click', () => this.togglePasswordVisibility());
    document.getElementById('formChangePassword')?.addEventListener('submit', (e) => this.handleChangePassword(e));

    // Nav Tabs & Mouse Wheel Horizontal Scroll
    const navTabs = document.getElementById('mainNavTabs');
    if (navTabs) {
      // Geser horizontal saat mouse di-roll (scroll wheel)
      navTabs.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          navTabs.scrollLeft += (e.deltaY * 0.9);
        }
      }, { passive: false });

      // Drag to slide dengan klik & geser mouse
      let isDown = false;
      let startX, scrollLeft;

      navTabs.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - navTabs.offsetLeft;
        scrollLeft = navTabs.scrollLeft;
      });
      navTabs.addEventListener('mouseleave', () => { isDown = false; });
      navTabs.addEventListener('mouseup', () => { isDown = false; });
      navTabs.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - navTabs.offsetLeft;
        const walk = (x - startX) * 1.5;
        navTabs.scrollLeft = scrollLeft - walk;
      });
    }

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    // Theme Toggle
    document.getElementById('btnThemeToggle')?.addEventListener('click', () => this.toggleTheme());

    // Period Change
    document.getElementById('globalPeriodSelect')?.addEventListener('change', (e) => {
      this.selectedPeriod = e.target.value;
      this.refreshCurrentView();
    });

    // Quick Action Buttons
    document.getElementById('btnOpenNewTxModal')?.addEventListener('click', () => this.openNewTransactionModal());
    document.getElementById('btnQuickPrintReport')?.addEventListener('click', () => this.openReportModal());
    document.getElementById('btnQuickExportExcel')?.addEventListener('click', () => this.export.exportToExcel());
    document.getElementById('btnPrintFullReport')?.addEventListener('click', () => this.openReportModal());
    document.getElementById('btnPrintBalanceSheetPDF')?.addEventListener('click', () => this.openBalanceSheetPDF());
    document.getElementById('btnPrintWorksheetReport')?.addEventListener('click', () => this.export.exportWorksheetToExcel(this.selectedPeriod));
    document.getElementById('btnExportWorksheetExcel')?.addEventListener('click', () => this.export.exportWorksheetToExcel(this.selectedPeriod));
    document.getElementById('btnExportJournalsExcel')?.addEventListener('click', () => this.export.exportJournalsToExcel(this.selectedPeriod));

    // Inventory Events
    document.getElementById('btnOpenNewProductModal')?.addEventListener('click', () => this.openNewProductModal());
    document.getElementById('invSearchInput')?.addEventListener('input', () => this.renderInventoryView());
    document.getElementById('invCategoryFilter')?.addEventListener('change', () => this.renderInventoryView());
    document.getElementById('invLowStockOnly')?.addEventListener('change', () => this.renderInventoryView());
    ['modalProdBuyPrice', 'modalProdSellPrice', 'modalProdStock'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.recalculateProductModalAsset());
    });
    document.getElementById('modalProdHasMultiUnit')?.addEventListener('change', () => this.toggleMultiUnitFields());
    ['modalProdPackBuyPrice', 'modalProdPackRatio', 'modalProdPackSellPrice'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.recalculatePackToRetailBuyPrice());
    });

    // COA Events
    document.getElementById('btnOpenNewCOAModal')?.addEventListener('click', () => this.openNewCOAModal());
    document.getElementById('ledgerAccountSelect')?.addEventListener('change', () => this.renderLedgerView());

    // Manual Journal Events
    document.getElementById('btnOpenManualJournalModal')?.addEventListener('click', () => this.openManualJournalModal());
    document.getElementById('btnAddJournalLine')?.addEventListener('click', () => this.addJournalLineRow());

    // Quick Action Modal Openers
    document.getElementById('btnOpenNewSaleModal')?.addEventListener('click', () => this.openNewSaleModal());
    document.getElementById('btnOpenNewPurchaseModal')?.addEventListener('click', () => this.openNewPurchaseModal());

    // Sales Form Events
    document.getElementById('btnAddSaleItemRow')?.addEventListener('click', () => this.addSaleItemRow());
    document.getElementById('salePaymentMethod')?.addEventListener('change', () => this.handleSalePaymentMethodChange());
    document.getElementById('saleDiscountPercent')?.addEventListener('input', () => this.handleSaleDiscountPercentChange());
    document.getElementById('saleDiscountAmount')?.addEventListener('input', () => this.handleSaleDiscountAmountChange());
    document.getElementById('saleTotalAmount')?.addEventListener('input', () => this.handleSaleAmountChange());
    document.getElementById('saleTenderedAmount')?.addEventListener('input', () => this.handleSaleAmountChange());
    document.getElementById('saleDebtDP')?.addEventListener('input', () => this.handleSaleAmountChange());
    document.getElementById('formNewSale')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSaveSale();
    });

    // Purchase / Restock Form Events
    document.getElementById('purchaseProductSelect')?.addEventListener('change', () => this.handlePurchaseProductSelectChange());
    document.getElementById('purchaseUnitChoice')?.addEventListener('change', () => this.recalculatePurchaseForm());
    document.getElementById('purchaseBuyPrice')?.addEventListener('input', () => this.recalculatePurchaseForm());
    document.getElementById('purchasePackBuyPrice')?.addEventListener('input', () => this.recalculatePurchaseForm());
    document.getElementById('purchaseAddQty')?.addEventListener('input', () => this.recalculatePurchaseForm());
    document.getElementById('purchasePaymentMethod')?.addEventListener('change', () => this.handlePurchasePaymentMethodChange());
    document.getElementById('purchasePaidAmount')?.addEventListener('input', () => this.recalculatePurchaseForm());
    document.getElementById('formNewPurchase')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSavePurchase();
    });

    document.getElementById('formNewProduct')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveProduct();
    });

    document.getElementById('formNewCOA')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveCOA();
    });

    document.getElementById('formManualJournal')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveManualJournal();
    });

    document.getElementById('formRepayment')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSaveRepayment();
    });

    document.getElementById('formStoreProfile')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveStoreProfile();
    });

    document.getElementById('formFirebaseConfig')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSaveFirebaseConfig();
    });

    document.getElementById('btnDisconnectFirebase')?.addEventListener('click', () => {
      this.firebase.clearConfig();
      this.updateCloudStatusBadge();
      this.showToast("Koneksi Firebase dinonaktifkan.", "warning");
    });

    document.getElementById('btnOpenFirebaseTutorial')?.addEventListener('click', () => {
      this.openModal('modalFirebaseGuide');
    });

    // Backup & Restore
    document.getElementById('btnDownloadBackup')?.addEventListener('click', () => {
      this.export.downloadBackupJSON();
      this.showToast("Cadangan database akuntansi JSON berhasil diunduh!");
    });

    document.getElementById('inputRestoreJSON')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await this.export.restoreFromJSON(file);
        this.populateCOAOptions();
        this.populateCategoryOptions();
        this.refreshCurrentView();
        this.updateStoreProfileHeader();
        this.showToast("Seluruh database & akuntansi berhasil dipulihkan!");
      } catch (err) {
        alert("Gagal restore: " + err.message);
      }
    });

    document.getElementById('btnClearAllData')?.addEventListener('click', async () => {
      if (confirm("⚠️ PERINGATAN: Apakah Anda yakin ingin MENGOSONGKAN SELURUH DATA (Transaksi, Stok Barang, dan Saldo Akuntansi) menjadi 0 (NOL/BERSIH)?")) {
        this.store.clearAllData();
        if (this.inventory) this.inventory.clearAllData();
        if (this.accounting) this.accounting.clearAllData();

        if (this.firebase && this.firebase.isCloudActive && this.firebase.db) {
          try {
            const snapshot = await this.firebase.db.collection(this.firebase.collectionName).get();
            const batch = this.firebase.db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          } catch (e) {
            console.warn("Gagal bersihkan cloud:", e);
          }
        }

        this.populateCOAOptions();
        this.refreshCurrentView();
        this.showToast("Semua data transaksi, stok & akuntansi telah dikosongkan (NOL)!", "success");
      }
    });

    // Filters
    ['txSearchInput', 'txTypeFilter', 'txCategoryFilter', 'txStatusFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.renderTransactionsTable());
      document.getElementById(id)?.addEventListener('change', () => this.renderTransactionsTable());
    });

    ['recSearchInput', 'recStatusFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.renderReceivablesView());
      document.getElementById(id)?.addEventListener('change', () => this.renderReceivablesView());
    });

    ['paySearchInput', 'payStatusFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.renderPayablesView());
      document.getElementById(id)?.addEventListener('change', () => this.renderPayablesView());
    });
  }

  // ==================== FORM ACTIONS ====================
  async handleSaveSale() {
    const items = [];
    const stockErrors = [];

    document.querySelectorAll('#saleItemsBuilderContainer .items-builder-row').forEach(row => {
      const name = row.querySelector('.item-name')?.value.trim();
      const qty = parseFloat(row.querySelector('.item-qty')?.value) || 1;
      const unit = row.querySelector('.item-unit-select')?.value || row.querySelector('.item-unit')?.value.trim() || 'Pcs';
      const unitRatio = parseFloat(row.querySelector('.item-unit-ratio')?.value) || 1;
      const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
      const productId = row.querySelector('.item-product-id')?.value || '';
      const cogs = parseFloat(row.querySelector('.item-cogs')?.value) || 0;

      if (name) {
        const totalBaseQty = qty * unitRatio;
        const product = this.inventory.products.find(p => (productId && p.id === productId) || p.name.toLowerCase() === name.toLowerCase());
        if (product && totalBaseQty > product.stock) {
          stockErrors.push(`• ${product.name}: Diminta ${qty} ${unit} (${totalBaseQty} ${product.unit}), tapi sisa stok di gudang hanya ada ${product.stock} ${product.unit}.`);
        }

        items.push({ id: productId, name, qty, unit, unitRatio, price, cogs, subtotal: qty * price });
      }
    });

    if (items.length === 0) {
      alert("Silakan masukkan minimal 1 barang material yang dijual!");
      return;
    }

    if (stockErrors.length > 0) {
      alert(`❌ TRANSAKSI PENJUALAN GAGAL (STOK TIDAK MENCUKUPI):\n\n${stockErrors.join('\n\n')}\n\nSolusi: Silakan kurangi jumlah penjualan atau lakukan kulakan/stok masuk terlebih dahulu.`);
      return;
    }

    const totalAmount = parseFloat(document.getElementById('saleTotalAmount')?.value) || 0;
    const method = document.getElementById('salePaymentMethod')?.value || 'cash';
    let paidAmount = totalAmount;

    if (method === 'piutang') {
      paidAmount = parseFloat(document.getElementById('saleDebtDP')?.value) || 0;
    } else {
      paidAmount = totalAmount;
    }

    const primaryCategory = (items[0] && items[0].id) ? (this.inventory?.products.find(p => p.id === items[0].id)?.category || 'lainnya') : 'lainnya';
    const customer = document.getElementById('saleCustomerName')?.value.trim() || 'Pelanggan Umum';

    const tendered = parseFloat(document.getElementById('saleTenderedAmount')?.value) || 0;
    const change = (tendered >= totalAmount && method === 'cash') ? (tendered - totalAmount) : 0;

    const subtotalAmount = parseFloat(document.getElementById('saleSubtotalAmount')?.value) || totalAmount;
    const discountPercent = parseFloat(document.getElementById('saleDiscountPercent')?.value) || 0;
    const discountAmount = parseFloat(document.getElementById('saleDiscountAmount')?.value) || 0;

    const txData = {
      type: 'in',
      paymentMethod: method,
      category: primaryCategory,
      date: document.getElementById('saleDate')?.value || new Date().toISOString().split('T')[0],
      title: `Penjualan - ${customer}`,
      customer: customer,
      supplier: '',
      phone: document.getElementById('saleCustomerPhone')?.value.trim() || '',
      amount: totalAmount,
      subtotal: subtotalAmount,
      discount: discountAmount,
      discountPercent: discountPercent,
      paidAmount: paidAmount,
      tenderedAmount: tendered,
      changeAmount: change,
      dueDate: document.getElementById('saleDueDate')?.value || '',
      notes: document.getElementById('saleNotes')?.value.trim() || '',
      items: items
    };

    try {
      const saved = await this.store.addTransaction(txData);
      this.closeModal('modalNewSale');
      this.refreshCurrentView();
      this.showToast(`Penjualan ${saved.id} berhasil dicatat & stok otomatis terpotong!`);

      setTimeout(() => {
        if (confirm(`Penjualan berhasil disimpan. Cetak Faktur / Nota Resmi sekarang?`)) {
          this.openReceiptModal(saved.id);
        }
      }, 300);
    } catch (err) {
      alert("Gagal menyimpan penjualan: " + err.message);
    }
  }

  async handleSavePurchase() {
    const selId = document.getElementById('purchaseProductSelect')?.value;
    const prod = this.inventory ? this.inventory.products.find(p => p.id === selId) : null;

    if (!prod) {
      alert("Silakan pilih barang material yang akan ditambah stoknya!");
      return;
    }

    const qtyInput = parseFloat(document.getElementById('purchaseAddQty')?.value) || 0;
    if (qtyInput <= 0) {
      alert("Silakan masukkan jumlah stok yang ditambahkan (lebih dari 0)!");
      return;
    }

    const unitChoiceVal = document.getElementById('purchaseUnitChoice')?.value || 'base';
    const isPack = (prod.hasMultiUnit && unitChoiceVal === 'pack');
    const ratio = isPack ? (prod.packRatio || 1) : 1;

    const baseQtyAdded = qtyInput * ratio;
    const unitBought = isPack ? prod.packUnit : prod.unit;
    const effectivePrice = isPack
      ? (parseFloat(document.getElementById('purchasePackBuyPrice')?.value) || (prod.buyPrice * ratio))
      : (parseFloat(document.getElementById('purchaseBuyPrice')?.value) || prod.buyPrice);

    const totalCost = qtyInput * effectivePrice;
    const method = document.getElementById('purchasePaymentMethod')?.value || 'cash';
    let paidAmount = totalCost;

    if (method === 'hutang') {
      paidAmount = parseFloat(document.getElementById('purchasePaidAmount')?.value) || 0;
    } else {
      paidAmount = totalCost;
    }

    const supplier = document.getElementById('purchaseSupplierName')?.value.trim() || 'Distributor Pabrik';
    const unitCostBase = baseQtyAdded > 0 ? Math.round(totalCost / baseQtyAdded) : effectivePrice;

    // Sinkronisasi update harga modal / harga jual master barang jika diedit di form
    const newSellPrice = parseFloat(document.getElementById('purchaseSellPrice')?.value) || prod.sellPrice;
    const updatedProdData = {
      buyPrice: isPack ? unitCostBase : (parseFloat(document.getElementById('purchaseBuyPrice')?.value) || prod.buyPrice),
      sellPrice: newSellPrice
    };
    if (isPack && prod.hasMultiUnit) {
      updatedProdData.packBuyPrice = effectivePrice;
    }
    this.inventory.updateProduct(prod.id, updatedProdData);

    const txData = {
      type: 'out',
      paymentMethod: method,
      category: prod.category || 'lainnya',
      date: document.getElementById('purchaseDate')?.value || new Date().toISOString().split('T')[0],
      title: `Kulakan ${prod.name} (${qtyInput} ${unitBought})`,
      customer: '',
      supplier: supplier,
      phone: '',
      amount: totalCost,
      paidAmount: paidAmount,
      dueDate: document.getElementById('purchaseDueDate')?.value || '',
      notes: document.getElementById('purchaseNotes')?.value.trim() || '',
      items: [
        {
          id: prod.id,
          name: prod.name,
          qty: baseQtyAdded,
          unit: prod.unit,
          unitRatio: 1,
          price: unitCostBase,
          cogs: unitCostBase,
          subtotal: totalCost
        }
      ]
    };

    try {
      const saved = await this.store.addTransaction(txData);
      this.closeModal('modalNewPurchase');
      this.refreshCurrentView();
      this.showToast(`Stok ${prod.name} berhasil ditambah +${baseQtyAdded} ${prod.unit}! Kulakan ${saved.id} tercatat.`);
    } catch (err) {
      alert("Gagal menyimpan kulakan: " + err.message);
    }
  }

  async handleSaveTransaction() {
    await this.handleSaveSale();
  }

  handleSaveProduct() {
    const hasMultiUnit = Boolean(document.getElementById('modalProdHasMultiUnit')?.checked);
    const packUnit = (document.getElementById('modalProdPackUnit')?.value || '').trim();
    const packRatio = hasMultiUnit ? Math.max(1, parseFloat(document.getElementById('modalProdPackRatio')?.value) || 1) : 1;
    const packBuyPrice = hasMultiUnit ? (parseFloat(document.getElementById('modalProdPackBuyPrice')?.value) || 0) : 0;
    const packSellPrice = hasMultiUnit ? (parseFloat(document.getElementById('modalProdPackSellPrice')?.value) || 0) : 0;

    let buyPrice = parseFloat(document.getElementById('modalProdBuyPrice').value) || 0;
    if (hasMultiUnit && packBuyPrice > 0 && buyPrice === 0) {
      buyPrice = Math.round(packBuyPrice / packRatio);
    }
    const sellPrice = parseFloat(document.getElementById('modalProdSellPrice').value) || 0;
    const stock = parseFloat(document.getElementById('modalProdStock').value) || 0;
    const totalAssetVal = buyPrice * stock;

    const prodData = {
      name: document.getElementById('modalProdName').value.trim(),
      category: document.getElementById('modalProdCategory').value,
      unit: document.getElementById('modalProdUnit').value.trim() || 'Pcs',
      buyPrice: buyPrice,
      sellPrice: sellPrice,
      hasMultiUnit: hasMultiUnit,
      packUnit: packUnit,
      packRatio: packRatio,
      packBuyPrice: packBuyPrice,
      packSellPrice: packSellPrice,
      stock: stock,
      minStock: parseFloat(document.getElementById('modalProdMinStock').value) || 5,
      location: document.getElementById('modalProdLocation').value.trim()
    };

    if (this.editingProdId) {
      this.inventory.updateProduct(this.editingProdId, prodData);
      this.showToast(`Data barang diperbarui! Total Nilai Aset: ${this.store.formatRupiah(totalAssetVal)}`);
    } else {
      this.inventory.addProduct(prodData);
      this.showToast(`Barang masuk dicatat! Total Nilai Aset (HPP): ${this.store.formatRupiah(totalAssetVal)}`);
    }

    this.closeModal('modalNewProduct');
    this.refreshCurrentView();
  }

  handleSaveCOA() {
    const code = document.getElementById('modalCOACode').value.trim();
    const accountData = {
      code: code,
      name: document.getElementById('modalCOAName').value.trim(),
      category: document.getElementById('modalCOACategory').value,
      normalBalance: document.getElementById('modalCOANormal').value,
      openingBalance: parseFloat(document.getElementById('modalCOAOpening').value) || 0
    };

    try {
      if (this.editingCOACode) {
        this.accounting.updateAccount(this.editingCOACode, accountData);
        this.showToast(`Akun COA ${accountData.code} - ${accountData.name} berhasil diperbarui!`);
      } else {
        this.accounting.addAccount(accountData);
        this.showToast(`Akun COA ${accountData.code} - ${accountData.name} berhasil ditambahkan!`);
      }
      this.populateCOAOptions();
      this.closeModal('modalNewCOA');
      this.refreshCurrentView();
    } catch (e) {
      alert(e.message);
    }
  }

  handleSaveManualJournal() {
    const lines = [];
    document.querySelectorAll('#journalLinesContainer .items-builder-row').forEach(row => {
      const accountCode = row.querySelector('.jrn-account')?.value;
      const debit = parseFloat(row.querySelector('.jrn-debit')?.value) || 0;
      const credit = parseFloat(row.querySelector('.jrn-credit')?.value) || 0;
      const desc = row.querySelector('.jrn-desc')?.value.trim();

      if (accountCode && (debit > 0 || credit > 0)) {
        lines.push({ accountCode, debit, credit, desc });
      }
    });

    const journalData = {
      date: document.getElementById('modalJrnDate').value,
      voucherNo: document.getElementById('modalJrnVoucher').value,
      desc: document.getElementById('modalJrnDesc').value,
      lines
    };

    try {
      if (this.editingJournalId) {
        this.accounting.updateManualJournal(this.editingJournalId, journalData);
        this.showToast("Jurnal penyesuaian berhasil diperbarui!");
      } else {
        this.accounting.addManualJournal(journalData);
        this.showToast("Jurnal penyesuaian manual berhasil dicatat!");
      }
      this.closeModal('modalManualJournal');
      this.refreshCurrentView();
    } catch (e) {
      alert(e.message);
    }
  }

  async handleSaveRepayment() {
    const txId = document.getElementById('repayTxId').value;
    const amount = parseFloat(document.getElementById('repayAmount').value) || 0;
    const date = document.getElementById('repayDate').value;
    const method = document.getElementById('repayMethod').value;
    const note = document.getElementById('repayNote').value;

    try {
      await this.store.addRepayment(txId, { amount, date, method, note });
      this.closeModal('modalRepayment');
      this.refreshCurrentView();
      this.showToast(`Pembayaran cicilan sebesar ${this.store.formatRupiah(amount)} berhasil disimpan!`);
    } catch (err) {
      alert("Gagal menyimpan cicilan: " + err.message);
    }
  }

  handleSaveStoreProfile() {
    const profile = {
      name: document.getElementById('settingStoreName').value.trim(),
      tagline: document.getElementById('settingStoreTagline').value.trim(),
      address: document.getElementById('settingStoreAddress').value.trim(),
      phone: document.getElementById('settingStorePhone').value.trim(),
      email: document.getElementById('settingStoreEmail').value.trim(),
      owner: document.getElementById('settingStoreOwner').value.trim(),
      footerText: document.getElementById('settingStoreFooter').value.trim()
    };

    if (this.store.saveStoreProfile(profile)) {
      this.updateStoreProfileHeader();
      this.showToast("Profil Toko Bangunan berhasil diperbarui!");
    }
  }

  async handleSaveFirebaseConfig() {
    const config = {
      apiKey: document.getElementById('fbApiKey').value.trim(),
      projectId: document.getElementById('fbProjectId').value.trim(),
      authDomain: document.getElementById('fbAuthDomain').value.trim(),
      storageBucket: document.getElementById('fbStorageBucket').value.trim(),
      appId: document.getElementById('fbAppId').value.trim()
    };

    if (!config.apiKey || !config.projectId) {
      alert("Harap masukkan minimal API Key dan Project ID dari Firebase Console!");
      return;
    }

    this.firebase.saveConfig(config);
    this.showToast("Menghubungkan ke Cloud Firebase...", "info");

    const ok = await this.firebase.init(config);
    this.updateCloudStatusBadge();

    if (ok) {
      this.showToast(`Berhasil terhubung ke Firebase Cloud: ${config.projectId}!`);
      if (confirm("Sinkronkan seluruh data transaksi lokal ke Cloud Firestore sekarang?")) {
        try {
          await this.firebase.uploadLocalBatch(this.store.transactions);
          this.showToast("Data berhasil diunggah ke Firebase Cloud!");
        } catch (syncErr) {
          alert("Gagal sinkronisasi data: " + syncErr.message);
        }
      }
    } else {
      alert("Gagal menghubungkan ke Firebase.");
    }
  }

  async deleteTransaction(txId) {
    if (confirm(`Hapus transaksi ${txId}?`)) {
      await this.store.deleteTransaction(txId);
      this.refreshCurrentView();
      this.showToast(`Transaksi ${txId} telah dihapus.`, "warning");
    }
  }

  showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'danger' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(35px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Inisialisasi Aplikasi saat DOM Siap
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
