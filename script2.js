const fs = require('fs');
let code = fs.readFileSync('public/js/app2.js', 'utf8');

// 4. Update the cart quantity logic to be editable
code = code.replace(/<span style="font-weight:600;min-width:24px;text-align:center;">\$\{i\.quantity\}<\/span>/, 
    '<input type="number" value="${i.quantity}" onchange="setDirectQty(${i.product_id}, this.value)" style="width:45px; text-align:center; font-weight:600; border:1px solid var(--border); border-radius:4px; padding:2px; font-size:0.9rem;" min="1">'
);

// 5. Update the cart price logic to be editable
code = code.replace(/<div class="cart-item-price"><span>Rs<\/span>\$\{i\.price\}<\/div>/, 
    '<div class="cart-item-price"><span>Rs</span><input type="number" class="pos-price-input" value="${i.price}" oninput="updateCartPrice(${i.product_id}, this.value)" min="0" step="any"></div>'
);

// 6. Add setDirectQty and updateCartPrice functions
code = code.replace(/function updateCartTotals\(\) \{/, 
    `window.setDirectQty = function(id, val) {
    const i = state.cart.findIndex(c => c.product_id === id);
    if(i > -1) {
        let newQty = parseInt(val);
        if (isNaN(newQty) || newQty < 1) return;
        const p = state.products.find(x => x.id === id);
        if(newQty > p.stock) {
            showToast('Not enough stock!', 'error');
            newQty = p.stock;
        }
        state.cart[i].quantity = newQty;
    }
    updateCartTotals();
}

window.updateCartPrice = function(id, val) {
    const i = state.cart.findIndex(c => c.product_id === id);
    if(i > -1) {
        let newPrice = parseFloat(val);
        if(isNaN(newPrice) || newPrice < 0) newPrice = 0;
        state.cart[i].price = newPrice;
    }
    updateCartTotals();
}

function updateCartTotals() {`
);

fs.writeFileSync('public/js/app2.js', code);
