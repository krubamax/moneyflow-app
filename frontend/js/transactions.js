/**
 * Transactions Page Module
 * Full CRUD for income/expense/transfer transactions with filtering.
 */
const TransactionsPage = (() => {
    function formatMoney(amount) {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    }

    function render(container) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const THAI_MONTHS_FULL = [
            '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
        ];

        container.innerHTML = `
            <div class="page-header">
                <h1>📝 รายการทั้งหมด</h1>
                <p>จัดการรายการรายรับ-รายจ่ายของคุณ</p>
            </div>

            <div class="filter-bar">
                <select class="form-control" id="txnMonth">
                    <option value="">ทุกเดือน</option>
                    ${Array.from({length: 12}, (_, i) => `<option value="${i+1}" ${i+1===month?'selected':''}>${THAI_MONTHS_FULL[i+1]}</option>`).join('')}
                </select>
                <select class="form-control" id="txnYear">
                    ${Array.from({length: 5}, (_, i) => {
                        const y = year - 2 + i;
                        return `<option value="${y}" ${y===year?'selected':''}>${y}</option>`;
                    }).join('')}
                </select>
                <select class="form-control" id="txnType">
                    <option value="">ทุกประเภท</option>
                    <option value="income">รายรับ</option>
                    <option value="expense">รายจ่าย</option>
                    <option value="transfer">โอนเงิน</option>
                </select>
                <select class="form-control" id="txnWallet">
                    <option value="">ทุกกระเป๋า</option>
                </select>
                <button class="btn btn-primary btn-sm" id="txnSearch">
                    <span class="material-icons-round" style="font-size:16px">search</span>
                    ค้นหา
                </button>
            </div>

            <div class="card">
                <div id="txnList">
                    <div class="empty-state">
                        <span class="material-icons-round">hourglass_empty</span>
                        <h3>กำลังโหลด...</h3>
                    </div>
                </div>
            </div>
        `;

        // Load wallet filter
        loadWalletFilter();

        document.getElementById('txnSearch').addEventListener('click', loadTransactions);
        document.getElementById('txnMonth').addEventListener('change', loadTransactions);
        document.getElementById('txnYear').addEventListener('change', loadTransactions);
        document.getElementById('txnType').addEventListener('change', loadTransactions);
        document.getElementById('txnWallet').addEventListener('change', loadTransactions);

        loadTransactions();
    }

    async function loadWalletFilter() {
        try {
            const wallets = await API.getWallets();
            const select = document.getElementById('txnWallet');
            if (select) {
                wallets.forEach(w => {
                    const opt = document.createElement('option');
                    opt.value = w.id;
                    opt.textContent = `${w.icon} ${w.name}`;
                    select.appendChild(opt);
                });
            }
        } catch (err) {
            console.error('Load wallet filter error:', err);
        }
    }

    async function loadTransactions() {
        const params = {};
        const month = document.getElementById('txnMonth')?.value;
        const year = document.getElementById('txnYear')?.value;
        const type = document.getElementById('txnType')?.value;
        const wallet_id = document.getElementById('txnWallet')?.value;

        if (month) params.month = month;
        if (year) params.year = year;
        if (type) params.type = type;
        if (wallet_id) params.wallet_id = wallet_id;

        try {
            const transactions = await API.getTransactions(params);
            renderTransactions(transactions);
        } catch (err) {
            App.showToast('ไม่สามารถโหลดรายการได้', 'error');
        }
    }

    function renderTransactions(transactions) {
        const container = document.getElementById('txnList');
        if (!container) return;

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round">receipt_long</span>
                    <h3>ไม่พบรายการ</h3>
                    <p>กดปุ่ม + เพื่อเพิ่มรายการใหม่</p>
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
                        <th style="text-align:center">สลิป</th>
                        <th style="text-align:center">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(t => {
                        const date = new Date(t.transaction_date);
                        const dateStr = date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
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
                                <td class="text-center">
                                    ${t.receipt_url ? `<img src="${t.receipt_url}" class="receipt-preview" style="width:32px;height:32px" alt="สลิป" onclick="window.open('${t.receipt_url}','_blank')">` : '-'}
                                </td>
                                <td class="text-center">
                                    <button class="btn-icon" onclick="TransactionsPage.editTransaction('${t.id}')" title="แก้ไข">
                                        <span class="material-icons-round" style="font-size:16px">edit</span>
                                    </button>
                                    <button class="btn-icon" onclick="TransactionsPage.deleteTransaction('${t.id}')" title="ลบ" style="color:var(--accent-red)">
                                        <span class="material-icons-round" style="font-size:16px">delete</span>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    async function showAddModal(editData = null) {
        const isEdit = !!editData;
        const wallets = await API.getWallets();
        const categories = await API.getCategories();

        const now = new Date();
        const defaultDate = editData
            ? new Date(editData.transaction_date).toISOString().slice(0, 16)
            : now.toISOString().slice(0, 16);

        const body = document.getElementById('modalBody');
        document.getElementById('modalTitle').textContent = isEdit ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่';

        const selectedType = editData?.type || 'expense';

        body.innerHTML = `
            <div class="type-selector">
                <button class="type-btn income ${selectedType === 'income' ? 'active' : ''}" data-type="income">
                    <span class="material-icons-round" style="font-size:18px">trending_up</span> รายรับ
                </button>
                <button class="type-btn expense ${selectedType === 'expense' ? 'active' : ''}" data-type="expense">
                    <span class="material-icons-round" style="font-size:18px">trending_down</span> รายจ่าย
                </button>
                <button class="type-btn transfer ${selectedType === 'transfer' ? 'active' : ''}" data-type="transfer">
                    <span class="material-icons-round" style="font-size:18px">swap_horiz</span> โอนเงิน
                </button>
            </div>
            <input type="hidden" id="txnFormType" value="${selectedType}">

            <div class="form-row">
                <div class="form-group">
                    <label>จำนวนเงิน (บาท) *</label>
                    <input type="number" class="form-control" id="txnFormAmount" placeholder="0.00" step="0.01" min="0.01" value="${editData?.amount || ''}">
                </div>
                <div class="form-group">
                    <label>วันที่และเวลา</label>
                    <input type="datetime-local" class="form-control" id="txnFormDate" value="${defaultDate}">
                </div>
            </div>

            <div class="form-group" id="categoryGroup">
                <label>หมวดหมู่</label>
                <select class="form-control" id="txnFormCategory">
                    <option value="">-- เลือกหมวดหมู่ --</option>
                    ${categories.filter(c => c.type === selectedType || selectedType === 'transfer').map(c =>
                        `<option value="${c.id}" ${editData?.category_id === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`
                    ).join('')}
                </select>
            </div>

            <div class="form-group">
                <label>กระเป๋าเงิน${selectedType === 'transfer' ? ' (ต้นทาง)' : ''} *</label>
                <select class="form-control" id="txnFormWallet">
                    <option value="">-- เลือกกระเป๋า --</option>
                    ${wallets.map(w => `<option value="${w.id}" ${editData?.wallet_id === w.id ? 'selected' : ''}>${w.icon} ${w.name} (฿${formatMoney(w.balance)})</option>`).join('')}
                </select>
            </div>

            <div class="form-group ${selectedType !== 'transfer' ? 'hidden' : ''}" id="toWalletGroup">
                <label>กระเป๋าปลายทาง *</label>
                <select class="form-control" id="txnFormToWallet">
                    <option value="">-- เลือกกระเป๋าปลายทาง --</option>
                    ${wallets.map(w => `<option value="${w.id}" ${editData?.to_wallet_id === w.id ? 'selected' : ''}>${w.icon} ${w.name}</option>`).join('')}
                </select>
            </div>

            <div class="form-group">
                <label>บันทึกย่อ</label>
                <textarea class="form-control" id="txnFormDesc" placeholder="รายละเอียด...">${editData?.description || ''}</textarea>
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
                <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
                <button class="btn btn-primary" id="txnFormSubmit">${isEdit ? 'บันทึก' : 'เพิ่มรายการ'}</button>
            </div>
        `;

        // Type selector events
        body.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                body.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('txnFormType').value = btn.dataset.type;

                // Toggle transfer wallet
                const toGroup = document.getElementById('toWalletGroup');
                const catGroup = document.getElementById('categoryGroup');
                if (btn.dataset.type === 'transfer') {
                    toGroup.classList.remove('hidden');
                    catGroup.classList.add('hidden');
                } else {
                    toGroup.classList.add('hidden');
                    catGroup.classList.remove('hidden');
                    // Refresh category options
                    const catSelect = document.getElementById('txnFormCategory');
                    catSelect.innerHTML = '<option value="">-- เลือกหมวดหมู่ --</option>' +
                        categories.filter(c => c.type === btn.dataset.type).map(c =>
                            `<option value="${c.id}">${c.icon} ${c.name}</option>`
                        ).join('');
                }
            });
        });

        // Submit
        document.getElementById('txnFormSubmit').addEventListener('click', async () => {
            const type = document.getElementById('txnFormType').value;
            const amount = parseFloat(document.getElementById('txnFormAmount').value);
            const transaction_date = document.getElementById('txnFormDate').value;
            const category_id = document.getElementById('txnFormCategory').value || null;
            const wallet_id = document.getElementById('txnFormWallet').value;
            const to_wallet_id = document.getElementById('txnFormToWallet').value || null;
            const description = document.getElementById('txnFormDesc').value;

            if (!amount || amount <= 0) return App.showToast('กรุณาระบุจำนวนเงิน', 'error');
            if (!wallet_id) return App.showToast('กรุณาเลือกกระเป๋าเงิน', 'error');
            if (type === 'transfer' && !to_wallet_id) return App.showToast('กรุณาเลือกกระเป๋าปลายทาง', 'error');

            const data = { type, amount, category_id, wallet_id, to_wallet_id, description };
            if (transaction_date) data.transaction_date = new Date(transaction_date).toISOString();

            try {
                if (isEdit) {
                    await API.updateTransaction(editData.id, data);
                    App.showToast('แก้ไขรายการสำเร็จ', 'success');
                } else {
                    await API.createTransaction(data);
                    App.showToast('เพิ่มรายการสำเร็จ', 'success');
                }
                App.closeModal();
                loadTransactions();
            } catch (err) {
                App.showToast(err.message, 'error');
            }
        });

        App.openModal();
    }

    async function editTransaction(id) {
        try {
            const txns = await API.getTransactions({ limit: 500 });
            const txn = txns.find(t => t.id === id);
            if (txn) showAddModal(txn);
        } catch (err) {
            App.showToast('ไม่สามารถโหลดข้อมูลรายการ', 'error');
        }
    }

    async function deleteTransaction(id) {
        if (!confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) return;
        try {
            await API.deleteTransaction(id);
            App.showToast('ลบรายการสำเร็จ', 'success');
            loadTransactions();
        } catch (err) {
            App.showToast(err.message, 'error');
        }
    }

    return { render, showAddModal, editTransaction, deleteTransaction, loadTransactions };
})();
