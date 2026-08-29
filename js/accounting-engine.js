/**
 * TB. SERBA GUNA - DOUBLE ENTRY ACCOUNTING ENGINE
 * Menghasilkan Jurnal Umum Otomatis, Buku Besar, Neraca Lajur 10 Kolom,
 * Laporan Laba Rugi Formal, dan Neraca Keuangan (Aktiva = Pasiva).
 */

const STORAGE_KEYS_ACCOUNTING = {
  COA: "TB_SERBAGUNA_COA",
  OPENING_BALANCES: "TB_SERBAGUNA_OPENING_BALANCES",
  MANUAL_JOURNALS: "TB_SERBAGUNA_MANUAL_JOURNALS"
};

class AccountingEngine {
  constructor() {
    this.coa = [];
    this.openingBalances = {};
    this.manualJournals = [];
    this.init();
  }

  init() {
    try {
      const savedCOA = localStorage.getItem(STORAGE_KEYS_ACCOUNTING.COA);
      if (savedCOA) {
        this.coa = JSON.parse(savedCOA);
        DEFAULT_COA.forEach(d => {
          if (!this.coa.some(c => c.code === d.code)) {
            this.coa.push({ ...d });
          }
        });
        this.saveCOA();
      } else {
        this.coa = JSON.parse(JSON.stringify(DEFAULT_COA));
        this.saveCOA();
      }
    } catch (e) {
      console.warn("Gagal memuat COA:", e);
      this.coa = JSON.parse(JSON.stringify(DEFAULT_COA));
    }

    try {
      const savedOB = localStorage.getItem(STORAGE_KEYS_ACCOUNTING.OPENING_BALANCES);
      if (savedOB) {
        this.openingBalances = JSON.parse(savedOB);
      } else {
        this.openingBalances = { ...INITIAL_OPENING_BALANCES };
        this.saveOpeningBalances();
      }
    } catch (e) {
      console.warn("Gagal memuat saldo awal:", e);
      this.openingBalances = {};
    }

    try {
      const savedMJ = localStorage.getItem(STORAGE_KEYS_ACCOUNTING.MANUAL_JOURNALS);
      if (savedMJ) {
        this.manualJournals = JSON.parse(savedMJ);
      } else {
        this.manualJournals = [];
      }
    } catch (e) {
      console.warn("Gagal memuat jurnal manual:", e);
      this.manualJournals = [];
    }
  }

  saveCOA() {
    try {
      localStorage.setItem(STORAGE_KEYS_ACCOUNTING.COA, JSON.stringify(this.coa));
    } catch (e) {
      console.error("Gagal simpan COA:", e);
    }
  }

  saveOpeningBalances() {
    try {
      localStorage.setItem(STORAGE_KEYS_ACCOUNTING.OPENING_BALANCES, JSON.stringify(this.openingBalances));
    } catch (e) {
      console.error("Gagal simpan saldo awal:", e);
    }
  }

  saveManualJournals() {
    try {
      localStorage.setItem(STORAGE_KEYS_ACCOUNTING.MANUAL_JOURNALS, JSON.stringify(this.manualJournals));
    } catch (e) {
      console.error("Gagal simpan jurnal manual:", e);
    }
  }

  addAccount(accountData) {
    const code = accountData.code.trim();
    const existing = this.coa.find(a => a.code === code);
    if (existing) {
      throw new Error(`Kode akun ${code} sudah digunakan oleh ${existing.name}`);
    }

    const newAcc = {
      code: code,
      name: accountData.name.trim(),
      category: accountData.category || "beban_operasional",
      normalBalance: accountData.normalBalance || "debit",
      isCustom: true
    };

    this.coa.push(newAcc);
    this.coa.sort((a, b) => a.code.localeCompare(b.code));
    this.saveCOA();

    if (accountData.openingBalance !== undefined) {
      this.openingBalances[newAcc.code] = Number(accountData.openingBalance) || 0;
      this.saveOpeningBalances();
    }

    return newAcc;
  }

