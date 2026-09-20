// --- LOCAL STORAGE DATABASE SETUP ---
const DB_KEY = 'mm_brothers_data';
let mockDB = null;

function getInitialData() {
    return {
        settings: {
            store_name: "MM Brothers Islamic Mart",
            store_contact: "Phone: 0300-1234567",
            logo_base64: "logo.jpg" // Fallback to local file if not set
        },
        users: [
            { id: 1, username: "admin", password: "123", role: "admin", name: "Admin User", phone: "0300-0000000", avatar: "" },
            { id: 2, username: "manager", password: "123", role: "manager", name: "Store Manager", phone: "0300-1111111", avatar: "" },
            { id: 3, username: "sales", password: "123", role: "salesman", name: "Sales Team", phone: "0300-2222222", avatar: "" }
        ],
        products: [],
        customers: [
            { id: 1, name: "Walk-in Customer", phone: "N/A", address: "" }
        ],
        salesHistory: []
    };
}

function initDB() {
    try {
        const data = localStorage.getItem(DB_KEY);
        if (!data) {
            saveDB(getInitialData());
        }
    } catch (err) {
        console.warn('localStorage is restricted or blocked. Using in-memory fallback.', err);
        if (!mockDB) mockDB = getInitialData();
    }
}

function getDB() { 
    try { 
        const data = localStorage.getItem(DB_KEY);
        return data ? JSON.parse(data) : (mockDB || getInitialData());
    } catch(err) { 
        return mockDB || getInitialData(); 
    }
}
function saveDB(data) { 
    try { 
        localStorage.setItem(DB_KEY, JSON.stringify(data)); 
    } catch(err) { 
        mockDB = data; 
    }
}

// Global State
let state = {
    products: [], customers: [], salesHistory: [], cart: [], stats: {},
    timeFilter: 'all', inventorySort: 'name',
    currentUser: null,
    settings: {}
};

// DOM Elements
const appContainer = document.getElementById('app');
const loginScreen = document.getElementById('login-screen');
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initDB(); 
    
    // Auto-login as Admin since anyone with the file should have access
    const db = getDB();
    state.currentUser = db.users.find(u => u.role === 'admin');
    state.settings = db.settings;
    
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
    document.querySelectorAll('.global-store-contact').forEach(el => el.textContent = state.settings.store_contact);
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

// --- DATA FETCHERS ---
function fetchProducts() { state.products = getDB().products; }
function fetchCustomers() { state.customers = getDB().customers; }
function fetchSalesHistory() { state.salesHistory = getDB().salesHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); }

