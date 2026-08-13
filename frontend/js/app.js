/**
 * Main Application Controller
 * Handles routing, navigation, modals, toasts, and theme switching.
 */
const App = (() => {
    const pages = {
        dashboard: DashboardPage,
        transactions: TransactionsPage,
        wallets: WalletsPage,
        budgets: BudgetsPage,
        recurring: RecurringPage,
        export: ExportPage,
    };

    let currentPage = 'dashboard';

    function init() {
        // Theme initialization
        const savedTheme = localStorage.getItem('moneyflow-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeUI(savedTheme);

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) navigateTo(page);
            });
        });

        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('show');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            });
        }

        // Theme toggles
        document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
        document.getElementById('themeToggleMobile')?.addEventListener('click', toggleTheme);

        // FAB: Add transaction
        document.getElementById('fabAdd')?.addEventListener('click', () => {
            TransactionsPage.showAddModal();
        });

        // Modal close
        document.getElementById('modalClose')?.addEventListener('click', closeModal);
        document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });

        // Alert close
        document.getElementById('alertClose')?.addEventListener('click', () => {
            document.getElementById('alertBanner').style.display = 'none';
        });

        // Hash routing
        window.addEventListener('hashchange', () => {
            const hash = location.hash.slice(1) || 'dashboard';
            if (pages[hash]) navigateTo(hash, false);
        });

        // Initial route
        const initialHash = location.hash.slice(1) || 'dashboard';
        navigateTo(initialHash, false);

        // Check budget alerts on load
        checkBudgetAlerts();
    }

    function navigateTo(page, pushHash = true) {
        if (!pages[page]) page = 'dashboard';
        currentPage = page;

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Close mobile menu
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('show');

        // Update hash
        if (pushHash) location.hash = page;

        // Render page
        const container = document.getElementById('page-container');
        if (container) {
            container.innerHTML = '';
            container.style.opacity = '0';
            container.style.transform = 'translateY(10px)';

            pages[page].render(container);

            // Animate in
            requestAnimationFrame(() => {
                container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                container.style.opacity = '1';
                container.style.transform = 'translateY(0)';
            });
        }
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('moneyflow-theme', next);
        updateThemeUI(next);
    }

    function updateThemeUI(theme) {
        const isDark = theme === 'dark';
        const icon = isDark ? 'light_mode' : 'dark_mode';
        const label = isDark ? 'โหมดสว่าง' : 'โหมดมืด';

        const themeIcon = document.getElementById('themeIcon');
        const themeLabel = document.getElementById('themeLabel');
        const themeIconMobile = document.getElementById('themeIconMobile');

        if (themeIcon) themeIcon.textContent = icon;
        if (themeLabel) themeLabel.textContent = label;
        if (themeIconMobile) themeIconMobile.textContent = icon;
    }

    // ── Modal ──
    function openModal() {
        document.getElementById('modalOverlay')?.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        document.getElementById('modalOverlay')?.classList.remove('show');
        document.body.style.overflow = '';
    }

    // ── Toast ──
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info',
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="material-icons-round" style="font-size:18px;color:var(--accent-${type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'amber' : 'blue'})">${icons[type]}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ── Budget Alerts ──
    async function checkBudgetAlerts() {
        try {
            const now = new Date();
            const alerts = await API.getBudgetAlerts({ month: now.getMonth() + 1, year: now.getFullYear() });
            if (alerts.length > 0) {
                const banner = document.getElementById('alertBanner');
                const text = document.getElementById('alertText');
                if (banner && text) {
                    const names = alerts.map(a => `${a.category_icon} ${a.category_name} (${a.percentage}%)`).join(', ');
                    text.textContent = `งบประมาณใกล้หมด: ${names}`;
                    banner.style.display = 'flex';
                }
            }
        } catch (err) {
            // Silently fail - alerts are non-critical
        }
    }

    return { init, navigateTo, openModal, closeModal, showToast, checkBudgetAlerts };
})();

// ── Boot ──
document.addEventListener('DOMContentLoaded', App.init);