  updateAccount(code, accountData) {
    const acc = this.coa.find(a => a.code === code);
    if (!acc) throw new Error("Akun COA tidak ditemukan.");

    acc.name = accountData.name.trim();
    if (accountData.category) acc.category = accountData.category;
    if (accountData.normalBalance) acc.normalBalance = accountData.normalBalance;

    this.saveCOA();

    if (accountData.openingBalance !== undefined) {
      this.openingBalances[code] = Number(accountData.openingBalance) || 0;
      this.saveOpeningBalances();
    }

    return acc;
  }

  deleteAccount(code) {
    const idx = this.coa.findIndex(a => a.code === code);
    if (idx === -1) return false;

    this.coa.splice(idx, 1);
    delete this.openingBalances[code];
    this.saveCOA();
    this.saveOpeningBalances();
    return true;
  }

  getAccount(code) {
    return this.coa.find(a => a.code === code) || {
      code,
      name: `Akun #${code}`,
      category: "beban_operasional",
      normalBalance: "debit"
    };
  }

  generateJournalsFromTransactions(transactions = []) {
    const autoJournals = [];

    transactions.forEach(tx => {
      const date = tx.date || new Date().toISOString().split('T')[0];
      const voucher = tx.id;
      const desc = tx.title || (tx.type === 'in' ? 'Penjualan Material' : 'Pembelian / Kulakan Material');
      const amount = Number(tx.amount) || 0;
      const paid = Number(tx.paidAmount) || 0;
      const debt = Number(tx.debtAmount) !== undefined ? Number(tx.debtAmount) : Math.max(0, amount - paid);
      const cogs = Number(tx.cogs) || 0;

      if (amount <= 0) return;

      if (tx.type === 'in') {
        const lines = [];
        const discount = Number(tx.discount) || 0;
        const grossAmount = discount > 0 ? (amount + discount) : amount;

        // 1. Kas / Bank / Piutang Masuk (Sisi Debit - Sebesar Nominal Bersih)
        if (tx.paymentMethod === 'cash') {
          lines.push({ accountCode: '1101', debit: amount, credit: 0, desc: 'Penerimaan Kasir Tunai' });
        } else if (tx.paymentMethod === 'transfer') {
          lines.push({ accountCode: '1102', debit: amount, credit: 0, desc: 'Penerimaan Transfer Bank BCA / QRIS' });
        } else if (tx.paymentMethod === 'piutang') {
          if (paid > 0) {
            lines.push({ accountCode: '1101', debit: paid, credit: 0, desc: 'Penerimaan Uang Muka (DP) Bon' });
          }
          if (debt > 0) {
            lines.push({ accountCode: '1103', debit: debt, credit: 0, desc: 'Piutang Bon Usaha Pelanggan' });
          }
          if (paid === 0 && debt === 0 && amount > 0) {
            lines.push({ accountCode: '1103', debit: amount, credit: 0, desc: 'Piutang Bon Usaha Pelanggan' });
          }
        } else {
          lines.push({ accountCode: '1101', debit: amount, credit: 0, desc: 'Penerimaan Kasir' });
        }

        // 2. Potongan / Diskon Penjualan (Sisi Debit - Akun Kontra Pendapatan 4102)
        if (discount > 0) {
          lines.push({ accountCode: '4102', debit: discount, credit: 0, desc: 'Potongan / Diskon Penjualan' });
        }

        // 3. Pendapatan Penjualan (Sisi Kredit - Nilai Bruto Penjualan)
        const revenueCode = tx.category === 'ongkir' ? '4201' : '4101';
        const revDesc = tx.category === 'ongkir' ? 'Pendapatan Ongkir Truk' : 'Pendapatan Penjualan Material';
        lines.push({ accountCode: revenueCode, debit: 0, credit: grossAmount, desc: revDesc });

        // 4. Beban Pokok Penjualan (HPP) & Pengurangan Stok Persediaan
        if (cogs > 0 && tx.category !== 'ongkir') {
          lines.push({ accountCode: '5101', debit: cogs, credit: 0, desc: 'Harga Pokok Penjualan (HPP)' });
          lines.push({ accountCode: '1104', debit: 0, credit: cogs, desc: 'Pengurangan Stok Persediaan' });
        }

        autoJournals.push({
          id: `JRN-${tx.id}`,
          date,
          createdAt: tx.createdAt || `${date}T${tx.time || '12:00:00'}`,
          priority: 40, // Penjualan Kasir
          voucherNo: voucher,
          desc,
          lines,
          isAuto: true
        });

      } else if (tx.type === 'out') {
        const lines = [];

        // 1. Penambahan Persediaan Material / Beban Operasional (Sisi Debit)
        let debitAcc = '1104';
        let debitDesc = 'Persediaan Barang Dagang (Stok Material Masuk)';

        if (tx.category === 'operasional') {
          debitAcc = '6101';
          debitDesc = 'Beban Gaji Karyawan & Upah Bongkar';
        } else if (tx.category === 'armada') {
          debitAcc = '6102';
          debitDesc = 'Beban BBM Solar & Perawatan Truk';
        } else if (tx.category === 'beban_lain') {
          debitAcc = '6199';
          debitDesc = 'Beban Operasional Lainnya';
        }

        lines.push({ accountCode: debitAcc, debit: amount, credit: 0, desc: debitDesc });

        // 2. Kas / Bank / Hutang Keluar (Sisi Kredit)
        if (tx.paymentMethod === 'cash') {
          lines.push({ accountCode: '1101', debit: 0, credit: amount, desc: 'Pengeluaran Kas Toko' });
        } else if (tx.paymentMethod === 'transfer') {
          lines.push({ accountCode: '1102', debit: 0, credit: amount, desc: 'Pengeluaran Rekening Bank BCA' });
        } else if (tx.paymentMethod === 'hutang') {
          if (paid > 0) {
            lines.push({ accountCode: '1101', debit: 0, credit: paid, desc: 'Pembayaran DP ke Distributor' });
          }
          if (debt > 0) {
            lines.push({ accountCode: '2101', debit: 0, credit: debt, desc: 'Hutang Usaha ke Distributor' });
          }
          if (paid === 0 && debt === 0 && amount > 0) {
            lines.push({ accountCode: '2101', debit: 0, credit: amount, desc: 'Hutang Usaha ke Distributor' });
          }
        } else {
          lines.push({ accountCode: '1101', debit: 0, credit: amount, desc: 'Pengeluaran Kas Toko' });
        }

        autoJournals.push({
          id: `JRN-${tx.id}`,
          date,
          createdAt: tx.createdAt || `${date}T${tx.time || '10:00:00'}`,
          priority: 30, // Kulakan / Stok Masuk
          voucherNo: voucher,
          desc,
          lines,
          isAuto: true
        });

      } else if (tx.type === 'return') {
        const lines = [];
        // 1. Akun Kontra Pendapatan: Retur Penjualan (Sisi Debit 4103)
        lines.push({ accountCode: '4103', debit: amount, credit: 0, desc: 'Retur Penjualan Material' });

        // 2. Pengembalian Dana / Potong Piutang (Sisi Kredit)
        if (tx.refundMethod === 'piutang' || tx.paymentMethod === 'piutang') {
          lines.push({ accountCode: '1103', debit: 0, credit: amount, desc: 'Pengurangan Piutang Bon Pelanggan' });
        } else if (tx.refundMethod === 'transfer' || tx.paymentMethod === 'transfer') {
          lines.push({ accountCode: '1102', debit: 0, credit: amount, desc: 'Pengembalian Dana via Transfer Bank' });
        } else {
          lines.push({ accountCode: '1101', debit: 0, credit: amount, desc: 'Pengembalian Uang Kasir Tunai' });
        }

        // 3. Kembalikan Stok Persediaan ke Gudang (Debit 1104) & Kurangi HPP (Kredit 5101)
        if (cogs > 0) {
          lines.push({ accountCode: '1104', debit: cogs, credit: 0, desc: 'Stok Barang Masuk Kembali ke Gudang' });
          lines.push({ accountCode: '5101', debit: 0, credit: cogs, desc: 'Pengurangan HPP Barang Diretur' });
        }

        autoJournals.push({
          id: `JRN-${tx.id}`,
          date,
          createdAt: tx.createdAt || `${date}T${tx.time || '14:00:00'}`,
          priority: 50, // Retur Penjualan
          voucherNo: voucher,
          desc,
          lines,
          isAuto: true
        });
      }

      // 4. Pembayaran Cicilan / Pelunasan Lanjutan
      if (Array.isArray(tx.payments)) {
        tx.payments.forEach((p, pIdx) => {
          if (pIdx === 0 && (tx.paymentMethod === 'cash' || tx.paymentMethod === 'transfer')) return;
          if (pIdx === 0 && (tx.paymentMethod === 'piutang' || tx.paymentMethod === 'hutang')) return;

          const pAmount = Number(p.amount) || 0;
          if (pAmount <= 0) return;

          const payDate = p.date || tx.date;
          const payLines = [];
          const cashAcc = p.method === 'transfer' ? '1102' : '1101';

          if (tx.type === 'in') {
            payLines.push({ accountCode: cashAcc, debit: pAmount, credit: 0, desc: `Pelunasan Bon: ${p.note || tx.title}` });
            payLines.push({ accountCode: '1103', debit: 0, credit: pAmount, desc: 'Pengurangan Piutang Bon' });
          } else {
            payLines.push({ accountCode: '2101', debit: pAmount, credit: 0, desc: 'Pelunasan Hutang Distributor' });
            payLines.push({ accountCode: cashAcc, debit: 0, credit: pAmount, desc: `Pembayaran Hutang: ${p.note || tx.title}` });
          }

          autoJournals.push({
            id: `JRN-PAY-${tx.id}-${pIdx}`,
            date: payDate,
            createdAt: p.createdAt || `${payDate}T${tx.time || '15:00:00'}`,
            priority: 60, // Pelunasan Cicilan
            voucherNo: p.receiptNo || `PAY-${tx.id}-${pIdx}`,
            desc: `Pelunasan Cicilan: ${tx.title} (${tx.customer || tx.supplier || ''})`,
            lines: payLines,
            isAuto: true
          });
        });
      }
    });

    return autoJournals;
  }

