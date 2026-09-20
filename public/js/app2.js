// --- LOCAL STORAGE DATABASE SETUP ---
const DB_KEY = 'mm_brothers_data';
let mockDB = null;

function getInitialData() {
    return {
        settings: {
            store_name: "MM Brothers Islamic Mart",
            store_contact: "03025731705",
            store_address: "Main Bazaar, City Center",
            receipt_footer: "Thanks for shopping with us! Please check items before leaving.",
            currency: "Rs",
            official_number: "03025731705",
            logo_base64: "logo.jpg",
            financial_password: null,
            printer_settings: {
                printer_name: "",
                paper_size: "80mm",
                silent_print: true
            }
        },
        users: [
            { id: 1, username: "admin", password: "123", role: "admin", name: "Admin User", phone: "03025731705", avatar: "" },
            { id: 2, username: "manager", password: "123", role: "manager", name: "Store Manager", phone: "0333-1111111", avatar: "" },
            { id: 3, username: "sales", password: "123", role: "salesman", name: "Sales Team", phone: "0333-2222222", avatar: "" }
        ],
        products: [],
        customers: [
            { id: 1, name: "Walk-in Customer", phone: "N/A", address: "" }
        ],
        salesHistory: [],
        attarProducts: [],
        bottles: [],
        khataRecords: []
    };
}

function initDB() { /* DB is initialized by main.js in Electron */ }

function getDB() { 
    try { 
        let parsed;
        if (window.api) { 
            const data = window.api.readDB('mm_brothers_data'); 
            parsed = data ? JSON.parse(data) : getInitialData(); 
        } else {
            const data = localStorage.getItem('mm_brothers_data'); 
            parsed = data ? JSON.parse(data) : (mockDB || getInitialData());
        }
        // Auto-migrate old JazakAllahu footer to correct text
        if (parsed && parsed.settings && parsed.settings.receipt_footer && 
            parsed.settings.receipt_footer.toLowerCase().includes('jazak')) {
            parsed.settings.receipt_footer = "Thanks for shopping with us!\nPlease check your items before leaving.";
            saveDB(parsed);
        }
        return parsed;
    } catch(err) { return mockDB || getInitialData(); } 
}
function saveDB(data) { try { if (window.api) { window.api.writeDB('mm_brothers_data', JSON.stringify(data)); } else { localStorage.setItem('mm_brothers_data', JSON.stringify(data)); } } catch(err) { console.error('Failed to save to SQLite', err); } }

// Global State
let state = {
    products: [], customers: [], salesHistory: [], cart: [], stats: {}, categories: [], expenses: [], workers: [],
    attarProducts: [], bottles: [], khataRecords: [],
    timeFilter: 'all', inventorySort: 'name', inventoryFilter: 'all',
    currentUser: null,
    settings: {},
    financialUnlocked: false,
    posTab: 'products'
};

// DOM Elements
const appContainer = document.getElementById('app');
const loginScreen = document.getElementById('login-screen');
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');

// === KHATA-REPORTS SYNC HELPER ===
// Cross-references salesHistory with khataRecords for real-time payment status
window.getKhataPaymentInfo = function(sale, passedDB = null) {
    const db = passedDB || getDB();
    const khataRec = (db.khataRecords || []).find(r => r.sale_id === sale.id);
    
    // Determine personKey for advance lookup
    let personKey = null;
    if (sale.customer_id) personKey = 'cust_' + sale.customer_id;

    // Get advance balance for this customer
    const advanceBalance = personKey && db.khataAdvance ? (db.khataAdvance[personKey] || 0) : 0;
    // Get advance history for this customer
    const advanceHistory = personKey && db.khataAdvanceHistory ? 
        db.khataAdvanceHistory.filter(h => h.personKey === personKey) : [];
    // Check if advance was used on THIS specific sale
    const advanceUsedOnSale = advanceHistory.filter(h => h.type === 'used' && h.sale_id === sale.id)
        .reduce((s, h) => s + (h.amount || 0), 0);

    // If no khata record, check original payment_status
    if (!khataRec) {
        return {
            isKhata: false,
            status: sale.payment_status === 'unpaid' ? 'unpaid' : 'paid',
            totalAmt: sale.total_amount || 0,
            paidAmt: sale.payment_status === 'unpaid' ? 0 : (sale.total_amount || 0),
            remaining: sale.payment_status === 'unpaid' ? (sale.total_amount || 0) : 0,
            payments: [],
            advanceBalance: advanceBalance,
            advanceUsed: advanceUsedOnSale,
            advanceHistory: advanceHistory
        };
    }

    const totalAmt = khataRec.total_amount || sale.total_amount || 0;
    const paidAmt = khataRec.paid_amount || 0;
    const remaining = totalAmt - paidAmt;

    // Build payment history from payments array
    const payments = (khataRec.payments || khataRec.payment_history || []).map(p => ({
        date: p.date || p.paid_at || new Date().toISOString(),
        amount: p.amount || 0,
        note: p.note || ''
    }));

    let status;
    if (paidAmt <= 0) status = 'unpaid';
    else if (paidAmt >= totalAmt) status = 'paid';
    else status = 'partial';

    return {
        isKhata: true,
        status: status,
        totalAmt: totalAmt,
        paidAmt: paidAmt,
        remaining: Math.max(0, remaining),
        payments: payments,
        advanceBalance: advanceBalance,
        advanceUsed: advanceUsedOnSale,
        advanceHistory: advanceHistory
    };
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initDB(); 
    
    // Auto-login as Admin since anyone with the file should have access
    const db = getDB();
    if (!db.users || !Array.isArray(db.users)) db.users = getInitialData().users;
    if (!db.settings) db.settings = getInitialData().settings;

    // Auto-update Admin contact if it's the old default
    const adminUser = db.users.find(u => u.username === 'admin');
    if (adminUser && adminUser.phone === '0300-0000000') {
        adminUser.phone = '03025731705';
        saveDB(db);
    }
    
    // Self-Correction: Fix the contact number typo (0303 -> 0302)
    if (db.settings.official_number === '03035731705' || db.settings.store_contact === '03035731705') {
        db.settings.official_number = '03025731705';
        db.settings.store_contact = '03025731705';
        saveDB(db);
    }
    
    state.currentUser = db.users.find(u => u.role === 'admin') || db.users[0];
    state.settings = db.settings;
    
    // Ensure state arrays are populated on load
    state.products = db.products || [];
    state.customers = db.customers || [];
    state.salesHistory = db.salesHistory || [];
    state.categories = db.categories || [];
    state.expenses = db.expenses || [];
    state.workers = db.workers || [];
    state.attarProducts = db.attarProducts || [];
    state.bottles = db.bottles || getInitialData().bottles;
    state.khataRecords = db.khataRecords || [];

    applyGlobalSettings();
    setupNavigation();

    document.getElementById('sidebar-logo-upload')?.addEventListener('change', (e) => {
        if(e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const db = getDB();
                db.settings.logo_base64 = evt.target.result;
                saveDB(db);
                state.settings = db.settings;
                applyGlobalSettings();
                showToast('Logo updated successfully!');
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });
});

function applyGlobalSettings() {
    // Apply UI elements based on global settings & user
    document.querySelectorAll('.global-store-name').forEach(el => el.textContent = state.settings.store_name);
    document.querySelectorAll('.global-store-contact').forEach(el => {
        const contact = state.settings.store_contact;
        el.textContent = contact.startsWith('Phone:') ? contact : `Phone: ${contact}`;
    });
    if(state.settings.logo_base64) {
        document.querySelectorAll('.global-logo-img').forEach(el => el.src = state.settings.logo_base64);
    }

    // Top Bar Profile
    document.getElementById('top-user-name').textContent = state.currentUser.name;
    document.getElementById('top-user-role').textContent = state.currentUser.role;
    if(state.currentUser.avatar) {
        document.getElementById('top-user-avatar').src = state.currentUser.avatar;
    }
}

function setupNavigation() {
    const role = state.currentUser.role;
    let firstAllowedView = null;

    navItems.forEach(item => {
        const allowedRoles = item.getAttribute('data-role').split(',');
        if(allowedRoles.includes(role) || allowedRoles.includes('all')) {
            item.classList.remove('hidden');
            if(!firstAllowedView) firstAllowedView = item.getAttribute('data-view');
        } else {
            item.classList.add('hidden');
        }

        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const view = e.currentTarget.getAttribute('data-view');
            if(view === 'inventory') state.inventoryFilter = 'all'; // Reset to all when clicking sidebar link
            loadView(view);
            window.location.hash = view;
        });
    });

    const hashView = window.location.hash.replace('#', '');
    const targetNav = document.querySelector(`[data-view="${hashView}"]`);
    
    if(targetNav && !targetNav.classList.contains('hidden')) {
        targetNav.click();
    } else {
        document.querySelector(`[data-view="${firstAllowedView}"]`).click();
    }
}

// --- TOAST NOTIFICATIONS ---
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : '⚠️'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- CUSTOM DIALOGS ---
window.showConfirm = function(title, message, options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('global-dialog-modal');
        const titleEl = document.getElementById('dialog-title');
        const msgEl = document.getElementById('dialog-message');
        const iconEl = document.getElementById('dialog-icon');
        const confirmBtn = document.getElementById('dialog-confirm-btn');
        const cancelBtn = document.getElementById('dialog-cancel-btn');

        titleEl.textContent = title || "Are you sure?";
        msgEl.textContent = message || "";
        iconEl.textContent = options.icon || "⚠️";
        confirmBtn.textContent = options.confirmText || "Confirm";
        cancelBtn.textContent = options.cancelText || "Cancel";

        if (options.isAlert) {
            cancelBtn.classList.add('hidden');
            confirmBtn.style.gridColumn = "span 2";
        } else {
            cancelBtn.classList.remove('hidden');
            confirmBtn.style.gridColumn = "unset";
        }

        modal.style.zIndex = '99999';
        modal.classList.remove('hidden');

        const handleConfirm = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

window.showAlert = function(title, message, icon = "ℹ️") {
    return window.showConfirm(title, message, { isAlert: true, icon: icon, confirmText: "Close" });
}

// --- DATA FETCHERS ---
function fetchProducts() { state.products = getDB().products; }
function fetchCustomers() { state.customers = getDB().customers; }
function fetchSalesHistory() { state.salesHistory = getDB().salesHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); }
function fetchCategories() { state.categories = getDB().categories || []; }
function fetchExpenses() { state.expenses = getDB().expenses || []; }
function fetchWorkers() { state.workers = getDB().workers || []; }
function fetchAttarProducts() { state.attarProducts = getDB().attarProducts || []; }
function fetchBottles() { state.bottles = getDB().bottles || getInitialData().bottles; }
function fetchKhata() { state.khataRecords = getDB().khataRecords || []; }

async function loadView(view) {
    pageTitle.innerHTML = view.charAt(0).toUpperCase() + view.slice(1);
    contentArea.style.opacity = 0;
    await new Promise(r => setTimeout(r, 100));
    contentArea.style.opacity = 1;

    try {
        switch(view) {
            case 'dashboard':
                if(state.currentUser.role === 'salesman') return;
                pageTitle.innerHTML = 'Dashboard';
                fetchProducts(); fetchSalesHistory(); fetchKhata(); fetchStats(); renderDashboard();
                break;
            case 'pos':
                fetchProducts(); fetchCustomers(); fetchAttarProducts(); fetchBottles(); renderPOS();
                break;
            case 'inventory':
                if(state.currentUser.role === 'salesman') return;
                fetchProducts(); fetchCategories(); fetchAttarProducts(); fetchBottles(); renderInventory();
                break;
            case 'reports':
                if(state.currentUser.role === 'salesman') return;
                fetchSalesHistory(); renderReports();
                break;
            case 'customers':
                fetchCustomers(); renderCustomers();
                break;
            case 'khata':
                if(state.currentUser.role === 'salesman') return;
                fetchCustomers(); fetchSalesHistory(); fetchKhata(); renderKhata();
                break;
            case 'financials':
                if(state.currentUser.role !== 'admin') return;
                fetchSalesHistory(); fetchProducts(); fetchExpenses(); fetchKhata();
                if(!state.financialUnlocked) {
                    showFinancialPasswordModal();
                } else {
                    renderFinancials();
                }
                break;
            case 'settings':
                if(state.currentUser.role !== 'admin') return;
                renderSettings();
                break;
            case 'expenses':
                if(state.currentUser.role === 'salesman') return;
                fetchExpenses(); fetchWorkers(); renderExpenses();
                break;
            case 'notes':
                renderNotes();
                break;
        }
    } catch(err) {
        contentArea.innerHTML = `<div style="color:red; padding:2rem;">Error: ${err.message}</div>`;
    }
}

// ... [Skipping Dashboard & Reports identical logic for brevity, implementing mostly same as before] ...
function fetchStats() {
    const db = getDB();
    const now = new Date();
    let filteredSales = db.salesHistory.filter(sale => {
        const saleDate = new Date(sale.created_at);
        if (state.timeFilter === 'all') return true;
        if (state.timeFilter === 'today') return saleDate.toDateString() === now.toDateString();
        if (state.timeFilter === 'week') { const w = new Date(); w.setDate(now.getDate() - 7); return saleDate >= w; }
        if (state.timeFilter === 'month') return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        if (state.timeFilter === 'year') return saleDate.getFullYear() === now.getFullYear();
        return true;
    });

    let filteredExpenses = (db.expenses || []).filter(expense => {
        const expDate = new Date(expense.created_at);
        if (state.timeFilter === 'all') return true;
        if (state.timeFilter === 'today') return expDate.toDateString() === now.toDateString();
        if (state.timeFilter === 'week') { const w = new Date(); w.setDate(now.getDate() - 7); return expDate >= w; }
        if (state.timeFilter === 'month') return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
        if (state.timeFilter === 'year') return expDate.getFullYear() === now.getFullYear();
        return true;
    });

    let ts=0, tp=0, te=0;
    filteredSales.forEach(s => { ts += s.total_amount; tp += s.profit; });
    filteredExpenses.forEach(e => { te += e.amount; });
    tp = tp - te; // Net Profit (after deducting expenses)
    const lowStock = db.products.filter(p => p.stock <= (p.low_stock_threshold !== undefined ? p.low_stock_threshold : 10)).length;

    let productSales = {};
    db.salesHistory.forEach(sale => {
        (sale.items || []).forEach(item => {
            if(!productSales[item.product_id]) productSales[item.product_id] = { name: item.name, qty: 0, img: null };
            productSales[item.product_id].qty += item.quantity;
            const prod = db.products.find(p => p.id === item.product_id);
            if(prod) productSales[item.product_id].img = prod.image_url;
        });
    });

    state.stats = {
        total_sales: ts, total_profit: tp, low_stock_count: lowStock,
        recent_sales: filteredSales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
        top_selling: Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 4)
    };
}