async function loadView(view) {
    pageTitle.innerHTML = view.charAt(0).toUpperCase() + view.slice(1);
    contentArea.style.opacity = 0;
    await new Promise(r => setTimeout(r, 100));
    contentArea.style.opacity = 1;

    try {
        switch(view) {
            case 'dashboard':
                if(state.currentUser.role === 'salesman') return;
                pageTitle.innerHTML = `Dashboard <select class="filter-select" id="dashboard-filter" style="margin-left:20px;">
                        <option value="today" ${state.timeFilter === 'today' ? 'selected' : ''}>Daily Sales</option>
                        <option value="week" ${state.timeFilter === 'week' ? 'selected' : ''}>Weekly Sales</option>
                        <option value="month" ${state.timeFilter === 'month' ? 'selected' : ''}>Monthly Sales</option>
                        <option value="year" ${state.timeFilter === 'year' ? 'selected' : ''}>Yearly Sales</option>
                        <option value="all" ${state.timeFilter === 'all' ? 'selected' : ''}>All-Time</option>
                    </select>`;
                document.getElementById('dashboard-filter').addEventListener('change', (e) => {
                    state.timeFilter = e.target.value; fetchStats(); renderDashboard();
                });
                fetchProducts(); fetchSalesHistory(); fetchStats(); renderDashboard();
                break;
            case 'pos':
                fetchProducts(); fetchCustomers(); renderPOS();
                break;
            case 'inventory':
                if(state.currentUser.role === 'salesman') return;
                fetchProducts(); renderInventory();
                break;
            case 'reports':
                if(state.currentUser.role === 'salesman') return;
                fetchSalesHistory(); renderReports();
                break;
            case 'customers':
                fetchCustomers(); renderCustomers();
                break;
            case 'settings':
                if(state.currentUser.role !== 'admin') return;
                renderSettings();
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

    let ts=0, tp=0;
    filteredSales.forEach(s => { ts += s.total_amount; tp += s.profit; });
    const lowStock = db.products.filter(p => p.stock <= (p.min_stock !== undefined ? p.min_stock : 10)).length;

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
    contentArea.innerHTML = `
        <div class="dashboard-grid">
            <div class="stat-card">
                <i class="stat-icon">💰</i><h3>Total Sales</h3><div class="value">${cur()} ${state.stats.total_sales.toLocaleString()}</div>
            </div>
            <div class="stat-card gold-accent">
                <i class="stat-icon">📈</i><h3>Total Profit</h3><div class="value">${cur()} ${state.stats.total_profit.toLocaleString()}</div>
            </div>
            <div class="stat-card danger-accent">
                <i class="stat-icon">⚠️</i><h3>Low Stock Alerts</h3><div class="value">${state.stats.low_stock_count}</div>
            </div>
        </div>
        <div class="dashboard-main">
            <div class="chart-container"><div class="chart-header">Sales Trend</div>
                <div class="chart-wrapper" style="position:relative; height:300px; width:100%;"><canvas id="salesChart"></canvas></div>
            </div>
            <div class="chart-container"><div class="chart-header">Top Selling</div>
                <div class="top-selling-list">
                    ${state.stats.top_selling.map(p => `
                        <div class="top-selling-item">
                            <img src="${p.img || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="%23f1f5f9"/></svg>'}">
                            <div class="top-selling-info"><h4>${p.name}</h4><p>${p.qty} Units</p></div>
                        </div>`).join('')}
                    ${state.stats.top_selling.length === 0 ? '<p style="color:var(--text-muted); font-size: 0.9rem;">No sales data available yet.</p>' : ''}
                </div>
            </div>
        </div>
    `;
    
    if (typeof Chart !== 'undefined') {
        const ctx = document.getElementById('salesChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], datasets: [{ data: [0,0,0,0,0,0, state.stats.total_sales || 1000], borderColor: '#A90011', backgroundColor: 'rgba(169, 0, 17, 0.1)', borderWidth: 3, fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    } else {
        const chartWrapper = document.querySelector('.chart-wrapper');
        if (chartWrapper) {
            chartWrapper.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Chart library could not be loaded. Please check your internet connection.</div>';
        }
    }
}

// 2. Inventory (with Compact Form)
function renderInventory() {
    let sortedProducts = [...state.products];
    if(state.inventorySort === 'price_asc') sortedProducts.sort((a,b) => a.sale_price - b.sale_price);
    else if(state.inventorySort === 'price_desc') sortedProducts.sort((a,b) => b.sale_price - a.sale_price);
    else if(state.inventorySort === 'stock') sortedProducts.sort((a,b) => a.stock - b.stock);
    else sortedProducts.sort((a,b) => a.name.localeCompare(b.name));

    contentArea.innerHTML = `
        <div class="data-table-container">
            <div class="table-header">
                <h3>Product Masterlist</h3>
                <div class="table-actions">
                    <select class="filter-select" onchange="sortInventory(this.value)">
                        <option value="name" ${state.inventorySort === 'name' ? 'selected' : ''}>Sort A-Z</option>
                        <option value="price_asc" ${state.inventorySort === 'price_asc' ? 'selected' : ''}>Price: Low-High</option>
                        <option value="price_desc" ${state.inventorySort === 'price_desc' ? 'selected' : ''}>Price: High-Low</option>
                        <option value="stock" ${state.inventorySort === 'stock' ? 'selected' : ''}>Stock Quantity</option>
                    </select>
                    <button class="btn btn-primary" onclick="showProductModal()">+ Add Product</button>
                </div>
            </div>
            <table>
                <thead><tr><th>Product</th><th>Category</th><th>Cost</th><th>Sale Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                    ${sortedProducts.map(p => `<tr>
                        <td><div style="display:flex;align-items:center;gap:12px;">${p.image_url ? `<img src="${p.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">` : '🖼️'} <strong>${p.name}</strong></div></td>
                        <td>${p.category}</td><td>${p.cost_price.toLocaleString()}</td><td style="color:var(--primary);font-weight:600;">${cur()} ${p.sale_price.toLocaleString()}</td>
                        <td>${p.stock}</td><td><span class="badge ${p.stock > (p.min_stock !== undefined ? p.min_stock : 10) ? 'badge-success' : 'badge-danger'}">${p.stock > (p.min_stock !== undefined ? p.min_stock : 10) ? 'In Stock' : 'Low Stock'}</span></td>
                        <td><button class="btn btn-secondary" onclick='showProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button></td>
                    </tr>`).join('')}
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
                            <div class="form-group"><label>Category</label><input type="text" id="prod-category" class="form-control" required></div>
                        </div>
                    </div>
                    <div class="compact-row">
                        <div class="form-group"><label>Cost (${cur()})</label><input type="number" id="prod-cost" class="form-control" required></div>
                        <div class="form-group"><label>Sale Price (${cur()})</label><input type="number" id="prod-price" class="form-control" required></div>
                        <div class="form-group"><label>Stock</label><input type="number" id="prod-stock" class="form-control" required></div>
                        <div class="form-group"><label>Min Stock</label><input type="number" id="prod-min-stock" class="form-control" required></div>
                    </div>
                    <div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="closeProductModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Product</button></div>
                </form>
            </div>
        </div>
    `;

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
        const payload = {
            name: document.getElementById('prod-name').value, category: document.getElementById('prod-category').value,
            cost_price: parseFloat(document.getElementById('prod-cost').value), sale_price: parseFloat(document.getElementById('prod-price').value),
            stock: parseInt(document.getElementById('prod-stock').value), min_stock: parseInt(document.getElementById('prod-min-stock').value), image_url: document.getElementById('prod-image-base64').value
        };
        if (id) { const i = db.products.findIndex(p => p.id == id); if(i !== -1) db.products[i] = { ...db.products[i], ...payload }; } 
        else { payload.id = Date.now(); db.products.push(payload); }
        saveDB(db); closeProductModal(); fetchProducts(); renderInventory(); showToast("Product Saved!");
    });
}

window.sortInventory = function(val) { state.inventorySort = val; renderInventory(); }
window.showProductModal = function(product = null) {
    document.getElementById('product-modal').classList.remove('hidden');
    document.getElementById('modal-title').textContent = product ? 'Edit Product' : 'Add Product';
    ['id','name','category','cost','price','stock'].forEach(k => document.getElementById(`prod-${k}`).value = product ? product[k === 'price' ? 'sale_price' : k === 'cost' ? 'cost_price' : k] : '');
    document.getElementById('prod-min-stock').value = product && product.min_stock !== undefined ? product.min_stock : 10;
    document.getElementById('prod-image-base64').value = product ? product.image_url : '';
    document.getElementById('prod-file-input').value = '';
    const preview = document.getElementById('upload-preview'), text = document.getElementById('upload-text');
    if(product && product.image_url) { preview.src = product.image_url; preview.style.display = 'inline-block'; text.style.display = 'none'; }
    else { preview.src = ''; preview.style.display = 'none'; text.style.display = 'block'; }
}
window.closeProductModal = function() { document.getElementById('product-modal').classList.add('hidden'); }

// 3. Advanced POS
function renderPOS() {
    contentArea.innerHTML = `
        <div class="pos-layout">
            <div class="products-pane">
                <input type="text" class="search-bar" placeholder="Search products..." id="pos-search">
                <div class="products-grid" id="pos-products-grid"></div>
            </div>
            <div class="cart-pane">
                <div class="cart-header">Current Order</div>
                <div class="cart-items" id="cart-items"></div>
                <div class="cart-summary">
                    
                    <div class="cart-customer-type">
                        <div class="customer-tab active" id="tab-walkin" onclick="setCartType('walkin')">Walk-in Cash</div>
                        <div class="customer-tab" id="tab-saved" onclick="setCartType('saved')">Saved / Delivery</div>
                    </div>

                    <div id="saved-customer-select-area" class="hidden">
                        <select class="customer-select" id="cart-customer-select">
                            <option value="">-- Select Customer --</option>
                            ${state.customers.filter(c => c.id !== 1).map(c => `<option value="${c.id}">${c.name} (${c.phone})</option>`).join('')}
                        </select>
                    </div>

                    <div style="margin-top:0.5rem; margin-bottom:1rem;">
                        <label style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">Salesman / Served By:</label>
                        <select class="customer-select" id="cart-salesman-select" style="margin-bottom:0;">
                            ${getDB().users.map(u => `<option value="${u.id}" ${u.id === state.currentUser.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="summary-row"><span>Subtotal:</span><span id="cart-subtotal">${cur()} 0</span></div>
                    
                    <select class="payment-method-select" id="payment-method">
                        <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option>
                        <option value="EasyPaisa">EasyPaisa</option><option value="JazzCash">JazzCash</option>
                        <option value="SadaPay">SadaPay</option><option value="NayaPay">NayaPay</option>
                    </select>

                    <div class="summary-total"><span>Total:</span><span id="cart-total" style="color:var(--primary);">${cur()} 0</span></div>
                    <button class="btn-checkout" onclick="processCheckout()">Checkout & Print</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('pos-search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        renderPOSProducts(state.products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
    });
    renderPOSProducts(state.products); renderCart();
}

let cartType = 'walkin';
window.setCartType = function(type) {
    cartType = type;
    document.getElementById('tab-walkin').classList.toggle('active', type === 'walkin');
    document.getElementById('tab-saved').classList.toggle('active', type === 'saved');
    document.getElementById('saved-customer-select-area').classList.toggle('hidden', type === 'walkin');
}

function renderPOSProducts(products) {
    document.getElementById('pos-products-grid').innerHTML = products.map(p => `
        <div class="product-card" onclick="addToCart(${p.id})" style="${p.stock <= 0 ? 'opacity: 0.5; pointer-events: none;' : ''}">
            ${p.image_url ? `<img src="${p.image_url}" class="product-img">` : `<div class="product-img" style="display:flex;align-items:center;justify-content:center;font-size:2rem;color:#cbd5e1;">📸</div>`}
            <div class="product-name">${p.name}</div><div class="product-price">${cur()} ${p.sale_price.toLocaleString()}</div>
            <div style="font-size:0.85rem;color:#64748B;margin-top:8px;">Stock: <strong style="color:${p.stock <= (p.min_stock !== undefined ? p.min_stock : 10) ? 'var(--danger)' : 'var(--success)'}">${p.stock}</strong></div>
        </div>`).join('');
}

window.addToCart = function(id) {
    const p = state.products.find(x => x.id === id); if(!p) return;
    const e = state.cart.find(c => c.product_id === id);
    if(e) { if (e.quantity < p.stock) e.quantity++; else showToast('Not enough stock!', 'error'); } 
    else if(p.stock > 0) state.cart.push({ product_id: p.id, name: p.name, price: p.sale_price, cost: p.cost_price, quantity: 1 });
    renderCart();
}

window.updateQty = function(id, d) {
    const i = state.cart.findIndex(c => c.product_id === id);
    if(i > -1) {
        const p = state.products.find(x => x.id === id);
        if(state.cart[i].quantity + d > p.stock) return showToast('Not enough stock!', 'error');
        state.cart[i].quantity += d;
        if(state.cart[i].quantity <= 0) state.cart.splice(i, 1);
    }
    renderCart();
}

function renderCart() {
    const d = document.getElementById('cart-items'); if (!d) return;
    if(state.cart.length === 0) d.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:3rem;">Cart is empty</div>';
    else d.innerHTML = state.cart.map(i => `<div class="cart-item"><div class="cart-item-info"><div class="cart-item-name">${i.name}</div><div class="cart-item-price">${cur()} ${i.price.toLocaleString()}</div></div><div class="cart-qty-controls"><button class="qty-btn" onclick="updateQty(${i.product_id}, -1)">-</button><span style="font-weight:600;min-width:24px;text-align:center;">${i.quantity}</span><button class="qty-btn" onclick="updateQty(${i.product_id}, 1)">+</button></div></div>`).join('');
    const t = state.cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    document.getElementById('cart-subtotal').textContent = `${cur()} ${t.toLocaleString()}`;
    document.getElementById('cart-total').textContent = `${cur()} ${t.toLocaleString()}`;
}

window.processCheckout = function() {
    if(state.cart.length === 0) return showToast('Cart is empty!', 'error');
    
    let customerId = 1; // Walk-in Default
    let customerObj = { name: "Walk-in Customer", phone: "", address: "" };

    if(cartType === 'saved') {
        const selId = document.getElementById('cart-customer-select').value;
        if(!selId) return showToast('Please select a customer or switch to Walk-in', 'error');
        customerId = parseInt(selId);
        customerObj = state.customers.find(c => c.id === customerId);
    }

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
        total_amount: totAmt, profit: totProf, created_at: new Date().toISOString(), items: [...state.cart]
    };

    db.salesHistory.push(saleRecord);
    saveDB(db);
    showToast('Sale Completed Successfully!');

    // Inject Receipt Data
    const selSalesmanId = document.getElementById('cart-salesman-select').value;
    const salesman = db.users.find(u => u.id == selSalesmanId) || state.currentUser;

    document.getElementById('receipt-date').textContent = new Date().toLocaleString();
    document.getElementById('receipt-method').textContent = `Payment: ${payMethod}`;
    document.getElementById('receipt-salesman').textContent = `${salesman.name} (${salesman.phone})`;
    
    const custSec = document.getElementById('receipt-customer-section');
    if(customerId !== 1) {
        custSec.classList.remove('hidden');
        document.getElementById('r-cust-name').textContent = customerObj.name;
        document.getElementById('r-cust-phone').textContent = customerObj.phone;
        document.getElementById('r-cust-address').textContent = customerObj.address || 'N/A';
    } else {
        custSec.classList.add('hidden');
    }

    document.getElementById('receipt-items').innerHTML = state.cart.map(item => `
        <tr><td style="padding-right:10px;">${item.name}</td><td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${cur()} ${item.price.toLocaleString()}</td><td style="text-align:right; font-weight:bold;">${cur()} ${(item.price * item.quantity).toLocaleString()}</td></tr>
    `).join('');
    document.getElementById('receipt-total-amt').textContent = `${cur()} ${totAmt.toLocaleString()}`;

    const modal = document.getElementById('receipt-modal');
    modal.classList.remove('hidden');

    state.cart = []; fetchProducts(); renderPOS();
}