  addManualJournal(journalData) {
    let totDebit = 0;
    let totCredit = 0;

    journalData.lines.forEach(line => {
      totDebit += (Number(line.debit) || 0);
      totCredit += (Number(line.credit) || 0);
    });

    if (Math.abs(totDebit - totCredit) > 1) {
      throw new Error(`Ayat Jurnal Tidak Seimbang! Total Debit (${totDebit}) harus sama dengan Total Kredit (${totCredit})`);
    }

    const isOwnerEquity = journalData.lines.some(l => l.accountCode === '3101' || l.accountCode === '1104');
    const priority = isOwnerEquity ? 15 : 35;

    const newJournal = {
      id: `MJRN-${Date.now()}`,
      date: journalData.date || new Date().toISOString().split('T')[0],
      voucherNo: journalData.voucherNo || `JV-${Date.now()}`,
      desc: journalData.desc || "Jurnal Penyesuaian Manual",
      lines: journalData.lines,
      isAuto: false,
      priority: priority,
      createdAt: new Date().toISOString()
    };

    this.manualJournals.unshift(newJournal);
    this.saveManualJournals();
    return newJournal;
  }

  updateManualJournal(journalId, journalData) {
    const idx = this.manualJournals.findIndex(j => j.id === journalId);
    if (idx === -1) throw new Error("Jurnal manual tidak ditemukan.");

    let totDebit = 0;
    let totCredit = 0;
    journalData.lines.forEach(line => {
      totDebit += (Number(line.debit) || 0);
      totCredit += (Number(line.credit) || 0);
    });

    if (Math.abs(totDebit - totCredit) > 1) {
      throw new Error(`Ayat Jurnal Tidak Seimbang! Total Debit (${totDebit}) harus sama dengan Total Kredit (${totCredit})`);
    }

    const isOwnerEquity = journalData.lines.some(l => l.accountCode === '3101' || l.accountCode === '1104');
    const priority = isOwnerEquity ? 15 : 35;

    const updated = {
      ...this.manualJournals[idx],
      date: journalData.date || this.manualJournals[idx].date,
      voucherNo: journalData.voucherNo || this.manualJournals[idx].voucherNo,
      desc: journalData.desc || this.manualJournals[idx].desc,
      lines: journalData.lines,
      priority: priority,
      updatedAt: new Date().toISOString()
    };

    this.manualJournals[idx] = updated;
    this.saveManualJournals();
    return updated;
  }

