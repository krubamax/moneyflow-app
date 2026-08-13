/**
 * Dashboard Page Module
 * Renders summary cards, charts, recent transactions, and wallet overview.
 */
const DashboardPage = (() => {
    let pieChart = null;
    let barChart = null;

    function formatMoney(amount) {
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }

    const THAI_MONTHS = [
        '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ];

    const THAI_MONTHS_FULL = [
        '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];

    function render(container) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        container.innerHTML = `
            <div class="page-header">
                <h1>📊 แดชบอร์ด</h1>
                <p>สรุปภาพรวมการเงินประจำเดือน ${THAI_MONTHS_FULL[month]} ${year}</p>
            </div>

            <!-- Month selector -->
            <div class="filter-bar">
                <select class="form-control" id="dashMonth" style="min-width:120px">
                    ${Array.from({length: 12}, (_, i) => `<option value="${i+1}" ${i+1===month?'selected':''}>${THAI_MONTHS_FULL[i+1]}</option>`).join('')}
                </select>
                <select class="form-control" id="dashYear" style="min-width:100px">
                    ${Array.from({length: 5}, (_, i) => {
                        const y = year - 2 + i;
                        return `<option value="${y}" ${y===year?'selected':''}>${y}</option>`;
                    }).join('')}
                </select>
                <button class="btn btn-primary btn-sm" id="dashRefresh">
                    <span class="material-icons-round" style="font-size:16px">refresh</span>
                    รีเฟรช
                </button>
            </div>

            <!-- Summary Cards -->
            <div class="summary-grid" id="summaryCards">
                <div class="card summary-card income">
                    <div class="card-icon">💰</div>
                    <div class="card-label">รายรับ</div>
                    <div class="card-value" id="totalIncome">฿0.00</div>
                    <div class="card-sub" id="incomeCount">0 รายการ</div>
                </div>
                <div class="card summary-card expense">
                    <div class="card-icon">💸</div>
                    <div class="card-label">รายจ่าย</div>
                    <div class="card-value" id="totalExpense">฿0.00</div>
                    <div class="card-sub" id="expenseCount">0 รายการ</div>
                </div>
                <div class="card summary-card net">
                    <div class="card-icon">📈</div>
                    <div class="card-label">ยอดสุทธิ</div>
                    <div class="card-value" id="netBalance">฿0.00</div>
                    <div class="card-sub" id="txnCount">0 รายการทั้งหมด</div>
                </div>
                <div class="card summary-card wallets">
                    <div class="card-icon">👛</div>
                    <div class="card-label">ยอดรวมทุกกระเป๋า</div>
                    <div class="card-value" id="totalWallets">฿0.00</div>
                    <div class="card-sub" id="walletCount">0 กระเป๋า</div>
                </div>
            </div>

            <!-- Charts -->
            <div class="charts-grid">
                <div class="card chart-card">
                    <h3><span class="material-icons-round">pie_chart</span> สัดส่วนรายจ่าย</h3>
                    <div class="chart-container">
                        <canvas id="pieChart"></canvas>
                    </div>
                </div>
                <div class="card chart-card">
                    <h3><span class="material-icons-round">bar_chart</span> เปรียบเทียบรายเดือน</h3>
                    <div class="chart-container">
                        <canvas id="barChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Budget Alerts -->
            <div id="budgetAlerts" class="mb-md"></div>

            <!-- Recent Transactions -->
            <div class="card" style="margin-top: 8px;">
                <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
                    <span class="material-icons-round">receipt_long</span> รายการล่าสุด
                </h3>
                <div id="recentTransactions">
                    <div class="empty-state">
                        <span class="material-icons-round">receipt_long</span>
                        <h3>ยังไม่มีรายการ</h3>
                        <p>กดปุ่ม + เพื่อเพิ่มรายการแรก</p>
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        document.getElementById('dashRefresh').addEventListener('click', () => loadData());
        document.getElementById('dashMonth').addEventListener('change', () => loadData());
        document.getElementById('dashYear').addEventListener('change', () => loadData());

        loadData();
    }

    async function loadData() {
        const month = parseInt(document.getElementById('dashMonth').value);
        const year = parseInt(document.getElementById('dashYear').value);

        try {
            const [summary, breakdown, comparison, wallets, alerts, transactions] = await Promise.all([
                API.getSummary(month, year),
                API.getCategoryBreakdown(month, year, 'expense'),
                API.getMonthlyComparison(year),
                API.getWalletBalances(),
                API.getBudgetAlerts({ month, year }),
                API.getTransactions({ month, year, limit: 10 }),
            ]);

            updateSummaryCards(summary, wallets);
            renderPieChart(breakdown);
            renderBarChart(comparison);
            renderBudgetAlerts(alerts);
            renderRecentTransactions(transactions);
        } catch (err) {
            console.error('Dashboard load error:', err);
            App.showToast('ไม่สามารถโหลดข้อมูลได้: ' + err.message, 'error');
        }
    }

    function updateSummaryCards(summary, wallets) {
        document.getElementById('totalIncome').textContent = `฿${formatMoney(summary.total_income)}`;
        document.getElementById('totalExpense').textContent = `฿${formatMoney(summary.total_expense)}`;
        document.getElementById('netBalance').textContent = `฿${formatMoney(summary.net_balance)}`;
        document.getElementById('txnCount').textContent = `${summary.transaction_count} รายการ`;

        const totalBal = wallets.reduce((sum, w) => sum + w.balance, 0);
        document.getElementById('totalWallets').textContent = `฿${formatMoney(totalBal)}`;
        document.getElementById('walletCount').textContent = `${wallets.length} กระเป๋า`;
    }

    function renderPieChart(breakdown) {
        const ctx = document.getElementById('pieChart');
        if (!ctx) return;

        if (pieChart) pieChart.destroy();

        if (breakdown.length === 0) {
            pieChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['ยังไม่มีข้อมูล'],
                    datasets: [{ data: [1], backgroundColor: ['rgba(100,100,100,0.2)'] }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    cutout: '65%',
                }
            });
            return;
        }

        pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: breakdown.map(b => `${b.category_icon} ${b.category_name}`),
                datasets: [{
                    data: breakdown.map(b => b.total),
                    backgroundColor: breakdown.map(b => b.category_color),
                    borderWidth: 0,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary').trim(),
                            font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 11 },
                            padding: 10,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ฿${formatMoney(ctx.parsed)} (${breakdown[ctx.dataIndex].percentage}%)`
                        },
                    },
                },
            },
        });
    }

    function renderBarChart(comparison) {
        const ctx = document.getElementById('barChart');
        if (!ctx) return;

        if (barChart) barChart.destroy();

        const textColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();
        const gridColor = getComputedStyle(document.body).getPropertyValue('--border-color').trim();

        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: comparison.map(c => THAI_MONTHS[c.month]),
                datasets: [
                    {
                        label: 'รายรับ',
                        data: comparison.map(c => c.income),
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'รายจ่าย',
                        data: comparison.map(c => c.expense),
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: textColor,
                            font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 11 },
                            usePointStyle: true,
                            pointStyleWidth: 10,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ฿${formatMoney(ctx.parsed.y)}`
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: textColor, font: { size: 10 } },
                        grid: { display: false },
                    },
                    y: {
                        ticks: {
                            color: textColor,
                            font: { size: 10 },
                            callback: (v) => `฿${(v/1000).toFixed(0)}k`
                        },
                        grid: { color: gridColor },
                    },
                },
            },
        });
    }

    function renderBudgetAlerts(alerts) {
        const container = document.getElementById('budgetAlerts');
        if (!container || alerts.length === 0) {
            if (container) container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="card" style="border-color: var(--accent-amber); background: var(--accent-amber-soft);">
                <h3 style="font-size:14px;font-weight:700;color:var(--accent-amber);margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                    <span class="material-icons-round">warning</span>
                    ⚠️ แจ้งเตือนงบประมาณ
                </h3>
                ${alerts.map(a => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px;">
                        <span>${a.category_icon} ${a.category_name}</span>
                        <span style="font-weight:700;color:${a.is_over_budget ? 'var(--accent-red)' : 'var(--accent-amber)'}">
                            ใช้ไป ${a.percentage}% (฿${formatMoney(a.spent)} / ฿${formatMoney(a.amount)})
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderRecentTransactions(transactions) {
        const container = document.getElementById('recentTransactions');
        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round">receipt_long</span>
                    <h3>ยังไม่มีรายการ</h3>
                    <p>กดปุ่ม + เพื่อเพิ่มรายการแรก</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>วันที่</th>
                        <th>ประเภท</th>
                        <th>หมวดหมู่</th>
                        <th>รายละเอียด</th>
                        <th>กระเป๋า</th>
                        <th style="text-align:right">จำนวนเงิน</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(t => {
                        const date = new Date(t.transaction_date);
                        const dateStr = date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
                        const typeLabel = { income: 'รายรับ', expense: 'รายจ่าย', transfer: 'โอน' }[t.type];
                        const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '';
                        return `
                            <tr>
                                <td>${dateStr}</td>
                                <td><span class="badge ${t.type}">${typeLabel}</span></td>
                                <td>${t.category_icon || '📂'} ${t.category_name || 'ไม่ระบุ'}</td>
                                <td class="text-sm text-muted">${t.description || '-'}</td>
                                <td class="text-sm">${t.wallet_name || ''}${t.to_wallet_name ? ' → ' + t.to_wallet_name : ''}</td>
                                <td class="text-right">
                                    <span class="amount ${t.type}">${sign}฿${formatMoney(t.amount)}</span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    return { render, loadData };
})();
