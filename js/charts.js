/**
 * TB. SERBA GUNA - CHARTS & VISUALIZATION
 * Render grafik interaktif dengan Chart.js (Dark & Light theme ready)
 */

class FinanceCharts {
  constructor() {
    this.trendChart = null;
    this.categoryChart = null;
    this.cashFlowChart = null;
  }

  // Deteksi mode tema saat ini untuk styling warna teks & grid
  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#1e293b' : '#0f172a',
      tooltipText: '#ffffff'
    };
  }

  // Format angka ke Rupiah singkat (misal: 12.5 Jt)
  formatShortRupiah(val) {
    if (Math.abs(val) >= 1000000000) {
      return (val / 1000000000).toFixed(1) + ' M';
    }
    if (Math.abs(val) >= 1000000) {
      return (val / 1000000).toFixed(1) + ' Jt';
    }
    if (Math.abs(val) >= 1000) {
      return (val / 1000).toFixed(0) + ' Rb';
    }
    return val;
  }

  // 1. Inisialisasi Grafik Tren Finansial Bulanan
  renderTrendChart(canvasId = 'monthlyTrendChart') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const trends = window.transactionStore.getMonthlyTrends(6);
    const theme = this.getThemeColors();

    const labels = trends.map(t => t.label);
    const revenueData = trends.map(t => t.revenue);
    const expenseData = trends.map(t => t.expense);
    const profitData = trends.map(t => t.netProfit);

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Omset Penjualan',
            data: revenueData,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 6,
            order: 2
          },
          {
            label: 'Belanja & Biaya',
            data: expenseData,
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderRadius: 6,
            order: 3
          },
          {
            label: 'Laba Bersih',
            data: profitData,
            type: 'line',
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            borderWidth: 3,
            tension: 0.35,
            fill: false,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 5,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: theme.textColor,
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600', size: 12 },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += window.transactionStore.formatRupiah(context.parsed.y);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor, font: { family: "'Plus Jakarta Sans', sans-serif" } }
          },
          y: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { family: "'Plus Jakarta Sans', sans-serif" },
              callback: (val) => this.formatShortRupiah(val)
            }
          }
        }
      }
    });
  }

  // 2. Inisialisasi Diagram Kategori Material
  renderCategoryChart(canvasId = 'categoryPieChart', period = '') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const breakdown = window.transactionStore.getCategoryBreakdown('in', period);
    const theme = this.getThemeColors();

    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    if (breakdown.length === 0) {
      // Tampilkan fallback teks jika belum ada transaksi di periode ini
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const labels = breakdown.map(b => `${b.icon} ${b.name}`);
    const dataValues = breakdown.map(b => b.amount);
    const bgColors = breakdown.map(b => b.color);

    const ctx = canvas.getContext('2d');
    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#0f172a' : '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: theme.textColor,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
              boxWidth: 10,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 10,
            callbacks: {
              label: function (context) {
                const val = context.raw || 0;
                const total = context.chart._metasets[context.datasetIndex].total;
                const percentage = ((val / total) * 100).toFixed(1);
                return ` ${window.transactionStore.formatRupiah(val)} (${percentage}%)`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // 3. Diagram Komparasi Kas Riil vs Piutang (Bon Proyek)
  renderCashFlowComparison(canvasId = 'cashFlowComparisonChart', period = '') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const stats = window.transactionStore.getFinancialStats(period);
    const theme = this.getThemeColors();

    if (this.cashFlowChart) {
      this.cashFlowChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.cashFlowChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Uang Masuk Kas/Bank', 'Piutang Bon Belum Lunas', 'Belanja/Biaya Terbayar', 'Hutang Distributor'],
        datasets: [{
          data: [
            stats.totalCashIn,
            stats.totalReceivables,
            stats.totalCashOut,
            stats.totalPayables
          ],
          backgroundColor: [
            '#10b981', // Emerald
            '#f59e0b', // Amber Piutang
            '#ef4444', // Red Keluar
            '#8b5cf6'  // Purple Hutang
          ],
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#0f172a' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.textColor,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
              boxWidth: 10,
              padding: 8
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${window.transactionStore.formatRupiah(ctx.raw || 0)}`
            }
          }
        },
        cutout: '60%'
      }
    });
  }

  // Update Semua Grafik
  updateAll(period = '') {
    this.renderTrendChart();
    this.renderCategoryChart('categoryPieChart', period);
    this.renderCashFlowComparison('cashFlowComparisonChart', period);
  }
}

// Global Chart Controller
window.financeCharts = new FinanceCharts();