  deleteManualJournal(journalId) {
    const idx = this.manualJournals.findIndex(j => j.id === journalId);
    if (idx === -1) return false;
    this.manualJournals.splice(idx, 1);
    this.saveManualJournals();
    return true;
  }

  generateJournalsFromInventory() {
    const journals = [];
    if (!window.inventoryStore || !Array.isArray(window.inventoryStore.products)) {
      return journals;
    }

    window.inventoryStore.products.forEach(p => {
      const initStock = Number(p.initialStock !== undefined ? p.initialStock : p.stock) || 0;
      const buyPrice = Number(p.buyPrice) || 0;
      const totalAsset = initStock * buyPrice;

      if (totalAsset > 0) {
        const dateStr = p.createdAt ? p.createdAt.split('T')[0] : (p.updatedAt ? p.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0]);
        journals.push({
          id: `JRN-STK-${p.id}`,
          date: dateStr,
          createdAt: p.createdAt || `${dateStr}T00:00:00.000Z`,
          priority: 10, // Modal Awal / Saldo Awal Persediaan selalu nomor 1 paling atas
          voucherNo: `STK-${p.code || p.id}`,
          desc: `Saldo Awal Persediaan Material: ${p.name} (${initStock} ${p.unit} @ Rp ${buyPrice.toLocaleString('id-ID')})`,
          lines: [
            {
              accountCode: '1104',
              debit: totalAsset,
              credit: 0,
              desc: `Saldo Awal Stok Persediaan: ${p.name}`
            },
            {
              accountCode: '3101',
              debit: 0,
              credit: totalAsset,
              desc: `Modal Awal Persediaan Pemilik Toko`
            }
          ],
          isAuto: true
        });
      }
    });

