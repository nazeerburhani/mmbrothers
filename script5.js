const fs = require('fs');
let code = fs.readFileSync('public/js/app2.js', 'utf8');

// 1. Add categories to state and fetchCategories
code = code.replace(/products: \[\], customers: \[\], salesHistory: \[\], cart: \[\], stats: \{\},/, `products: [], customers: [], salesHistory: [], cart: [], stats: {}, categories: [],`);
code = code.replace(/function fetchSalesHistory\(\) \{.*?\}/, `$&
function fetchCategories() { state.categories = getDB().categories || []; }`);

// 2. Add financials to loadView switch
code = code.replace(/case 'settings':/, `case 'financials':
                if(state.currentUser.role !== 'admin') return;
                fetchSalesHistory(); fetchProducts(); renderFinancials();
                break;
            case 'settings':`);

// 3. Update Inventory UI to add Manage Categories and use Select dropdown
code = code.replace(/<button class="btn btn-primary" onclick="showProductModal\(\)">\+ Add Product<\/button>/, `<button class="btn btn-secondary" onclick="showCategoryModal()" style="margin-right:10px;">🏷️ Manage Categories</button><button class="btn btn-primary" onclick="showProductModal()">+ Add Product</button>`);

// 4. Update the Category input to a select in product-modal
code = code.replace(/<input type="text" id="prod-category" class="form-control" required>/, `<select id="prod-category" class="form-control" required></select>`);

// 5. Add populate categories logic inside showProductModal
code = code.replace(/window\.showProductModal = function\(product = null\) \{/, `window.showProductModal = function(product = null) {
    const catSelect = document.getElementById('prod-category');
    catSelect.innerHTML = '<option value="">-- Select Category --</option>' + state.categories.map(c => \`<option value="\${c.name}">\${c.name}</option>\`).join('');
`);

// 6. Add renderFinancials and showCategoryModal functions at the end
const financialsAndCategories = `
// --- FINANCIALS & CATEGORIES ---
function renderFinancials() {
    const db = getDB();
    const inventoryValue = state.products.reduce((sum, p) => sum + (p.cost_price * p.stock), 0);
    const zakat = inventoryValue * 0.025; // 2.5% of total stock value
    
    // Time filtered sales
    const now = new Date();
    let dSales=0, dProf=0, wSales=0, wProf=0, mSales=0, mProf=0, ySales=0, yProf=0;
    
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

    contentArea.innerHTML = \`
        <div class="stats-grid" style="margin-bottom: 2rem;">
            <div class="stat-card" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white;">
                <div class="stat-title" style="color:#cbd5e1;">Total Inventory Value (Cost)</div>
                <div class="stat-value">Rs \${inventoryValue.toLocaleString()}</div>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #b45309, #78350f); color: white;">
                <div class="stat-title" style="color:#fde68a;">Estimated Zakat (2.5%)</div>
                <div class="stat-value">Rs \${zakat.toLocaleString()}</div>
            </div>
        </div>

        <h3 style="margin-bottom:1rem;">Sales & Profit Breakdown</h3>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-title">Daily Sales & Profit</div>
                <div class="stat-value" style="font-size:1.2rem;">Rs \${dSales.toLocaleString()}</div>
                <div style="color:var(--success); font-weight:bold;">+Rs \${dProf.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Weekly Sales & Profit</div>
                <div class="stat-value" style="font-size:1.2rem;">Rs \${wSales.toLocaleString()}</div>
                <div style="color:var(--success); font-weight:bold;">+Rs \${wProf.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Monthly Sales & Profit</div>
                <div class="stat-value" style="font-size:1.2rem;">Rs \${mSales.toLocaleString()}</div>
                <div style="color:var(--success); font-weight:bold;">+Rs \${mProf.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Yearly Sales & Profit</div>
                <div class="stat-value" style="font-size:1.2rem;">Rs \${ySales.toLocaleString()}</div>
                <div style="color:var(--success); font-weight:bold;">+Rs \${yProf.toLocaleString()}</div>
            </div>
        </div>
    \`;
}

window.showCategoryModal = function() {
    const existing = document.getElementById('category-modal');
    if(existing) existing.remove();
    
    const div = document.createElement('div');
    div.id = 'category-modal';
    div.className = 'modal';
    div.innerHTML = \`
        <div class="modal-content" style="max-width: 400px;">
            <h3 style="margin-bottom:1rem;">Manage Categories</h3>
            <form id="add-category-form" style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                <input type="text" id="new-cat-name" class="form-control" placeholder="New Category Name" required style="flex:1;">
                <button type="submit" class="btn btn-primary">Add</button>
            </form>
            <table style="width:100%; text-align:left; font-size:0.9rem;">
                <thead><tr><th>Category Name</th><th>Action</th></tr></thead>
                <tbody id="category-list">
                    \${state.categories.map(c => \`<tr><td style="padding:0.5rem;">\${c.name}</td><td><button type="button" class="btn btn-secondary" style="padding:0.2rem 0.5rem;" onclick="deleteCategory(\${c.id})">Delete</button></td></tr>\`).join('')}
                </tbody>
            </table>
            <div style="text-align:right; margin-top:1rem;">
                <button class="btn btn-secondary" onclick="document.getElementById('category-modal').remove()">Close</button>
            </div>
        </div>
    \`;
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

window.deleteCategory = function(id) {
    if(!confirm('Delete this category?')) return;
    const db = getDB();
    db.categories = db.categories.filter(c => c.id !== id);
    saveDB(db);
    state.categories = db.categories;
    showToast('Category deleted!');
    showCategoryModal(); // Refresh modal
};
`;

code += financialsAndCategories;

// Important: Also add fetchCategories to inventory loading so it's ready when the modal opens
code = code.replace(/case 'inventory':\s*if\(state.currentUser.role === 'salesman'\) return;\s*fetchProducts\(\); renderInventory\(\);/g, `case 'inventory':
                if(state.currentUser.role === 'salesman') return;
                fetchProducts(); fetchCategories(); renderInventory();`);

fs.writeFileSync('public/js/app2.js', code);