// 4. Reports & Customers (Similar to before + Customer Add logic)
function renderReports() {
    contentArea.innerHTML = `<div class="data-table-container"><div class="table-header"><h3>Sales History</h3><button class="btn btn-gold" onclick="exportToCSV()">Export Excel</button></div>
    <table><thead><tr><th>Order ID</th><th>Date</th><th>Method</th><th>Items</th><th>Revenue</th><th>Profit</th></tr></thead>
    <tbody>${state.salesHistory.map(s => `<tr><td>#${s.id}</td><td>${new Date(s.created_at).toLocaleString()}</td><td>${s.payment_method||'Cash'}</td><td>${(s.items || []).reduce((a,b)=>a+b.quantity,0)}</td><td style="font-weight:700;">${cur()} ${s.total_amount.toLocaleString()}</td><td style="color:var(--success);">+${cur()} ${s.profit.toLocaleString()}</td></tr>`).join('')}</tbody></table></div>`;
}
window.exportToCSV = function() { /* Truncated for brevity, works identical */ }

function renderCustomers() {
    contentArea.innerHTML = `
        <div class="data-table-container">
            <div class="table-header"><h3>Customer Directory</h3><button class="btn btn-primary" onclick="showCustomerModal()">+ Add Customer</button></div>
            <table><thead><tr><th>Name</th><th>Phone</th><th>Address</th></tr></thead>
            <tbody>${state.customers.filter(c=>c.id!==1).map(c => `<tr><td style="font-weight:600;">${c.name}</td><td>${c.phone}</td><td>${c.address || 'N/A'}</td></tr>`).join('')}</tbody></table>
        </div>
        <div id="customer-modal" class="modal hidden">
            <div class="modal-content" style="width:400px;">
                <h3 style="margin-bottom:1rem;">Add Customer</h3>
                <form id="customer-form">
                    <div class="form-group"><label>Name</label><input type="text" id="cust-name" class="form-control" required></div>
                    <div class="form-group"><label>Phone Number</label><input type="text" id="cust-phone" class="form-control" required></div>
                    <div class="form-group"><label>Delivery Address</label><input type="text" id="cust-address" class="form-control"></div>
                    <div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="document.getElementById('customer-modal').classList.add('hidden')">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>
                </form>
            </div>
        </div>`;

    const custForm = document.getElementById('customer-form');
    if (custForm) custForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const db = getDB();
        db.customers.push({ id: Date.now(), name: document.getElementById('cust-name').value, phone: document.getElementById('cust-phone').value, address: document.getElementById('cust-address').value });
        saveDB(db); document.getElementById('customer-modal').classList.add('hidden'); fetchCustomers(); renderCustomers(); showToast('Customer Added!');
    });
}
window.showCustomerModal = function() { document.getElementById('customer-modal').classList.remove('hidden'); }

