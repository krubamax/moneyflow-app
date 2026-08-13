/**
 * Wallets Page Module
 */
const WalletsPage = (() => {
    function formatMoney(amount) {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    }

    const WALLET_TYPES = {
        cash: 'เงินสด',
        bank: 'บัญชีธนาคาร',
        investment: 'ลงทุน',
        e_wallet: 'e-Wallet',
    };

    const WALLET_ICONS = ['💰', '🏦', '💳', '📈', '🪙', '💵', '🏧', '👛', '💎', '🎯'];
    const WALLET_COLORS = ['#4ECDC4', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6'];

    function render(container) {
        container.innerHTML = `
            <div class="page-header flex justify-between items-center">
                <div>
                    <h1>👛 กระเป๋าเงิน</h1>
                    <p>จัดการกระเป๋าเงินและบัญชีต่างๆ ของคุณ</p>
                </div>
                <button class="btn btn-primary" id="addWalletBtn">
                    <span class="material-icons-round" style="font-size:18px">add</span> เพิ่มกระเป๋า
                </button>
            </div>
            <div class="wallet-grid" id="walletGrid">
                <div class="empty-state">
                    <span class="material-icons-round">hourglass_empty</span>
                    <h3>กำลังโหลด...</h3>
                </div>
            </div>
        `;

        document.getElementById('addWalletBtn').addEventListener('click', () => showWalletModal());
        loadWallets();
    }

    async function loadWallets() {
        try {
            const wallets = await API.getWallets();
            renderWallets(wallets);
        } catch (err) {
            App.showToast('ไม่สามารถโหลดกระเป๋าเงินได้', 'error');
        }
    }

    function renderWallets(wallets) {
        const grid = document.getElementById('walletGrid');
        if (!grid) return;

        if (wallets.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <span class="material-icons-round">account_balance_wallet</span>
                    <h3>ยังไม่มีกระเป๋าเงิน</h3>
                    <p>กดปุ่ม "เพิ่มกระเป๋า" เพื่อเริ่มต้น</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = wallets.map(w => `
            <div class="card wallet-card" style="--wallet-color:${w.color}">
                <div class="wallet-actions">
                    <button class="btn-icon" onclick="WalletsPage.editWallet('${w.id}')" title="แก้ไข">
                        <span class="material-icons-round" style="font-size:16px">edit</span>
                    </button>
                    <button class="btn-icon" onclick="WalletsPage.deleteWallet('${w.id}')" title="ลบ" style="color:var(--accent-red)">
                        <span class="material-icons-round" style="font-size:16px">delete</span>
                    </button>
                </div>
                <div class="wallet-icon">${w.icon}</div>
                <div class="wallet-name">${w.name}</div>
                <div class="wallet-type">${WALLET_TYPES[w.type] || w.type}</div>
                <div class="wallet-balance-label">ยอดคงเหลือ</div>
                <div class="wallet-balance" style="color:${w.color}">฿${formatMoney(w.balance)}</div>
                <div style="position:absolute;bottom:-30px;right:-30px;width:100px;height:100px;border-radius:50%;background:${w.color};opacity:0.1"></div>
            </div>
        `).join('');
    }

    async function showWalletModal(editData = null) {
        const isEdit = !!editData;
        document.getElementById('modalTitle').textContent = isEdit ? 'แก้ไขกระเป๋า' : 'เพิ่มกระเป๋าใหม่';

        const body = document.getElementById('modalBody');
        body.innerHTML = `
            <div class="form-group">
                <label>ชื่อกระเป๋า *</label>
                <input type="text" class="form-control" id="walletName" placeholder="เช่น ธนาคารกรุงเทพ" value="${editData?.name || ''}">
            </div>
            <div class="form-group">
                <label>ประเภท</label>
                <select class="form-control" id="walletType">
                    ${Object.entries(WALLET_TYPES).map(([k, v]) =>
                        `<option value="${k}" ${editData?.type === k ? 'selected' : ''}>${v}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>ยอดเงินเริ่มต้น</label>
                <input type="number" class="form-control" id="walletBalance" placeholder="0.00" step="0.01" min="0" value="${editData?.balance ?? ''}">
            </div>
            <div class="form-group">
                <label>ไอคอน</label>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${WALLET_ICONS.map(icon => `
                        <button class="btn-icon wallet-icon-btn ${editData?.icon === icon ? 'active' : ''}"
                                onclick="document.querySelectorAll('.wallet-icon-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');document.getElementById('walletIcon').value='${icon}'"
                                style="font-size:20px;width:40px;height:40px;${editData?.icon === icon ? 'border-color:var(--accent-primary);background:var(--accent-primary-glow)' : ''}">
                            ${icon}
                        </button>
                    `).join('')}
                </div>
                <input type="hidden" id="walletIcon" value="${editData?.icon || '💰'}">
            </div>
            <div class="form-group">
                <label>สี</label>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${WALLET_COLORS.map(color => `
                        <button class="wallet-color-btn"
                                onclick="document.querySelectorAll('.wallet-color-btn').forEach(b=>b.style.outline='');this.style.outline='2px solid white';document.getElementById('walletColor').value='${color}'"
                                style="width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;background:${color};${editData?.color === color ? 'outline:2px solid white' : ''}">
                        </button>
                    `).join('')}
                </div>
                <input type="hidden" id="walletColor" value="${editData?.color || '#4ECDC4'}">
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
                <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
                <button class="btn btn-primary" id="walletSubmit">${isEdit ? 'บันทึก' : 'สร้างกระเป๋า'}</button>
            </div>
        `;

        document.getElementById('walletSubmit').addEventListener('click', async () => {
            const name = document.getElementById('walletName').value.trim();
            const type = document.getElementById('walletType').value;
            const balance = parseFloat(document.getElementById('walletBalance').value) || 0;
            const icon = document.getElementById('walletIcon').value;
            const color = document.getElementById('walletColor').value;

            if (!name) return App.showToast('กรุณาระบุชื่อกระเป๋า', 'error');

            try {
                if (isEdit) {
                    await API.updateWallet(editData.id, { name, type, balance, icon, color });
                    App.showToast('แก้ไขกระเป๋าสำเร็จ', 'success');
                } else {
                    await API.createWallet({ name, type, balance, icon, color });
                    App.showToast('สร้างกระเป๋าสำเร็จ', 'success');
                }
                App.closeModal();
                loadWallets();
            } catch (err) {
                App.showToast(err.message, 'error');
            }
        });

        App.openModal();
    }

    async function editWallet(id) {
        try {
            const wallet = await API.getWallet(id);
            showWalletModal(wallet);
        } catch (err) {
            App.showToast('ไม่สามารถโหลดข้อมูลกระเป๋า', 'error');
        }
    }

    async function deleteWallet(id) {
        if (!confirm('ต้องการลบกระเป๋านี้ใช่หรือไม่?')) return;
        try {
            await API.deleteWallet(id);
            App.showToast('ลบกระเป๋าสำเร็จ', 'success');
            loadWallets();
        } catch (err) {
            App.showToast(err.message, 'error');
        }
    }

    return { render, showWalletModal, editWallet, deleteWallet, loadWallets };
})();
