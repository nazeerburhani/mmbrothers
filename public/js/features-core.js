// === CUSTOMER SEARCH ===
window.searchCustomers = function(val) {
    window.customerSearchQuery = val;
    renderCustomers();
}

// === POS TAB SWITCHING ===
window.setPosTab = function(tab) {
    state.posTab = tab;
    renderPOS();
}

// === ATTAR POS RENDERING ===
window.renderPOSAttarProducts = function(products) {
    const grid = document.getElementById('pos-products-grid');
    if(!grid) return;
    if(!products || products.length === 0) {
        grid.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:3rem;grid-column:1/-1;">No attar products found. Add them from Inventory → Attar tab.</div>';
        return;
    }
    grid.innerHTML = products.map(p => {
        const available = Math.max(0, p.total_ml - (p.used_ml || 0));
        const pct = p.total_ml > 0 ? (available / p.total_ml) * 100 : 0;
        const barColor = pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444';
        return `<div class="attar-product-card" onclick="showAttarSaleModal(${p.id})">
            <div class="attar-badge">ATTAR</div>
            ${p.image_url ? `<img src="${p.image_url}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;">` : '<div style="font-size:2.5rem;margin-bottom:8px;">🧴</div>'}
            <div style="font-weight:700;color:#1e293b;margin-bottom:4px;">${p.name}</div>
            <div style="color:#d97706;font-weight:800;">${cur()} ${p.price_per_ml}/ml</div>
            <div class="attar-ml-display">Available: <strong>${available}ml</strong> / ${p.total_ml}ml</div>
            <div class="attar-ml-bar"><div class="attar-ml-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
        </div>`;
    }).join('') + `
        <div class="attar-product-card" style="background:#f8fafc; border:2px dashed #cbd5e1; display:flex; flex-direction:column; justify-content:center; align-items:center;" onclick="showBottleSaleModal()">
            <div style="font-size:2.5rem;margin-bottom:8px;">🍶</div>
            <div style="font-weight:700;color:#1e293b;margin-bottom:4px;">Sell Empty Bottle</div>
            <div style="color:#64748b;font-size:0.9rem;">Standalone sale</div>
        </div>
    `;
}