    return journals;
  }

  getAllJournals(period = '') {
    const rawTx = window.transactionStore ? window.transactionStore.transactions : [];
    const autoJrn = this.generateJournalsFromTransactions(rawTx);
    const stockJrn = this.generateJournalsFromInventory();
    const combined = [...autoJrn, ...stockJrn, ...this.manualJournals];

    combined.sort((a, b) => {
      // 1. Urutkan berdasarkan Tanggal Transaksi (Terlama ke Terbaru)
      const dateA = a.date || "";
      const dateB = b.date || "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      // 2. Jika tanggal sama, urutkan murni sesuai Waktu / Jam Transaksi (createdAt / Jam Input)
      const timeA = a.createdAt || (a.date ? `${a.date}T00:00:00` : "");
      const timeB = b.createdAt || (b.date ? `${b.date}T00:00:00` : "");
      if (timeA && timeB && timeA !== timeB) return timeA.localeCompare(timeB);

      // 3. Fallback jika waktu sama: Nomor Voucher / ID
      return (a.voucherNo || a.id || "").localeCompare(b.voucherNo || b.id || "");
    });

    if (period) {
      return combined.filter(j => j.date && j.date.startsWith(period));
    }
    return combined;
  }

  getGeneralLedger(period = '') {
    const journals = this.getAllJournals(period);
    const ledger = {};

    this.coa.forEach(acc => {
      const openBal = Number(this.openingBalances[acc.code]) || 0;
      ledger[acc.code] = {
        code: acc.code,
        name: acc.name,
        category: acc.category,
        normalBalance: acc.normalBalance,
        openingBalance: openBal,
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        endingBalance: openBal
      };
    });

    journals.forEach(j => {
      j.lines.forEach(l => {
        const code = l.accountCode;
        if (!ledger[code]) {
          const fallback = this.getAccount(code);
          ledger[code] = {
            code: fallback.code,
            name: fallback.name,
            category: fallback.category,
            normalBalance: fallback.normalBalance,
            openingBalance: 0,
            entries: [],
            totalDebit: 0,
            totalCredit: 0,
            endingBalance: 0
          };
        }

        const deb = Number(l.debit) || 0;
        const cre = Number(l.credit) || 0;
        const acc = ledger[code];

        acc.totalDebit += deb;
        acc.totalCredit += cre;

        let running = acc.openingBalance;
        if (acc.entries.length > 0) {
          running = acc.entries[acc.entries.length - 1].runningBalance;
        }

        if (acc.normalBalance === 'debit') {
          running = running + deb - cre;
        } else {
          running = running + cre - deb;
        }

        acc.entries.push({
          date: j.date,
          voucherNo: j.voucherNo,
          desc: l.desc || j.desc,
          debit: deb,
          credit: cre,
          runningBalance: running
        });

        acc.endingBalance = running;
      });
    });

    return ledger;
  }

  getWorksheet10Column(period = '') {
    const ledger = this.getGeneralLedger(period);
    const rows = [];

    let totTB_Debit = 0, totTB_Credit = 0;
    let totAdj_Debit = 0, totAdj_Credit = 0;
    let totATB_Debit = 0, totATB_Credit = 0;
    let totIS_Debit = 0, totIS_Credit = 0;
    let totBS_Debit = 0, totBS_Credit = 0;

    this.coa.forEach(acc => {
      const data = ledger[acc.code] || {
        openingBalance: 0, totalDebit: 0, totalCredit: 0, endingBalance: 0, normalBalance: acc.normalBalance
      };

      const tbDebit = acc.normalBalance === 'debit' ? (data.openingBalance + data.totalDebit) : 0;
      const tbCredit = acc.normalBalance === 'kredit' ? (data.openingBalance + data.totalCredit) : 0;

      let adjDebit = 0;
      let adjCredit = 0;
      this.manualJournals.forEach(mj => {
        if (!period || mj.date.startsWith(period)) {
          mj.lines.forEach(l => {
            if (l.accountCode === acc.code) {
              adjDebit += (Number(l.debit) || 0);
              adjCredit += (Number(l.credit) || 0);
            }
          });
        }
      });

      let netBal = 0;
      if (acc.normalBalance === 'debit') {
        netBal = (data.openingBalance + data.totalDebit - data.totalCredit);
      } else {
        netBal = (data.openingBalance + data.totalCredit - data.totalDebit);
      }

      const atbDebit = acc.normalBalance === 'debit' ? Math.max(0, netBal) : 0;
      const atbCredit = acc.normalBalance === 'kredit' ? Math.max(0, netBal) : 0;

      let isDebit = 0, isCredit = 0;
      let bsDebit = 0, bsCredit = 0;

      const isNominal = ['pendapatan', 'hpp', 'beban_operasional'].includes(acc.category);
      if (isNominal) {
        isDebit = atbDebit;
        isCredit = atbCredit;
      } else {
        bsDebit = atbDebit;
        bsCredit = atbCredit;
      }

      totTB_Debit += tbDebit;
      totTB_Credit += tbCredit;
      totAdj_Debit += adjDebit;
      totAdj_Credit += adjCredit;
      totATB_Debit += atbDebit;
      totATB_Credit += atbCredit;
      totIS_Debit += isDebit;
      totIS_Credit += isCredit;
      totBS_Debit += bsDebit;
      totBS_Credit += bsCredit;

      rows.push({
        code: acc.code,
        name: acc.name,
        category: acc.category,
        tbDebit, tbCredit,
        adjDebit, adjCredit,
        atbDebit, atbCredit,
        isDebit, isCredit,
        bsDebit, bsCredit
      });
    });

    const netIncome = totIS_Credit - totIS_Debit;
    const balancedIS_Debit = totIS_Debit + (netIncome > 0 ? netIncome : 0);
    const balancedIS_Credit = totIS_Credit + (netIncome < 0 ? Math.abs(netIncome) : 0);
    const balancedBS_Debit = totBS_Debit + (netIncome < 0 ? Math.abs(netIncome) : 0);
    const balancedBS_Credit = totBS_Credit + (netIncome > 0 ? netIncome : 0);

    return {
      period,
      rows,
      totals: {
        totTB_Debit, totTB_Credit,
        totAdj_Debit, totAdj_Credit,
        totATB_Debit, totATB_Credit,
        totIS_Debit, totIS_Credit,
        totBS_Debit, totBS_Credit,
        netIncome,
        balancedIS_Debit, balancedIS_Credit,
        balancedBS_Debit, balancedBS_Credit
      }
    };
  }

  getIncomeStatement(period = '') {
    const ledger = this.getGeneralLedger(period);
    const revenues = [];
    const cogs = [];
    const expenses = [];

    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalExpenses = 0;

    this.coa.forEach(acc => {
      const l = ledger[acc.code];
      const val = l ? Math.abs(l.endingBalance) : 0;
      if (val === 0) return;

      if (acc.category === 'pendapatan') {
        const isContra = acc.normalBalance === 'debit';
        revenues.push({ code: acc.code, name: acc.name, amount: val, isContra });
        totalRevenue += isContra ? -val : val;
      } else if (acc.category === 'hpp') {
        cogs.push({ code: acc.code, name: acc.name, amount: val });
        totalCOGS += val;
      } else if (acc.category === 'beban_operasional') {
        expenses.push({ code: acc.code, name: acc.name, amount: val });
        totalExpenses += val;
      }
    });

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpenses;
    const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    return {
      period,
      revenues,
      totalRevenue,
      cogs,
      totalCOGS,
      grossProfit,
      expenses,
      totalExpenses,
      netProfit,
      netMargin
    };
  }

  getBalanceSheet(period = '') {
    const ledger = this.getGeneralLedger(period);
    const inc = this.getIncomeStatement(period);

    const currentAssets = [];
    const fixedAssets = [];
    const currentLiabilities = [];
    const equity = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    this.coa.forEach(acc => {
      const l = ledger[acc.code];
      let val = l ? l.endingBalance : 0;

      if (acc.category === 'aset_lancar') {
        currentAssets.push({ code: acc.code, name: acc.name, amount: val });
        totalAssets += val;
      } else if (acc.category === 'aset_tetap') {
        const isContra = acc.normalBalance === 'kredit';
        fixedAssets.push({ code: acc.code, name: acc.name, amount: val, isContra });
        totalAssets += isContra ? -val : val;
      } else if (acc.category === 'kewajiban_lancar') {
        currentLiabilities.push({ code: acc.code, name: acc.name, amount: val });
        totalLiabilities += val;
      } else if (acc.category === 'ekuitas') {
        equity.push({ code: acc.code, name: acc.name, amount: val });
        totalEquity += val;
      }
    });

    // Masukkan Laba Bersih Berjalan ke Ekuitas
    equity.push({ code: "3201-CURR", name: "Laba Bersih Tahun Berjalan", amount: inc.netProfit, isCalculated: true });
    totalEquity += inc.netProfit;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const difference = totalAssets - totalLiabilitiesAndEquity;
    const isBalanced = Math.abs(difference) < 1;

    return {
      period,
      currentAssets,
      fixedAssets,
      totalAssets,
      currentLiabilities,
      totalLiabilities,
      equity,
      totalEquity,
      totalLiabilitiesAndEquity,
      difference,
      isBalanced
    };
  }

  clearAllData() {
    this.openingBalances = {};
    this.manualJournals = [];
    this.saveOpeningBalances();
    this.saveManualJournals();
  }
}

// Global Accounting Engine Instance
window.accountingEngine = new AccountingEngine();