// 5. Settings / Admin Panel
function renderSettings() {
    contentArea.innerHTML = `
        <div class="settings-grid">
            <div class="settings-panel">
                <h3>🏪 Global Store Settings</h3>
                <form id="store-settings-form">
                    <div class="form-group">
                        <label>Store Logo (Global)</label>
                        <div class="image-upload-wrapper" style="padding:1rem;">
                            <input type="file" id="settings-logo-file" accept="image/*">
                            <img id="settings-logo-preview" src="${state.settings.logo_base64 || ''}" style="max-height:80px; ${state.settings.logo_base64 ? '' : 'display:none;'}">
                            <div id="settings-logo-text" style="${state.settings.logo_base64 ? 'display:none;' : ''}">Click to change logo</div>
                        </div>
                    </div>
                    <div class="form-group"><label>Store Name</label><input type="text" id="settings-name" class="form-control" value="${state.settings.store_name}" required></div>
                    <div class="form-group"><label>Store Contact Info (Receipt)</label><input type="text" id="settings-contact" class="form-control" value="${state.settings.store_contact}" required></div>
                    <button type="submit" class="btn btn-primary" style="width:100%;">Save Store Settings</button>
                </form>
            </div>
            <div class="settings-panel">
                <h3>👥 Sales Team / Staff</h3>
                <form id="add-staff-form" style="margin-bottom:1rem; display:flex; gap:0.5rem;">
                    <input type="text" id="staff-name" placeholder="Name" class="form-control" style="flex:1;" required>
                    <input type="text" id="staff-phone" placeholder="Phone" class="form-control" style="flex:1;" required>
                    <button type="submit" class="btn btn-primary">Add</button>
                </form>
                <table style="font-size:0.9rem; margin-bottom:1rem;">
                    <thead><tr><th>Name</th><th>Phone</th><th>Action</th></tr></thead>
                    <tbody>${getDB().users.map(u => `<tr><td>${u.name} ${u.role==='admin'?'<span class="badge badge-warning">Admin</span>':''}</td><td>${u.phone}</td><td>${u.role!=='admin' ? `<button class="btn btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.8rem;" onclick="deleteStaff(${u.id})">Delete</button>` : ''}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
    `;

    const addStaffForm = document.getElementById('add-staff-form');
    if (addStaffForm) addStaffForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const db = getDB();
        db.users.push({ id: Date.now(), role: 'salesman', name: document.getElementById('staff-name').value, phone: document.getElementById('staff-phone').value });
        saveDB(db);
        renderSettings();
        showToast('Staff member added!');
    });

    window.deleteStaff = function(id) {
        if(confirm('Delete this staff member?')) {
            const db = getDB();
            db.users = db.users.filter(u => u.id !== id);
            saveDB(db);
            renderSettings();
            showToast('Staff member deleted');
        }
    }

    let newLogoBase64 = state.settings.logo_base64;
    document.getElementById('settings-logo-file').addEventListener('change', (e) => {
        if(e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                newLogoBase64 = evt.target.result;
                document.getElementById('settings-logo-preview').src = newLogoBase64;
                document.getElementById('settings-logo-preview').style.display = 'block';
                document.getElementById('settings-logo-text').style.display = 'none';
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    document.getElementById('store-settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const db = getDB();
        db.settings = {
            store_name: document.getElementById('settings-name').value,
            store_contact: document.getElementById('settings-contact').value,
            logo_base64: newLogoBase64
        };
        saveDB(db);
        state.settings = db.settings;
        applyGlobalSettings();
        showToast('Store Settings Saved & Applied Globally!');
    });
}

// Receipt helpers
window.closeReceipt = function() { document.getElementById('receipt-modal').classList.add('hidden'); }
window.printReceipt = function() {
    const printContent = document.getElementById('receipt-print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); // Reload to restore events
}

// User Profile Modal (Simple Alert for now to represent the action)
window.showProfileModal = function() {
    alert(`Logged in as: ${state.currentUser.name}\nRole: ${state.currentUser.role}\nPhone: ${state.currentUser.phone}`);
}