// === ATTAR SALE MODAL ===
window.showAttarSaleModal = function(attarId) {
    const db = getDB();
    const attar = (db.attarProducts || []).find(a => a.id === attarId);
    if(!attar) return;
    const bottles = db.bottles || [];
    const available = Math.max(0, attar.total_ml - (attar.used_ml || 0));

    window._currentAttarId = attarId; // Store for helpers

    const existing = document.getElementById('attar-sale-modal');
    if(existing) existing.remove();

    window.showBottleModal = function() {
        const existing = document.getElementById('bottle-modal');
        if(existing) existing.remove();
        const db = getDB();
        const bottles = db.bottles || [];
        const div = document.createElement('div');
        div.id = 'bottle-modal'; div.className = 'modal';
        div.innerHTML = `<div class="modal-content" style="max-width:500px;border-radius:20px;padding:2rem;">
            <h3 style="margin-bottom:1.5rem;">🍶 Manage Bottles</h3>
            <form id="bottle-add-form" style="display:flex;gap:0.5rem;margin-bottom:1.5rem;">
                <input type="number" id="bottle-new-size" class="form-control" placeholder="Size (ML)" required style="flex:1.2;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;">
                <input type="number" id="bottle-new-cost" class="form-control" placeholder="Cost (${cur()})" required style="flex:1;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;">
                <input type="number" id="bottle-new-stock" class="form-control" placeholder="Stock" required style="flex:1;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;">
                <button type="submit" class="btn btn-primary" style="border-radius:10px;background:#d97706;border:none;">Add</button>
            </form>
            <table style="width:100%;font-size:0.9rem;"><thead><tr><th>Size</th><th>Cost/Bot</th><th>Stock</th><th>Action</th></tr></thead>
            <tbody>${bottles.map(b => `<tr><td style="font-weight:700;">${b.size}ml</td>
                <td>${cur()} ${b.cost_price || 0}</td>
                <td><input type="number" value="${b.stock}" onchange="updateBottleStock(${b.id},this.value)" style="width:70px;padding:0.4rem;border-radius:6px;border:1px solid #e2e8f0;font-weight:700;"></td>
                <td><button class="btn btn-secondary" style="padding:0.2rem 0.5rem;font-size:0.8rem;color:#ef4444;" onclick="deleteBottle(${b.id})">Remove</button></td></tr>`).join('')}</tbody></table>
            <div style="text-align:right;margin-top:1rem;"><button class="btn btn-secondary" onclick="document.getElementById('bottle-modal').remove()">Close</button></div>
        </div>`;
        document.body.appendChild(div);
        document.getElementById('bottle-add-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const db2 = getDB();
            if(!db2.bottles) db2.bottles = [];
            db2.bottles.push({ 
                id: Date.now(), 
                size: parseInt(document.getElementById('bottle-new-size').value), 
                cost_price: parseFloat(document.getElementById('bottle-new-cost').value) || 0,
                stock: parseInt(document.getElementById('bottle-new-stock').value) 
            });
            saveDB(db2); state.bottles = db2.bottles;
            showBottleModal(); showToast('Bottle added!');
        });
    }

    // === BOTTLE SALE MODAL ===
    window.showBottleSaleModal = function() {
        const db = getDB();
        const bottles = db.bottles || [];
        const existing = document.getElementById('bottle-sale-modal');
        if(existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'bottle-sale-modal';
        div.className = 'modal';
        div.innerHTML = `
            <div class="modal-content" style="max-width:400px;border-radius:20px;padding:2rem;">
                <h3 style="margin-bottom:1.5rem;display:flex;align-items:center;gap:10px;">🍶 Sell Empty Bottle</h3>
                <div class="form-group" style="margin-bottom:1rem;">
                    <label style="font-weight:700;display:block;margin-bottom:0.5rem;">Select Bottle</label>
                    <div class="bottle-stock-grid" id="bottle-sale-grid">
                        ${bottles.map(b => `<div class="bottle-chip ${b.stock <= 0 ? 'out-of-stock' : ''}" data-bottle-id="${b.id}" onclick="window.selectSaleBottle(${b.id}, ${b.size})">
                            <div class="size">${b.size}ml</div>
                            <div class="stock">${b.stock} left</div>
                        </div>`).join('')}
                    </div>
                    <input type="hidden" id="selected-sale-bottle-id" value="">
                    <input type="hidden" id="selected-sale-bottle-size" value="0">
                </div>
                <div class="form-group" style="margin-bottom:1.5rem;">
                    <label style="font-weight:700;display:block;margin-bottom:0.5rem;">Price per Bottle (${cur()})</label>
                    <input type="number" id="bottle-sale-price" class="form-control" placeholder="e.g. 50" min="0" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;font-size:1.1rem;font-weight:700;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <button class="btn btn-secondary" onclick="document.getElementById('bottle-sale-modal').remove()" style="padding:1rem;border-radius:12px;">Cancel</button>
                    <button class="btn btn-primary" onclick="confirmBottleSale()" style="padding:1rem;border-radius:12px;background:#d97706;border:none;">Add to Cart</button>
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }

    window.selectSaleBottle = function(bottleId, bottleSize) {
        document.getElementById('selected-sale-bottle-id').value = bottleId;
        document.getElementById('selected-sale-bottle-size').value = bottleSize || 0;
        document.querySelectorAll('#bottle-sale-grid .bottle-chip').forEach(c => c.classList.remove('selected'));
        const chip = document.querySelector(`#bottle-sale-grid .bottle-chip[data-bottle-id="${bottleId}"]`);
        if(chip) chip.classList.add('selected');
    }

    window.confirmBottleSale = function() {
        const db = getDB();
        const bottleId = parseInt(document.getElementById('selected-sale-bottle-id').value);
        const price = parseFloat(document.getElementById('bottle-sale-price').value) || 0;
        
        if(!bottleId) return showToast('Please select a bottle', 'error');
        const bottle = (db.bottles || []).find(b => b.id === bottleId);
        if(!bottle) return showToast('Selected bottle not found!', 'error');
        if(bottle.stock < 1) return showToast('Out of stock!', 'error');

        // Deduct stock
        const bi = db.bottles.findIndex(b => b.id === bottleId);
        if(bi !== -1) db.bottles[bi].stock -= 1;
        saveDB(db);

        const cost = bottle.cost_price || 0;

        state.cart.push({
            product_id: `bottle_${bottleId}_${Date.now()}`,
            name: `Empty Bottle (${bottle.size}ml)`,
            price: price, original_price: price,
            cost: cost, quantity: 1, is_bottle_only: true,
            bottle_id: bottleId
        });

        state.bottles = db.bottles;
        document.getElementById('bottle-sale-modal').remove();
        if (typeof renderCart === 'function') renderCart();
        showToast(`Empty ${bottle.size}ml bottle added to cart!`);
    }

    window.deleteAttarProduct = async function(id) {
        const confirmed = confirm('Delete Attar? Are you sure you want to completely remove this attar product?');
        if(!confirmed) return;
        const db = getDB();
        db.attarProducts = db.attarProducts.filter(a => a.id !== id);
        saveDB(db);
        state.attarProducts = db.attarProducts;
        if (typeof renderAttarInventory === 'function') renderAttarInventory();
        showToast('Attar product deleted successfully');
    }

    const div = document.createElement('div');
    div.id = 'attar-sale-modal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="modal-content" style="max-width:500px;border-radius:20px;padding:2rem;">
            <h3 style="margin-bottom:1.5rem;display:flex;align-items:center;gap:10px;">🧴 Sell: ${attar.name}</h3>
            <p style="color:#64748b;font-size:0.9rem;margin-bottom:1rem;">Price: <strong>${cur()} ${attar.price_per_ml}/ml</strong> | Available: <strong>${available}ml</strong></p>
            <div class="form-group" style="margin-bottom:1rem;">
                <label style="font-weight:700;display:block;margin-bottom:0.5rem;">Quantity (ML)</label>
                <input type="number" id="attar-ml-input" class="form-control" placeholder="e.g. 0, 3, 6..." min="0" max="${available}" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;font-size:1.1rem;font-weight:700;" oninput="window.calcAttarPrice(${attar.id})">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label style="font-weight:700;display:block;margin-bottom:0.5rem;">Select Bottle</label>
                <div class="bottle-stock-grid" id="bottle-grid">
                    ${bottles.map(b => `<div class="bottle-chip ${b.stock <= 0 ? 'out-of-stock' : ''}" data-bottle-id="${b.id}" onclick="window.selectBottle(${b.id}, ${b.size})">
                        <div class="size">${b.size}ml</div>
                        <div class="stock">${b.stock} left</div>
                    </div>`).join('')}
                </div>
                <input type="hidden" id="selected-bottle-id" value="">
                <input type="hidden" id="selected-bottle-size" value="0">
            </div>
            <div class="form-group" id="bottle-count-group" style="margin-bottom:1rem;display:none;">
                <label style="font-weight:700;display:block;margin-bottom:0.5rem;">Number of Bottles</label>
                <div style="display:flex;align-items:center;gap:1rem;">
                    <button class="btn btn-secondary" style="padding:0.5rem 1rem;border-radius:8px;font-weight:bold;font-size:1.2rem;cursor:pointer;" onclick="window.changeBottleCount(-1)">-</button>
                    <input type="number" id="bottle-count-input" value="1" min="1" style="width:80px;text-align:center;padding:0.5rem;border-radius:8px;border:1px solid #e2e8f0;font-weight:800;font-size:1.2rem;" oninput="window.updateCalculatedML()">
                    <button class="btn btn-secondary" style="padding:0.5rem 1rem;border-radius:8px;font-weight:bold;font-size:1.2rem;cursor:pointer;" onclick="window.changeBottleCount(1)">+</button>
                </div>
                <div style="font-size:0.9rem;color:#10b981;margin-top:0.5rem;font-weight:600;" id="bottle-calc-text"></div>
            </div>
            <div class="attar-calc-result" id="attar-calc-box" style="display:none; padding:1rem; background:#f8fafc; border-radius:10px; margin-bottom:1rem; border:1px solid #e2e8f0;">
                <label style="font-weight:700;display:block;margin-bottom:0.5rem;color:#1e293b;">Total Price (Editable)</label>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-weight:800;font-size:1.2rem;color:#64748b;">${cur()}</span>
                    <input type="number" id="attar-total-price-input" class="form-control" style="width:100%;padding:0.8rem;border-radius:8px;border:1px solid #cbd5e1;font-size:1.2rem;font-weight:800;color:#0f172a;">
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.5rem;">
                <button class="btn btn-secondary" onclick="document.getElementById('attar-sale-modal').remove()" style="padding:1rem;border-radius:12px;">Cancel</button>
                <button class="btn btn-primary" onclick="confirmAttarSale(${attar.id})" style="padding:1rem;border-radius:12px;background:#d97706;border:none;">Add to Cart</button>
            </div>
        </div>`;
    document.body.appendChild(div);
}

window.selectBottle = function(bottleId, bottleSize) {
    document.getElementById('selected-bottle-id').value = bottleId;
    document.getElementById('selected-bottle-size').value = bottleSize || 0;
    document.querySelectorAll('.bottle-chip').forEach(c => c.classList.remove('selected'));
    const chip = document.querySelector(`.bottle-chip[data-bottle-id="${bottleId}"]`);
    if(chip) chip.classList.add('selected');
    
    // Show the stepper and calculate
    document.getElementById('bottle-count-group').style.display = 'block';
    window.updateCalculatedML();
}

window.changeBottleCount = function(delta) {
    const input = document.getElementById('bottle-count-input');
    let val = parseInt(input.value) || 1;
    val += delta;
    if(val < 1) val = 1;
    input.value = val;
    window.updateCalculatedML();
}

window.updateCalculatedML = function() {
    const count = parseInt(document.getElementById('bottle-count-input').value) || 1;
    const bottleSize = parseFloat(document.getElementById('selected-bottle-size').value) || 0;
    if (bottleSize > 0) {
        const totalML = count * bottleSize;
        document.getElementById('bottle-calc-text').innerHTML = `Capacity: ${totalML}ml (${bottleSize}ml × ${count})`;
    }
}

window.calcAttarPrice = function(attarId) {
    const db = getDB();
    const attar = (db.attarProducts || []).find(a => a.id === attarId);
    if(!attar) return;
    const ml = parseFloat(document.getElementById('attar-ml-input').value) || 0;
    const total = ml * attar.price_per_ml;
    const box = document.getElementById('attar-calc-box');
    const priceInput = document.getElementById('attar-total-price-input');
    
    box.style.display = 'block'; 
    priceInput.value = total; 
}

window.confirmAttarSale = function(attarId) {
    const db = getDB();
    const attar = (db.attarProducts || []).find(a => a.id === attarId);
    if(!attar) return;
    const ml = parseFloat(document.getElementById('attar-ml-input').value) || 0;
    const bottleId = parseInt(document.getElementById('selected-bottle-id').value);
    const bottleCount = parseInt(document.getElementById('bottle-count-input').value) || 1;
    const available = Math.max(0, attar.total_ml - (attar.used_ml || 0));

    if(ml <= 0 && (!bottleId || bottleCount <= 0)) return showToast('Enter ML or select a bottle', 'error');
    if(ml > available) return showToast(`Only ${available}ml available!`, 'error');

    let bottle = null;
    if(bottleId) {
        bottle = (db.bottles || []).find(b => b.id === bottleId);
        if(!bottle) return showToast('Selected bottle not found!', 'error');
        if(bottle.stock < bottleCount) return showToast(`Not enough bottles! Only ${bottle.stock} left.`, 'error');
    }

    const totalPrice = parseFloat(document.getElementById('attar-total-price-input').value) || 0;
    const totalCost = (ml * (attar.cost_per_ml || 0)) + (bottleCount * (bottle ? (bottle.cost_price || 0) : 0));

    // Deduct ML and bottle
    if(ml > 0) {
        const ai = db.attarProducts.findIndex(a => a.id === attarId);
        if(ai !== -1) db.attarProducts[ai].used_ml = (db.attarProducts[ai].used_ml || 0) + ml;
    }
    if(bottleId) {
        const bi = db.bottles.findIndex(b => b.id === bottleId);
        if(bi !== -1) db.bottles[bi].stock -= bottleCount;
    }
    saveDB(db);

    let itemName = attar.name;
    if(ml > 0 && bottleId) itemName += ` (${ml}ml - ${bottleCount}x ${bottle.size}ml bottle)`;
    else if(ml > 0) itemName += ` (${ml}ml)`;
    else if(bottleId) itemName = `Empty Bottle (${bottle.size}ml) x${bottleCount}`;

    // Add to cart
    state.cart.push({
        product_id: `attar_${attarId}_${Date.now()}`,
        name: itemName,
        price: totalPrice, original_price: totalPrice,
        cost: totalCost, quantity: 1, is_attar: true
    });

    state.attarProducts = db.attarProducts;
    state.bottles = db.bottles;
    document.getElementById('attar-sale-modal').remove();
    if (typeof renderCart === 'function') renderCart();
    
    if(ml > 0) showToast(`Added ${ml}ml of ${attar.name} to cart!`);
    else showToast(`Added ${bottleCount}x Empty Bottle to cart!`);
}
