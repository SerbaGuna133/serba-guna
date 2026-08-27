/**
 * TB. SERBA GUNA - EXPORT & OFFICIAL INVOICE MANAGER
 * Ekspor Excel (Jurnal, Buku Besar, Neraca Lajur, Neraca, Laba Rugi) & Cetak Faktur/Nota Resmi.
 */

class ExportManager {
  constructor() {
    this.store = window.transactionStore;
    this.accounting = window.accountingEngine;
  }

  // 1. Ekspor Rekap Transaksi ke Excel
  exportToExcel(transactions = null, filename = null) {
    const list = transactions || this.store.transactions;
    const profile = this.store.storeProfile;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const defaultFilename = filename || `Laporan_Keuangan_TB_Serba_Guna_${dateStr}.xlsx`;

    if (typeof XLSX === 'undefined') {
      alert("Library SheetJS (XLSX) tidak terdeteksi. Mengalihkan ke CSV...");
      this.exportToCSV(list);
      return;
    }

    const rows = [];
    rows.push(["LAPORAN PEMBUKUAN KEUANGAN TOKO BANGUNAN"]);
    rows.push([profile.name.toUpperCase()]);
    rows.push([profile.address + " | Telp: " + profile.phone]);
    rows.push(["Tanggal Ekspor: " + now.toLocaleString('id-ID')]);
    rows.push([]);

    rows.push([
      "No", "ID Transaksi", "Tanggal", "Waktu", "Jenis Kas", "Kategori Material",
      "Keterangan", "Pelanggan / Supplier", "Metode Bayar", "Total Nominal (Rp)",
      "Sudah Dibayar (Rp)", "Sisa Bon/Hutang (Rp)", "Status", "Jatuh Tempo", "Catatan"
    ]);

    list.forEach((tx, idx) => {
      const typeLabel = tx.type === 'in' ? 'Pemasukan (Penjualan)' : 'Pengeluaran (Belanja/Biaya)';
      const methodLabel = tx.paymentMethod === 'cash' ? 'Tunai / Kasir' :
        tx.paymentMethod === 'transfer' ? 'Transfer Bank' :
        tx.paymentMethod === 'piutang' ? 'Piutang / Bon Proyek' : 'Hutang Distributor';

      const catObj = MATERIAL_CATEGORIES.find(c => c.id === tx.category);
      const catLabel = catObj ? catObj.name : (tx.category || '-');

      rows.push([
        idx + 1, tx.id, tx.date, tx.time || "-", typeLabel, catLabel,
        tx.title, tx.customer || tx.supplier || "-", methodLabel,
        tx.amount, tx.paidAmount || 0, tx.debtAmount || 0,
        tx.status === 'lunas' ? 'LUNAS' : 'TEMPO / BON',
        tx.dueDate || "-", tx.notes || "-"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Transaksi");
    XLSX.writeFile(wb, defaultFilename);
  }

  // 2. Ekspor Jurnal Umum ke Excel
  exportJournalsToExcel(period = '') {
    if (typeof XLSX === 'undefined') return;
    const journals = this.accounting.getAllJournals(period);
    const profile = this.store.storeProfile;

    const rows = [];
    rows.push(["JURNAL UMUM (GENERAL JOURNAL)"]);
    rows.push([profile.name.toUpperCase()]);
    rows.push([`Periode: ${period || 'Semua Waktu'}`]);
    rows.push([]);

    rows.push(["Tanggal", "No. Bukti / Voucher", "Kode Akun", "Nama Akun", "Keterangan", "Debit (Rp)", "Kredit (Rp)"]);

    let totD = 0, totC = 0;
    journals.forEach(j => {
      j.lines.forEach((l, idx) => {
        const acc = this.accounting.getAccount(l.accountCode);
        const deb = Number(l.debit) || 0;
        const cre = Number(l.credit) || 0;
        totD += deb;
        totC += cre;

        rows.push([
          idx === 0 ? j.date : "",
          idx === 0 ? j.voucherNo : "",
          l.accountCode,
          acc.name,
          l.desc || j.desc,
          deb > 0 ? deb : "",
          cre > 0 ? cre : ""
        ]);
      });
    });

    rows.push([]);
    rows.push(["TOTAL DEBIT & KREDIT", "", "", "", "", totD, totC]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jurnal Umum");
    XLSX.writeFile(wb, `Jurnal_Umum_TB_Serba_Guna_${period || 'All'}.xlsx`);
  }

  // 3. Ekspor Neraca Lajur 10 Kolom ke Excel
  exportWorksheetToExcel(period = '') {
    if (typeof XLSX === 'undefined') return;
    const wsData = this.accounting.getWorksheet10Column(period);
    const profile = this.store.storeProfile;

    const rows = [];
    rows.push(["NERACA LAJUR 10 KOLOM (WORKSHEET)"]);
    rows.push([profile.name.toUpperCase()]);
    rows.push([`Periode: ${period || 'Semua Waktu'}`]);
    rows.push([]);

    // Header 2 Tingkat
    rows.push([
      "Kode", "Nama Akun",
      "Neraca Saldo", "",
      "Penyesuaian", "",
      "Neraca Saldo Disesuaikan", "",
      "Laba Rugi", "",
      "Neraca Akhir", ""
    ]);

    rows.push([
      "", "",
      "Debit", "Kredit",
      "Debit", "Kredit",
      "Debit", "Kredit",
      "Debit", "Kredit",
      "Debit", "Kredit"
    ]);

    wsData.rows.forEach(r => {
      rows.push([
        r.code, r.name,
        r.tbDebit || 0, r.tbCredit || 0,
        r.adjDebit || 0, r.adjCredit || 0,
        r.atbDebit || 0, r.atbCredit || 0,
        r.isDebit || 0, r.isCredit || 0,
        r.bsDebit || 0, r.bsCredit || 0
      ]);
    });

    // Total Sebelum Laba
    const t = wsData.totals;
    rows.push([
      "TOTAL", "",
      t.totTB_Debit, t.totTB_Credit,
      t.totAdj_Debit, t.totAdj_Credit,
      t.totATB_Debit, t.totATB_Credit,
      t.totIS_Debit, t.totIS_Credit,
      t.totBS_Debit, t.totBS_Credit
    ]);

    // Baris Laba Bersih
    rows.push([
      "LABA BERSIH", "",
      "", "",
      "", "",
      "", "",
      t.netIncome > 0 ? t.netIncome : "", t.netIncome < 0 ? Math.abs(t.netIncome) : "",
      t.netIncome < 0 ? Math.abs(t.netIncome) : "", t.netIncome > 0 ? t.netIncome : ""
    ]);

    // Total Seimbang
    rows.push([
      "TOTAL SEIMBANG (BALANCED)", "",
      t.totTB_Debit, t.totTB_Credit,
      t.totAdj_Debit, t.totAdj_Credit,
      t.totATB_Debit, t.totATB_Credit,
      t.balancedIS_Debit, t.balancedIS_Credit,
      t.balancedBS_Debit, t.balancedBS_Credit
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Neraca Lajur 10 Kolom");
    XLSX.writeFile(wb, `Neraca_Lajur_TB_Serba_Guna_${period || 'All'}.xlsx`);
  }

  // 4. Render Faktur Resmi Toko Bangunan (Ukuran A4 / A5 Resmi)
  generateOfficialInvoiceHTML(txId) {
    const tx = this.store.transactions.find(t => t.id === txId);
    if (!tx) return "<p>Transaksi tidak ditemukan</p>";

    const profile = this.store.storeProfile;
    const isPiutang = tx.paymentMethod === 'piutang';
    const isHutang = tx.paymentMethod === 'hutang';

    let itemsRows = "";
    if (Array.isArray(tx.items) && tx.items.length > 0) {
      itemsRows = tx.items.map((item, idx) => `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td class="font-mono text-xs">${item.id || `ITM-${idx+1}`}</td>
          <td><strong>${item.name}</strong></td>
          <td class="text-center">${item.qty}</td>
          <td class="text-center">${item.unit || 'Pcs'}</td>
          <td class="text-right">${this.store.formatRupiah(item.price)}</td>
          <td class="text-right font-semibold">${this.store.formatRupiah(item.subtotal)}</td>
        </tr>
      `).join('');
    } else {
      itemsRows = `
        <tr>
          <td class="text-center">1</td>
          <td class="font-mono text-xs">GEN-001</td>
          <td><strong>${tx.title}</strong></td>
          <td class="text-center">1</td>
          <td class="text-center">Paket</td>
          <td class="text-right">${this.store.formatRupiah(tx.amount)}</td>
          <td class="text-right font-semibold">${this.store.formatRupiah(tx.amount)}</td>
        </tr>
      `;
    }

    let paymentsTable = "";
    if (Array.isArray(tx.payments) && tx.payments.length > 0 && (isPiutang || isHutang)) {
      paymentsTable = `
        <div style="margin-top: 1rem;">
          <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.35rem; color: #475569;">
            Riwayat Pembayaran & Cicilan:
          </div>
          <table class="report-table" style="font-size: 0.75rem;">
            <thead>
              <tr>
                <th>Tgl Bayar</th>
                <th>Keterangan / Bukti</th>
                <th>Metode</th>
                <th class="text-right">Nominal Disetor</th>
              </tr>
            </thead>
            <tbody>
              ${tx.payments.map(p => `
                <tr>
                  <td>${this.store.formatDateIndo(p.date)}</td>
                  <td>${p.note || 'Pembayaran Cicilan'}</td>
                  <td>${p.method === 'transfer' ? 'Transfer Bank' : 'Tunai Kasir'}</td>
                  <td class="text-right font-semibold text-success">${this.store.formatRupiah(p.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      <div class="print-document invoice-view">
        <!-- KOP NOTA RESMI -->
        <div class="official-kop">
          <div class="kop-logo">🏗️</div>
          <div class="kop-text">
            <h1>${profile.name}</h1>
            <h2>${profile.tagline}</h2>
            <p>${profile.address} | Telp/WA: <strong>${profile.phone}</strong> | Email: ${profile.email || '-'}</p>
          </div>
        </div>
        <div class="kop-line-double"></div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
          <div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">
              ${tx.type === 'in' ? (isPiutang ? 'FAKTUR BON PROYEK (PIUTANG)' : 'FAKTUR PENJUALAN MATERIAL') : 'FAKTUR PEMBELIAN / BUKTI KAS KELUAR'}
            </div>
            <div class="font-mono text-sm" style="margin-top: 0.2rem;">No. Faktur: <strong>${tx.id}</strong></div>
            <div class="text-sm text-muted">Tanggal: ${this.store.formatDateIndo(tx.date)} ${tx.time || ''}</div>
          </div>
          <div style="text-align: right; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.75rem 1rem; border-radius: 6px; min-width: 220px;">
            <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase;">
              ${tx.type === 'in' ? 'KEPADA YTH (PELANGGAN):' : 'KEPADA (SUPPLIER/PENERIMA):'}
            </div>
            <div style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0.15rem 0;">
              ${tx.customer || tx.supplier || 'Pelanggan Umum'}
            </div>
            ${tx.phone ? `<div class="text-xs text-muted">Telp/WA: ${tx.phone}</div>` : ''}
          </div>
        </div>

        <!-- TABEL RINCIAN BARANG -->
        <table class="report-table" style="margin-bottom: 1rem;">
          <thead>
            <tr>
              <th style="width: 40px;" class="text-center">No</th>
              <th style="width: 90px;">Kode</th>
              <th>Nama Barang / Material Konstruksi</th>
              <th style="width: 60px;" class="text-center">Qty</th>
              <th style="width: 70px;" class="text-center">Satuan</th>
              <th style="width: 120px;" class="text-right">Harga Satuan</th>
              <th style="width: 130px;" class="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- TOTAL & JATUH TEMPO -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start;">
          <div>
            ${tx.notes ? `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem 0.85rem; border-radius: 6px; font-size: 0.75rem;">
                <strong>Catatan / Alamat Kirim Armada:</strong><br>
                ${tx.notes}
              </div>
            ` : ''}
            ${tx.dueDate ? `
              <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 0.6rem 0.85rem; border-radius: 6px; font-size: 0.75rem; margin-top: 0.5rem; color: #991b1b;">
                <strong>📅 Syarat Jatuh Tempo Pelunasan:</strong><br>
                Harap dilunasi sebelum tanggal <strong>${this.store.formatDateIndo(tx.dueDate)}</strong>.
              </div>
            ` : ''}
          </div>

          <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.85rem; background: #ffffff;">
            <div class="total-row" style="font-size: 0.85rem; padding: 0.25rem 0;">
              <span>Total Nilai Transaksi:</span>
              <span><strong>${this.store.formatRupiah(tx.amount)}</strong></span>
            </div>
            <div class="total-row" style="font-size: 0.85rem; padding: 0.25rem 0; color: #16a34a;">
              <span>Jumlah Sudah Dibayar:</span>
              <span><strong>${this.store.formatRupiah(tx.paidAmount)}</strong></span>
            </div>
            <div class="total-row highlight" style="font-size: 1.05rem; border-top: 2px solid #0f172a; padding-top: 0.5rem; margin-top: 0.25rem;">
              <span>${isPiutang ? 'SISA TAGIHAN (BON):' : isHutang ? 'SISA HUTANG:' : 'SISA:'}</span>
              <span class="${tx.debtAmount > 0 ? 'text-danger' : 'text-success'} font-bold">
                ${this.store.formatRupiah(tx.debtAmount)}
              </span>
            </div>
            <div style="text-align: right; margin-top: 0.35rem;">
              <span class="badge ${tx.debtAmount === 0 ? 'badge-success' : 'badge-danger'}" style="font-size: 0.75rem;">
                ${tx.debtAmount === 0 ? 'STATUS: LUNAS' : 'STATUS: TEMPO / BELUM LUNAS'}
              </span>
            </div>
          </div>
        </div>

        ${paymentsTable}

        <!-- TANDA TANGAN & KETENTUAN -->
        <div style="margin-top: 2rem;">
          <p style="font-size: 0.7rem; color: #64748b; font-style: italic; margin-bottom: 1.5rem;">
            * Syarat & Ketentuan: ${profile.footerText}
          </p>
          <div class="signature-grid">
            <div class="sig-box">
              <p>Penerima / Pelanggan,</p>
              <div class="sig-line"></div>
              <p><strong>(${tx.customer || tx.supplier || '............................'})</strong></p>
            </div>
            <div class="sig-box">
              <p>Sopir / Bagian Pengiriman,</p>
              <div class="sig-line"></div>
              <p>( ............................ )</p>
            </div>
            <div class="sig-box">
              <p>Kasir / Pengelola TB. Serba Guna,</p>
              <div class="sig-line"></div>
              <p><strong>(${profile.owner.split('/')[0].trim()})</strong></p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 5. Cetak Laporan Neraca Keuangan PDF
  generateBalanceSheetPrintHTML(period = '') {
    const bs = this.accounting.getBalanceSheet(period);
    const profile = this.store.storeProfile;
    const now = new Date();

    return `
      <div class="print-document report-view">
        <div class="official-kop">
          <div class="kop-logo">🏗️</div>
          <div class="kop-text">
            <h1>${profile.name}</h1>
            <h2>${profile.tagline}</h2>
            <p>${profile.address} | Telp: ${profile.phone}</p>
          </div>
        </div>
        <div class="kop-line-double"></div>

        <div class="report-title-section">
          <h3>LAPORAN NERACA KEUANGAN (BALANCE SHEET)</h3>
          <p>Per ${this.store.formatDateIndo(now.toISOString().split('T')[0])} | Periode: ${period || 'Tahun 2026'}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <!-- AKTIVA / ASET -->
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 0.3rem; margin-bottom: 0.6rem;">
              ASET (AKTIVA)
            </h4>
            <div style="font-weight: 700; font-size: 0.8rem; margin: 0.4rem 0;">1. Aset Lancar:</div>
            <table class="report-table">
              <tbody>
                ${bs.currentAssets.map(a => `
                  <tr>
                    <td>${a.code} - ${a.name}</td>
                    <td class="text-right font-semibold">${this.store.formatRupiah(a.amount)}</td>
                  </tr>
                `).join('')}
                <tr class="table-total-row">
                  <td><strong>Total Aset Lancar</strong></td>
                  <td class="text-right"><strong>${this.store.formatRupiah(bs.totalCurrentAssets)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div style="font-weight: 700; font-size: 0.8rem; margin: 0.4rem 0;">2. Aset Tetap:</div>
            <table class="report-table">
              <tbody>
                ${bs.fixedAssets.map(a => `
                  <tr>
                    <td>${a.code} - ${a.name}</td>
                    <td class="text-right font-semibold ${a.isContra ? 'text-danger' : ''}">
                      ${a.isContra ? `(${this.store.formatRupiah(a.amount)})` : this.store.formatRupiah(a.amount)}
                    </td>
                  </tr>
                `).join('')}
                <tr class="table-total-row">
                  <td><strong>Total Aset Tetap</strong></td>
                  <td class="text-right"><strong>${this.store.formatRupiah(bs.totalFixedAssets)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 6px; padding: 0.75rem; margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: #166534; font-size: 0.9rem;">TOTAL ASET (AKTIVA):</strong>
              <strong style="color: #166534; font-size: 1.1rem;">${this.store.formatRupiah(bs.totalAssets)}</strong>
            </div>
          </div>

          <!-- PASIVA / KEWAJIBAN & EKUITAS -->
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: #8b5cf6; border-bottom: 2px solid #8b5cf6; padding-bottom: 0.3rem; margin-bottom: 0.6rem;">
              KEWAJIBAN & EKUITAS (PASIVA)
            </h4>
            <div style="font-weight: 700; font-size: 0.8rem; margin: 0.4rem 0;">1. Kewajiban / Hutang:</div>
            <table class="report-table">
              <tbody>
                ${bs.currentLiabilities.map(l => `
                  <tr>
                    <td>${l.code} - ${l.name}</td>
                    <td class="text-right font-semibold text-danger">${this.store.formatRupiah(l.amount)}</td>
                  </tr>
                `).join('')}
                <tr class="table-total-row">
                  <td><strong>Total Kewajiban</strong></td>
                  <td class="text-right text-danger"><strong>${this.store.formatRupiah(bs.totalLiabilities)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div style="font-weight: 700; font-size: 0.8rem; margin: 0.4rem 0;">2. Ekuitas / Modal:</div>
            <table class="report-table">
              <tbody>
                ${bs.equity.map(e => `
                  <tr>
                    <td>${e.code} - ${e.name}</td>
                    <td class="text-right font-semibold">${this.store.formatRupiah(e.amount)}</td>
                  </tr>
                `).join('')}
                <tr class="table-total-row">
                  <td><strong>Total Ekuitas</strong></td>
                  <td class="text-right"><strong>${this.store.formatRupiah(bs.totalEquity)}</strong></td>
                </tr>
              </tbody>
            </table>

            <div style="background: #faf5ff; border: 2px solid #8b5cf6; border-radius: 6px; padding: 0.75rem; margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: #6b21a8; font-size: 0.9rem;">TOTAL PASIVA (KEWAJIBAN + EKUITAS):</strong>
              <strong style="color: #6b21a8; font-size: 1.1rem;">${this.store.formatRupiah(bs.totalLiabilitiesAndEquity)}</strong>
            </div>
          </div>
        </div>

        <!-- STATUS BALANCE -->
        <div style="margin-top: 1.5rem; text-align: center;">
          <span class="badge ${bs.isBalanced ? 'badge-success' : 'badge-danger'}" style="font-size: 0.85rem; padding: 0.4rem 1rem;">
            ${bs.isBalanced ? '✅ NERACA KEUANGAN SEIMBANG (BALANCED: AKTIVA = PASIVA)' : '⚠️ PERHATIAN: NERACA BELUM SEIMBANG'}
          </span>
        </div>

        <div class="report-sign-wrapper">
          <div class="signature-grid">
            <div class="sig-box">
              <p>Disusun oleh (Bagian Pembukuan),</p>
              <div class="sig-line"></div>
              <p>( Petugas Kasir TB. Serba Guna )</p>
            </div>
            <div class="sig-box">
              <p>Disetujui oleh (Pemilik Toko),</p>
              <div class="sig-line"></div>
              <p><strong>${profile.owner}</strong></p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 6. Cetak Laporan Keuangan Resmi Lengkap
  generateFinancialReportHTML(period = '') {
    const profile = this.store.storeProfile;
    const stats = this.store.getFinancialStats(period);
    const inc = this.accounting.getIncomeStatement(period);
    const now = new Date();

    return `
      <div class="print-document report-view">
        <div class="official-kop">
          <div class="kop-logo">🏗️</div>
          <div class="kop-text">
            <h1>${profile.name}</h1>
            <h2>${profile.tagline}</h2>
            <p>${profile.address} | No. Telp/WhatsApp: ${profile.phone}</p>
          </div>
        </div>
        <div class="kop-line-double"></div>

        <div class="report-title-section">
          <h3>LAPORAN LABA RUGI KOMPREHENSIF</h3>
          <p>Periode: ${period || 'Semua Waktu 2026'}</p>
        </div>

        <table class="report-table" style="font-size: 0.85rem;">
          <tbody>
            <tr style="background: #f8fafc;">
              <td colspan="2"><strong>1. PENDAPATAN USAHA</strong></td>
            </tr>
            ${inc.revenues.map(r => `
              <tr>
                <td style="padding-left: 1.5rem;">${r.name}</td>
                <td class="text-right font-semibold">${this.store.formatRupiah(r.amount)}</td>
              </tr>
            `).join('')}
            <tr style="border-top: 1px solid #cbd5e1;">
              <td><strong>TOTAL PENDAPATAN</strong></td>
              <td class="text-right font-bold text-success">${this.store.formatRupiah(inc.totalRevenue)}</td>
            </tr>

            <tr style="background: #f8fafc;">
              <td colspan="2" style="padding-top: 0.75rem;"><strong>2. BEBAN POKOK PENJUALAN (HPP)</strong></td>
            </tr>
            ${inc.cogs.map(c => `
              <tr>
                <td style="padding-left: 1.5rem;">${c.name}</td>
                <td class="text-right font-semibold text-danger">(${this.store.formatRupiah(c.amount)})</td>
              </tr>
            `).join('')}
            <tr style="border-top: 1px solid #cbd5e1; background: #fffbeb;">
              <td><strong>LABA KOTOR (GROSS PROFIT) [Margin: ${inc.grossMargin}%]</strong></td>
              <td class="text-right font-bold" style="color: #b45309;">${this.store.formatRupiah(inc.grossProfit)}</td>
            </tr>

            <tr style="background: #f8fafc;">
              <td colspan="2" style="padding-top: 0.75rem;"><strong>3. BEBAN OPERASIONAL</strong></td>
            </tr>
            ${inc.expenses.map(e => `
              <tr>
                <td style="padding-left: 1.5rem;">${e.name}</td>
                <td class="text-right font-semibold text-danger">(${this.store.formatRupiah(e.amount)})</td>
              </tr>
            `).join('')}
            <tr style="border-top: 1px solid #cbd5e1;">
              <td><strong>TOTAL BEBAN OPERASIONAL</strong></td>
              <td class="text-right font-bold text-danger">(${this.store.formatRupiah(inc.totalExpenses)})</td>
            </tr>

            <tr style="background: #f0fdf4; border-top: 2px solid #16a34a; font-size: 1rem;">
              <td><strong style="color: #166534;">LABA BERSIH USAHA (NET PROFIT) [Margin: ${inc.netMargin}%]</strong></td>
              <td class="text-right font-bold" style="color: #166534;">${this.store.formatRupiah(inc.netProfit)}</td>
            </tr>
          </tbody>
        </table>

        <div class="report-sign-wrapper">
          <div class="signature-grid">
            <div class="sig-box">
              <p>Dibuat oleh (Pembukuan),</p>
              <div class="sig-line"></div>
              <p>( Petugas Kasir TB. Serba Guna )</p>
            </div>
            <div class="sig-box">
              <p>Disetujui oleh (Pemilik Toko),</p>
              <div class="sig-line"></div>
              <p><strong>${profile.owner}</strong></p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 7. Backup Seluruh Database (Termasuk COA & Inventori) ke file .json
  downloadBackupJSON() {
    const data = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      storeProfile: this.store.storeProfile,
      transactions: this.store.transactions,
      products: window.inventoryStore ? window.inventoryStore.products : [],
      coa: this.accounting.coa,
      manualJournals: this.accounting.manualJournals,
      openingBalances: this.accounting.openingBalances
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TB_Serba_Guna_Full_Accounting_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async restoreFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed.storeProfile) this.store.saveStoreProfile(parsed.storeProfile);
          if (Array.isArray(parsed.transactions)) {
            this.store.transactions = parsed.transactions;
            this.store.persistLocal();
          }
          if (Array.isArray(parsed.products) && window.inventoryStore) {
            window.inventoryStore.products = parsed.products;
            window.inventoryStore.save();
          }
          if (Array.isArray(parsed.coa)) {
            this.accounting.coa = parsed.coa;
            this.accounting.saveCOA();
          }
          if (Array.isArray(parsed.manualJournals)) {
            this.accounting.manualJournals = parsed.manualJournals;
            this.accounting.saveManualJournals();
          }
          if (parsed.openingBalances) {
            this.accounting.openingBalances = parsed.openingBalances;
            this.accounting.saveOpeningBalances();
          }
          resolve(true);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Gagal membaca file backup"));
      reader.readAsText(file);
    });
  }
}

// Global Export Manager
window.exportManager = new ExportManager();
