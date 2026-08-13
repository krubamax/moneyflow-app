/**
 * API Client Module
 * Centralized fetch wrapper for all backend API calls.
 */
const API = (() => {
    const BASE_URL = '/api';

    async function request(endpoint, options = {}) {
        const url = `${BASE_URL}${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        };
        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }
        if (config.body instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        try {
            const res = await fetch(url, config);
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'เกิดข้อผิดพลาด' }));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await res.json();
            }
            return res;
        } catch (e) {
            console.error(`API Error [${endpoint}]:`, e);
            throw e;
        }
    }

    return {
        // Wallets
        getWallets: () => request('/wallets/'),
        getWallet: (id) => request(`/wallets/${id}`),
        createWallet: (data) => request('/wallets/', { method: 'POST', body: data }),
        updateWallet: (id, data) => request(`/wallets/${id}`, { method: 'PUT', body: data }),
        deleteWallet: (id) => request(`/wallets/${id}`, { method: 'DELETE' }),

        // Categories
        getCategories: (type) => request(`/categories/${type ? '?type=' + type : ''}`),
        createCategory: (data) => request('/categories/', { method: 'POST', body: data }),
        deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

        // Transactions
        getTransactions: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request(`/transactions/${qs ? '?' + qs : ''}`);
        },
        createTransaction: (data) => request('/transactions/', { method: 'POST', body: data }),
        updateTransaction: (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: data }),
        deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
        uploadReceipt: (id, formData) => request(`/transactions/${id}/receipt`, {
            method: 'POST',
            body: formData,
            headers: {},
        }),

        // Budgets
        getBudgets: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request(`/budgets/${qs ? '?' + qs : ''}`);
        },
        createBudget: (data) => request('/budgets/', { method: 'POST', body: data }),
        deleteBudget: (id) => request(`/budgets/${id}`, { method: 'DELETE' }),
        getBudgetAlerts: (params = {}) => {
            const qs = new URLSearchParams(params).toString();
            return request(`/budgets/alerts${qs ? '?' + qs : ''}`);
        },

        // Recurring
        getRecurring: () => request('/recurring/'),
        createRecurring: (data) => request('/recurring/', { method: 'POST', body: data }),
        updateRecurring: (id, data) => request(`/recurring/${id}`, { method: 'PUT', body: data }),
        deleteRecurring: (id) => request(`/recurring/${id}`, { method: 'DELETE' }),
        processRecurring: () => request('/recurring/process', { method: 'POST' }),

        // Dashboard
        getSummary: (month, year) => request(`/dashboard/summary?month=${month}&year=${year}`),
        getCategoryBreakdown: (month, year, type = 'expense') =>
            request(`/dashboard/category-breakdown?month=${month}&year=${year}&type=${type}`),
        getMonthlyComparison: (year) => request(`/dashboard/monthly-comparison?year=${year}`),
        getWalletBalances: () => request('/dashboard/wallet-balances'),

        // Export
        exportPdf: (month, year) => {
            window.open(`${BASE_URL}/export/pdf?month=${month}&year=${year}`, '_blank');
        },
        exportCsv: (month, year) => {
            window.open(`${BASE_URL}/export/csv?month=${month}&year=${year}`, '_blank');
        },
        exportSheets: (month, year) => request(`/export/sheets?month=${month}&year=${year}`),
    };
})();
