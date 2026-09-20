// === FINANCIAL AUTO-LOCK (2-MINUTE INACTIVITY TIMEOUT) ===
let _financialLockTimer = null;
const FINANCIAL_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function startFinancialLockTimer() {
    clearFinancialLockTimer();
    _financialLockTimer = setTimeout(() => {
        if(state.financialUnlocked) {
            state.financialUnlocked = false;
            showToast('🔒 Financial section locked due to inactivity', 'error');
            const dashNav = document.querySelector('[data-view="dashboard"]');
            if(dashNav) dashNav.click();
        }
    }, FINANCIAL_TIMEOUT_MS);
}

function clearFinancialLockTimer() {
    if(_financialLockTimer) { clearTimeout(_financialLockTimer); _financialLockTimer = null; }
}

function resetFinancialLockTimer() {
    if(state.financialUnlocked) startFinancialLockTimer();
}

// Reset timer on user activity in financials
document.addEventListener('click', resetFinancialLockTimer);
document.addEventListener('keypress', resetFinancialLockTimer);

// === FINANCIAL PASSWORD SYSTEM ===
window.showFinancialPasswordModal = function(mode) {
    const db = getDB();
    const hasPassword = db.settings.financial_password;
    const modal = document.getElementById('financial-password-modal');
    const title = document.getElementById('fin-pass-title');
    const subtitle = document.getElementById('fin-pass-subtitle');
    const fields = document.getElementById('fin-pass-fields');
    const submitBtn = document.getElementById('fin-pass-submit-btn');
    const errorEl = document.getElementById('fin-pass-error');
    errorEl.style.display = 'none';

    if(mode === 'change') {
        title.textContent = 'Change Password';
        subtitle.textContent = 'Enter current password and new password.';
        fields.innerHTML = `
            <input type="password" id="fin-pass-current" class="form-control" placeholder="Current password" required style="width:100%;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;font-size:1rem;margin-bottom:0.8rem;text-align:center;letter-spacing:3px;font-weight:700;">
            <input type="password" id="fin-pass-new" class="form-control" placeholder="New password" required style="width:100%;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;font-size:1rem;margin-bottom:0.8rem;text-align:center;letter-spacing:3px;font-weight:700;">
            <input type="password" id="fin-pass-confirm" class="form-control" placeholder="Confirm new password" required style="width:100%;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;font-size:1rem;margin-bottom:1rem;text-align:center;letter-spacing:3px;font-weight:700;">`;
        submitBtn.textContent = 'Update Password';
        window._finPassMode = 'change';
    } else if(!hasPassword) {
        title.textContent = 'Set Up Password';
        subtitle.textContent = 'Protect your financial data by setting a password.';
        fields.innerHTML = `
            <input type="password" id="fin-pass-new" class="form-control" placeholder="Create password" required style="width:100%;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;font-size:1rem;margin-bottom:0.8rem;text-align:center;letter-spacing:3px;font-weight:700;">
            <input type="password" id="fin-pass-confirm" class="form-control" placeholder="Confirm password" required style="width:100%;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;font-size:1rem;margin-bottom:1rem;text-align:center;letter-spacing:3px;font-weight:700;">`;
        submitBtn.textContent = 'Set Password & Open';
        window._finPassMode = 'setup';
    } else {
        title.textContent = 'Enter Password';
        subtitle.textContent = 'Financial data is protected.';
        fields.innerHTML = `<input type="password" id="fin-pass-input" class="form-control" placeholder="Enter password" required style="width:100%;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;font-size:1rem;margin-bottom:1rem;text-align:center;letter-spacing:3px;font-weight:700;">`;
        submitBtn.textContent = 'Unlock';
        window._finPassMode = 'unlock';
    }
    modal.classList.remove('hidden');

    // Remove old listener
    const form = document.getElementById('fin-pass-form');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const err = document.getElementById('fin-pass-error');
        const db2 = getDB();

        if(window._finPassMode === 'setup') {
            const np = document.getElementById('fin-pass-new').value;
            const cp = document.getElementById('fin-pass-confirm').value;
            if(np.length < 3) { err.textContent = 'Password must be at least 3 characters'; err.style.display = 'block'; return; }
            if(np !== cp) { err.textContent = 'Passwords do not match'; err.style.display = 'block'; return; }
            db2.settings.financial_password = np;
            saveDB(db2); state.settings = db2.settings;
            state.financialUnlocked = true;
            startFinancialLockTimer();
            document.getElementById('financial-password-modal').classList.add('hidden');
            showToast('Password set! Financial data unlocked.');
            fetchSalesHistory(); fetchProducts(); fetchExpenses(); fetchKhata();
            renderFinancials();
        } else if(window._finPassMode === 'unlock') {
            const input = document.getElementById('fin-pass-input').value;
            if(input === db2.settings.financial_password) {
                state.financialUnlocked = true;
                startFinancialLockTimer();
                document.getElementById('financial-password-modal').classList.add('hidden');
                fetchSalesHistory(); fetchProducts(); fetchExpenses(); fetchKhata();
                renderFinancials();
            } else {
                err.textContent = 'Incorrect password'; err.style.display = 'block';
            }
        } else if(window._finPassMode === 'change') {
            const cur = document.getElementById('fin-pass-current').value;
            const np = document.getElementById('fin-pass-new').value;
            const cp = document.getElementById('fin-pass-confirm').value;
            if(cur !== db2.settings.financial_password) { err.textContent = 'Current password is incorrect'; err.style.display = 'block'; return; }
            if(np.length < 3) { err.textContent = 'New password must be at least 3 characters'; err.style.display = 'block'; return; }
            if(np !== cp) { err.textContent = 'New passwords do not match'; err.style.display = 'block'; return; }
            db2.settings.financial_password = np;
            saveDB(db2); state.settings = db2.settings;
            document.getElementById('financial-password-modal').classList.add('hidden');
            showToast('Password changed successfully!');
        }
    });
}

