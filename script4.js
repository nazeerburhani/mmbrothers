const fs = require('fs');
let code = fs.readFileSync('public/js/app2.js', 'utf8');

code = code.replace(/document\.getElementById\('receipt-date'\)\.textContent = new Date\(\)\.toLocaleString\(\);/, `document.getElementById('receipt-store-contact').textContent = state.settings.store_contact;\n    document.getElementById('receipt-date').textContent = new Date().toLocaleString();`);

fs.writeFileSync('public/js/app2.js', code);
