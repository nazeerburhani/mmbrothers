const fs = require('fs');
let code = fs.readFileSync('public/js/app2.js', 'utf8');

// 1. Replace printReceipt
code = code.replace(/window\.printReceipt = function\(\) \{[\s\S]*?\}/, `window.printReceipt = function() { 
    if (window.api) { 
        window.api.printReceipt(); 
    } else { 
        const pr = document.getElementById('receipt-print-area').innerHTML; 
        const w = window.open('', '_blank', 'width=400,height=600'); 
        w.document.write('<html><head><title>Print Receipt</title><style>body{margin:0;padding:10px;font-family:monospace;width:300px;}</style></head><body>' + pr + '<script>window.print();window.close();<\\/script></body></html>'); 
        w.document.close(); 
    } 
}`);

// 2. Add Backup UI
code = code.replace(/<div class="settings-panel">\s*<h3>👥 Sales Team \/ Staff<\/h3>/, `<div class="settings-panel">
    <h3>💾 Database Backup & Transfer</h3>
    <p style="font-size:0.9rem;color:#555;margin-bottom:15px;">Export your shop's database to a USB drive, or import it to another computer.</p>
    <div style="display:flex;gap:10px;margin-bottom:20px;">
        <button class="btn btn-primary" onclick="exportDatabase()" style="flex:1;">⬇️ Export Database</button>
        <button class="btn btn-secondary" onclick="importDatabase()" style="flex:1;">⬆️ Import Database</button>
    </div>
</div>
<div class="settings-panel">
    <h3>👥 Sales Team / Staff</h3>`);

// 3. Add window.exportDatabase and window.importDatabase
code += `
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
`;

fs.writeFileSync('public/js/app2.js', code);
