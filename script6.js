const fs = require('fs');
let code = fs.readFileSync('public/js/app2.js', 'utf8');

const renderInventoryStr = `// 2. Inventory (with Compact Form)
window.searchInventory = function(val) { state.inventorySearch = val; renderInventoryTable(); }

function renderInventoryTable() {
    let filteredProducts = [...state.products];
    if(state.inventoryFilter === 'low') {
        filteredProducts = filteredProducts.filter(p => p.stock <= (p.low_stock_threshold !== undefined ? p.low_stock_threshold : 10));
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
        const isLow = p.stock <= (p.low_stock_threshold !== undefined ? p.low_stock_threshold : 10);
        return \`<tr style="\${isLow ? 'background-color: #fff1f2;' : ''}">
        <td><div style="display:flex;align-items:center;gap:12px;">\${p.image_url ? \`<img src="\${p.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">\` : '📦'} <strong>\${p.name}</strong></div></td>
        <td>\${p.category}</td><td>\${p.cost_price.toLocaleString()}</td><td style="color:var(--primary);font-weight:600;">Rs \${p.sale_price.toLocaleString()}</td>
        <td><strong style="color:\${isLow ? 'var(--danger)' : 'inherit'};">\${p.stock}</strong></td><td><span class="badge \${!isLow ? 'badge-success' : 'badge-danger'}">\${!isLow ? 'In Stock' : '⚠️ Low Stock'}</span></td>
        <td><button class="btn btn-secondary" onclick='showProductModal(\${JSON.stringify(p).replace(/'/g, "&#39;")})'>Edit</button></td>
    </tr>\`}).join('');
}

function renderInventory() {
    contentArea.innerHTML = \`
        <div class="data-table-container">
            <div class="table-header">
                <h3>Product Masterlist</h3>
                <div class="table-actions">
                    <input type="text" placeholder="Search by name or category..." class="form-control" style="width: 250px; display: inline-block; margin-right: 10px;" oninput="searchInventory(this.value)" value="\${state.inventorySearch || ''}">
                    <select class="filter-select" onchange="filterInventory(this.value)" style="margin-right:10px;">
                        <option value="all" \${state.inventoryFilter === 'all' ? 'selected' : ''}>All Products</option>
                        <option value="low" \${state.inventoryFilter === 'low' ? 'selected' : ''}>⚠️ Low Stock Only</option>
                    </select>
                    <select class="filter-select" onchange="sortInventory(this.value)">
                        <option value="name" \${state.inventorySort === 'name' ? 'selected' : ''}>Sort A-Z</option>
                        <option value="category" \${state.inventorySort === 'category' ? 'selected' : ''}>Sort by Category</option>
                        <option value="price_asc" \${state.inventorySort === 'price_asc' ? 'selected' : ''}>Price: Low-High</option>
                        <option value="price_desc" \${state.inventorySort === 'price_desc' ? 'selected' : ''}>Price: High-Low</option>
                        <option value="stock" \${state.inventorySort === 'stock' ? 'selected' : ''}>Stock Quantity</option>
                    </select>
                    <button class="btn btn-secondary" onclick="showCategoryModal()" style="margin-right:10px;">🏷️ Manage Categories</button><button class="btn btn-primary" onclick="showProductModal()">+ Add Product</button>
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
                    <div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="closeProductModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Product</button></div>
                </form>
            </div>
        </div>
    \`;
    renderInventoryTable();`;

const startIndex = code.indexOf('// 2. Inventory (with Compact Form)');
const endIndex = code.indexOf(`    document.getElementById('prod-file-input').addEventListener('change', function(e) {`, startIndex);

if(startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + renderInventoryStr + '\n' + code.substring(endIndex);
    fs.writeFileSync('public/js/app2.js', code);
    console.log('Successfully patched renderInventory');
} else {
    console.log('Could not find injection boundaries.');
}