window.closeFinancialPasswordModal = function() {
    document.getElementById('financial-password-modal').classList.add('hidden');
    // Navigate back to dashboard
    const dashNav = document.querySelector('[data-view="dashboard"]');
    if(dashNav) dashNav.click();
}

// === ATTAR INVENTORY MANAGEMENT ===
window.renderAttarInventory = function() {
    const container = document.getElementById('attar-inventory-content');
    if(!container) return;
    const db = getDB();
    const attars = db.attarProducts || [];
    const bottles = db.bottles || [];

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
            <h3 style="margin:0;color:#1e293b;">🧴 Attar Products (ML-Based)</h3>
            <div style="display:flex;gap:0.8rem;">
                <button class="btn btn-secondary" onclick="showBottleModal()" style="border-radius:10px;">🍶 Manage Bottles</button>
                <button class="btn btn-primary" onclick="showAttarModal()" style="border-radius:10px;background:#d97706;border:none;">+ Add Attar</button>
            </div>
        </div>
        <div class="data-table-container">
            <table><thead><tr><th>Product</th><th>Price/ML</th><th>Cost/ML</th><th>Total ML</th><th>Used</th><th>Available</th><th>Actions</th></tr></thead>
            <tbody>${attars.map(a => {
                const avail = Math.max(0, a.total_ml - (a.used_ml || 0));
                return `<tr><td style="font-weight:700;">${a.name}</td><td>${cur()} ${a.price_per_ml}</td><td>${cur()} ${a.cost_per_ml || 0}</td>
                <td>${a.total_ml}ml</td><td>${a.used_ml || 0}ml</td>
                <td style="font-weight:700;color:${avail < 50 ? 'var(--danger)' : 'var(--success)'};">${avail}ml</td>
                <td>
                    <button class="btn btn-secondary" style="padding:0.3rem 0.8rem;font-size:0.85rem;" onclick='showAttarModal(${JSON.stringify(a).replace(/'/g,"&#39;")})'>Edit</button>
                </td></tr>`;
            }).join('')}
            ${attars.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:3rem;color:var(--text-muted);">No attar products added yet.</td></tr>' : ''}
            </tbody></table>
        </div>
        <div style="margin-top:2rem;">
            <h4 style="margin-bottom:1rem;color:#1e293b;">🍶 Bottle Inventory</h4>
            <div class="bottle-stock-grid">
                ${bottles.map(b => `<div class="bottle-chip" style="cursor:default;">
                    <div class="size">${b.size}ml</div>
                    <div class="stock" style="color:${b.stock <= 5 ? '#ef4444' : '#64748b'};">${b.stock} in stock</div>
                </div>`).join('')}
            </div>
        </div>`;
}

window.showAttarModal = function(attar) {
    const existing = document.getElementById('attar-modal');
    if(existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'attar-modal'; div.className = 'modal';
    div.innerHTML = `<div class="modal-content" style="max-width:450px;border-radius:20px;padding:2rem;">
        <h3 style="margin-bottom:1.5rem;">${attar ? 'Edit' : 'Add'} Attar Product</h3>
        <form id="attar-form">
            <input type="hidden" id="attar-id" value="${attar ? attar.id : ''}">
            <div class="form-group" style="margin-bottom:1rem;"><label style="font-weight:700;display:block;margin-bottom:0.5rem;">Product Name</label><input type="text" id="attar-name" class="form-control" required value="${attar ? attar.name : ''}" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="form-group"><label style="font-weight:700;display:block;margin-bottom:0.5rem;">Price per ML (${cur()})</label><input type="number" id="attar-price-ml" class="form-control" required value="${attar ? attar.price_per_ml : ''}" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;"></div>
                <div class="form-group"><label style="font-weight:700;display:block;margin-bottom:0.5rem;">Cost per ML (${cur()})</label><input type="number" id="attar-cost-ml" class="form-control" required value="${attar ? attar.cost_per_ml || '' : ''}" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;"></div>
            </div>
            <div class="form-group" style="margin-bottom:1.5rem;"><label style="font-weight:700;display:block;margin-bottom:0.5rem;">Total Stock (ML)</label><input type="number" id="attar-total-ml" class="form-control" required value="${attar ? attar.total_ml : ''}" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('attar-modal').remove()" style="padding:1rem;border-radius:12px;">Cancel</button>
                <button type="submit" class="btn btn-primary" style="padding:1rem;border-radius:12px;background:#d97706;border:none;">Save</button>
            </div>
        </form></div>`;
    document.body.appendChild(div);
    document.getElementById('attar-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const db2 = getDB();
        if(!db2.attarProducts) db2.attarProducts = [];
        const id = document.getElementById('attar-id').value;
        const payload = {
            name: document.getElementById('attar-name').value,
            price_per_ml: parseFloat(document.getElementById('attar-price-ml').value),
            cost_per_ml: parseFloat(document.getElementById('attar-cost-ml').value),
            total_ml: parseFloat(document.getElementById('attar-total-ml').value),
            used_ml: attar ? (attar.used_ml || 0) : 0
        };
        if(id) { const i = db2.attarProducts.findIndex(a => a.id == id); if(i!==-1) db2.attarProducts[i] = {...db2.attarProducts[i], ...payload}; }
        else { payload.id = Date.now(); db2.attarProducts.push(payload); }
        saveDB(db2); state.attarProducts = db2.attarProducts;
        document.getElementById('attar-modal').remove();
        renderAttarInventory(); showToast('Attar product saved!');
    });
}

window.showBottleModal = function() {
    const existing = document.getElementById('bottle-modal');
    if(existing) existing.remove();
    const db = getDB();
    const bottles = db.bottles || [];
    const div = document.createElement('div');
    div.id = 'bottle-modal'; div.className = 'modal';
    div.innerHTML = `<div class="modal-content" style="max-width:450px;border-radius:20px;padding:2rem;">
        <h3 style="margin-bottom:1.5rem;">🍶 Manage Bottles</h3>
        <form id="bottle-add-form" style="display:flex;gap:0.5rem;margin-bottom:1.5rem;">
            <input type="number" id="bottle-new-size" class="form-control" placeholder="Size (ML)" required style="flex:1;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;">
            <input type="number" id="bottle-new-stock" class="form-control" placeholder="Stock" required style="flex:1;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;">
            <button type="submit" class="btn btn-primary" style="border-radius:10px;background:#d97706;border:none;">Add</button>
        </form>
        <table style="width:100%;font-size:0.9rem;"><thead><tr><th>Size</th><th>Stock</th><th>Action</th></tr></thead>
        <tbody>${bottles.map(b => `<tr><td style="font-weight:700;">${b.size}ml</td>
            <td><input type="number" value="${b.stock}" onchange="updateBottleStock(${b.id},this.value)" style="width:70px;padding:0.4rem;border-radius:6px;border:1px solid #e2e8f0;font-weight:700;"></td>
            <td><button class="btn btn-secondary" style="padding:0.2rem 0.5rem;font-size:0.8rem;color:#ef4444;" onclick="deleteBottle(${b.id})">Remove</button></td></tr>`).join('')}</tbody></table>
        <div style="text-align:right;margin-top:1rem;"><button class="btn btn-secondary" onclick="document.getElementById('bottle-modal').remove()">Close</button></div>
    </div>`;
    document.body.appendChild(div);
    document.getElementById('bottle-add-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const db2 = getDB();
        if(!db2.bottles) db2.bottles = [];
        db2.bottles.push({ id: Date.now(), size: parseInt(document.getElementById('bottle-new-size').value), stock: parseInt(document.getElementById('bottle-new-stock').value) });
        saveDB(db2); state.bottles = db2.bottles;
        showBottleModal(); showToast('Bottle added!');
    });
}

window.updateBottleStock = function(id, val) {
    const db = getDB(); const i = (db.bottles||[]).findIndex(b => b.id === id);
    if(i !== -1) { db.bottles[i].stock = parseInt(val) || 0; saveDB(db); state.bottles = db.bottles; }
}

window.deleteBottle = function(id) {
    const db = getDB(); db.bottles = (db.bottles||[]).filter(b => b.id !== id);
    saveDB(db); state.bottles = db.bottles; showBottleModal(); showToast('Bottle removed');
}