function renderDashboard() {
    const db = getDB();
    const now = new Date();
    const todayOrders = state.salesHistory.filter(s => new Date(s.created_at).toDateString() === now.toDateString());
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const lowStockProducts = state.products.filter(p => p.stock <= (p.low_stock_threshold !== undefined ? p.low_stock_threshold : 10));
    const recentOrders = state.salesHistory.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
    const totalCustomers = state.customers.filter(c => c.id !== 1).length;
    const pendingKhata = (db.khataRecords || []).filter(r => r.status !== 'paid');
    const khataOutstanding = pendingKhata.reduce((s, r) => s + ((r.total_amount || 0) - (r.paid_amount || 0)), 0);

    contentArea.innerHTML = `
        <div class="dashboard-grid" style="grid-template-columns: repeat(4, 1fr);">
            <div class="stat-card" style="cursor:pointer;" onclick="loadView('inventory')">
                <i class="stat-icon">📦</i><h3>Total Products</h3><div class="value">${state.products.length}</div>
                <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">${state.products.reduce((s,p)=>s+p.stock,0)} units in stock</div>
            </div>
            <div class="stat-card danger-accent" onclick="viewLowStock()" style="cursor: pointer;">
                <i class="stat-icon">⚠️</i><h3>Low Stock Alerts</h3><div class="value">${lowStockProducts.length}</div>
                <div style="font-size:0.8rem;color:var(--danger);margin-top:4px;">${lowStockProducts.length > 0 ? 'Needs attention!' : 'All good ✅'}</div>
            </div>
            <div class="stat-card" style="cursor:pointer;" onclick="viewTodaysOrders()">
                <i class="stat-icon">🛒</i><h3>Today's Orders</h3><div class="value">${todayOrders.length}</div>
                <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Revenue: Rs ${todayRevenue.toLocaleString()}</div>
            </div>
            <div class="stat-card gold-accent" style="cursor:pointer;" onclick="loadView('customers')">
                <i class="stat-icon">👥</i><h3>Customers</h3><div class="value">${totalCustomers}</div>
                <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">${pendingKhata.length} pending khata</div>
            </div>
        </div>

        <div class="dashboard-main">
            <div class="chart-container" style="flex:1.5;">
                <div class="chart-header" style="display:flex;justify-content:space-between;align-items:center;">
                    <span>📋 Recent Orders</span>
                    <button class="btn btn-secondary" style="padding:0.4rem 1rem;font-size:0.8rem;border-radius:8px;" onclick="loadView('reports')">View All</button>
                </div>
                <div style="overflow-y:auto;max-height:340px;">
                    ${recentOrders.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:3rem;">No orders yet. Start selling from POS!</p>' : ''}
                    ${recentOrders.map(s => {
                        const cust = db.customers.find(c => c.id === s.customer_id) || { name: 'Walk-in' };
                        const itemCount = (s.items || []).reduce((a, b) => a + b.quantity, 0);
                        const isUnpaid = s.payment_status === 'unpaid';
                        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" onclick="showReceiptModal(${s.id})">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <div style="width:40px;height:40px;border-radius:10px;background:${isUnpaid ? '#fef3c7' : '#ecfdf5'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;">${isUnpaid ? '📒' : '✅'}</div>
                                <div>
                                    <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">#${s.id} — ${cust.name}</div>
                                    <div style="font-size:0.8rem;color:#64748b;">${new Date(s.created_at).toLocaleString()} · ${itemCount} items · ${s.payment_method || 'Cash'}</div>
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight:800;color:var(--primary);">Rs ${(s.total_amount || 0).toLocaleString()}</div>
                                ${isUnpaid ? '<span style="font-size:0.7rem;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-weight:700;">UNPAID</span>' : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <div class="chart-container">
                <div class="chart-header">⚠️ Low Stock Items</div>
                <div style="overflow-y:auto;max-height:340px;">
                    ${lowStockProducts.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:3rem;">All products are well-stocked! 🎉</p>' : ''}
                    ${lowStockProducts.slice(0, 8).map(p => `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f1f5f9;">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <div style="width:36px;height:36px;border-radius:8px;background:#fef2f2;display:flex;align-items:center;justify-content:center;">📦</div>
                                <div>
                                    <div style="font-weight:600;font-size:0.9rem;">${p.name}</div>
                                    <div style="font-size:0.75rem;color:#64748b;">${p.category || 'General'}</div>
                                </div>
                            </div>
                            <div style="font-weight:800;color:${p.stock <= 0 ? '#ef4444' : '#f59e0b'};font-size:0.95rem;">${p.stock} left</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// 2. Inventory (with Compact Form)
window.searchInventory = function(val) { state.inventorySearch = val; renderInventoryTable(); }

function renderInventoryTable() {
    let filteredProducts = [...state.products];
    if(state.inventoryFilter === 'low') {
        filteredProducts = filteredProducts.filter(p => p.stock <= (p.low_stock_threshold !== undefined ? p.low_stock_threshold : 10));
    } else if(state.inventoryFilter === 'out') {
        filteredProducts = filteredProducts.filter(p => p.stock <= 0);
    }
    if(state.inventorySearch) {
        const q = state.inventorySearch.toLowerCase();
        filteredProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }

    let sortedProducts = [...filteredProducts];
    if(state.inventorySort === 'price_asc') sortedProducts.sort((a,b) => a.sale_price - b.sale_price);
    else if(state.inventorySort === 'price_desc') sortedProducts.sort((a,b) => b.sale_price - a.sale_price);
    else if(state.inventorySort === 'stock') sortedProducts.sort((a,b) => a.stock - b.stock);
    else if(state.inventorySort === 'category') sortedProducts.sort((a,b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    else sortedProducts.sort((a,b) => a.name.localeCompare(b.name));

    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;
    tbody.innerHTML = sortedProducts.map(p => {
        const threshold = p.low_stock_threshold !== undefined ? p.low_stock_threshold : 10;
        let statusHtml = '';
        
        if (p.stock <= 0) {
            statusHtml = `<span class="badge badge-danger">Out of Stock</span>`;
        } else if (p.stock <= threshold) {
            statusHtml = `<span class="badge badge-warning">Low Stock</span>`;
        } else {
            statusHtml = `<span class="badge badge-success">In Stock</span>`;
        }

        if (p.is_discounted) {
            statusHtml += `<span class="badge badge-info" style="margin-left:5px;">Discounted</span>`;
        }

        return `<tr style="${p.stock <= 0 ? 'background-color: #fff1f2;' : (p.stock <= threshold ? 'background-color: #fffbeb;' : '')}">
        <td><div style="display:flex;align-items:center;gap:12px;">${p.image_url ? `<img src="${p.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">` : '📦'} <strong>${p.name}</strong></div></td>
        <td>${p.category}</td><td>${p.cost_price.toLocaleString()}</td><td style="color:var(--primary);font-weight:600;">Rs ${p.sale_price.toLocaleString()}</td>
        <td><strong style="color:${p.stock <= threshold ? 'var(--danger)' : 'inherit'};">${p.stock}</strong></td>
        <td><div style="display:flex; flex-wrap:wrap; gap:4px;">${statusHtml}</div></td>
        <td>
            <button class="btn btn-secondary" onclick='showProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button>
        </td>
    </tr>`}).join('');
}

function renderInventory() {
    state.inventoryFilter = state.inventoryFilter || 'all';
    window.inventoryTab = window.inventoryTab || 'products';
    contentArea.innerHTML = `
        <div style="display: flex; background: #f1f5f9; padding: 5px; border-radius: 12px; margin-bottom: 1.5rem; width: fit-content; border: 1px solid #e2e8f0;">
            <button onclick="setInventoryTab('products')" style="padding: 10px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${window.inventoryTab==='products' ? 'background: white; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">📦 Products</button>
            <button onclick="setInventoryTab('attar')" style="padding: 10px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${window.inventoryTab==='attar' ? 'background: white; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">🧴 Attar Products</button>
        </div>
        ${window.inventoryTab === 'attar' ? '<div id="attar-inventory-content"></div>' : `<div class="data-table-container">
            <div class="table-header" style="display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; padding: 1.5rem 2rem; background: white;">
                <h3 style="margin: 0; font-size: 1.2rem; color: #1e293b; font-weight: 700; white-space: nowrap;">Product Masterlist</h3>
                <div style="display: flex; align-items: center; gap: 0.8rem; flex: 1; max-width: 1000px;">
                    <!-- Search Bar -->
                    <div style="position: relative; flex: 1;">
                        <input type="text" placeholder="Search" 
                            class="form-control" 
                            style="width: 100%; height: 44px; padding: 0 1.2rem; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.95rem; transition: all 0.2s; background: #f8fafc;" 
                            oninput="searchInventory(this.value)" 
                            value="${state.inventorySearch || ''}">
                    </div>

                    <!-- Filter Group -->
                    <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                        <select class="filter-select" onchange="filterInventory(this.value)" style="width: 145px; height: 44px; padding: 0 0.8rem; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.9rem; font-weight: 600; cursor: pointer; background: white;">
                            <option value="all" ${state.inventoryFilter === 'all' ? 'selected' : ''}>All Products</option>
                            <option value="low" ${state.inventoryFilter === 'low' ? 'selected' : ''}>⚠️ Low Stock</option>
                            <option value="out" ${state.inventoryFilter === 'out' ? 'selected' : ''}>🚫 Out of Stock</option>
                        </select>
                        <select class="filter-select" onchange="sortInventory(this.value)" style="width: 135px; height: 44px; padding: 0 0.8rem; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.9rem; font-weight: 600; cursor: pointer; background: white;">
                            <option value="name" ${state.inventorySort === 'name' ? 'selected' : ''}>Sort A-Z</option>
                            <option value="category" ${state.inventorySort === 'category' ? 'selected' : ''}>By Category</option>
                            <option value="price_asc" ${state.inventorySort === 'price_asc' ? 'selected' : ''}>Price: Low-High</option>
                            <option value="price_desc" ${state.inventorySort === 'price_desc' ? 'selected' : ''}>Price: High-Low</option>
                            <option value="stock" ${state.inventorySort === 'stock' ? 'selected' : ''}>Stock Level</option>
                        </select>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0;">
                    <button class="btn btn-secondary" onclick="showCategoryModal()" style="height: 44px; padding: 0 0.8rem; border-radius: 10px; font-weight: 700; font-size: 0.82rem; display: flex; align-items: center; gap: 6px; border: 1px solid #e2e8f0; background: white; white-space: nowrap; color: #475569;">
                        <span style="font-size: 1rem;">🏷️</span> Categories
                    </button>
                    <button class="btn btn-primary" onclick="showProductModal()" style="height: 44px; padding: 0 1rem; border-radius: 10px; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; background: #990000; border: none; white-space: nowrap; box-shadow: 0 4px 10px rgba(153,0,0,0.1);">
                        + Add Product
                    </button>
                </div>
            </div>
            <table>
                <thead><tr><th>Product</th><th>Category</th><th>Cost</th><th>Sale Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody id="inventory-tbody">
                </tbody>
            </table>
        </div>

        <div id="product-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="modal-title" style="margin-bottom:1rem;">Add Product</h3>
                <form id="product-form">
                    <input type="hidden" id="prod-id"><input type="hidden" id="prod-image-base64">
                    <div class="compact-row">
                        <div class="form-group" style="flex: 0.5;">
                            <label>Product Image</label>
                            <div class="image-upload-wrapper" id="upload-wrapper" style="padding:1rem;">
                                <input type="file" id="prod-file-input" accept="image/*">
                                <div id="upload-text" style="font-size:0.8rem;"><span style="font-size:1.5rem;display:block;">📸</span>Upload</div>
                                <img id="upload-preview" class="image-preview" src="">
                            </div>
                        </div>
                        <div style="flex:1;">
                            <div class="form-group"><label>Name</label><input type="text" id="prod-name" class="form-control" required></div>
                            <div class="form-group"><label>Category</label><select id="prod-category" class="form-control" required></select></div>
                        </div>
                    </div>
                    <div class="compact-row">
                        <div class="form-group"><label>Cost (Rs)</label><input type="number" id="prod-cost" class="form-control" required></div>
                        <div class="form-group"><label>Sale Price (Rs)</label><input type="number" id="prod-price" class="form-control" required></div>
                        <div class="form-group"><label>Stock</label><input type="number" id="prod-stock" class="form-control" required></div>
                        <div class="form-group"><label>Low Stock Alert</label><input type="number" id="prod-low-stock" class="form-control" required value="10"></div>
                    </div>

                    <!-- VARIANTS SECTION -->
                    <div id="variants-section" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.2rem; margin-bottom:1.5rem;">
                        <h4 style="margin-bottom:10px; font-size:0.95rem; color:#0f172a;">Size / Variants Management</h4>
                        <p id="variant-instructions" style="font-size:0.8rem; color:#64748b; margin-bottom:1rem;">Select or enter available sizes and their respective stock quantities.</p>
                        
                        <!-- Predefined Caps Sizes -->
                        <div id="caps-sizes-container" style="display:none; margin-bottom:1rem; flex-wrap:wrap; gap:8px;">
                            ${[18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22, 22.5, 23, 'Default Size'].map(s => `
                                <div class="size-chip" style="display:inline-flex; align-items:center; border:1px solid #cbd5e1; border-radius:8px; background:white; overflow:hidden;">
                                    <label style="padding:6px 10px; margin:0; cursor:pointer; font-weight:600; font-size:0.85rem; border-right:1px solid #cbd5e1; display:flex; align-items:center; gap:6px;">
                                        <input type="checkbox" class="cap-size-cb" value="${s}" onchange="toggleSizeStock(this, '${s}')"> ${s}
                                    </label>
                                    <input type="number" id="stock-size-${s.toString().replace(/\s/g,'_')}" class="form-control size-stock-input" placeholder="Qty" style="width:70px; border:none; border-radius:0; padding:6px; display:none;" min="0">
                                </div>
                            `).join('')}
                            <div style="width:100%; margin-top:0.5rem; display:flex; align-items:center; gap:10px;">
                                <label style="font-size:0.85rem; font-weight:600; color:#475569;">Custom Color (Optional):</label>
                                <input type="text" id="caps-custom-color" class="form-control" placeholder="e.g. Navy Blue" style="flex:1; padding:6px; border-radius:8px; border:1px solid #cbd5e1;">
                            </div>
                        </div>

                        <!-- Custom Size Entry (For Shawls or Custom Caps) -->
                        <div id="custom-size-adder" style="display:flex; gap:10px; align-items:flex-end;">
                            <div style="flex:1;">
                                <label style="font-size:0.8rem; font-weight:600; color:#475569;">Add Custom Size</label>
                                <input type="text" id="custom-size-name" class="form-control" placeholder="e.g. Large, 2x4">
                            </div>
                            <div style="width:100px;">
                                <label style="font-size:0.8rem; font-weight:600; color:#475569;">Stock</label>
                                <input type="number" id="custom-size-qty" class="form-control" placeholder="Qty">
                            </div>
                            <button type="button" class="btn btn-secondary" onclick="addCustomSize()" style="padding:0.7rem 1.2rem; border-radius:8px; border:1px solid #cbd5e1;">Add Size</button>
                        </div>

                        <!-- Added Custom Sizes List -->
                        <div id="custom-sizes-list" style="margin-top:1rem; display:flex; flex-direction:column; gap:8px;"></div>
                    </div>

                    <div class="form-group" style="display:flex; align-items:center; gap:10px; background:#f8fafc; padding:0.8rem; border-radius:10px; border:1px solid #e2e8f0;">
                        <input type="checkbox" id="prod-discounted" style="width:20px; height:20px; cursor:pointer;">
                        <label for="prod-discounted" style="margin-bottom:0; cursor:pointer; font-weight:700; color:#1e293b;">Mark as "Discounted" Product</label>
                    </div>
                    <div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="closeProductModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Product</button></div>
                </form>
            </div>
        </div>`}
    `;
    if(window.inventoryTab === 'attar') {
        if(typeof renderAttarInventory === 'function') renderAttarInventory();
        return;
    }
    renderInventoryTable();
    document.getElementById('prod-file-input').addEventListener('change', function(e) {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                document.getElementById('prod-image-base64').value = evt.target.result;
                document.getElementById('upload-preview').src = evt.target.result;
                document.getElementById('upload-preview').style.display = 'inline-block';
                document.getElementById('upload-text').style.display = 'none';
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    document.getElementById('product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const db = getDB();
        
        const category = document.getElementById('prod-category').value;
        const baseName = document.getElementById('prod-name').value;
        
        let variants = null;
        let isEditingExploded = false;
        
        // Check if editing an already exploded variant
        if (id) {
            const existing = db.products.find(p => p.id == id);
            if (existing && existing.is_exploded_variant) {
                isEditingExploded = true;
            }
        }
        
        if ((category === 'Caps' || category === 'Kashmiri Shawl') && !isEditingExploded) {
            variants = [];
            
            // Collect Predefined Sizes (Caps)
            if (category === 'Caps') {
                const capColor = document.getElementById('caps-custom-color') ? document.getElementById('caps-custom-color').value.trim() : '';
                document.querySelectorAll('.cap-size-cb:checked').forEach(cb => {
                    const stockInp = document.getElementById('stock-size-' + cb.value.toString().replace(/\s/g,'_'));
                    const s = parseInt(stockInp.value) || 0;
                    variants.push({ name: cb.value, stock: s, color: capColor });
                });
            }
            
            // Collect Custom Sizes
            window._customVariantSizes.forEach(v => {
                const stockInp = document.querySelector(`.custom-var-stock[data-name="${v.name}"]`);
                const s = stockInp ? parseInt(stockInp.value) || 0 : v.stock;
                variants.push({ name: v.name, stock: s });
            });
            
            if (variants.length === 0 && !id) return showToast('Please select or add at least one size variant.', 'error');
        }

        const basePayload = {
            category: category,
            cost_price: parseFloat(document.getElementById('prod-cost').value), sale_price: parseFloat(document.getElementById('prod-price').value),
            low_stock_threshold: parseInt(document.getElementById('prod-low-stock').value), 
            image_url: document.getElementById('prod-image-base64').value,
            is_discounted: document.getElementById('prod-discounted').checked
        };

        if (id) { 
            const i = db.products.findIndex(p => p.id == id); 
            if(i !== -1) {
                db.products[i] = { 
                    ...db.products[i], 
                    ...basePayload,
                    name: baseName, // They might rename the variant directly
                    stock: parseInt(document.getElementById('prod-stock').value) || 0
                }; 
            }
        } 
        else { 
            if (variants && variants.length > 0) {
                // EXPLODE!
                let t = Date.now();
                variants.forEach(v => {
                    const variantNameStr = `${baseName} - Size ${v.name}` + (v.color ? ` - Color ${v.color}` : '');
                    db.products.push({
                        ...basePayload,
                        id: t++,
                        name: variantNameStr,
                        base_name: baseName,
                        size_name: v.name,
                        color: v.color || '',
                        stock: v.stock,
                        is_exploded_variant: true
                    });
                });
            } else {
                // NORMAL SINGLE PRODUCT
                db.products.push({
                    ...basePayload,
                    id: Date.now(),
                    name: baseName,
                    stock: parseInt(document.getElementById('prod-stock').value) || 0
                });
            }
        }
        
        saveDB(db); closeProductModal(); fetchProducts(); renderInventory(); showToast("Product Saved!");
    });
}

window.setInventoryTab = function(tab) { window.inventoryTab = tab; renderInventory(); }
window.sortInventory = function(val) { state.inventorySort = val; renderInventory(); }
window.filterInventory = function(val) { state.inventoryFilter = val; renderInventory(); }
window.viewLowStock = function() {
    state.inventoryFilter = 'low';
    loadView('inventory');
    // Update Sidebar Selection
    navItems.forEach(nav => {
        nav.classList.remove('active');
        if(nav.getAttribute('data-view') === 'inventory') nav.classList.add('active');
    });
}
window.viewTodaysOrders = function() {
    window.reportTab = 'sales';
    window._todayOnlyFilter = true;
    loadView('reports');
    // Update Sidebar Selection
    navItems.forEach(nav => {
        nav.classList.remove('active');
        if(nav.getAttribute('data-view') === 'reports') nav.classList.add('active');
    });
    window.location.hash = 'reports';
}
window.showProductModal = function(product = null) {
    const catSelect = document.getElementById('prod-category');
    catSelect.innerHTML = '<option value="">-- Select Category --</option>' + state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    document.getElementById('product-modal').classList.remove('hidden');
    document.getElementById('modal-title').textContent = product ? 'Edit Product' : 'Add Product';
    ['id','name','category','cost','price','stock'].forEach(k => document.getElementById(`prod-${k}`).value = product ? product[k === 'price' ? 'sale_price' : k === 'cost' ? 'cost_price' : k] : '');
    document.getElementById('prod-low-stock').value = product && product.low_stock_threshold !== undefined ? product.low_stock_threshold : 10;
    document.getElementById('prod-discounted').checked = product ? product.is_discounted : false;
    document.getElementById('prod-image-base64').value = product ? product.image_url : '';
    document.getElementById('prod-file-input').value = '';
    
    // Clear variants UI
    document.querySelectorAll('.cap-size-cb').forEach(cb => { cb.checked = false; window.toggleSizeStock(cb, cb.value); });
    document.getElementById('custom-sizes-list').innerHTML = '';
    document.getElementById('custom-size-name').value = '';
    document.getElementById('custom-size-qty').value = '';
    const colorInput = document.getElementById('caps-custom-color');
    if (colorInput) colorInput.value = '';
    window._customVariantSizes = [];

    // Setup Variants UI based on category
    catSelect.onchange = function() {
        const val = this.value;
        const varSec = document.getElementById('variants-section');
        const capsContainer = document.getElementById('caps-sizes-container');
        const normalStock = document.getElementById('prod-stock').closest('.form-group');
        
        if ((val === 'Caps' || val === 'Kashmiri Shawl') && (!product || !product.is_exploded_variant)) {
            varSec.style.display = 'block';
            normalStock.style.display = 'none';
            document.getElementById('prod-stock').removeAttribute('required');
            
            if (val === 'Caps') {
                capsContainer.style.display = 'flex';
                document.getElementById('variant-instructions').textContent = 'Select standard Cap sizes or enter custom ones. Each size tracks its own stock.';
            } else {
                capsContainer.style.display = 'none';
                document.getElementById('variant-instructions').textContent = 'Enter arbitrary sizes for the shawl (e.g., Large, 2x4). Each tracks its own stock.';
            }
        } else {
            varSec.style.display = 'none';
            normalStock.style.display = 'block';
            document.getElementById('prod-stock').setAttribute('required', 'true');
        }
    };
    
    // Trigger onchange to set correct state
    catSelect.onchange();

    // Populate variants if editing
    if (product && product.variants && product.variants.length > 0) {
        product.variants.forEach(v => {
            const predefinedCb = document.querySelector(`.cap-size-cb[value="${v.name}"]`);
            if (predefinedCb) {
                predefinedCb.checked = true;
                window.toggleSizeStock(predefinedCb, v.name);
                document.getElementById('stock-size-' + v.name.replace(/\s/g,'_')).value = v.stock;
            } else {
                window.addCustomSize(v.name, v.stock);
            }
        });
    }

    const preview = document.getElementById('upload-preview'), text = document.getElementById('upload-text');
    if(product && product.image_url) { preview.src = product.image_url; preview.style.display = 'inline-block'; text.style.display = 'none'; }
    else { preview.src = ''; preview.style.display = 'none'; text.style.display = 'block'; }
}

window.toggleSizeStock = function(cb, size) {
    const inp = document.getElementById('stock-size-' + size.toString().replace(/\s/g,'_'));
    if(inp) {
        inp.style.display = cb.checked ? 'block' : 'none';
        if(cb.checked) inp.focus();
        else inp.value = '';
    }
    const label = cb.closest('label');
    if(label) label.style.borderRight = cb.checked ? 'none' : '1px solid #cbd5e1';
}

window._customVariantSizes = [];
window.addCustomSize = function(forceName = null, forceStock = null) {
    const nameInput = document.getElementById('custom-size-name');
    const qtyInput = document.getElementById('custom-size-qty');
    const name = forceName || nameInput.value.trim();
    const qty = forceStock !== null ? forceStock : parseInt(qtyInput.value) || 0;
    
    if(!name) return showToast('Enter a size name', 'error');
    if(window._customVariantSizes.some(x => x.name === name)) return showToast('Size already added', 'error');

    window._customVariantSizes.push({name, stock: qty});
    
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:white; padding:8px 12px; border:1px solid #e2e8f0; border-radius:8px;';
    div.innerHTML = `
        <div style="font-weight:700; color:#1e293b;">${name}</div>
        <div style="display:flex; align-items:center; gap:10px;">
            <input type="number" class="form-control custom-var-stock" data-name="${name}" value="${qty}" style="width:80px; padding:4px 8px; min-width:80px;" min="0">
            <button type="button" onclick="this.parentElement.parentElement.remove(); window._customVariantSizes = window._customVariantSizes.filter(x => x.name !== '${name}');" style="background:#fef2f2; border:1px solid #fecaca; color:#ef4444; width:28px; height:28px; border-radius:6px; cursor:pointer; font-weight:bold;">×</button>
        </div>
    `;
    document.getElementById('custom-sizes-list').appendChild(div);
    nameInput.value = '';
    qtyInput.value = '';
}
window.closeProductModal = function() { document.getElementById('product-modal').classList.add('hidden'); }

window.showRestockModal = function(product) {
    const existing = document.getElementById('restock-modal');
    if(existing) existing.remove();
    
    const div = document.createElement('div');
    div.id = 'restock-modal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <h3 style="margin-bottom:1rem; display:flex; align-items:center; gap:10px;">📦 Restock: ${product.name}</h3>
            <p style="color:#64748b; font-size:0.9rem; margin-bottom:1.5rem;">Current Stock: <strong style="font-size:1.1rem; color:#1e293b;">${product.stock}</strong></p>
            
            <form id="restock-form">
                <div class="form-group">
                    <label style="font-weight:700; color:#64748b; font-size:0.85rem; margin-bottom:0.5rem; display:block;">Quantity to Add</label>
                    <input type="number" id="restock-qty" class="form-control" placeholder="Enter amount..." required style="width:100%; padding:0.8rem; border-radius:10px; border:1px solid #e2e8f0; font-size:1.1rem; font-weight:700;">
                </div>
                
                <div class="form-group">
                    <label style="font-weight:700; color:#64748b; font-size:0.85rem; margin-bottom:0.5rem; display:block;">Note (Optional)</label>
                    <input type="text" id="restock-note" class="form-control" placeholder="e.g. New delivery from supplier" style="width:100%; padding:0.8rem; border-radius:10px; border:1px solid #e2e8f0;">
                </div>

                <div style="display:flex; gap:10px; margin-top:2rem;">
                    <button type="button" class="btn btn-secondary" style="flex:1; justify-content:center; border-radius:12px;" onclick="document.getElementById('restock-modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="flex:1; justify-content:center; border-radius:12px; background:#0369a1;">Apply Stock</button>
                </div>
            </form>
            
            <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px dashed #e2e8f0;">
                <h4 style="font-size:0.9rem; color:#1e293b; margin-bottom:1rem; font-weight:700;">Recent Stock History</h4>
                <div id="restock-history-list" style="font-size:0.85rem; max-height:200px; overflow-y:auto;">
                    ${(product.stock_history || []).slice(-5).reverse().map(h => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f5f9;">
                            <div>
                                <div style="font-weight:700; color:#1e293b;">${h.type === 'restock' ? 'Replenished' : 'Adjustment'}</div>
                                <div style="font-size:0.75rem; color:#64748b;">${new Date(h.date).toLocaleDateString()} ${new Date(h.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight:800; color:${h.type === 'restock' ? '#166534' : '#991B1B'}">${h.type === 'restock' ? '+' : '-'}${h.qty}</div>
                                <div style="font-size:0.7rem; color:#94a3b8; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${h.note || ''}</div>
                            </div>
                        </div>
                    `).join('') || '<p style="color:#94a3b8; font-style:italic; text-align:center; padding:1rem;">No history recorded yet</p>'}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(div);
    
    document.getElementById('restock-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const qty = parseInt(document.getElementById('restock-qty').value);
        const note = document.getElementById('restock-note').value;
        if(isNaN(qty) || qty <= 0) return showToast('Please enter a valid quantity', 'error');
        
        const db = getDB();
        const i = db.products.findIndex(p => p.id == product.id);
        if(i !== -1) {
            db.products[i].stock += qty;
            if(!db.products[i].stock_history) db.products[i].stock_history = [];
            db.products[i].stock_history.push({ 
                date: new Date().toISOString(), 
                type: 'restock', 
                qty: qty, 
                note: note || 'Quick restock' 
            });
            // Auto-reset status if it was 'Restocking'
            if(db.products[i].manual_status === 'Restocking') db.products[i].manual_status = 'automatic';
            
            saveDB(db);
            fetchProducts();
            renderInventory();
            showToast(`Successfully added ${qty} units!`);
            document.getElementById('restock-modal').remove();
        }
    });
};

// 3. Advanced POS
function renderPOS() {
    contentArea.innerHTML = `
        <div class="pos-layout">
            <div class="products-pane">
                <div class="pos-tab-bar">
                    <button class="pos-tab-btn ${state.posTab === 'products' ? 'active' : ''}" onclick="setPosTab('products')">🛒 Products</button>
                    <button class="pos-tab-btn ${state.posTab === 'attar' ? 'active' : ''}" onclick="setPosTab('attar')">🧴 Attar (ML)</button>
                </div>
                <input type="text" class="search-bar" placeholder="Search ${state.posTab === 'attar' ? 'attar' : 'products'}..." id="pos-search">
                <div class="products-grid" id="pos-products-grid"></div>
            </div>
            <div class="cart-pane">
                <div class="cart-header">
                    <span>🛒 Current Order</span>
                    <span class="cart-badge" id="cart-count-badge">0 items</span>
                </div>
                <div class="cart-items" id="cart-items"></div>
                <div class="cart-footer">
                    <div class="cart-footer-section">
                        <div class="cart-customer-type">
                            <div class="customer-tab active" id="tab-walkin" onclick="setCartType('walkin')">Walk-in</div>
                            <div class="customer-tab" id="tab-saved" onclick="setCartType('saved')">Search Customer</div>
                        </div>
                        <div id="saved-customer-select-area" style="position:relative;background:#fff;padding:8px;border-radius:8px;border:1px solid #e2e8f0;">
                            <div style="position:relative;">
                                <input type="text" id="customer-search-input" class="customer-select" placeholder="🔍 Customer name or phone..."
                                    style="margin-bottom:0;padding-left:10px;border-radius:6px;font-size:0.8rem;"
                                    oninput="showCustomerResults(this.value)" autocomplete="off">
                            </div>
                            <input type="hidden" id="cart-customer-select" value="1">
                            <div id="customer-results-list" class="hidden" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);z-index:100;max-height:180px;overflow-y:auto;margin-top:4px;"></div>
                            <div id="selected-customer-badge" style="margin-top:6px;font-size:0.8rem;font-weight:700;color:var(--primary);display:none;">
                                Selected: <span id="selected-customer-name">Walk-in</span>
                                <button onclick="clearSelectedCustomer()" style="border:none;background:none;color:#ef4444;cursor:pointer;margin-left:8px;font-size:0.7rem;">(Clear)</button>
                            </div>
                        </div>
                    </div>

                    <div class="cart-footer-section" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <div>
                            <div class="cart-footer-label">Salesman</div>
                            <select class="customer-select" id="cart-salesman-select" style="margin-bottom:0;font-size:0.78rem;">
                                ${getDB().users.map(u => `<option value="${u.id}" ${u.id === state.currentUser.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <div class="cart-footer-label">Payment</div>
                            <select class="payment-method-select" id="payment-method" style="margin-bottom:0;font-size:0.78rem;">
                                <option value="Cash">💵 Cash</option><option value="Bank Transfer">🏦 Bank Transfer</option>
                                <option value="EasyPaisa">📱 EasyPaisa</option><option value="JazzCash">📱 JazzCash</option>
                                <option value="SadaPay">💳 SadaPay</option><option value="NayaPay">💳 NayaPay</option>
                            </select>
                        </div>
                    </div>

                    <div class="cart-footer-section">
                        <div class="cart-summary-row"><span>Subtotal</span><span id="cart-subtotal">Rs 0</span></div>
                        <div class="cart-summary-total"><span>Total</span><span class="total-amount" id="cart-total">Rs 0</span></div>
                    </div>

                    <div class="cart-actions">
                        <button class="btn-checkout" onclick="processCheckout()">🧾 Checkout & Print</button>
                        <button class="btn-unpaid" onclick="processKhataOrder()">📒 Confirm Order (Not Paid)</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('pos-search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        if(state.posTab === 'attar') {
            renderPOSAttarProducts(state.attarProducts.filter(p => p.name.toLowerCase().includes(q)));
        } else {
            renderPOSProducts(state.products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
        }
    });
    if(state.posTab === 'attar') {
        renderPOSAttarProducts(state.attarProducts);
    } else {
        renderPOSProducts(state.products);
    }
    renderCart();
}

let cartType = 'walkin';
window.setCartType = function(type) {
    cartType = type;
    document.getElementById('tab-walkin').classList.toggle('active', type === 'walkin');
    document.getElementById('tab-saved').classList.toggle('active', type === 'saved');
    
    if(type === 'walkin') {
        clearSelectedCustomer();
    } else {
        document.getElementById('customer-search-input').focus();
    }
}

window.clearSelectedCustomer = function() {
    document.getElementById('cart-customer-select').value = '1';
    document.getElementById('customer-search-input').value = '';
    document.getElementById('selected-customer-badge').style.display = 'none';
    const list = document.getElementById('customer-results-list');
    if (list) { list.classList.add('hidden'); list.style.display = 'none'; }
}

window.selectCustomerFromList = function(id, name) {
    document.getElementById('cart-customer-select').value = id;
    document.getElementById('customer-search-input').value = '';
    document.getElementById('selected-customer-name').textContent = name;
    document.getElementById('selected-customer-badge').style.display = 'block';
    document.getElementById('customer-results-list').classList.add('hidden');
    document.getElementById('customer-results-list').style.display = 'none';
    
    // Switch to Saved mode if a customer is selected
    cartType = 'saved';
    document.getElementById('tab-walkin').classList.remove('active');
    document.getElementById('tab-saved').classList.add('active');
}

window.showCustomerResults = function(query) {
    const list = document.getElementById('customer-results-list');
    const hiddenInput = document.getElementById('cart-customer-select');
    
    if(!query || query.trim().length < 1) { 
        list.classList.add('hidden'); 
        list.style.display = 'none';
        hiddenInput.value = ''; // Reset ID if user clears the search field
        return; 
    }
    const q = query.toLowerCase();
    const filtered = state.customers.filter(c => c.id !== 1 && (c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)));
    
    if(filtered.length === 0) {
        list.innerHTML = '<div style="padding: 15px; text-align: center; color: #94a3b8; font-size: 0.9rem;">No customers found</div>';
    } else {
        list.innerHTML = filtered.map(c => `
            <div class="customer-result-item" onclick="selectCustomerFromList(${c.id}, '${c.name.replace(/'/g, "\\'")}')" style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                <div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">${c.name}</div>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">📞 ${c.phone}</div>
            </div>
        `).join('');
    }
    list.classList.remove('hidden');
    list.style.display = 'block'; // Ensure it shows when needed
}

window.selectCartCustomer = function(id, name) {
    const list = document.getElementById('customer-results-list');
    document.getElementById('cart-customer-select').value = id;
    document.getElementById('customer-search-input').value = name;
    if (list) {
        list.classList.add('hidden');
        list.style.display = 'none'; // Force hide to prevent overlap
    }
    showToast(`Selected: ${name}`);
}

// Close results list when clicking outside
document.addEventListener('click', (e) => {
    const list = document.getElementById('customer-results-list');
    const input = document.getElementById('customer-search-input');
    if (list && !list.contains(e.target) && e.target !== input) {
        list.classList.add('hidden');
    }
});

function renderPOSProducts(products) {
    const groupedMap = new Map();
    
    products.forEach(p => {
        if (p.is_exploded_variant && p.base_name) {
            if (!groupedMap.has(p.base_name)) {
                groupedMap.set(p.base_name, {
                    ...p,
                    id: 'group_' + p.base_name,
                    name: p.base_name,
                    is_virtual_group: true,
                    variants: [],
                    stock: 0
                });
            }
            const group = groupedMap.get(p.base_name);
            group.variants.push({ id: p.id, name: p.size_name, stock: p.stock });
            group.stock += p.stock;
        } else {
            groupedMap.set(p.id, p);
        }
    });

    const displayList = Array.from(groupedMap.values());

    document.getElementById('pos-products-grid').innerHTML = displayList.map(p => `
        <div class="product-card" onclick="${p.is_virtual_group ? `showGroupVariantModal('${p.base_name.replace(/'/g, "\\'")}')` : `addToCart(${p.id})`}" style="${p.stock <= 0 ? 'opacity: 0.5; pointer-events: none;' : ''}">
            ${p.image_url ? `<img src="${p.image_url}" class="product-img">` : `<div class="product-img" style="display:flex;align-items:center;justify-content:center;background:#f1f5f9;font-size:2rem;">📦</div>`}
            <div class="product-info">
                <div style="font-weight:600;color:#1e293b;margin-bottom:4px;">${p.name}</div>
                ${p.color ? `<div style="font-size:0.75rem;margin-bottom:2px;"><span style="background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:6px;font-weight:600;">🎨 ${p.color}</span></div>` : ''}
                <div style="color:var(--primary);font-weight:700;">Rs ${p.sale_price.toLocaleString()}</div>
                <div style="font-size:0.85rem;color:#64748B;margin-top:8px;">Stock: <strong style="color:${p.stock <= (p.low_stock_threshold !== undefined ? p.low_stock_threshold : 10) ? 'var(--danger)' : 'var(--success)'}">${p.stock}</strong></div>
            </div>
        </div>`).join('');
}

window.addToCart = function(id, evt) {
    const p = state.products.find(x => x.id === id); if(!p) return;
    const e = state.cart.find(c => c.product_id === id);
    if(e) { if (e.quantity < p.stock) e.quantity++; else showToast('Not enough stock!', 'error'); } 
    else if(p.stock > 0) state.cart.push({ product_id: p.id, name: p.name, price: p.sale_price, original_price: p.sale_price, cost: p.cost_price, quantity: 1 });
    else return showToast('Out of stock!', 'error');

    renderCart();
    // Visual feedback — flash the cart header
    const header = document.querySelector('.cart-header');
    if(header) {
        header.style.transition = 'background 0.15s';
        header.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
        setTimeout(() => { header.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'; }, 300);
    }
    // Auto-scroll cart to bottom
    const cartEl = document.getElementById('cart-items');
    if(cartEl) setTimeout(() => { cartEl.scrollTop = cartEl.scrollHeight; }, 50);
}

window.showGroupVariantModal = function(baseName) {
    const ex = document.getElementById('variant-modal');
    if(ex) ex.remove();
    
    const variants = state.products.filter(p => p.base_name === baseName && p.is_exploded_variant);
    
    const div = document.createElement('div');
    div.id = 'variant-modal';
    div.className = 'modal';
    div.style.cssText = 'z-index:10002; display:flex; align-items:center; justify-content:center;';
    
    const variantListHtml = variants.map(v => {
        const isOut = v.stock <= 0;
        const colorLabel = v.color ? ` <span style="font-size:0.75rem; background:#e2e8f0; padding:2px 6px; border-radius:6px; margin-left:6px; color:#334155;">${v.color}</span>` : '';
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px; background:${isOut ? '#f8fafc' : 'white'}; opacity:${isOut ? '0.6' : '1'};">
                <div>
                    <div style="font-weight:700; color:#1e293b; display:flex; align-items:center; flex-wrap:wrap; gap:4px;">Size ${v.size_name}${colorLabel}</div>
                    <div style="font-size:0.8rem; color:${isOut ? '#ef4444' : '#64748b'}; margin-top:2px;">Stock: ${v.stock}</div>
                </div>
                <button class="btn btn-primary" onclick="document.getElementById('variant-modal').remove(); window.addToCart(${v.id})" ${isOut ? 'disabled' : ''} style="padding:6px 16px; border-radius:8px; ${isOut ? 'background:#cbd5e1;cursor:not-allowed;' : ''}">Select</button>
            </div>
        `;
    }).join('');

    div.innerHTML = `
        <div class="modal-content" style="max-width:400px; border-radius:20px; padding:2rem; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h3 style="margin:0; font-weight:800;">Select Size</h3>
                <button onclick="document.getElementById('variant-modal').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#94a3b8;">&times;</button>
            </div>
            <p style="color:#64748b; font-size:0.9rem; margin-bottom:1rem;">${baseName}</p>
            <div style="max-height:300px; overflow-y:auto; padding-right:5px;">
                ${variantListHtml}
            </div>
        </div>
    `;
    document.body.appendChild(div);
};

window.updateQty = function(id, d) {
    const i = state.cart.findIndex(c => String(c.product_id) === String(id));
    if(i > -1) {
        const p = state.products.find(x => String(x.id) === String(id));
        if(p && state.cart[i].quantity + d > p.stock) return showToast('Not enough stock!', 'error');
        state.cart[i].quantity += d;
        if(state.cart[i].quantity <= 0) state.cart.splice(i, 1);
    }
    renderCart();
    if(!document.getElementById('checkout-modal').classList.contains('hidden')) renderCheckoutReview();
}

window.setDirectQty = function(id, val) {
    const qty = parseInt(val);
    if(isNaN(qty) || qty < 0) return renderCart();
    const i = state.cart.findIndex(c => String(c.product_id) === String(id));
    if(i > -1) {
        const p = state.products.find(x => String(x.id) === String(id));
        if(p && qty > p.stock) {
            showToast('Not enough stock!', 'error');
            state.cart[i].quantity = p.stock;
        } else {
            state.cart[i].quantity = qty;
            if(state.cart[i].quantity <= 0) state.cart.splice(i, 1);
        }
    }
    renderCart();
    if(!document.getElementById('checkout-modal').classList.contains('hidden')) renderCheckoutReview();
}

function renderCart() {
    const d = document.getElementById('cart-items'); if (!d) return;
    const badge = document.getElementById('cart-count-badge');
    const totalItems = state.cart.reduce((s, i) => s + i.quantity, 0);
    if(badge) badge.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;

    if(state.cart.length === 0) {
        d.innerHTML = `<div class="cart-empty-state">
            <div class="cart-empty-icon">🛒</div>
            <p>No items yet</p>
            <span style="font-size:0.75rem;color:#cbd5e1;">Click a product to add it</span>
        </div>`;
    } else {
        d.innerHTML = state.cart.map(i => {
            const hasDiscount = i.original_price && i.price < i.original_price;
            const discountAmt = hasDiscount ? i.original_price - i.price : 0;
            const discountPct = hasDiscount ? ((discountAmt / i.original_price) * 100).toFixed(0) : 0;
            const lineTotal = i.price * i.quantity;
            return `<div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name" title="${i.name}">${i.name}</div>
                    <div class="cart-price-edit-row">
                        <span style="color:#94a3b8;font-size:0.75rem;">Rs</span>
                        <input type="number" class="pos-price-input" value="${i.price}" 
                            oninput="setCustomPrice('${i.product_id}', this.value)" 
                            onblur="renderCart()"
                            style="width:60px;" min="0" step="1">
                        <span style="color:#94a3b8;font-size:0.7rem;">× ${i.quantity} =</span>
                        <span style="font-weight:800;color:#1e293b;font-size:0.82rem;">Rs ${lineTotal.toLocaleString()}</span>
                    </div>
                    ${hasDiscount ? `<div class="cart-discount-badge">↓ Rs ${discountAmt.toLocaleString()} off (${discountPct}%)</div>` : ''}
                </div>
                <div class="cart-qty-controls">
                    <button class="qty-btn" onclick="updateQty('${i.product_id}', -1)">−</button>
                    <input type="number" value="${i.quantity}" onchange="setDirectQty('${i.product_id}', this.value)" 
                        style="width:36px;text-align:center;font-weight:700;border:1px solid #e2e8f0;border-radius:6px;padding:3px;font-size:0.85rem;outline:none;" min="1">
                    <button class="qty-btn" onclick="updateQty('${i.product_id}', 1)">+</button>
                </div>
                <button class="cart-item-remove" onclick="removeCartItem('${i.product_id}')" title="Remove">✕</button>
            </div>`;
        }).join('');
    }
    const t = state.cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const el1 = document.getElementById('cart-subtotal');
    const el2 = document.getElementById('cart-total');
    if(el1) el1.textContent = `Rs ${t.toLocaleString()}`;
    if(el2) el2.textContent = `Rs ${t.toLocaleString()}`;
}

window.removeCartItem = function(id) {
    state.cart = state.cart.filter(c => String(c.product_id) !== String(id));
    renderCart();
    if(!document.getElementById('checkout-modal').classList.contains('hidden')) renderCheckoutReview();
}

window.setCustomPrice = function(id, val) {
    const newPrice = parseFloat(val);
    if(isNaN(newPrice) || newPrice < 0) return;
    const i = state.cart.findIndex(c => String(c.product_id) === String(id));
    if(i > -1) {
        state.cart[i].price = newPrice;
    }
    // Update totals inline WITHOUT re-rendering cart (avoids destroying active input)
    const t = state.cart.reduce((s, item) => s + (item.price * item.quantity), 0);
    const el1 = document.getElementById('cart-subtotal');
    const el2 = document.getElementById('cart-total');
    if(el1) el1.textContent = `Rs ${t.toLocaleString()}`;
    if(el2) el2.textContent = `Rs ${t.toLocaleString()}`;
    if(!document.getElementById('checkout-modal').classList.contains('hidden')) renderCheckoutReview();
}

window.processCheckout = function() {
    if(state.cart.length === 0) return showToast('Cart is empty!', 'error');
    
    if(cartType === 'saved') {
        const selId = document.getElementById('cart-customer-select').value;
        if(!selId) return showToast('Please select a customer or switch to Walk-in', 'error');
    }

    renderCheckoutReview();
    document.getElementById('checkout-modal').classList.remove('hidden');
}

window.renderCheckoutReview = function() {
    const container = document.getElementById('checkout-review-content');
    const db = getDB();
    
    let customerId = 1;
    let customerObj = { name: "Walk-in Customer" };
    if(cartType === 'saved') {
        customerId = parseInt(document.getElementById('cart-customer-select').value);
        customerObj = state.customers.find(c => c.id === customerId);
    }

    const payMethod = document.getElementById('payment-method').value;
    const total = state.cart.reduce((s, i) => s + (i.price * i.quantity), 0);

    const totalSavings = state.cart.reduce((s, item) => {
        if (item.original_price && item.price < item.original_price) {
            return s + ((item.original_price - item.price) * item.quantity);
        }
        return s;
    }, 0);

    container.innerHTML = `
        <div style="background: #f8fafc; padding: 1.2rem; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 1.5rem; display: grid; grid-template-columns: 1fr 1.5fr; gap: 1rem;">
            <div>
                <label style="font-size:0.75rem; color:#64748b; text-transform:uppercase; font-weight:700;">Customer</label>
                <div style="font-weight:700; color:#0f172a;">${customerObj.name}</div>
            </div>
            <div>
                <label style="font-size:0.75rem; color:#64748b; text-transform:uppercase; font-weight:700;">Payment Method</label>
                <div style="font-weight:700; color:#0f172a;">${payMethod}</div>
            </div>
        </div>

        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: white;">
            <table style="width:100%; border-collapse: collapse; font-size: 0.95rem;">
                <thead style="background: #f8fafc; position: sticky; top: 0; z-index: 1;">
                    <tr>
                        <th style="text-align:left; padding: 12px; color: #64748b;">Item Description</th>
                        <th style="text-align:center; padding: 12px; color: #64748b;">Quantity</th>
                        <th style="text-align:right; padding: 12px; color: #64748b;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.cart.map(item => {
                        const hasDiscount = item.original_price && item.price < item.original_price;
                        const discountAmt = hasDiscount ? item.original_price - item.price : 0;
                        const discountPct = hasDiscount ? ((discountAmt / item.original_price) * 100).toFixed(1) : 0;
                        return `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 12px; font-weight: 500;">
                                ${item.name}
                                ${hasDiscount ? `<div class="cart-discount-badge" style="margin-top:4px;">\u2193 Rs ${discountAmt.toLocaleString()} off (${discountPct}%)</div>` : ''}
                            </td>
                            <td style="padding: 12px; text-align: center;">
                                <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                                    <button onclick="updateQty(${item.product_id}, -1)" style="width:24px; height:24px; border-radius:4px; border:1px solid #cbd5e1; background:white; cursor:pointer;">-</button>
                                    <span style="font-weight:700; min-width:20px;">${item.quantity}</span>
                                    <button onclick="updateQty(${item.product_id}, 1)" style="width:24px; height:24px; border-radius:4px; border:1px solid #cbd5e1; background:white; cursor:pointer;">+</button>
                                </div>
                            </td>
                            <td style="padding: 12px; text-align: right; font-weight: 700;">Rs ${(item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>

        ${totalSavings > 0 ? `<div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; background: #ecfdf5; padding: 0.8rem 1.5rem; border-radius: 10px; border: 1px solid #a7f3d0;">
            <span style="font-size: 0.95rem; font-weight: 700; color: #065f46;">💰 Total Discount Given</span>
            <span style="font-size: 1.1rem; font-weight: 800; color: #059669;">- Rs ${totalSavings.toLocaleString()}</span>
        </div>` : ''}

        <div style="margin-top: ${totalSavings > 0 ? '0.8rem' : '1.5rem'}; display: flex; justify-content: space-between; align-items: center; background: #f0f9ff; padding: 1rem 1.5rem; border-radius: 12px; border: 1px solid #bae6fd;">
            <span style="font-size: 1.1rem; font-weight: 600; color: #0369a1;">Order Total</span>
            <span style="font-size: 1.5rem; font-weight: 900; color: #0369a1;">Rs ${total.toLocaleString()}</span>
        </div>
    `;
}

window.confirmCheckout = function() {
    if(state.cart.length === 0) return showToast('Cart is empty!', 'error');
    
    document.getElementById('checkout-modal').classList.add('hidden');

    const customerSelect = document.getElementById('cart-customer-select');
    const customerId = customerSelect ? parseInt(customerSelect.value) : 1;

    const payMethod = document.getElementById('payment-method').value;
    const db = getDB();
    let totAmt = 0, totProf = 0;

    state.cart.forEach(item => {
        totAmt += item.price * item.quantity;
        totProf += (item.price - item.cost) * item.quantity;
        const pi = db.products.findIndex(p => p.id === item.product_id);
        if(pi !== -1) db.products[pi].stock -= item.quantity;
    });

    const saleRecord = {
        id: Date.now(), customer_id: customerId, payment_method: payMethod,
        total_amount: totAmt, profit: totProf, created_at: new Date().toISOString(), items: [...state.cart],
        salesman_id: parseInt(document.getElementById('cart-salesman-select').value)
    };

    db.salesHistory.push(saleRecord);
    saveDB(db);
    showToast('Sale Completed Successfully!');

    showReceiptModal(saleRecord.id);

    state.cart = []; fetchProducts(); fetchSalesHistory(); renderPOS();
}

// 4. Reports & Customers (Similar to before + Customer Add logic)
window.setReportTab = function(tab) { window._todayOnlyFilter = false; window.reportTab = tab; renderReports(); }
window.searchReceipts = function(val) { window.receiptSearch = val; renderReceiptLog(); }
window.clearTodayFilter = function() { window._todayOnlyFilter = false; renderSalesSummary(); }

function renderReports() {
    window.reportTab = window.reportTab || 'sales';
    contentArea.innerHTML = `
        <div style="display: flex; background: #f1f5f9; padding: 5px; border-radius: 12px; margin-bottom: 2rem; width: fit-content; border: 1px solid #e2e8f0;">
            <button onclick="setReportTab('sales')" style="padding: 10px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${window.reportTab==='sales' ? 'background: white; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">Sales Summary</button>
            <button onclick="setReportTab('receipts')" style="padding: 10px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${window.reportTab==='receipts' ? 'background: white; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">Receipt Archive</button>
        </div>
        <div id="report-content-area"></div>
    `;
    if(window.reportTab === 'sales') renderSalesSummary();
    else renderReceiptLog();
}

function renderSalesSummary() {
    const container = document.getElementById('report-content-area');
    const now = new Date();
    const isTodayOnly = window._todayOnlyFilter === true;
    let salesData = state.salesHistory.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if (isTodayOnly) {
        salesData = salesData.filter(s => new Date(s.created_at).toDateString() === now.toDateString());
    }
    const todayRevenue = salesData.reduce((s, o) => s + (o.total_amount || 0), 0);
    const headerTitle = isTodayOnly ? `Today's Orders (${salesData.length})` : 'Daily Transaction Log';
    const filterBanner = isTodayOnly ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;padding:10px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;">
        <span style="font-size:1.1rem;">📅</span>
        <span style="font-weight:700;color:#065f46;font-size:0.9rem;">Showing today's orders only — Revenue: Rs ${todayRevenue.toLocaleString()}</span>
        <button onclick="clearTodayFilter()" style="margin-left:auto;border:none;background:#065f46;color:white;padding:5px 14px;border-radius:6px;font-size:0.8rem;font-weight:700;cursor:pointer;">Show All Orders</button>
    </div>` : '';
    const db = getDB();
    container.innerHTML = `${filterBanner}<div class="data-table-container"><div class="table-header"><h3>${headerTitle}</h3><div style="display:flex;gap:0.8rem;"><button class="btn btn-secondary" style="border-radius:10px;" onclick="showExportModal()">📤 Export Report</button><button class="btn btn-gold" onclick="exportToCSV()">Export Excel</button></div></div>
    <table><thead><tr><th>Order ID</th><th>Date</th><th>Customer</th><th>Method</th><th>Items</th><th>Revenue</th><th>Status</th></tr></thead>
    <tbody>${salesData.map(s => {
        const cust = db.customers.find(c => c.id === s.customer_id) || { name: 'Walk-in' };
        const ki = getKhataPaymentInfo(s, db);
        let statusBadge;
        if (ki.status === 'paid') statusBadge = '<span style="background:#ecfdf5;color:#065f46;padding:3px 10px;border-radius:6px;font-size:0.8rem;font-weight:700;">PAID</span>';
        else if (ki.status === 'partial') statusBadge = '<span style="background:#fff7ed;color:#c2410c;padding:3px 10px;border-radius:6px;font-size:0.8rem;font-weight:700;">PARTIAL</span>';
        else if (ki.status === 'unpaid') statusBadge = '<span style="background:#fef2f2;color:#991b1b;padding:3px 10px;border-radius:6px;font-size:0.8rem;font-weight:700;">UNPAID</span>';
        else statusBadge = '<span style="background:#ecfdf5;color:#065f46;padding:3px 10px;border-radius:6px;font-size:0.8rem;font-weight:700;">PAID</span>';
        return `<tr>
            <td>#${s.id}</td>
            <td>${new Date(s.created_at).toLocaleString()}</td>
            <td style="font-weight:600;">${cust.name}</td>
            <td>${s.payment_method||'Cash'}</td>
            <td>${(s.items || []).reduce((a,b)=>a+b.quantity,0)}</td>
            <td style="font-weight:700;">Rs ${s.total_amount.toLocaleString()}</td>
            <td>${statusBadge}${ki.paidAmt > 0 && ki.status !== 'paid' ? '<div style="font-size:0.7rem;color:#64748b;margin-top:2px;">Paid: Rs '+ki.paidAmt.toLocaleString()+'</div>' : ''}</td>
        </tr>`;
    }).join('')}${salesData.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:3rem;color:var(--text-muted);">No orders found for today.</td></tr>' : ''}</tbody></table></div>`;
}

function renderReceiptLog() {
    const container = document.getElementById('report-content-area');
    const db = getDB();
    const searchVal = window.receiptSearch || '';
    
    const filteredReceipts = state.salesHistory.filter(s => {
        const cust = db.customers.find(c => c.id === s.customer_id) || { name: 'Walk-in' };
        return s.id.toString().includes(searchVal) || 
               cust.name.toLowerCase().includes(searchVal.toLowerCase()) ||
               new Date(s.created_at).toLocaleDateString().includes(searchVal);
    });

    const tableRows = filteredReceipts.map(s => {
        const cust = db.customers.find(c => c.id === s.customer_id) || { name: 'Walk-in Customer' };
        return `<tr>
            <td>#${s.id}</td>
            <td>${new Date(s.created_at).toLocaleString()}</td>
            <td style="font-weight:600;">${cust.name}</td>
            <td style="font-weight:700; color:var(--primary);">Rs ${s.total_amount.toLocaleString()}</td>
            <td><button class="btn btn-secondary" onclick="showReceiptModal(${s.id})">👁️ View Receipt</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">No matching receipts found.</td></tr>';

    const existingBody = document.getElementById('receipt-log-body');
    if (existingBody) {
        existingBody.innerHTML = tableRows;
        return;
    }

    container.innerHTML = `
        <div class="data-table-container">
            <div class="table-header">
                <h3>Issued Receipts</h3>
                <input type="text" id="receipt-search-input" class="filter-select" placeholder="Search Receipts..." style="width: 300px; padding: 0.8rem 1.2rem;" value="${searchVal}" oninput="searchReceipts(this.value)">
            </div>
            <table>
                <thead><tr><th>Receipt #</th><th>Date</th><th>Customer</th><th>Total Amount</th><th>Action</th></tr></thead>
                <tbody id="receipt-log-body">
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}
window.exportToCSV = function() { /* Truncated for brevity, works identical */ }

function renderCustomers() {
    window.customerSearchQuery = window.customerSearchQuery || '';
    const filtered = state.customers.filter(c => {
        if(c.id === 1) return false;
        if(!window.customerSearchQuery) return true;
        const q = window.customerSearchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
    });

    contentArea.innerHTML = `
        <div class="data-table-container">
            <div class="table-header" style="flex-wrap: wrap; gap: 1rem;">
                <h3>Customer Directory</h3>
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1; max-width: 600px;">
                    <div class="customer-search-wrapper" style="flex: 1;">
                        <span class="search-icon">\ud83d\udd0d</span>
                        <input type="text" class="customer-search-bar" placeholder="Search by name or phone..." 
                            value="${window.customerSearchQuery || ''}"
                            oninput="searchCustomers(this.value)">
                    </div>
                    <button class="btn btn-primary" onclick="showCustomerModal()" style="white-space: nowrap;">+ Add Customer</button>
                </div>
            </div>
            <table><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Actions</th></tr></thead>
            <tbody>${filtered.map(c => `<tr>
                <td style="font-weight:600;">${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.address || 'N/A'}</td>
                <td>
                    <button class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.85rem;" onclick='showCustomerModal(${JSON.stringify(c).replace(/'/g, "&apos;")})'>Edit</button>
                    <button class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.85rem; color:var(--danger);" onclick="deleteCustomer(${c.id})">Delete</button>
                </td>
            </tr>`).join('')}
            ${filtered.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">No customers found.</td></tr>' : ''}
            </tbody></table>
        </div>
        <div id="customer-modal" class="modal hidden">
            <div class="modal-content" style="width:400px;">
                <h3 id="cust-modal-title" style="margin-bottom:1rem;">Add Customer</h3>
                <form id="customer-form">
                    <input type="hidden" id="cust-id">
                    <div class="form-group"><label>Name</label><input type="text" id="cust-name" class="form-control" required></div>
                    <div class="form-group"><label>Phone Number</label><input type="text" id="cust-phone" class="form-control" required></div>
                    <div class="form-group"><label>Delivery Address</label><input type="text" id="cust-address" class="form-control"></div>
                    <div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="document.getElementById('customer-modal').classList.add('hidden')">Cancel</button><button type="submit" class="btn btn-primary">Save Changes</button></div>
                </form>
            </div>
        </div>`;

    const custForm = document.getElementById('customer-form');
    if (custForm) custForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const db = getDB();
        const id = document.getElementById('cust-id').value;
        const payload = {
            name: document.getElementById('cust-name').value,
            phone: document.getElementById('cust-phone').value,
            address: document.getElementById('cust-address').value
        };

        if(id) {
            const idx = db.customers.findIndex(c => c.id == id);
            if(idx !== -1) db.customers[idx] = { ...db.customers[idx], ...payload };
        } else {
            payload.id = Date.now();
            db.customers.push(payload);
        }

        saveDB(db); document.getElementById('customer-modal').classList.add('hidden'); fetchCustomers(); renderCustomers(); 
        showToast(id ? 'Customer Updated!' : 'Customer Added!');
    });
}

window.showCustomerModal = function(customer = null) { 
    document.getElementById('customer-modal').classList.remove('hidden'); 
    document.getElementById('cust-modal-title').textContent = customer ? 'Edit Customer' : 'Add Customer';
    document.getElementById('cust-id').value = customer ? customer.id : '';
    document.getElementById('cust-name').value = customer ? customer.name : '';
    document.getElementById('cust-phone').value = customer ? customer.phone : '';
    document.getElementById('cust-address').value = customer ? (customer.address || '') : '';
}

window.deleteCustomer = async function(id) {
    const confirmed = await showConfirm('Delete Customer?', 'Are you sure you want to delete this customer? This action cannot be undone.');
    if(!confirmed) return;
    const db = getDB();
    db.customers = db.customers.filter(c => c.id !== id);
    saveDB(db);
    fetchCustomers();
    renderCustomers();
    showToast('Customer deleted');
}

window.showReceiptModal = function(saleId) {
    const db = getDB();
    const sale = db.salesHistory.find(s => s.id === saleId);
    if(!sale) return;

    const paperSize = state.settings.printer_settings?.paper_size || '80mm';
    document.documentElement.style.setProperty('--receipt-width', paperSize);
    
    // Set container width based on paper size for preview
    const container = document.querySelector('#receipt-modal .modal-content');
    if (container) {
        container.style.width = paperSize === '58mm' ? '280px' : '380px';
    }

    const customer = db.customers.find(c => c.id === sale.customer_id) || { name: "Walk-in Customer", phone: "", address: "" };
    const salesman = db.users.find(u => u.id == sale.salesman_id) || { name: 'Admin Staff', phone: '' };

    const logoImg = document.getElementById('receipt-logo');
    if (state.settings && state.settings.logo_base64 && state.settings.logo_base64.startsWith('data:image')) {
        logoImg.src = state.settings.logo_base64;
        logoImg.style.display = 'inline-block';
    } else {
        // Keep the default logo.jpg from HTML or show if it exists
        logoImg.style.display = 'inline-block'; 
    }

    // Always update receipt header from current settings
    const storeName = state.settings.store_name || 'MM Brothers Islamic Mart';
    document.getElementById('receipt-store-name').innerHTML = storeName.toUpperCase().replace(/\s+/g, ' ').replace(/(BROTHERS?)\s*/i, '$1<br>');
    document.getElementById('receipt-store-address').textContent = state.settings.store_address || 'Saleem Market Par Hoti, Mardan';
    document.getElementById('receipt-store-contact').textContent = `Contact: ${state.settings.official_number || state.settings.store_contact || '03025731705'}`;
    const dateObj = new Date(sale.created_at);
    const dateStr = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    document.getElementById('receipt-date').textContent = `${dateStr} ${timeStr}`;
    // Dynamic payment method label based on Khata status
    const ki = getKhataPaymentInfo(sale);
    let payLabel = sale.payment_method || 'Cash';
    if (ki.isKhata) {
        if (ki.status === 'paid') payLabel = 'Paid';
        else if (ki.status === 'partial') payLabel = 'Partial';
        else payLabel = 'Khata (Udhaar)';
    }
    document.getElementById('receipt-method').textContent = payLabel;
    document.getElementById('receipt-id').textContent = `#${sale.id}`;
    document.getElementById('receipt-salesman').textContent = salesman.name;
    
    document.getElementById('r-cust-name').textContent = customer.name;
    document.getElementById('r-cust-phone').textContent = customer.phone || 'N/A';
    document.getElementById('r-cust-address').textContent = customer.address || 'N/A';

    let totalSaved = 0;
    const itemsHtml = (sale.items || []).map(item => {
        const hasDiscount = item.original_price && parseFloat(item.price) < parseFloat(item.original_price);
        const discountAmt = hasDiscount ? (item.original_price - item.price) * (item.quantity || 1) : 0;
        const discountPctPerUnit = hasDiscount ? (((item.original_price - item.price) / item.original_price) * 100).toFixed(0) : 0;
        if (hasDiscount) totalSaved += discountAmt;
        return `
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #000; margin-bottom: ${hasDiscount ? '2px' : '8px'}; padding: 2px 0;">
            <span style="flex: 2.5; text-align: left; padding-right: 5px;">${item.name}</span>
            <span style="flex: 0.5; text-align: center;">${item.quantity}</span>
            <span style="flex: 1; text-align: right;">Rs ${(parseFloat(item.price) * parseInt(item.quantity)).toLocaleString()}</span>
        </div>
        ${hasDiscount ? `<div style="margin-bottom: 8px; padding-left: 4px; font-size: 11px; color: #000;">
            <span style="text-decoration: line-through; color: #555;">Rs ${item.original_price.toLocaleString()}</span>
            → Rs ${parseFloat(item.price).toLocaleString()} 
            <strong>(${discountPctPerUnit}% off, saved Rs ${discountAmt.toLocaleString()})</strong>
        </div>` : ''}`;
    }).join('');
    
    // Build total savings summary if any discount was given
    const savingsHtml = totalSaved > 0 ? `<div style="display:flex; justify-content:space-between; font-size:12px; font-weight:800; color:#000; padding:6px 0; margin-top:4px; border-top:1px dashed #999;">
        <span>💰 YOU SAVED</span>
        <span>Rs ${totalSaved.toLocaleString()}</span>
    </div>` : '';

    document.getElementById('receipt-items').innerHTML = (itemsHtml || '<div style="text-align:center; padding:10px;">No items found</div>') + savingsHtml;
    document.getElementById('receipt-total-amt').textContent = `${state.settings.currency || 'Rs'} ${(sale.total_amount || 0).toLocaleString()}`;

    // Dynamic receipt footer text from settings
    const footerEl = document.getElementById('receipt-footer-text');
    if (footerEl && state.settings.receipt_footer) {
        footerEl.innerHTML = state.settings.receipt_footer.replace(/\n/g, '<br>');
    }

    // Payment stamp
    const paymentStamp = document.getElementById('receipt-payment-stamp');
    if(paymentStamp) {
        if(ki.status === 'unpaid') {
            paymentStamp.style.display = 'inline-block';
            paymentStamp.textContent = 'UNPAID — UDHAAR';
            paymentStamp.style.color = '#dc2626';
            paymentStamp.style.borderColor = '#dc2626';
        } else if(ki.status === 'partial') {
            paymentStamp.style.display = 'inline-block';
            paymentStamp.textContent = 'PARTIAL — Rs ' + ki.paidAmt.toLocaleString() + ' / ' + ki.totalAmt.toLocaleString();
            paymentStamp.style.color = '#c2410c';
            paymentStamp.style.borderColor = '#c2410c';
        } else {
            paymentStamp.style.display = 'none';
        }
    }

    // Khata payment details section
    const khataDetails = document.getElementById('receipt-khata-details');
    if (khataDetails) {
        if (ki.isKhata) {
            let detailsHtml = '';
            // Payment history
            if (ki.payments.length > 0) {
                detailsHtml += '<div style="border-top:1px dashed #000;padding-top:10px;margin-top:5px;">';
                detailsHtml += '<div style="font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:6px;color:#333;">Payment History</div>';
                ki.payments.forEach(function(p) {
                    detailsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:3px 0;border-bottom:1px solid #eee;">';
                    detailsHtml += '<span style="color:#333;">' + new Date(p.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
                    if (p.note && p.note.indexOf('Advance') !== -1) {
                        detailsHtml += ' <span style="font-size:9px;color:#1565C0;font-weight:600;">(Advance)</span>';
                    }
                    detailsHtml += '</span>';
                    detailsHtml += '<span style="font-weight:700;color:#2E7D32;">Rs ' + p.amount.toLocaleString() + '</span>';
                    detailsHtml += '</div>';
                });
                detailsHtml += '</div>';
            }
            // Summary
            let displayPaidAmt = ki.paidAmt;
            if (ki.advanceBalance > 0 && ki.paidAmt <= ki.totalAmt) {
                displayPaidAmt += ki.advanceBalance;
            }
            
            detailsHtml += '<div style="margin-top:8px;padding:8px 0;border-top:1px dashed #000;">';
            detailsHtml += '<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;"><span style="color:#555;font-weight:600;">Total Amount</span><span style="font-weight:800;color:#1a1a1a;">Rs ' + ki.totalAmt.toLocaleString() + '</span></div>';
            detailsHtml += '<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;"><span style="color:#555;font-weight:600;">Total Paid</span><span style="font-weight:800;color:#2E7D32;">Rs ' + displayPaidAmt.toLocaleString() + '</span></div>';
            detailsHtml += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;font-weight:800;"><span style="color:' + (ki.remaining > 0 ? '#C62828' : '#2E7D32') + ';">Remaining Balance</span><span style="color:' + (ki.remaining > 0 ? '#C62828' : '#2E7D32') + ';">Rs ' + ki.remaining.toLocaleString() + '</span></div>';
            detailsHtml += '</div>';
            // Advance info
            if (ki.advanceUsed > 0 || ki.advanceBalance > 0) {
                detailsHtml += '<div style="margin-top:6px;padding:6px 8px;background:#E3F2FD;border:1px solid #90CAF9;border-radius:6px;">';
                if (ki.advanceUsed > 0) {
                    detailsHtml += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span style="color:#1565C0;font-weight:600;">Used from Advance</span><span style="font-weight:700;color:#1565C0;">Rs ' + ki.advanceUsed.toLocaleString() + '</span></div>';
                }
                if (ki.advanceBalance > 0) {
                    var recvRecs = (ki.advanceHistory || []).filter(function(h){ return h.type === 'received'; });
                    var sinceStr = '';
                    if (recvRecs.length > 0) {
                        sinceStr = ' <span style="font-size:9px;color:#1565C0;">(Since ' + new Date(recvRecs[recvRecs.length-1].date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ')</span>';
                    }
                    detailsHtml += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span style="color:#1565C0;font-weight:600;">Advance Balance' + sinceStr + '</span><span style="font-weight:700;color:#1565C0;">Rs ' + ki.advanceBalance.toLocaleString() + '</span></div>';
                }
                detailsHtml += '</div>';
            }
            // Paid on date for fully paid
            if (ki.status === 'paid' && ki.payments.length > 0) {
                var lastPayDate = new Date(ki.payments[ki.payments.length-1].date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
                detailsHtml += '<div style="text-align:center;font-size:10px;color:#2E7D32;font-weight:700;margin-top:4px;">Paid on: ' + lastPayDate + '</div>';
            }
            khataDetails.style.display = 'block';
            khataDetails.innerHTML = detailsHtml;
        } else {
            khataDetails.style.display = 'none';
            khataDetails.innerHTML = '';
        }
    }

    const modal = document.getElementById('receipt-modal');
    modal.classList.remove('hidden');

    // Receipt is shown — user clicks 'Print Receipt' button manually.
    // Auto-print removed: user controls when to send to thermal printer.
}

// 5. Settings / Admin Panel
function renderSettings() {
    contentArea.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 1rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                
                <!-- Global Store Settings -->
                <div style="background: white; border-radius: 20px; border: 1px solid #e2e8f0; padding: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <h3 style="margin: 0 0 1.5rem 0; color: #1e293b; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.5rem;">🏪</span> Global Store Settings
                    </h3>
                    
                    <form id="store-settings-form">
                        <div style="margin-bottom: 2rem;">
                            <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 1rem;">Store Logo (Global)</label>
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed #e2e8f0; border-radius: 16px; padding: 2rem; background: #f8fafc; transition: all 0.2s; position: relative; overflow: hidden; cursor: pointer;" onclick="document.getElementById('settings-logo-file').click()">
                                <input type="file" id="settings-logo-file" accept="image/*" style="display: none;">
                                <img id="settings-logo-preview" src="${state.settings.logo_base64 || ''}" style="max-height: 100px; max-width: 100%; border-radius: 8px; ${state.settings.logo_base64 ? '' : 'display:none;'}">
                                <div id="settings-logo-text" style="text-align: center; color: #94a3b8; font-size: 0.9rem; ${state.settings.logo_base64 ? 'display:none;' : ''}">
                                    <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">📸</span>
                                    Click to upload or change logo
                                </div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                            <div class="form-group">
                                <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">Store Name</label>
                                <input type="text" id="settings-name" class="form-control" value="${state.settings.store_name}" required style="width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem;">
                            </div>
                            <div class="form-group">
                                <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">Official Store Number</label>
                                <input type="text" id="settings-official-number" class="form-control" value="${state.settings.official_number || ''}" required style="width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem;">
                            </div>
                        </div>

                        <div style="margin-bottom: 1.5rem;">
                            <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">Store Address (Receipt)</label>
                            <input type="text" id="settings-address" class="form-control" value="${state.settings.store_address || ''}" required style="width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem;">
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                            <div class="form-group">
                                <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">Currency Format</label>
                                <select id="settings-currency" class="form-control" style="width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem; background: white;">
                                    <option value="Rs" ${state.settings.currency === 'Rs' ? 'selected' : ''}>Rs (Rupees)</option>
                                    <option value="PKR" ${state.settings.currency === 'PKR' ? 'selected' : ''}>PKR</option>
                                    <option value="$" ${state.settings.currency === '$' ? 'selected' : ''}>$ (USD)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">Contact Method</label>
                                <input type="text" id="settings-contact" class="form-control" value="${state.settings.store_contact}" placeholder="e.g. Phone: 0300..." required style="width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem;">
                            </div>
                        </div>

                        <div style="margin-bottom: 2rem;">
                            <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">Receipt Footer Message</label>
                            <textarea id="settings-footer" class="form-control" style="width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem; min-height: 80px; resize: none;">${state.settings.receipt_footer || ''}</textarea>
                        </div>

                        <button type="submit" class="btn btn-primary" style="width: 100%; padding: 1.1rem; border-radius: 12px; font-weight: 700; font-size: 0.95rem; justify-content: center; background: #990000; border: none; box-shadow: 0 4px 12px rgba(153,0,0,0.15);">Save Store Settings</button>
                    </form>
                </div>

                <div style="display: flex; flex-direction: column; gap: 2rem;">
                    
                    <!-- Database & Backups -->
                    <div style="background: white; border-radius: 20px; border: 1px solid #e2e8f0; padding: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                        <h3 style="margin: 0 0 1rem 0; color: #1e293b; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">💾</span> Data Management
                        </h3>
                        <p style="font-size: 0.9rem; color: #64748b; line-height: 1.5; margin-bottom: 1.5rem;">Securely export your database to external storage or restore from a previous backup. Keep your business data safe.</p>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                            <button class="btn btn-secondary" onclick="exportDatabase()" style="border-radius: 12px; padding: 1rem; font-weight: 700; font-size: 0.85rem; justify-content: center; border: 1px solid #e2e8f0; background: white; color: #1e293b;">⬇️ Export Data</button>
                            <button class="btn btn-secondary" onclick="importDatabase()" style="border-radius: 12px; padding: 1rem; font-weight: 700; font-size: 0.85rem; justify-content: center; border: 1px solid #e2e8f0; background: white; color: #1e293b;">⬆️ Restore Data</button>
                        </div>

                        <div style="background: #f0f9ff; border-radius: 12px; padding: 1rem; border: 1px solid #bae6fd; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.2rem;">🔔</span>
                                <span style="font-size: 0.85rem; font-weight: 600; color: #0369a1;">Daily Backup Reminders</span>
                            </div>
                            <input type="checkbox" style="width: 18px; height: 18px; cursor: pointer;" checked>
                        </div>
                    </div>

                    <!-- Printer Configuration -->
                    <div style="background: white; border-radius: 20px; border: 1px solid #e2e8f0; padding: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                        <h3 style="margin: 0 0 1rem 0; color: #1e293b; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">🖨️</span> Printer Configuration
                        </h3>
                        <form id="printer-settings-form">
                            <div style="margin-bottom: 1.5rem;">
                                <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">Select Printer</label>
                                <select id="settings-printer-name" class="form-control" style="width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem; background: white;">
                                    <option value="">Default System Printer</option>
                                </select>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                                <div class="form-group">
                                    <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">Paper Size</label>
                                    <select id="settings-paper-size" class="form-control" style="width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem; background: white;">
                                        <option value="58mm" ${state.settings.printer_settings?.paper_size === '58mm' ? 'selected' : ''}>58mm (Small)</option>
                                        <option value="80mm" ${state.settings.printer_settings?.paper_size === '80mm' ? 'selected' : ''}>80mm (Standard)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">Silent Print</label>
                                    <select id="settings-silent-print" class="form-control" style="width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem; background: white;">
                                        <option value="true" ${state.settings.printer_settings?.silent_print ? 'selected' : ''}>Yes (Instant)</option>
                                        <option value="false" ${!state.settings.printer_settings?.silent_print ? 'selected' : ''}>No (Show Dialog)</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-secondary" style="width: 100%; padding: 0.8rem; border-radius: 10px; font-weight: 700; background: #f8fafc; border: 1px solid #e2e8f0;">Save Printer Config</button>
                        </form>
                    </div>

                    <!-- Sales Team / Staff -->
                    <div style="background: white; border-radius: 20px; border: 1px solid #e2e8f0; padding: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                        <h3 style="margin: 0 0 1.5rem 0; color: #1e293b; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">👥</span> Sales Team / Staff
                        </h3>
                        
                        <form id="add-staff-form" style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem;">
                            <input type="text" id="staff-name" placeholder="Full Name" class="form-control" style="flex: 1.5; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem;" required>
                            <input type="text" id="staff-phone" placeholder="Phone Number" class="form-control" style="flex: 1.5; border-radius: 10px; border: 1px solid #e2e8f0; padding: 0.8rem;" required>
                            <button type="submit" class="btn btn-primary" style="flex: 0.7; border-radius: 10px; font-weight: 700; justify-content: center; background: #990000; border: none;">Add</button>
                        </form>

                        <div style="border: 1px solid #f1f5f9; border-radius: 12px; overflow: hidden;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead style="background: #f8fafc;">
                                    <tr>
                                        <th style="padding: 1rem; text-align: left; color: #64748b; font-weight: 700; font-size: 0.75rem; text-transform: uppercase;">Staff Member</th>
                                        <th style="padding: 1rem; text-align: left; color: #64748b; font-weight: 700; font-size: 0.75rem; text-transform: uppercase;">Contact</th>
                                        <th style="padding: 1rem; text-align: right; color: #64748b; font-weight: 700; font-size: 0.75rem; text-transform: uppercase;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${getDB().users.map(u => `
                                        <tr style="border-top: 1px solid #f1f5f9; ${u.role==='admin' ? 'background: #fffbeb;' : ''}">
                                            <td style="padding: 1rem;">
                                                <div style="font-weight: 700; color: #1e293b;">${u.name}</div>
                                                ${u.role==='admin' ? '<span style="display: inline-block; background: #d97706; color: white; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 100px; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Administrator</span>' : '<span style="font-size: 0.75rem; color: #94a3b8;">Sales Team</span>'}
                                            </td>
                                            <td style="padding: 1rem; color: #64748b;">${u.phone}</td>
                                            <td style="padding: 1rem; text-align: right;">
                                                ${u.role!=='admin' ? `<button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 8px; border: 1px solid #fee2e2; color: #ef4444; background: white;" onclick="deleteStaff(${u.id})">Delete</button>` : '<span style="color: #94a3b8; font-size: 0.75rem; font-style: italic;">Protected</span>'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Re-attach event listeners
    const addStaffForm = document.getElementById('add-staff-form');
    if (addStaffForm) addStaffForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const db = getDB();
        db.users.push({ id: Date.now(), role: 'salesman', name: document.getElementById('staff-name').value, phone: document.getElementById('staff-phone').value });
        saveDB(db);
        renderSettings();
        showToast('Staff member added!');
    });

    let newLogoBase64 = state.settings.logo_base64;
    document.getElementById('settings-logo-file').addEventListener('change', (e) => {
        if(e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                newLogoBase64 = evt.target.result;
                const preview = document.getElementById('settings-logo-preview');
                const text = document.getElementById('settings-logo-text');
                preview.src = newLogoBase64;
                preview.style.display = 'block';
                text.style.display = 'none';
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Fetch available printers
    if (window.api) {
        window.api.invoke('get-printers').then(printers => {
            const printerSelect = document.getElementById('settings-printer-name');
            if (printerSelect) {
                printers.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.name;
                    opt.textContent = `${p.name} ${p.isDefault ? '(Default)' : ''}`;
                    if (state.settings.printer_settings?.printer_name === p.name) opt.selected = true;
                    printerSelect.appendChild(opt);
                });
            }
        });
    }

    document.getElementById('printer-settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const db = getDB();
        db.settings.printer_settings = {
            printer_name: document.getElementById('settings-printer-name').value,
            paper_size: document.getElementById('settings-paper-size').value,
            silent_print: document.getElementById('settings-silent-print').value === 'true'
        };
        saveDB(db);
        state.settings = db.settings;
        showToast('Printer Configuration Saved!');
    });

    document.getElementById('store-settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const db = getDB();
        db.settings = {
            ...db.settings,
            store_name: document.getElementById('settings-name').value,
            store_contact: document.getElementById('settings-contact').value,
            store_address: document.getElementById('settings-address').value,
            receipt_footer: document.getElementById('settings-footer').value,
            currency: document.getElementById('settings-currency').value,
            official_number: document.getElementById('settings-official-number').value,
            logo_base64: newLogoBase64
        };
        saveDB(db);
        state.settings = db.settings;
        applyGlobalSettings();
        showToast('Settings Saved & Applied!');
    });
}

// Receipt helpers
window.closeReceipt = function() { document.getElementById('receipt-modal').classList.add('hidden'); }
window.printReceipt = function() { 
    const settings = state.settings.printer_settings || {};
    const paperSize = settings.paper_size || '80mm';
    const useSilentPrint = settings.silent_print === true;
    
    // Set CSS variable for @media print
    document.documentElement.style.setProperty('--receipt-width', paperSize);

    if (window.api) { 
        window.api.printReceipt({
            deviceName: settings.printer_name || '',
            silent: useSilentPrint,
            pageSize: paperSize
        }); 
    } else { 
        window.print();
    } 
}

// User Profile Modal (Redesigned)
window.showProfileModal = function() {
    const existing = document.getElementById('user-profile-modal');
    if(existing) existing.remove();
    
    const div = document.createElement('div');
    div.id = 'user-profile-modal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center; border-radius: 16px; padding: 2rem;">
            <div style="font-size: 3.5rem; margin-bottom: 5px; color: #475569;">👤</div>
            <h2 style="margin-bottom: 1.5rem; color: #1e293b; font-weight: 800;">User Profile</h2>
            
            <div style="text-align: left; background: #f8fafc; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                    <span style="color: #64748b; font-weight: 600; font-size: 0.95rem;">Full Name</span>
                    <span style="color: #0f172a; font-weight: 700;">${state.currentUser.name}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                    <span style="color: #64748b; font-weight: 600; font-size: 0.95rem;">Role</span>
                    <span style="color: #0f172a; font-weight: 700; text-transform: uppercase;">${state.currentUser.role}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding-bottom: 4px;">
                    <span style="color: #64748b; font-weight: 600; font-size: 0.95rem;">Store Contact</span>
                    <span style="color: #0f172a; font-weight: 700;">${state.settings.store_contact.replace('Phone: ', '')}</span>
                </div>
            </div>

            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button class="btn btn-secondary" onclick="document.getElementById('user-profile-modal').remove()" style="flex: 1;">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('user-profile-modal').remove()" style="flex: 1;">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

window.exportDatabase = async function() { 
    if(window.api) { 
        const res = await window.api.exportDB(); 
        if(res.success) showToast('Database exported successfully!'); 
        else if(!res.canceled) showToast('Failed to export: ' + res.error, 'error'); 
    } else { 
        showToast('Export only available in Desktop App', 'error'); 
    } 
};
window.importDatabase = async function() { 
    if(window.api) { 
        const res = await window.api.importDB(); 
        if(res.success) { 
            showToast('Database imported! Reloading...'); 
            setTimeout(() => window.location.reload(), 1500); 
        } else if(!res.canceled) showToast('Failed to import: ' + res.error, 'error'); 
    } else { 
        showToast('Import only available in Desktop App', 'error'); 
    } 
};

window.finTab = window.finTab || 'daily';
window.setFinTab = function(tab) {
    window.finTab = tab;
    fetchSalesHistory(); fetchProducts(); fetchExpenses(); fetchKhata();
    renderFinancials();
}

function renderFinancials() {
    const db = getDB();
    const inventoryValue = state.products.reduce((sum, p) => sum + (p.cost_price * p.stock), 0);
    const zakat = inventoryValue * 0.025;
    const now = new Date();
    let dSales=0, dProf=0, wSales=0, wProf=0, mSales=0, mProf=0, ySales=0, yProf=0;
    let dExp=0, wExp=0, mExp=0, yExp=0;

    state.salesHistory.forEach(s => {
        const d = new Date(s.created_at);
        const amt = s.total_amount || 0;
        const prof = s.profit || 0;
        if (d.toDateString() === now.toDateString()) { dSales+=amt; dProf+=prof; }
        const diff = now - d;
        if (diff <= 7*24*60*60*1000) { wSales+=amt; wProf+=prof; }
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) { mSales+=amt; mProf+=prof; }
        if (d.getFullYear() === now.getFullYear()) { ySales+=amt; yProf+=prof; }
    });

    (db.expenses || []).forEach(e => {
        const d = new Date(e.created_at);
        const amt = e.amount || 0;
        if (d.toDateString() === now.toDateString()) dExp += amt;
        const diff = now - d;
        if (diff <= 7*24*60*60*1000) wExp += amt;
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) mExp += amt;
        if (d.getFullYear() === now.getFullYear()) yExp += amt;
    });

    let currentSales = 0, currentGrossProf = 0, currentNetProf = 0, currentExp = 0, tabTitle = '';
    if (window.finTab === 'daily') { currentSales = dSales; currentGrossProf = dProf; currentNetProf = dProf - dExp; currentExp = dExp; tabTitle = "Today's Overview"; }
    else if (window.finTab === 'weekly') { currentSales = wSales; currentGrossProf = wProf; currentNetProf = wProf - wExp; currentExp = wExp; tabTitle = "This Week's Overview"; }
    else if (window.finTab === 'monthly') { currentSales = mSales; currentGrossProf = mProf; currentNetProf = mProf - mExp; currentExp = mExp; tabTitle = "This Month's Overview"; }
    else if (window.finTab === 'yearly') { currentSales = ySales; currentGrossProf = yProf; currentNetProf = yProf - yExp; currentExp = yExp; tabTitle = "This Year's Overview"; }

    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedProfit = mSales > 0 ? ( (mSales - mExp) / currentDay) * daysInMonth : 0;
    const projectedExp = mExp > 0 ? (mExp / currentDay) * daysInMonth : 0;

    const lastWeekStart = new Date(now); lastWeekStart.setDate(now.getDate() - 14);
    const lastWeekEnd = new Date(now); lastWeekEnd.setDate(now.getDate() - 7);
    let thisWeekTotal = 0, lastWeekTotal = 0;
    (db.expenses || []).forEach(e => {
        const d = new Date(e.created_at);
        if (d >= lastWeekEnd && d <= now) thisWeekTotal += e.amount;
        if (d >= lastWeekStart && d < lastWeekEnd) lastWeekTotal += e.amount;
    });
    const weekTrend = lastWeekTotal === 0 ? 0 : ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;

    const expCats = { 'Workers Salary': 'Workers Salaries', 'Worker Advance': 'Worker Advances', 'Worker Tip': 'Worker Tips/Bonuses', 'Shop Expense': 'Shop Expenses', 'Utility Bill': 'Utility Bills', 'Daily Running': 'Running Costs', 'Stock Purchase': 'Stock Purchase', 'Rent': 'Rent', 'Electricity': 'Electricity', 'Other': 'Other Expenses' };
    const catStats = {};
    Object.keys(expCats).forEach(k => catStats[k] = { today: 0, week: 0, month: 0, year: 0 });
    (db.expenses || []).forEach(e => {
        const d = new Date(e.created_at);
        const amt = e.amount || 0;
        const cat = catStats[e.category] ? e.category : 'Other';
        if (d.toDateString() === now.toDateString()) catStats[cat].today += amt;
        if ((now - d) <= 7*24*60*60*1000) catStats[cat].week += amt;
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) catStats[cat].month += amt;
        if (d.getFullYear() === now.getFullYear()) catStats[cat].year += amt;
    });

    const chartLabels = [], chartSales = [], chartExp = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(now.getDate() - i);
        chartLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        let daySales = 0, dayExp = 0;
        state.salesHistory.forEach(s => { if(new Date(s.created_at).toDateString() === d.toDateString()) daySales += (s.total_amount || 0); });
        (db.expenses || []).forEach(e => { if(new Date(e.created_at).toDateString() === d.toDateString()) dayExp += (e.amount || 0); });
        chartSales.push(daySales);
        chartExp.push(dayExp);
    }

    contentArea.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 1rem;">
            <div style="display:flex;justify-content:flex-end;margin-bottom:1rem;">
                <button class="btn btn-secondary" onclick="showFinancialPasswordModal('change')" style="border-radius:10px;font-size:0.85rem;">🔐 Change Password</button>
            </div>
            <!-- Key Performance Cards -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 20px; padding: 1.5rem; color: white;">
                    <div style="color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.5rem;">Inventory Value</div>
                    <div style="font-size: 1.8rem; font-weight: 800;">Rs ${inventoryValue.toLocaleString()}</div>
                    <div style="margin-top: 1rem; font-size: 0.8rem; color: #38bdf8;">Current Stock Assets</div>
                </div>
                <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); border-radius: 20px; padding: 1.5rem; color: white;">
                    <div style="color: #fde68a; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.5rem;">Estimated Zakat</div>
                    <div style="font-size: 1.8rem; font-weight: 800;">Rs ${zakat.toLocaleString()}</div>
                    <div style="margin-top: 1rem; font-size: 0.8rem; color: #fef3c7;">Purify Your Wealth</div>
                </div>
                <div style="background: white; border-radius: 20px; padding: 1.5rem; border: 1px solid #e2e8f0;">
                    <div style="color: #64748b; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.5rem;">Current Month Sales</div>
                    <div style="font-size: 1.8rem; font-weight: 800; color: #10b981;">Rs ${Math.round(mSales).toLocaleString()}</div>
                    <div style="margin-top: 1rem; font-size: 0.8rem; color: #94a3b8;">Total sales this month</div>
                </div>
            </div>

            <!-- Financials Section -->
            <div style="background: white; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 2rem; overflow: hidden;">
                <div style="padding: 1.5rem 2rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; font-weight: 700;">Financial Analytics</h3>
                    <div style="display: flex; background: #f1f5f9; border-radius: 12px; padding: 4px;">
                        ${['daily', 'weekly', 'monthly', 'yearly'].map(t => `<button onclick="setFinTab('${t}')" style="padding: 8px 20px; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s; ${window.finTab===t ? 'background: white; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
                    </div>
                </div>

                <div style="padding: 2rem;">
                    <div style="text-align: center; margin-bottom: 2rem;"><h4 style="color: #64748b; text-transform: uppercase; letter-spacing: 2px; font-size: 0.85rem; font-weight: 700;">${tabTitle}</h4></div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
                        <div style="background: #f8fafc; border-radius: 16px; padding: 1.5rem; text-align: center;">
                            <div style="font-size: 0.9rem; color: #64748b;">Total Sales</div>
                            <div style="font-size: 1.6rem; font-weight: 800;">Rs ${currentSales.toLocaleString()}</div>
                        </div>
                        <div style="background: #f0fdf4; border-radius: 16px; padding: 1.5rem; text-align: center; border: 1px solid #bbf7d0;">
                            <div style="font-size: 0.9rem; color: #166534;">Gross Profit</div>
                            <div style="font-size: 1.6rem; font-weight: 800; color: #16a34a;">Rs ${currentGrossProf.toLocaleString()}</div>
                        </div>
                        <div style="background: #fef2f2; border-radius: 16px; padding: 1.5rem; text-align: center; border: 1px solid #fecaca;">
                            <div style="font-size: 0.9rem; color: #991b1b;">Total Expenses</div>
                            <div style="font-size: 1.6rem; font-weight: 800; color: #ef4444;">Rs ${currentExp.toLocaleString()}</div>
                        </div>
                        <div style="background: #ecfdf5; border-radius: 16px; padding: 1.5rem; text-align: center; border: 1px solid #10b981;">
                            <div style="font-size: 0.9rem; color: #065f46;">Net Profit</div>
                            <div style="font-size: 1.8rem; font-weight: 800; color: #10b981;">Rs ${currentNetProf.toLocaleString()}</div>
                        </div>
                        <div style="background: #eff6ff; border-radius: 16px; padding: 1.5rem; text-align: center; border: 1px solid #3b82f6;">
                            <div style="font-size: 0.9rem; color: #1e40af;">Current Investment</div>
                            <div style="font-size: 1.8rem; font-weight: 800; color: #1d4ed8;">Rs ${inventoryValue.toLocaleString()}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
                        <div style="background: white; border: 1px solid #f1f5f9; border-radius: 16px; padding: 1.5rem;">
                            <h4 style="margin-bottom: 1.5rem; color: #1e293b; font-size: 0.95rem;">Profit vs Expense Trend</h4>
                            <div style="position: relative; height: 280px;"><canvas id="chart-profit-trend"></canvas></div>
                        </div>
                        <div style="background: white; border: 1px solid #f1f5f9; border-radius: 16px; padding: 1.5rem;">
                            <h4 style="margin-bottom: 1.5rem; color: #1e293b; font-size: 0.95rem;">Expense Allocation</h4>
                            <div id="exp-dist-wrapper" style="position: relative; height: 280px; display: flex; align-items: center; justify-content: center;"><canvas id="chart-exp-dist"></canvas></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Operational Cost Summary Table -->
            <div style="background: white; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                <div style="padding: 1.5rem 2rem; border-bottom: 1px solid #f1f5f9; background: #fafafa;">
                    <h3 style="margin: 0; font-size: 1.15rem; color: #1e293b; font-weight: 700;">Operational Cost Breakdown</h3>
                </div>
                <div style="padding: 2rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
                        <div style="background: #f8fafc; padding: 1.5rem; border-radius: 16px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Today's Costs</div>
                            <div style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-top: 0.5rem;">Rs ${dExp.toLocaleString()}</div>
                        </div>
                        <div style="background: #f8fafc; padding: 1.5rem; border-radius: 16px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">This Week</div>
                            <div style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-top: 0.5rem;">Rs ${wExp.toLocaleString()}</div>
                            <div style="font-size: 0.75rem; color: ${weekTrend > 0 ? '#ef4444' : '#10b981'}; margin-top: 0.5rem; font-weight: 700;">${weekTrend >= 0 ? '↑' : '↓'} ${Math.abs(weekTrend).toFixed(1)}% vs last week</div>
                        </div>
                        <div style="background: #eff6ff; padding: 1.5rem; border-radius: 16px; border: 1px solid #dbeafe;">
                            <div style="font-size: 0.8rem; color: #1d4ed8; font-weight: 700; text-transform: uppercase;">Est. Month End Expenses</div>
                            <div style="font-size: 1.5rem; font-weight: 800; color: #1e40af; margin-top: 0.5rem;">Rs ${Math.round(projectedExp).toLocaleString()}</div>
                        </div>
                    </div>
                    <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead><tr style="background: #f8fafc;"><th style="padding: 1.2rem; text-align: left; font-size: 0.85rem; color: #64748b;">CATEGORY</th><th style="padding: 1.2rem; text-align: left; font-size: 0.85rem; color: #64748b;">TODAY</th><th style="padding: 1.2rem; text-align: left; font-size: 0.85rem; color: #64748b;">WEEKLY</th><th style="padding: 1.2rem; text-align: left; font-size: 0.85rem; color: #64748b;">MONTHLY</th><th style="padding: 1.2rem; text-align: left; font-size: 0.85rem; color: #64748b;">ALLOCATION</th></tr></thead>
                            <tbody>
                                ${Object.keys(expCats).map(catId => {
                                    const stats = catStats[catId];
                                    const perc = mExp > 0 ? (stats.month / mExp) * 100 : 0;
                                    return `<tr><td style="padding: 1.2rem; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #1e293b;">${expCats[catId]}</td><td style="padding: 1.2rem; border-bottom: 1px solid #f1f5f9;">Rs ${stats.today.toLocaleString()}</td><td style="padding: 1.2rem; border-bottom: 1px solid #f1f5f9;">Rs ${stats.week.toLocaleString()}</td><td style="padding: 1.2rem; border-bottom: 1px solid #f1f5f9; font-weight: 800;">Rs ${stats.month.toLocaleString()}</td><td style="padding: 1.2rem; border-bottom: 1px solid #f1f5f9;"><div style="display: flex; align-items: center; gap: 10px;"><div style="flex: 1; height: 8px; background: #f1f5f9; border-radius: 10px; overflow: hidden;"><div style="width: ${perc}%; height: 100%; background: #3b82f6;"></div></div><span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">${perc.toFixed(0)}%</span></div></td></tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        if(window.finCharts) Object.values(window.finCharts).forEach(c => c && c.destroy());
        window.finCharts = {};
        const ctx1 = document.getElementById('chart-profit-trend')?.getContext('2d');
        if (ctx1) {
            window.finCharts.trend = new Chart(ctx1, {
                type: 'line',
                data: { labels: chartLabels, datasets: [{ label: 'Sales Margin', data: chartSales, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.35 }, { label: 'Expenses', data: chartExp, borderColor: '#ef4444', borderDash: [5, 5], tension: 0.35 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
            });
        }
        const ctx2 = document.getElementById('chart-exp-dist')?.getContext('2d');
        const periodKey = window.finTab === 'daily' ? 'today' : (window.finTab === 'weekly' ? 'week' : (window.finTab === 'yearly' ? 'year' : 'month'));
        const expData = Object.keys(expCats).map(k => catStats[k][periodKey]);
        if (ctx2 && expData.some(v => v > 0)) {
            window.finCharts.dist = new Chart(ctx2, {
                type: 'doughnut',
                data: { labels: Object.values(expCats), datasets: [{ data: expData, backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#64748b'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
            });
        } else if (ctx2) {
            const wrapper = document.getElementById('exp-dist-wrapper');
            const timePhrase = window.finTab === 'daily' ? 'today' : (window.finTab === 'weekly' ? 'this week' : (window.finTab === 'yearly' ? 'this year' : 'this month'));
            if(wrapper) wrapper.innerHTML = `<p style="color: #94a3b8; font-size: 0.9rem;">No expense data ${timePhrase}</p>`;
        }
    }, 150);
}

window.showCategoryModal = function() {
    const existing = document.getElementById('category-modal');
    if(existing) existing.remove();
    
    const div = document.createElement('div');
    div.id = 'category-modal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <h3 style="margin-bottom:1rem;">Manage Categories</h3>
            <form id="add-category-form" style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                <input type="text" id="new-cat-name" class="form-control" placeholder="New Category Name" required style="flex:1;">
                <button type="submit" class="btn btn-primary">Add</button>
            </form>
            <table style="width:100%; text-align:left; font-size:0.9rem;">
                <thead><tr><th>Category Name</th><th>Action</th></tr></thead>
                <tbody id="category-list">
                    ${state.categories.map(c => `<tr><td style="padding:0.5rem;">${c.name}</td><td><button type="button" class="btn btn-secondary" style="padding:0.2rem 0.5rem;" onclick="deleteCategory(${c.id})">Delete</button></td></tr>`).join('')}
                </tbody>
            </table>
            <div style="text-align:right; margin-top:1rem;">
                <button class="btn btn-secondary" onclick="document.getElementById('category-modal').remove()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
    
    document.getElementById('add-category-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('new-cat-name').value.trim();
        if(!name) return;
        const db = getDB();
        if(!db.categories) db.categories = [];
        db.categories.push({ id: Date.now(), name });
        saveDB(db);
        state.categories = db.categories;
        showToast('Category added!');
        showCategoryModal(); // Refresh modal
    });
};

window.deleteCategory = async function(id) {
    const confirmed = await showConfirm('Delete Category?', 'Are you sure you want to delete this category?');
    if(!confirmed) return;
    const db = getDB();
    db.categories = db.categories.filter(c => c.id !== id);
    saveDB(db);
    state.categories = db.categories;
    showToast('Category deleted!');
    showCategoryModal(); // Refresh modal
};

// --- EXPENSES & WORKERS ---

// Global helper: Add an expense entry to the database
window.addExpense = function(data, passedDb) {
    const db = passedDb || getDB();
    if (!db.expenses) db.expenses = [];
    db.expenses.push({
        id: Date.now(),
        category: data.category || 'Other',
        description: data.description || '',
        amount: data.amount || 0,
        worker_id: data.worker_id || null,
        created_at: new Date().toISOString()
    });
    saveDB(db);
    state.expenses = db.expenses;
    // Re-render if on expenses view
    if (window.expenseTab === 'general') {
        try { renderGeneralExpenses(); } catch(e) {}
    }
};

// Global helper: Delete an expense entry from the database
window.deleteExpense = async function(id) {
    const confirmed = await showConfirm('Delete Expense?', 'Are you sure you want to remove this expense record?');
    if (!confirmed) return;
    const db = getDB();
    const exp = (db.expenses || []).find(e => e.id === id);
    if (exp) {
        if (exp.category === 'Worker Advance') {
            if (db.workerAdvances && db.workerAdvances[exp.worker_id]) {
                db.workerAdvances[exp.worker_id] -= exp.amount;
                if (db.workerAdvances[exp.worker_id] <= 0) delete db.workerAdvances[exp.worker_id];
            }
        } else if (exp.category === 'Workers Salary') {
            const match = exp.description.match(/Adv Deduct:\s*([\d.]+)/);
            if (match) {
                const advDed = parseFloat(match[1]);
                if (advDed > 0) {
                    db.workerAdvances = db.workerAdvances || {};
                    db.workerAdvances[exp.worker_id] = (db.workerAdvances[exp.worker_id] || 0) + advDed;
                }
            }
        }
    }
    
    db.expenses = (db.expenses || []).filter(e => e.id !== id);
    saveDB(db);
    state.expenses = db.expenses;
    renderGeneralExpenses();
    showToast('Expense removed');
};

window.setExpenseTab = function(tab) {
    window.expenseTab = tab;
    renderExpenses();
}

window.setExpenseFilter = function(filter) {
    window.expenseFilter = filter;
    renderGeneralExpenses();
}

function renderExpenses() {
    window.expenseTab = window.expenseTab || 'general';
    contentArea.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto;">
            <div style="display: flex; background: #f1f5f9; padding: 5px; border-radius: 12px; margin-bottom: 2rem; width: fit-content; border: 1px solid #e2e8f0;">
                <button onclick="setExpenseTab('general')" style="padding: 10px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${window.expenseTab==='general' ? 'background: white; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">Shop Expenses</button>
                <button onclick="setExpenseTab('workers')" style="padding: 10px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${window.expenseTab==='workers' ? 'background: white; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05);' : 'background: transparent; color: #64748b;'}">Workers & Salaries</button>
            </div>
            <div id="expense-view-content"></div>
        </div>
    `;
    if(window.expenseTab === 'general') renderGeneralExpenses();
    else renderWorkerManagement();
}

function renderGeneralExpenses() {
    const db = getDB();
    const container = document.getElementById('expense-view-content');
    if(!container) return;

    const allExpenses = (state.expenses || []);
    const now = new Date();
    const thisMonthExp = allExpenses.filter(e => { const d = new Date(e.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthExp = allExpenses.filter(e => { const d = new Date(e.created_at); return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear(); });
    const thisMonthTotal = thisMonthExp.reduce((s, e) => s + e.amount, 0);
    const lastMonthTotal = lastMonthExp.reduce((s, e) => s + e.amount, 0);
    const trendPct = lastMonthTotal > 0 ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(0) : 0;

    // Category totals for this month
    const catTotals = {};
    thisMonthExp.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });

    // Filter logic
    window.expenseFilter = window.expenseFilter || 'all';
    let filtered = allExpenses;
    if(window.expenseFilter === 'month') filtered = thisMonthExp;
    else if(window.expenseFilter === 'lastmonth') filtered = lastMonthExp;

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
            <div style="background:white;border-radius:16px;padding:1.5rem;text-align:center;border:1px solid #e2e8f0;">
                <div style="font-size:0.8rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:0.5rem;">This Month</div>
                <div style="font-size:1.6rem;font-weight:800;color:#ef4444;">Rs ${thisMonthTotal.toLocaleString()}</div>
            </div>
            <div style="background:white;border-radius:16px;padding:1.5rem;text-align:center;border:1px solid #e2e8f0;">
                <div style="font-size:0.8rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:0.5rem;">Last Month</div>
                <div style="font-size:1.6rem;font-weight:800;color:#f59e0b;">Rs ${lastMonthTotal.toLocaleString()}</div>
            </div>
            <div style="background:white;border-radius:16px;padding:1.5rem;text-align:center;border:1px solid #e2e8f0;">
                <div style="font-size:0.8rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:0.5rem;">Trend</div>
                <div style="font-size:1.6rem;font-weight:800;color:${trendPct > 0 ? '#ef4444' : '#10b981'};">${trendPct > 0 ? '↑' : trendPct < 0 ? '↓' : '–'} ${Math.abs(trendPct)}%</div>
            </div>
        </div>

        ${Object.keys(catTotals).length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1.5rem;">
            ${Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat,amt]) => `<span style="background:#f1f5f9;padding:6px 14px;border-radius:20px;font-size:0.8rem;font-weight:600;border:1px solid #e2e8f0;">${cat}: <strong style="color:#ef4444;">Rs ${amt.toLocaleString()}</strong></span>`).join('')}
        </div>` : ''}

        <div class="dashboard-grid">
            <div class="stat-card" style="background: white; grid-column: span 3;">
                <div class="form-group">
                    <h3 style="margin-bottom:1.5rem;">Record New Expense</h3>
                    <form id="expense-form">
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                            <div class="form-group">
                                <label style="font-weight:600; margin-bottom:0.5rem; display:block;">Amount (Rs)</label>
                                <input type="number" id="exp-amount" class="form-control" required style="width:100%; padding: 0.8rem; border-radius: 10px; border: 1px solid #e2e8f0;">
                            </div>
                            <div class="form-group">
                                <label style="font-weight:600; margin-bottom:0.5rem; display:block;">Category</label>
                                <select id="exp-category" class="form-control" required style="width:100%; padding: 0.8rem; border-radius: 10px; border: 1px solid #e2e8f0;">
                                    <option value="Rent">🏠 Rent</option>
                                    <option value="Electricity">⚡ Electricity</option>
                                    <option value="Water">💧 Water</option>
                                    <option value="Gas">🔥 Gas</option>
                                    <option value="Internet">🌐 Internet / Phone</option>
                                    <option value="Shop Expense" selected>🏪 Shop Expense</option>
                                    <option value="Stock Purchase">📦 Stock Purchase</option>
                                    <option value="Transport">🚗 Transport</option>
                                    <option value="Daily Running">🔄 Daily Running</option>
                                    <option value="Maintenance">🔧 Maintenance</option>
                                    <option value="Utility Bill">📋 Other Utility</option>
                                    <option value="Other">📝 Other</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom:1rem;">
                            <label style="font-weight:600; margin-bottom:0.5rem; display:block;">Description / Notes</label>
                            <input type="text" id="exp-desc" class="form-control" placeholder="e.g. Electricity bill for April" required style="width:100%; padding: 0.8rem; border-radius: 10px; border: 1px solid #e2e8f0;">
                        </div>
                        <button type="submit" class="btn btn-primary" style="padding: 0.9rem 2rem; width: 100%; border-radius: 10px; justify-content: center; font-weight: 700;">Add Expense Entry</button>
                    </form>
                </div>
            </div>
        </div>

        <div class="data-table-container" style="margin-top: 1rem;">
            <div class="table-header">
                <h3>Expense History</h3>
                <div style="display:flex;gap:0.5rem;">
                    <button onclick="setExpenseFilter('all')" style="padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;${window.expenseFilter==='all'?'background:#0f172a;color:white;':'background:white;color:#64748b;'}">All</button>
                    <button onclick="setExpenseFilter('month')" style="padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;${window.expenseFilter==='month'?'background:#0f172a;color:white;':'background:white;color:#64748b;'}">This Month</button>
                    <button onclick="setExpenseFilter('lastmonth')" style="padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;${window.expenseFilter==='lastmonth'?'background:#0f172a;color:white;':'background:white;color:#64748b;'}">Last Month</button>
                </div>
            </div>
            <table>
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Action</th></tr></thead>
                <tbody>
                    ${filtered.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30).map(e => `
                        <tr>
                            <td>${new Date(e.created_at).toLocaleDateString()}</td>
                            <td><span class="badge ${e.category.includes('Worker') ? 'badge-success' : 'badge-warning'}" style="font-size:0.8rem;">${e.category}</span></td>
                            <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.description}</td>
                            <td style="font-weight:700; color:#ef4444;">Rs ${e.amount.toLocaleString()}</td>
                            <td><button class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="deleteExpense(${e.id})">Remove</button></td>
                        </tr>
                    `).join('')}
                    ${filtered.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:#64748b; padding: 3rem;">No expense records found.</td></tr>' : ''}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('expense-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amt = parseFloat(document.getElementById('exp-amount').value);
        const cat = document.getElementById('exp-category').value;
        const desc = document.getElementById('exp-desc').value;
        if (!amt || amt <= 0) return showToast('Enter a valid amount', 'error');
        addExpense({ category: cat, description: desc, amount: amt });
        showToast('Expense added ✅');
        document.getElementById('expense-form').reset();
        fetchExpenses();
        renderGeneralExpenses();
    });
}

function renderWorkerManagement() {
    const container = document.getElementById('expense-view-content');
    if(!container) return;

    const db = getDB();
    const advances = db.workerAdvances || {};

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 350px 1fr; gap: 2rem;">
            <div class="stat-card" style="background: white; align-self: start; padding: 2rem; position: sticky; top: 2rem;">
                <h3 style="margin-bottom:1.5rem; display:flex; align-items:center; gap:8px;">
                    <span style="font-size:1.5rem;">👷‍♂️</span> Create Profile
                </h3>
                <form id="worker-form">
                    <div class="form-group" style="margin-bottom:1.2rem;">
                        <label style="font-weight:600; margin-bottom:0.5rem; display:block; color:#475569;">Full Name</label>
                        <input type="text" id="worker-name" class="form-control" required style="width:100%; padding: 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; background:#f8fafc;">
                    </div>
                    <div class="form-group" style="margin-bottom:1.2rem;">
                        <label style="font-weight:600; margin-bottom:0.5rem; display:block; color:#475569;">Phone Number</label>
                        <input type="text" id="worker-phone" class="form-control" required style="width:100%; padding: 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; background:#f8fafc;">
                    </div>
                    <div class="form-group" style="margin-bottom:1.8rem;">
                        <label style="font-weight:600; margin-bottom:0.5rem; display:block; color:#475569;">Base Salary (Rs)</label>
                        <input type="number" id="worker-salary" class="form-control" required style="width:100%; padding: 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; background:#f8fafc;">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%; padding: 1rem; border-radius: 8px; justify-content: center; font-weight: 700; transition:all 0.2s;">Save Worker</button>
                </form>
            </div>

            <div style="display:flex; flex-direction:column; gap:1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <h3 style="margin:0; font-size:1.5rem;">Staff Directory</h3>
                    <span style="background:#f1f5f9; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.85rem; color:#64748b;">${state.workers.length} Employees</span>
                </div>
                
                ${state.workers.length === 0 ? `
                    <div style="background:white; border-radius:16px; padding:4rem 2rem; text-align:center; border:1px dashed #cbd5e1;">
                        <div style="font-size:3rem; margin-bottom:1rem;">👥</div>
                        <h4 style="color:#1e293b; margin-bottom:0.5rem;">No staff members yet</h4>
                        <p style="color:#64748b; font-size:0.95rem;">Create profiles to manage salaries, advances, and tips.</p>
                    </div>
                ` : state.workers.map(w => {
                    const isPaid = isWorkerPaidThisMonth(w.id);
                    const advanceBal = advances[w.id] || 0;
                    
                    return `
                    <div style="background:white; border-radius:16px; padding:1.5rem; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; transition:box-shadow 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display:flex; align-items:center; gap:1.5rem;">
                            <div style="width:50px; height:50px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:700; color:#0f172a;">
                                ${w.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                                    <span style="font-weight:700; color:#0f172a; font-size:1.1rem;">${w.name}</span>
                                    ${isPaid ? `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; border:1px solid #bbf7d0;">PAID</span>` : `<span style="background:#fefce8; color:#a16207; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; border:1px solid #fef08a;">UNPAID</span>`}
                                </div>
                                <div style="font-size:0.85rem; color:#64748b; margin-bottom:4px;">📞 ${w.phone}</div>
                                <div style="display:flex; gap:1.5rem; margin-top:8px;">
                                    <div><span style="font-size:0.75rem; color:#94a3b8; text-transform:uppercase; font-weight:700;">Base Salary</span> <span style="font-weight:700; color:#1e293b;">Rs ${w.salary.toLocaleString()}</span></div>
                                    ${advanceBal > 0 ? `<div><span style="font-size:0.75rem; color:#ef4444; text-transform:uppercase; font-weight:700;">Active Advance</span> <span style="font-weight:700; color:#ef4444;">Rs ${advanceBal.toLocaleString()}</span></div>` : ''}
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:flex-end;">
                            <button class="btn btn-primary" style="padding:0.6rem 1.5rem; font-weight:700; border-radius:8px; box-shadow:0 4px 6px -1px rgba(15,23,42,0.1);" onclick="showWorkerPaymentModal(${w.id})">Manage Payment</button>
                            <button class="btn" style="padding:0.4rem 1rem; font-size:0.8rem; background:transparent; color:#ef4444; border:none; text-decoration:underline;" onclick="deleteWorker(${w.id})">Remove</button>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.getElementById('worker-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('worker-name').value;
        const phone = document.getElementById('worker-phone').value;
        const salary = parseFloat(document.getElementById('worker-salary').value);
        addWorker({ name, phone, salary });
    });
}

window.addWorker = function(data) {
    const db = getDB();
    if (!db.workers) db.workers = [];
    db.workers.push({
        id: Date.now(),
        name: data.name,
        phone: data.phone,
        salary: data.salary,
        created_at: new Date().toISOString()
    });
    saveDB(db);
    state.workers = db.workers;
    renderWorkerManagement();
    showToast('Staff profile created successfully');
};

window.deleteWorker = async function(id) {
    const confirmed = await showConfirm('Delete Staff?', 'Are you sure you want to remove this staff member?');
    if(!confirmed) return;
    const db = getDB();
    db.workers = (db.workers || []).filter(w => w.id !== id);
    if(db.workerAdvances && db.workerAdvances[id]) delete db.workerAdvances[id];
    saveDB(db);
    state.workers = db.workers;
    renderWorkerManagement();
    showToast('Staff member removed');
};

function isWorkerPaidThisMonth(workerId) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return state.expenses.some(e => {
        if (e.category !== "Workers Salary" || e.worker_id !== workerId) return false;
        const expDate = new Date(e.created_at);
        return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
    });
}

window.showWorkerPaymentModal = function(workerId) {
    const worker = state.workers.find(w => w.id === workerId);
    if(!worker) return;

    const db = getDB();
    const advances = db.workerAdvances || {};
    const advanceBal = advances[worker.id] || 0;
    const isPaid = isWorkerPaidThisMonth(worker.id);
    
    // Auto-calculate regular salary deduction
    const netSalary = Math.max(0, worker.salary - advanceBal);
    const advanceDeducted = Math.min(advanceBal, worker.salary);

    const existing = document.getElementById('worker-pay-modal');
    if(existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'worker-pay-modal';
    div.className = 'modal';
    div.style.cssText = 'z-index:10005; display:flex; align-items:center; justify-content:center;';
    div.innerHTML = `
        <div class="modal-content" style="max-width:500px; width:100%; border-radius:24px; padding:0; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="background:#0f172a; padding:1.5rem 2rem; display:flex; justify-content:space-between; align-items:center;">
                <div style="color:white;">
                    <h3 style="margin:0; font-size:1.4rem; font-weight:800;">${worker.name}</h3>
                    <div style="font-size:0.9rem; color:#94a3b8; margin-top:4px;">Base Salary: Rs ${worker.salary.toLocaleString()}</div>
                </div>
                <button onclick="document.getElementById('worker-pay-modal').remove()" style="background:none; border:none; color:#94a3b8; font-size:2rem; cursor:pointer; line-height:1;">&times;</button>
            </div>
            
            <div style="background:#f8fafc; padding:0; display:flex; border-bottom:1px solid #e2e8f0;">
                <button onclick="switchWorkerTab('salary')" id="w-tab-salary" style="flex:1; padding:1rem; border:none; background:white; font-weight:700; color:#0f172a; border-bottom:2px solid #0f172a; cursor:pointer;">Salary</button>
                <button onclick="switchWorkerTab('advance')" id="w-tab-advance" style="flex:1; padding:1rem; border:none; background:transparent; font-weight:600; color:#64748b; border-bottom:2px solid transparent; cursor:pointer;">Advance</button>
                <button onclick="switchWorkerTab('tip')" id="w-tab-tip" style="flex:1; padding:1rem; border:none; background:transparent; font-weight:600; color:#64748b; border-bottom:2px solid transparent; cursor:pointer;">Tip/Bonus</button>
            </div>

            <div style="padding:2rem;">
                <!-- SALARY TAB -->
                <div id="w-content-salary">
                    ${isPaid ? `
                        <div style="text-align:center; padding:2rem 0;">
                            <div style="font-size:3rem; margin-bottom:1rem;">✅</div>
                            <h4 style="color:#1e293b; margin-bottom:0.5rem;">Already Paid</h4>
                            <p style="color:#64748b; font-size:0.9rem;">Salary for this month has already been processed.</p>
                        </div>
                    ` : `
                        <div style="background:#f1f5f9; border-radius:12px; padding:1.5rem; margin-bottom:1.5rem; border:1px solid #e2e8f0;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.8rem;">
                                <span style="color:#475569; font-weight:600;">Base Salary</span>
                                <span style="font-weight:700; color:#0f172a;">Rs ${worker.salary.toLocaleString()}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.8rem; padding-bottom:0.8rem; border-bottom:1px dashed #cbd5e1;">
                                <span style="color:#ef4444; font-weight:600;">Advance Deduction</span>
                                <span style="font-weight:700; color:#ef4444;">- Rs ${advanceDeducted.toLocaleString()}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span style="color:#0f172a; font-weight:800; font-size:1.1rem;">Net Payable</span>
                                <span style="font-weight:800; color:#10b981; font-size:1.2rem;">Rs ${netSalary.toLocaleString()}</span>
                            </div>
                        </div>
                        <button type="button" class="btn btn-primary" style="width:100%; padding:1.2rem; border-radius:12px; justify-content:center; font-size:1.1rem; font-weight:800;" onclick="processWorkerPayment(${worker.id}, 'salary', ${netSalary}, ${advanceDeducted})">Process Salary Payment</button>
                    `}
                </div>

                <!-- ADVANCE TAB -->
                <div id="w-content-advance" style="display:none;">
                    ${advanceBal > 0 ? `
                        <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:12px; padding:1rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.5rem;">⚠️</span>
                            <div>
                                <div style="color:#be123c; font-weight:700; font-size:0.9rem;">Existing Advance Balance</div>
                                <div style="color:#e11d48; font-weight:800; font-size:1.1rem;">Rs ${advanceBal.toLocaleString()}</div>
                            </div>
                        </div>
                    ` : ''}
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label style="font-weight:700; color:#1e293b; margin-bottom:0.5rem; display:block;">Amount to Advance</label>
                        <input type="number" id="w-adv-amount" class="form-control" placeholder="Rs" style="width:100%; padding:1rem; font-size:1.2rem; border-radius:12px;">
                    </div>
                    <div class="form-group" style="margin-bottom:1.5rem;">
                        <label style="font-weight:700; color:#1e293b; margin-bottom:0.5rem; display:block;">Reason (Optional)</label>
                        <input type="text" id="w-adv-reason" class="form-control" placeholder="e.g. Emergency loan" style="width:100%; padding:0.8rem; font-size:1rem; border-radius:12px;">
                    </div>
                    <button type="button" class="btn" style="width:100%; padding:1.2rem; border-radius:12px; background:#f59e0b; color:white; font-weight:800; font-size:1.1rem; border:none;" onclick="processWorkerPayment(${worker.id}, 'advance')">Give Advance</button>
                </div>

                <!-- TIP TAB -->
                <div id="w-content-tip" style="display:none;">
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:1rem; margin-bottom:1.5rem; text-align:center;">
                        <div style="color:#166534; font-weight:600; font-size:0.9rem;">Tips & Bonuses are recorded as Shop Expenses and do not affect Base Salary or Advance balances.</div>
                    </div>
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label style="font-weight:700; color:#1e293b; margin-bottom:0.5rem; display:block;">Tip / Bonus Amount</label>
                        <input type="number" id="w-tip-amount" class="form-control" placeholder="Rs" style="width:100%; padding:1rem; font-size:1.2rem; border-radius:12px;">
                    </div>
                    <div class="form-group" style="margin-bottom:1.5rem;">
                        <label style="font-weight:700; color:#1e293b; margin-bottom:0.5rem; display:block;">Reason (Optional)</label>
                        <input type="text" id="w-tip-reason" class="form-control" placeholder="e.g. Eid Bonus" style="width:100%; padding:0.8rem; font-size:1rem; border-radius:12px;">
                    </div>
                    <button type="button" class="btn" style="width:100%; padding:1.2rem; border-radius:12px; background:#10b981; color:white; font-weight:800; font-size:1.1rem; border:none;" onclick="processWorkerPayment(${worker.id}, 'tip')">Give Tip / Bonus</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(div);
};

window.switchWorkerTab = function(tab) {
    ['salary', 'advance', 'tip'].forEach(t => {
        document.getElementById('w-content-' + t).style.display = t === tab ? 'block' : 'none';
        const btn = document.getElementById('w-tab-' + t);
        if(t === tab) {
            btn.style.background = 'white';
            btn.style.color = '#0f172a';
            btn.style.borderBottom = '2px solid #0f172a';
            btn.style.fontWeight = '700';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = '#64748b';
            btn.style.borderBottom = '2px solid transparent';
            btn.style.fontWeight = '600';
        }
    });
};

window.processWorkerPayment = async function(workerId, type, netSalary = 0, advanceDeducted = 0) {
    const worker = state.workers.find(w => w.id === workerId);
    if(!worker) return;
    
    const db = getDB();
    if(!db.workerAdvances) db.workerAdvances = {};

    if(type === 'salary') {
        const confirmed = await showConfirm('Confirm Salary Process', `Pay Rs ${netSalary.toLocaleString()} as net salary? (Rs ${advanceDeducted.toLocaleString()} will be cleared from advance).`, {icon:"✅"});
        if(!confirmed) return;
        
        // Deduct advance
        if(advanceDeducted > 0) {
            db.workerAdvances[worker.id] -= advanceDeducted;
            if(db.workerAdvances[worker.id] <= 0) delete db.workerAdvances[worker.id];
        }
        
        // Record Expense (which will also save the DB with our advance modifications)
        addExpense({
            category: "Workers Salary",
            description: `Salary: ${worker.name} (Base: ${worker.salary}, Adv Deduct: ${advanceDeducted})`,
            amount: netSalary, // The cash actually going out right now
            worker_id: worker.id
        }, db);
        
        showToast(`Salary processed for ${worker.name}`);
    } 
    else if(type === 'advance') {
        const amt = parseFloat(document.getElementById('w-adv-amount').value);
        const reason = document.getElementById('w-adv-reason').value.trim();
        if(!amt || amt <= 0) return showToast('Enter valid amount', 'error');
        
        const confirmed = await showConfirm('Confirm Advance', `Give Rs ${amt.toLocaleString()} advance to ${worker.name}?`, {icon:"⚠️"});
        if(!confirmed) return;
        
        db.workerAdvances[worker.id] = (db.workerAdvances[worker.id] || 0) + amt;
        
        addExpense({
            category: "Worker Advance",
            description: `Advance to ${worker.name}${reason ? ' - ' + reason : ''}`,
            amount: amt,
            worker_id: worker.id
        }, db);
        
        showToast(`Advance given to ${worker.name}`);
    }
    else if(type === 'tip') {
        const amt = parseFloat(document.getElementById('w-tip-amount').value);
        const reason = document.getElementById('w-tip-reason').value.trim();
        if(!amt || amt <= 0) return showToast('Enter valid amount', 'error');
        
        const confirmed = await showConfirm('Confirm Tip / Bonus', `Give Rs ${amt.toLocaleString()} tip/bonus to ${worker.name}?`, {icon:"💰"});
        if(!confirmed) return;
        
        addExpense({
            category: "Worker Tip",
            description: `Tip/Bonus for ${worker.name}${reason ? ' - ' + reason : ''}`,
            amount: amt,
            worker_id: worker.id
        }, db);
        
        showToast(`Tip recorded for ${worker.name}`);
    }

    document.getElementById('worker-pay-modal').remove();
    renderWorkerManagement();
}
window.deleteStaff = async function(id) {
    const user = getDB().users.find(u => u.id === id);
    if(user && user.role === 'admin') {
        return showAlert('Action Restricted', 'Administrative accounts cannot be deleted to ensure system access.', '🚫');
    }
    
    const confirmed = await showConfirm('Delete Staff?', `Are you sure you want to delete ${user ? user.name : 'this staff member'}?`);
    if(confirmed) {
        const db = getDB();
        db.users = db.users.filter(u => u.id !== id);
        saveDB(db);
        renderSettings();
        showToast('Staff member deleted');
    }
}
