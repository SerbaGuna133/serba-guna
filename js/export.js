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

  // 4. Render Struk Thermal Kasir POS (58mm / 80mm)
  generateThermalReceiptHTML(txId, paperWidth = '80mm') {
    const tx = this.store.transactions.find(t => t.id === txId);
    if (!tx) return `<div class="p-4 text-danger">Transaksi #${txId} tidak ditemukan.</div>`;

    const profile = this.store.storeProfile;
    const isPiutang = tx.paymentMethod === 'piutang';
    const isHutang = tx.paymentMethod === 'hutang';
    const isTransfer = tx.paymentMethod === 'transfer';

    const items = (Array.isArray(tx.items) && tx.items.length > 0) ? tx.items : [{
      name: tx.title,
      qty: 1,
      unit: 'Item',
      price: tx.amount,
      subtotal: tx.amount
    }];

    const dateFormatted = this.store.formatDateIndo(tx.date);
    const timeFormatted = tx.time || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    let methodText = 'TUNAI KASIR';
    if (isTransfer) methodText = 'TRANSFER BANK / QRIS';
    else if (isPiutang) methodText = 'BON / TEMPO PROYEK';
    else if (isHutang) methodText = 'TEMPO DISTRIBUTOR';

    const maxWidth = paperWidth === '58mm' ? '270px' : '350px';
    const fontSize = paperWidth === '58mm' ? '11px' : '12.5px';

    return `
      <div class="thermal-receipt-wrap paper-${paperWidth}" style="background: #ffffff !important; color: #000000 !important; font-family: 'JetBrains Mono', 'Courier New', Courier, monospace !important; padding: 18px 14px 25px 14px !important; margin: 0 auto !important; box-shadow: 0 6px 25px rgba(0,0,0,0.35) !important; border-radius: 6px !important; box-sizing: border-box !important; width: 100% !important; max-width: ${maxWidth} !important; font-size: ${fontSize} !important; line-height: 1.35 !important; display: block !important;">
        <div class="thermal-header" style="text-align: center; margin-bottom: 6px;">
          <div class="thermal-logo" style="font-size: 24px; margin-bottom: 2px;">🏗️</div>
          <h2 class="thermal-title" style="font-size: 15px; font-weight: 800; margin: 0; text-transform: uppercase; color: #000000;">${profile.name}</h2>
          <div class="thermal-sub" style="font-size: 10.5px; font-weight: 600; color: #333333; margin-bottom: 2px;">${profile.tagline || 'Pusat Bahan Bangunan & Konstruksi'}</div>
          <div class="thermal-address" style="font-size: 9.5px; color: #444444;">${profile.address}</div>
          <div class="thermal-contact" style="font-size: 9.5px; color: #444444;">Telp/WA: ${profile.phone}</div>
        </div>

        <div class="thermal-divider" style="text-align: center; font-weight: 700; letter-spacing: -1px; overflow: hidden; margin: 4px 0; user-select: none;">================================</div>

        <div class="thermal-meta" style="font-size: 11px; margin: 4px 0;">
          <div class="d-flex justify-between" style="display: flex; justify-content: space-between;">
            <span>No. Nota :</span>
            <span class="font-bold font-mono" style="font-weight: 700;">${tx.id}</span>
          </div>
          <div class="d-flex justify-between" style="display: flex; justify-content: space-between;">
            <span>Tanggal  :</span>
            <span>${dateFormatted} ${timeFormatted}</span>
          </div>
          <div class="d-flex justify-between" style="display: flex; justify-content: space-between;">
            <span>Kasir    :</span>
            <span>Kasir Utama</span>
          </div>
          <div class="d-flex justify-between" style="display: flex; justify-content: space-between;">
            <span>${tx.type === 'in' ? 'Pelanggan:' : 'Supplier :'}</span>
            <span class="font-bold" style="font-weight: 700;">${tx.customer || tx.supplier || 'Pelanggan Umum'}</span>
          </div>
          ${tx.phone ? `
          <div class="d-flex justify-between" style="display: flex; justify-content: space-between;">
            <span>No. HP   :</span>
            <span>${tx.phone}</span>
          </div>
          ` : ''}
        </div>

        <div class="thermal-divider" style="text-align: center; font-weight: 700; letter-spacing: -1px; overflow: hidden; margin: 4px 0; user-select: none;">--------------------------------</div>
        <div class="thermal-items-header" style="display: flex; justify-content: space-between; font-weight: 800; font-size: 11px;">
          <span>ITEM / BARANG</span>
          <span>TOTAL</span>
        </div>
        <div class="thermal-divider" style="text-align: center; font-weight: 700; letter-spacing: -1px; overflow: hidden; margin: 4px 0; user-select: none;">--------------------------------</div>

        <div class="thermal-items-list" style="margin: 4px 0;">
          ${items.map(it => `
            <div class="thermal-item-row" style="margin-bottom: 6px;">
              <div class="thermal-item-name" style="font-weight: 700; font-size: 11.5px;">${it.name}</div>
              <div class="thermal-item-details" style="display: flex; justify-content: space-between; font-size: 10.5px; color: #222222;">
                <span>${it.qty} ${it.unit || 'Pcs'} x ${this.store.formatRupiah(it.price)}</span>
                <span class="font-bold" style="font-weight: 700;">${this.store.formatRupiah(it.subtotal || (it.qty * it.price))}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="thermal-divider" style="text-align: center; font-weight: 700; letter-spacing: -1px; overflow: hidden; margin: 4px 0; user-select: none;">--------------------------------</div>

        <div class="thermal-summary" style="font-size: 11.5px; margin: 4px 0;">
          ${(tx.discount > 0) ? `
          <div class="d-flex justify-between thermal-sum-row" style="display: flex; justify-content: space-between; margin: 2px 0;">
            <span>SUBTOTAL:</span>
            <span>${this.store.formatRupiah(tx.subtotal || (tx.amount + tx.discount))}</span>
          </div>
          <div class="d-flex justify-between thermal-sum-row font-bold" style="display: flex; justify-content: space-between; margin: 2px 0; color: #dc2626;">
            <span>DISKON / POTONGAN ${tx.discountPercent > 0 ? `(${tx.discountPercent}%)` : ''}:</span>
            <span>-${this.store.formatRupiah(tx.discount)}</span>
          </div>
          ` : ''}
          <div class="d-flex justify-between thermal-sum-row" style="display: flex; justify-content: space-between; margin: 2px 0;">
            <span>TOTAL TAGIHAN:</span>
            <span class="thermal-sum-val font-bold" style="font-weight: 700; font-size: 12.5px;">${this.store.formatRupiah(tx.amount)}</span>
          </div>
          <div class="d-flex justify-between thermal-sum-row" style="display: flex; justify-content: space-between; margin: 2px 0;">
            <span>METODE BAYAR:</span>
            <span>${methodText}</span>
          </div>
          ${(tx.paymentMethod === 'cash') ? `
          <div class="d-flex justify-between thermal-sum-row" style="display: flex; justify-content: space-between; margin: 2px 0;">
            <span>UANG DITERIMA (TUNAI):</span>
            <span class="font-bold" style="font-weight: 700;">${this.store.formatRupiah(tx.tenderedAmount !== undefined ? tx.tenderedAmount : (tx.paidAmount || tx.amount))}</span>
          </div>
          <div class="d-flex justify-between thermal-sum-row font-bold text-success" style="display: flex; justify-content: space-between; margin: 2px 0; font-weight: 700; color: #16a34a;">
            <span>KEMBALIAN:</span>
            <span>${this.store.formatRupiah(tx.changeAmount !== undefined ? tx.changeAmount : Math.max(0, (tx.tenderedAmount || tx.amount) - tx.amount))}</span>
          </div>
          ` : (isPiutang || isHutang) ? `
          <div class="d-flex justify-between thermal-sum-row" style="display: flex; justify-content: space-between; margin: 2px 0;">
            <span>SUDAH DIBAYAR (DP):</span>
            <span class="font-bold" style="font-weight: 700;">${this.store.formatRupiah(tx.paidAmount || 0)}</span>
          </div>
          ` : `
          <div class="d-flex justify-between thermal-sum-row" style="display: flex; justify-content: space-between; margin: 2px 0;">
            <span>JUMLAH DIBAYAR:</span>
            <span class="font-bold" style="font-weight: 700;">${this.store.formatRupiah(tx.paidAmount || tx.amount)}</span>
          </div>
          `}
          ${(isPiutang || isHutang || tx.debtAmount > 0) ? `
          <div class="thermal-divider" style="text-align: center; font-weight: 700; letter-spacing: -1px; overflow: hidden; margin: 4px 0; user-select: none;">--------------------------------</div>
          <div class="d-flex justify-between thermal-sum-row font-bold text-danger" style="display: flex; justify-content: space-between; margin: 2px 0; font-weight: 700; color: #dc2626;">
            <span>SISA TAGIHAN (BON):</span>
            <span>${this.store.formatRupiah(tx.debtAmount)}</span>
          </div>
          ${tx.dueDate ? `
          <div class="d-flex justify-between thermal-sum-row text-xs" style="display: flex; justify-content: space-between; font-size: 10px; margin: 2px 0;">
            <span>JATUH TEMPO:</span>
            <span>${this.store.formatDateIndo(tx.dueDate)}</span>
          </div>
          ` : ''}
          <div class="d-flex justify-between thermal-sum-row" style="display: flex; justify-content: space-between; margin-top: 4px;">
            <span>STATUS:</span>
            <span class="font-bold" style="font-weight: 700; color: ${tx.debtAmount === 0 ? '#16a34a' : '#dc2626'};">
              ${tx.debtAmount === 0 ? '*** LUNAS ***' : '*** BELUM LUNAS / BON ***'}
            </span>
          </div>
          ` : `
          <div class="d-flex justify-between thermal-sum-row" style="display: flex; justify-content: space-between; margin-top: 4px;">
            <span>STATUS:</span>
            <span class="font-bold" style="font-weight: 700; color: #16a34a;">*** LUNAS ***</span>
          </div>
          `}
        </div>

        ${tx.notes ? `
        <div class="thermal-divider" style="text-align: center; font-weight: 700; letter-spacing: -1px; overflow: hidden; margin: 4px 0; user-select: none;">--------------------------------</div>
        <div class="thermal-notes" style="font-size: 10px; background: #f8fafc; padding: 4px 6px; border-radius: 3px; margin: 4px 0; border: 1px dashed #cbd5e1;">
          <strong>Catatan:</strong> ${tx.notes}
        </div>
        ` : ''}

        <div class="thermal-divider" style="text-align: center; font-weight: 700; letter-spacing: -1px; overflow: hidden; margin: 4px 0; user-select: none;">================================</div>
        <div class="thermal-footer" style="text-align: center; font-size: 10px; margin-top: 8px; line-height: 1.35; color: #333333;">
          <div>Terima kasih atas kunjungan Anda!</div>
          <div style="margin-top: 2px;">Barang yang sudah dibeli tidak dapat ditukar/dikembalikan tanpa nota asli.</div>
          <div class="thermal-app-tag" style="font-size: 9px; margin-top: 6px; letter-spacing: 1px; color: #555555; font-weight: 600;">-- TB. SERBA GUNA POS --</div>
        </div>
      </div>
    `;
  }

  // 5. Render Faktur Resmi Toko Bangunan (Ukuran A4 / A5 Resmi)
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
          <td class="text-center" style="text-align: center;">${idx + 1}</td>
          <td class="font-mono text-xs" style="font-family: monospace; font-size: 0.75rem;">${item.id || `ITM-${idx+1}`}</td>
          <td><strong>${item.name}</strong></td>
          <td class="text-center" style="text-align: center;">${item.qty}</td>
          <td class="text-center" style="text-align: center;">${item.unit || 'Pcs'}</td>
          <td class="text-right" style="text-align: right;">${this.store.formatRupiah(item.price)}</td>
          <td class="text-right font-semibold" style="text-align: right; font-weight: 600;">${this.store.formatRupiah(item.subtotal)}</td>
        </tr>
      `).join('');
    } else {
      itemsRows = `
        <tr>
          <td class="text-center" style="text-align: center;">1</td>
          <td class="font-mono text-xs" style="font-family: monospace; font-size: 0.75rem;">GEN-001</td>
          <td><strong>${tx.title}</strong></td>
          <td class="text-center" style="text-align: center;">1</td>
          <td class="text-center" style="text-align: center;">Paket</td>
          <td class="text-right" style="text-align: right;">${this.store.formatRupiah(tx.amount)}</td>
          <td class="text-right font-semibold" style="text-align: right; font-weight: 600;">${this.store.formatRupiah(tx.amount)}</td>
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
          <table class="report-table" style="font-size: 0.75rem; width: 100%; border-collapse: collapse; margin-bottom: 1rem;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; text-align: left;">Tgl Bayar</th>
                <th style="border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; text-align: left;">Keterangan / Bukti</th>
                <th style="border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; text-align: left;">Metode</th>
                <th class="text-right" style="border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; text-align: right;">Nominal Disetor</th>
              </tr>
            </thead>
            <tbody>
              ${tx.payments.map(p => `
                <tr>
                  <td style="border: 1px solid #e2e8f0; padding: 0.4rem 0.6rem;">${this.store.formatDateIndo(p.date)}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 0.4rem 0.6rem;">${p.note || 'Pembayaran Cicilan'}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 0.4rem 0.6rem;">${p.method === 'transfer' ? 'Transfer Bank' : 'Tunai Kasir'}</td>
                  <td class="text-right font-semibold text-success" style="border: 1px solid #e2e8f0; padding: 0.4rem 0.6rem; text-align: right; font-weight: 600; color: #16a34a;">${this.store.formatRupiah(p.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      <div class="print-document invoice-view" style="background: #ffffff !important; color: #0f172a !important; width: 100% !important; max-width: 840px !important; padding: 2.5rem 2.75rem 3.5rem 2.75rem !important; margin: 0 auto !important; border-radius: 8px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.25) !important; box-sizing: border-box !important; display: block !important;">
        <!-- KOP NOTA RESMI -->
        <div class="official-kop" style="display: flex; align-items: center; gap: 1.25rem; margin-bottom: 0.75rem;">
          <div class="kop-logo" style="font-size: 3rem;">🏗️</div>
          <div class="kop-text">
            <h1 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.02em;">${profile.name}</h1>
            <h2 style="font-size: 0.88rem; color: #d97706; font-weight: 700; margin: 0.15rem 0;">${profile.tagline}</h2>
            <p style="font-size: 0.78rem; color: #64748b; margin: 0;">${profile.address} | Telp/WA: <strong>${profile.phone}</strong> | Email: ${profile.email || '-'}</p>
          </div>
        </div>
        <div class="kop-line-double" style="border-top: 3px double #0f172a; margin: 0.75rem 0 1.25rem 0;"></div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
          <div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">
              ${tx.type === 'in' ? (isPiutang ? 'FAKTUR BON PROYEK (PIUTANG)' : 'FAKTUR PENJUALAN MATERIAL') : 'FAKTUR PEMBELIAN / BUKTI KAS KELUAR'}
            </div>
            <div class="font-mono text-sm" style="font-family: monospace; font-size: 0.875rem; margin-top: 0.2rem;">No. Faktur: <strong>${tx.id}</strong></div>
            <div class="text-sm text-muted" style="font-size: 0.875rem; color: #64748b;">Tanggal: ${this.store.formatDateIndo(tx.date)} ${tx.time || ''}</div>
          </div>
          <div style="text-align: right; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.75rem 1rem; border-radius: 6px; min-width: 220px;">
            <div style="font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase;">
              ${tx.type === 'in' ? 'KEPADA YTH (PELANGGAN):' : 'KEPADA (SUPPLIER/PENERIMA):'}
            </div>
            <div style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0.15rem 0;">
              ${tx.customer || tx.supplier || 'Pelanggan Umum'}
            </div>
            ${tx.phone ? `<div class="text-xs text-muted" style="font-size: 0.75rem; color: #64748b;">Telp/WA: ${tx.phone}</div>` : ''}
          </div>
        </div>

        <!-- TABEL RINCIAN BARANG -->
        <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 1rem;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="width: 40px; border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; text-align: center;">No</th>
              <th style="width: 90px; border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; text-align: left;">Kode</th>
              <th style="border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; text-align: left;">Nama Barang / Material Konstruksi</th>
              <th style="width: 60px; border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; text-align: center;">Qty</th>
              <th style="width: 70px; border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; text-align: center;">Satuan</th>
              <th style="width: 120px; border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; text-align: right;">Harga Satuan</th>
              <th style="width: 130px; border: 1px solid #cbd5e1; padding: 0.45rem 0.6rem; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- TOTAL & JATUH TEMPO -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; margin-bottom: 1rem;">
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
            ${(tx.discount > 0) ? `
            <div class="total-row" style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.25rem 0;">
              <span>Subtotal Belanja:</span>
              <span>${this.store.formatRupiah(tx.subtotal || (tx.amount + tx.discount))}</span>
            </div>
            <div class="total-row" style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.25rem 0; color: #dc2626;">
              <span>Diskon / Potongan Harga ${tx.discountPercent > 0 ? `(${tx.discountPercent}%)` : ''}:</span>
              <span><strong>-${this.store.formatRupiah(tx.discount)}</strong></span>
            </div>
            ` : ''}
            <div class="total-row" style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.25rem 0;">
              <span>Total Tagihan (Netto):</span>
              <span><strong>${this.store.formatRupiah(tx.amount)}</strong></span>
            </div>
            ${(tx.paymentMethod === 'cash') ? `
            <div class="total-row" style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.25rem 0; color: #0284c7;">
              <span>Uang Diterima (Tunai):</span>
              <span><strong>${this.store.formatRupiah(tx.tenderedAmount !== undefined ? tx.tenderedAmount : (tx.paidAmount || tx.amount))}</strong></span>
            </div>
            <div class="total-row" style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.25rem 0; color: #16a34a;">
              <span>Kembalian:</span>
              <span><strong>${this.store.formatRupiah(tx.changeAmount !== undefined ? tx.changeAmount : Math.max(0, (tx.tenderedAmount || tx.amount) - tx.amount))}</strong></span>
            </div>
            ` : `
            <div class="total-row" style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.25rem 0; color: #16a34a;">
              <span>Jumlah Sudah Dibayar:</span>
              <span><strong>${this.store.formatRupiah(tx.paidAmount || tx.amount)}</strong></span>
            </div>
            `}
            <div class="total-row highlight" style="display: flex; justify-content: space-between; font-size: 1.05rem; border-top: 2px solid #0f172a; padding-top: 0.5rem; margin-top: 0.25rem;">
              <span>${isPiutang ? 'SISA TAGIHAN (BON):' : isHutang ? 'SISA HUTANG:' : 'SISA:'}</span>
              <span class="${tx.debtAmount > 0 ? 'text-danger' : 'text-success'}" style="font-weight: 700; color: ${tx.debtAmount > 0 ? '#dc2626' : '#16a34a'};">
                ${this.store.formatRupiah(tx.debtAmount)}
              </span>
            </div>
            <div style="text-align: right; margin-top: 0.35rem;">
              <span class="badge ${tx.debtAmount === 0 ? 'badge-success' : 'badge-danger'}" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; background: ${tx.debtAmount === 0 ? '#dcfce7' : '#fee2e2'}; color: ${tx.debtAmount === 0 ? '#166534' : '#991b1b'};">
                ${tx.debtAmount === 0 ? 'STATUS: LUNAS' : 'STATUS: TEMPO / BELUM LUNAS'}
              </span>
            </div>
          </div>
        </div>

        ${paymentsTable}

        <!-- TANDA TANGAN & KETENTUAN -->
        <div style="margin-top: 1.5rem; padding-top: 0.75rem; border-top: 1px solid #f1f5f9;">
          <p style="font-size: 0.72rem; color: #64748b; font-style: italic; margin: 0 0 1.25rem 0;">
            * Syarat & Ketentuan: ${profile.footerText}
          </p>
          <div class="signature-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; text-align: center; font-size: 0.75rem;">
            <div class="sig-box" style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 90px;">
              <p style="margin: 0;">Penerima / Pelanggan,</p>
              <div class="sig-line" style="height: 50px;"></div>
              <p style="margin: 0;"><strong>(${tx.customer || tx.supplier || '............................'})</strong></p>
            </div>
            <div class="sig-box" style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 90px;">
              <p style="margin: 0;">Sopir / Bagian Pengiriman,</p>
              <div class="sig-line" style="height: 50px;"></div>
              <p style="margin: 0;">( ............................ )</p>
            </div>
            <div class="sig-box" style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 90px;">
              <p style="margin: 0;">Kasir / Pengelola TB. Serba Guna,</p>
              <div class="sig-line" style="height: 50px;"></div>
              <p style="margin: 0;"><strong>(${profile.owner.split('/')[0].trim()})</strong></p>
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
