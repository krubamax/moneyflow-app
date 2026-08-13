/**
 * Recurring Transactions Page Module
 */
const RecurringPage = (() => {
    function formatMoney(amount) {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    }

    const FREQ_LABELS = {
        daily: 'ทุกวัน',
        weekly: 'ทุกสัปดาห์',
        monthly: 'ทุกเดือน',
        yearly: 'ทุกปี',
    };

    function render(container) {
        container.innerHTML = `
            <div class="page-header flex justify-between items-center">
                <div>
                    <h1>🔄 รายการประจำ</h1>
                    <p>ตั้งค่ารายรับ-รายจ่ายที่เกิดขึ้นประจำ เช่น ค่าบริการรายเดือน</p>
                </div>
                <div style="display:flex;gap:10px;">
                    <button class="btn btn-ghost" id="processRecurringBtn">
                        <span class="material-icons-round" style="font-size:18px">play_arrow</span> ประมวลผลรายการ
                    </button>
                    <button class="btn btn-primary" id="addRecurringBtn">
                        <span class="material-icons-round" style="font-size:18px">add</span> เพิ่มรายการประจำ
                    </button>
                </div>
            </div>
            <div id="recurringList">
                <div class="empty-state">
                    <span class="material-icons-round">hourglass_empty</span>
                    <h3>กำลังโหลด...</h3>
                </div>
            </div>
        `;

        document.getElementById('addRecurringBtn').addEventListener('click', () => showRecurringModal());
        document.getElementById('processRecurringBtn').addEventListener('click', async () => {
            try {
                const result = await API.processRecurring();
                App.showToast(result.message, 'success');
                loadRecurring();
            } catch (err) {
                App.showToast(err.message, 'error');
            }
        });

        loadRecurring();
    }

    async function loadRecurring() {
        try {
            const items = await API.getRecurring();
            renderRecurring(items);
        } catch (err) {
            App.showToast('ไม่สามารถโหลดรายการประจำได้', 'error');
        }
    }

    function renderRecurring(items) {
        const container = document.getElementById('recurringList');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <span class="material-icons-round">autorenew</span>
                        <h3>ยังไม่มีรายการประจำ</h3>
                        <p>เพิ่มรายการที่เกิดขึ้นทุกเดือน เช่น Spotify, ค่าอินเทอร์เน็ต</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
            ${items.map(r => `
                <div class="card" style="opacity:${r.is_active ? '1' : '0.5'}">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-md">
                            <span style="font-size:28px">${r.category_icon || '📂'}</span>
                            <div>
                                <div class="font-bold">${r.description || r.category_name || 'ไม่ระบุ'}</div>
                                <div class="text-xs text-muted">
                                    ${r.category_name} • ${r.wallet_name} •
                                    ${FREQ_LABELS[r.frequency]} (วันที่ ${r.day_of_month})
                                </div>
                                ${r.last_generated ? `<div class="text-xs text-muted">สร้างล่าสุด: ${r.last_generated}</div>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-sm">
                            <span class="amount ${r.type}" style="font-size:16px">
                                ${r.type === 'income' ? '+' : '-'}฿${formatMoney(r.amount)}
                            </span>
                            <span class="badge ${r.type}" style="margin-left:8px">
                                ${r.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
                            </span>
                            <button class="btn-icon" onclick="RecurringPage.toggleActive('${r.id}', ${!r.is_active})" title="${r.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}">
                                <span class="material-icons-round" style="font-size:16px">${r.is_active ? 'pause' : 'play_arrow'}</span>
                            </button>
                            <button class="btn-icon" onclick="RecurringPage.deleteRecurring('${r.id}')" title="ลบ" style="color:var(--accent-red)">
                                <span class="material-icons-round" style="font-size:16px">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>`;
    }

    async function showRecurringModal() {
        const wallets = await API.getWallets();
        const categories = await API.getCategories();

        document.getElementById('modalTitle').textContent = 'เพิ่มรายการประจำ';
        const body = document.getElementById('modalBody');
        body.innerHTML = `
            <div class="type-selector">
                <button class="type-btn expense active" data-type="expense">
                    <span class="material-icons-round" style="font-size:18px">trending_down</span> รายจ่าย
                </button>
                <button class="type-btn income" data-type="income">
                    <span class="material-icons-round" style="font-size:18px">trending_up</span> รายรับ
                </button>
            </div>
            <input type="hidden" id="recFormType" value="expense">

            <div class="form-group">
                <label>รายละเอียด *</label>
                <input type="text" class="form-control" id="recFormDesc" placeholder="เช่น Spotify Premium, ค่าอินเทอร์เน็ต">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>จำนวนเงิน (บาท) *</label>
                    <input type="number" class="form-control" id="recFormAmount" placeholder="0.00" step="0.01" min="0.01">
                </div>
                <div class="form-group">
                    <label>ความถี่</label>
                    <select class="form-control" id="recFormFreq">
                        <option value="monthly" selected>ทุกเดือน</option>
                        <option value="weekly">ทุกสัปดาห์</option>
                        <option value="daily">ทุกวัน</option>
                        <option value="yearly">ทุกปี</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>หมวดหมู่ *</label>
                    <select class="form-control" id="recFormCategory">
                        <option value="">-- เลือก --</option>
                        ${categories.filter(c => c.type === 'expense').map(c =>
                            `<option value="${c.id}">${c.icon} ${c.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>กระเป๋าเงิน *</label>
                    <select class="form-control" id="recFormWallet">
                        <option value="">-- เลือก --</option>
                        ${wallets.map(w => `<option value="${w.id}">${w.icon} ${w.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>วันที่ในเดือน</label>
                    <input type="number" class="form-control" id="recFormDay" value="1" min="1" max="31">
                </div>
                <div class="form-group">
                    <label>เริ่มตั้งแต่</label>
                    <input type="date" class="form-control" id="recFormStart" value="${new Date().toISOString().slice(0, 10)}">
                </div>
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
                <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
                <button class="btn btn-primary" id="recFormSubmit">เพิ่มรายการประจำ</button>
            </div>
        `;

        // Type toggle
        body.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                body.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('recFormType').value = btn.dataset.type;
                const catSelect = document.getElementById('recFormCategory');
                catSelect.innerHTML = '<option value="">-- เลือก --</option>' +
                    categories.filter(c => c.type === btn.dataset.type).map(c =>
                        `<option value="${c.id}">${c.icon} ${c.name}</option>`
                    ).join('');
            });
        });

        document.getElementById('recFormSubmit').addEventListener('click', async () => {
            const type = document.getElementById('recFormType').value;
            const description = document.getElementById('recFormDesc').value.trim();
            const amount = parseFloat(document.getElementById('recFormAmount').value);
            const frequency = document.getElementById('recFormFreq').value;
            const category_id = document.getElementById('recFormCategory').value;
            const wallet_id = document.getElementById('recFormWallet').value;
            const day_of_month = parseInt(document.getElementById('recFormDay').value);
            const start_date = document.getElementById('recFormStart').value;

            if (!description) return App.showToast('กรุณาระบุรายละเอียด', 'error');
            if (!amount || amount <= 0) return App.showToast('กรุณาระบุจำนวนเงิน', 'error');
            if (!category_id) return App.showToast('กรุณาเลือกหมวดหมู่', 'error');
            if (!wallet_id) return App.showToast('กรุณาเลือกกระเป๋าเงิน', 'error');

            try {
                await API.createRecurring({
                    type, description, amount, frequency,
                    category_id, wallet_id, day_of_month, start_date,
                });
                App.showToast('เพิ่มรายการประจำสำเร็จ', 'success');
                App.closeModal();
                loadRecurring();
            } catch (err) {
                App.showToast(err.message, 'error');
            }
        });

        App.openModal();
    }

    async function toggleActive(id, isActive) {
        try {
            await API.updateRecurring(id, { is_active: isActive });
            App.showToast(isActive ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว', 'success');
            loadRecurring();
        } catch (err) {
            App.showToast(err.message, 'error');
        }
    }

    async function deleteRecurring(id) {
        if (!confirm('ต้องการลบรายการประจำนี้ใช่หรือไม่?')) return;
        try {
            await API.deleteRecurring(id);
            App.showToast('ลบรายการประจำสำเร็จ', 'success');
            loadRecurring();
        } catch (err) {
            App.showToast(err.message, 'error');
        }
    }

    return { render, loadRecurring, toggleActive, deleteRecurring };
})();
