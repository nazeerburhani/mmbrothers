const fs = require('fs');
let code = fs.readFileSync('public/js/app2.js', 'utf8');

code = code.replace(/document\.getElementById\('receipt-date'\)\.textContent = new Date\(\)\.toLocaleString\(\);/, `const logoImg = document.getElementById('receipt-logo');
if (state.settings && state.settings.logo_base64 && state.settings.logo_base64 !== 'logo.jpg') {
    logoImg.src = state.settings.logo_base64;
    logoImg.style.display = 'inline-block';
} else {
    logoImg.style.display = 'none';
}
document.getElementById('receipt-date').textContent = new Date().toLocaleString();`);

fs.writeFileSync('public/js/app2.js', code);
