/**
 * Budgets Page Module
 */
const BudgetsPage = (() => {
    function formatMoney(amount) {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    }

    const THAI_MONTHS_FULL = [
        '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];

    function render(container) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        container.innerHTML = `
            <div class="page-header flex justify-between items-center">
                <div>
                    <h1>💎 งบประมาณ</h1>
                    <p>ตั้งงบประมาณและติดตามการใช้จ่ายในแต่ละหมวดหมู่</p>
                </div>
                <button class="btn btn-primary" id="addBudgetBtn">
                    <span class="material-icons-round" style="font-size:18px">add</span> ตั้งงบประมาณ
                </button>
            </div>

            <div class="filter-bar">
                <select class="form-control" id="budgetMonth">
                    ${Array.from({length: 12}, (_, i) => `<option value="${i+1}" ${i+1===month?'selected':''}>${THAI_MONTHS_FULL[i+1]}</option>`).join('')}
                </select>
                <select class="form-control" id="budgetYear">
                    ${Array.from({length: 5}, (_, i) => {
                        const y = year - 2 + i;
                        return `<option value="${y}" ${y===year?'selected':''}>${y}</option>`;
                    }).join('')}
                </select>
            </div>

            <div class="budget-list" id="budgetList">
                <div class="empty-state">
                    <span class="material-icons-round">hourglass_empty</span>
                    <h3>กำลังโหลด...</h3>
                </div>
            </div>
        `;

        document.getElementById('addBudgetBtn').addEventListener('click', () => showBudgetModal());
        document.getElementById('budgetMonth').addEventListener('change', loadBudgets);
        document.getElementById('budgetYear').addEventListener('change', loadBudgets);

        loadBudgets();
    }

    async function loadBudgets() {
        const month = document.getElementById('budgetMonth')?.value;
        const year = document.getElementById('budgetYear')?.value;

        try {
            const budgets = await API.getBudgets({ month, year });
            renderBudgets(budgets);
        } catch (err) {
            App.showToast('ไม่สามารถโหลดงบประมาณได้', 'error');
        }
    }

    function renderBudgets(budgets) {
        const list = document.getElementById('budgetList');
        if (!list) return;

        if (budgets.length === 0) {
            list.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <span class="material-icons-round">savings</span>
                        <h3>ยังไม่มีงบประมาณ</h3>
                        <p>กดปุ่ม "ตั้งงบประมาณ" เพื่อเริ่มติดตามการใช้จ่าย</p>
                    </div>
                </div>
            `;
            return;
        }

        list.innerHTML = budgets.map(b => {
            const progressClass = b.is_over_budget ? 'danger' : b.is_over_threshold ? 'warning' : 'safe';
            const pct = Math.min(b.percentage, 100);
            return `
                <div class="card budget-item">
                    <div class="budget-header">
                        <div class="budget-category">
                            <span style="font-size:20px">${b.category_icon || '📂'}</span>
                            <span>${b.category_name || 'ไม่ระบุ'}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span class="budget-percentage" style="color:${b.is_over_budget ? 'var(--accent-red)' : b.is_over_threshold ? 'var(--accent-amber)' : 'var(--accent-green)'}">
                                ${b.percentage}%
                            </span>
                            <button class="btn-icon" onclick="BudgetsPage.deleteBudget('${b.id}')" title="ลบ" style="color:var(--accent-red)">
                                <span class="material-icons-round" style="font-size:16px">delete</span>
                            </button>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width:${pct}%"></div>
                    </div>
                    <div class="budget-amounts" style="margin-top:8px;">
                        <span>ใช้ไป: <span class="spent" style="color:var(--accent-red)">฿${formatMoney(b.spent)}</span></span>
                        <span>/ งบ: ฿${formatMoney(b.amount)}</span>
                        <span style="margin-left:auto;">คงเหลือ: <strong style="color:${b.remaining >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">฿${formatMoney(b.remaining)}</strong></span>
                    </div>
                    ${b.is_over_threshold ? `
                        <div style="margin-top:8px;padding:6px 10px;border-radius:var(--radius-sm);background:${b.is_over_budget ? 'var(--accent-red-soft)' : 'var(--accent-amber-soft)'};font-size:11px;font-weight:600;color:${b.is_over_budget ? 'var(--accent-red)' : 'var(--accent-amber)'};">
                            ⚠️ ${b.is_over_budget ? 'ใช้จ่ายเกินงบประมาณแล้ว!' : `ใช้จ่ายเกิน ${b.alert_threshold}% ของงบแล้ว`}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    async function showBudgetModal() {
        const categories = await API.getCategories('expense');
        const now = new Date();
        const month = parseInt(document.getElementById('budgetMonth')?.value || (now.getMonth() + 1));
        const year = parseInt(document.getElementById('budgetYear')?.value || now.getFullYear());

        document.getElementById('modalTitle').textContent = 'ตั้งงบประมาณ';
        const body = document.getElementById('modalBody');
        body.innerHTML = `
            <div class="form-group">
                <label>หมวดหมู่ *</label>
                <select class="form-control" id="budgetCategory">
                    <option value="">-- เลือกหมวดหมู่ --</option>
                    ${categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>วงเงินงบประมาณ (บาท) *</label>
                <input type="number" class="form-control" id="budgetAmount" placeholder="5000" step="100" min="1">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>เดือน</label>
                    <select class="form-control" id="budgetFormMonth">
                        ${Array.from({length: 12}, (_, i) => `<option value="${i+1}" ${i+1===month?'selected':''}>${THAI_MONTHS_FULL[i+1]}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>ปี</label>
                    <input type="number" class="form-control" id="budgetFormYear" value="${year}" min="2020">
                </div>
            </div>
            <div class="form-group">
                <label>แจ้งเตือนเมื่อใช้จ่ายถึง (%)</label>
                <input type="number" class="form-control" id="budgetThreshold" value="80" min="10" max="100" step="5">
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
                <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
                <button class="btn btn-primary" id="budgetSubmit">ตั้งงบประมาณ</button>
            </div>
        `;

        document.getElementById('budgetSubmit').addEventListener('click', async () => {
            const category_id = document.getElementById('budgetCategory').value;
            const amount = parseFloat(document.getElementById('budgetAmount').value);
            const m = parseInt(document.getElementById('budgetFormMonth').value);
            const y = parseInt(document.getElementById('budgetFormYear').value);
            const alert_threshold = parseFloat(document.getElementById('budgetThreshold').value);

            if (!category_id) return App.showToast('กรุณาเลือกหมวดหมู่', 'error');
            if (!amount || amount <= 0) return App.showToast('กรุณาระบุวงเงิน', 'error');

            try {
                await API.createBudget({ category_id, amount, month: m, year: y, alert_threshold });
                App.showToast('ตั้งงบประมาณสำเร็จ', 'success');
                App.closeModal();
                loadBudgets();
            } catch (err) {
                App.showToast(err.message, 'error');
            }
        });

        App.openModal();
    }

    async function deleteBudget(id) {
        if (!confirm('ต้องการลบงบประมาณนี้ใช่หรือไม่?')) return;
        try {
            await API.deleteBudget(id);
            App.showToast('ลบงบประมาณสำเร็จ', 'success');
            loadBudgets();
        } catch (err) {
            App.showToast(err.message, 'error');
        }
    }

    return { render, loadBudgets, deleteBudget };
})();
