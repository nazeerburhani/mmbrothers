// === EXPORT REPORTS SYSTEM ===

window.showExportModal = function() {
    const existing = document.getElementById('export-modal');
    if(existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'export-modal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="modal-content" style="max-width:500px;border-radius:20px;padding:2rem;">
            <div style="text-align:center;margin-bottom:1.5rem;">
                <div style="font-size:2.5rem;margin-bottom:0.5rem;">📤</div>
                <h3 style="margin-bottom:0.3rem;">Export Sales Report</h3>
                <p style="color:#64748b;font-size:0.9rem;">Choose period and format</p>
            </div>

            <div style="margin-bottom:1.5rem;">
                <label style="font-weight:700;font-size:0.85rem;color:#64748b;display:block;margin-bottom:0.5rem;text-transform:uppercase;">Report Period</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;" id="export-period-btns">
                    <button class="export-period-btn active" data-period="today" onclick="setExportPeriod('today')">📅 Today</button>
                    <button class="export-period-btn" data-period="week" onclick="setExportPeriod('week')">📆 This Week</button>
                    <button class="export-period-btn" data-period="month" onclick="setExportPeriod('month')">🗓️ This Month</button>
                    <button class="export-period-btn" data-period="3months" onclick="setExportPeriod('3months')">📊 3 Months</button>
                </div>
            </div>

            <div style="margin-bottom:1.5rem;">
                <label style="font-weight:700;font-size:0.85rem;color:#64748b;display:block;margin-bottom:0.5rem;text-transform:uppercase;">Or Custom Date Range</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
                    <input type="date" id="export-date-from" class="form-control" style="padding:0.7rem;border-radius:10px;border:1px solid #e2e8f0;" onchange="setExportPeriod('custom')">
                    <input type="date" id="export-date-to" class="form-control" style="padding:0.7rem;border-radius:10px;border:1px solid #e2e8f0;" onchange="setExportPeriod('custom')">
                </div>
            </div>

            <div id="export-preview" style="background:#f8fafc;border-radius:12px;padding:1rem;margin-bottom:1.5rem;border:1px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;font-size:0.9rem;">
                    <span style="color:#64748b;">Records found:</span>
                    <span style="font-weight:700;" id="export-count">0</span>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <button class="btn btn-secondary" style="padding:1rem;border-radius:12px;font-weight:700;font-size:0.95rem;" onclick="exportReportPDF()">📄 Print PDF</button>
                <button class="btn btn-primary" style="padding:1rem;border-radius:12px;font-weight:700;font-size:0.95rem;background:#0369a1;border:none;" onclick="exportReportCSV()">📊 Export Excel</button>
            </div>

            <button onclick="document.getElementById('export-modal').remove()" style="margin-top:1rem;width:100%;padding:0.8rem;background:transparent;border:1px solid #e2e8f0;border-radius:12px;cursor:pointer;color:#64748b;font-weight:600;">Cancel</button>
        </div>
    `;
    document.body.appendChild(div);

    // Add button styles
    const style = document.createElement('style');
    style.textContent = `
        .export-period-btn { padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:white;cursor:pointer;font-weight:600;font-size:0.85rem;transition:all 0.2s; }
        .export-period-btn:hover { border-color:#0369a1;color:#0369a1; }
        .export-period-btn.active { background:#0369a1;color:white;border-color:#0369a1; }
    `;
    div.appendChild(style);

    window._exportPeriod = 'today';
    updateExportPreview();
}

window.setExportPeriod = function(period) {
    window._exportPeriod = period;
    document.querySelectorAll('.export-period-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.period === period);
    });
    if(period === 'custom') {
        document.querySelectorAll('.export-period-btn').forEach(b => b.classList.remove('active'));
    }
    updateExportPreview();
}

function getExportDateRange() {
    const now = new Date();
    let from, to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch(window._exportPeriod) {
        case 'today':
            from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            break;
        case 'week':
            from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0,0,0);
            break;
        case 'month':
            from = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case '3months':
            from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            break;
        case 'custom':
            const f = document.getElementById('export-date-from').value;
            const t = document.getElementById('export-date-to').value;
            from = f ? new Date(f) : new Date(0);
            to = t ? new Date(t + 'T23:59:59') : to;
            break;
        default:
            from = new Date(0);
    }
    return { from, to };
}

function getFilteredExportSales() {
    const { from, to } = getExportDateRange();
    return state.salesHistory.filter(s => {
        const d = new Date(s.created_at);
        return d >= from && d <= to;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function updateExportPreview() {
    const sales = getFilteredExportSales();
    const el = document.getElementById('export-count');
    if(el) el.textContent = sales.length;
}

window.exportReportCSV = function() {
    const sales = getFilteredExportSales();
    if(sales.length === 0) return showToast('No records found for this period', 'error');

    const db = getDB();
    const headers = ['Order ID', 'Date', 'Time', 'Customer', 'Payment Method', 'Items', 'Total Amount', 'Status'];
    const rows = sales.map(s => {
        const cust = db.customers.find(c => c.id === s.customer_id) || { name: 'Walk-in' };
        const d = new Date(s.created_at);
        return [
            s.id,
            d.toLocaleDateString(),
            d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
            `"${cust.name}"`,
            s.payment_method || 'Cash',
            (s.items || []).reduce((a,b) => a + b.quantity, 0),
            s.total_amount,
            s.payment_status === 'unpaid' ? 'UNPAID' : 'PAID'
        ].join(',');
    });

    const totalRevenue = sales.reduce((s, o) => s + (o.total_amount || 0), 0);
    rows.push('');
    rows.push(`,,,,, TOTAL,${totalRevenue},`);

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MM_Brothers_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Excel report exported!');
    document.getElementById('export-modal')?.remove();
}

window.exportReportPDF = function() {
    const sales = getFilteredExportSales();
    if(sales.length === 0) return showToast('No records found for this period', 'error');

    const db = getDB();
    const { from, to } = getExportDateRange();
    const totalRevenue = sales.reduce((s, o) => s + (o.total_amount || 0), 0);
    const storeName = state.settings.store_name || 'MM Brothers Islamic Mart';

    const printHTML = `
    <html><head><title>${storeName} - Sales Report</title>
    <style>
        * { margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif; }
        body { padding:30px; }
        .header { text-align:center;margin-bottom:25px;border-bottom:2px solid #000;padding-bottom:15px; }
        .header h1 { font-size:18px;margin-bottom:3px; }
        .header p { font-size:11px;color:#555; }
        .summary { display:flex;justify-content:space-between;margin-bottom:20px;font-size:12px; }
        .summary div { background:#f5f5f5;padding:10px 15px;border-radius:6px;flex:1;margin:0 5px;text-align:center; }
        .summary .label { color:#666;font-size:10px;text-transform:uppercase;margin-bottom:3px; }
        .summary .value { font-weight:700;font-size:14px; }
        table { width:100%;border-collapse:collapse;font-size:11px; }
        th { background:#1e293b;color:white;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase; }
        td { padding:7px 10px;border-bottom:1px solid #e5e5e5; }
        tr:nth-child(even) { background:#fafafa; }
        .footer { margin-top:20px;text-align:center;font-size:10px;color:#999;border-top:1px solid #ddd;padding-top:10px; }
        @media print { body { padding:15px; } }
    </style></head><body>
        <div class="header">
            <h1>${storeName}</h1>
            <p>Sales Report: ${from.toLocaleDateString()} — ${to.toLocaleDateString()}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        <div class="summary">
            <div><div class="label">Total Orders</div><div class="value">${sales.length}</div></div>
            <div><div class="label">Total Revenue</div><div class="value">Rs ${totalRevenue.toLocaleString()}</div></div>
            <div><div class="label">Paid Orders</div><div class="value">${sales.filter(s=>s.payment_status!=='unpaid').length}</div></div>
            <div><div class="label">Unpaid Orders</div><div class="value">${sales.filter(s=>s.payment_status==='unpaid').length}</div></div>
        </div>
        <table>
            <thead><tr><th>#</th><th>Order ID</th><th>Date</th><th>Customer</th><th>Method</th><th>Items</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>${sales.map((s, i) => {
                const cust = db.customers.find(c => c.id === s.customer_id) || { name: 'Walk-in' };
                return `<tr>
                    <td>${i+1}</td><td>#${s.id}</td>
                    <td>${new Date(s.created_at).toLocaleDateString()}</td>
                    <td>${cust.name}</td><td>${s.payment_method||'Cash'}</td>
                    <td>${(s.items||[]).reduce((a,b)=>a+b.quantity,0)}</td>
                    <td style="font-weight:700;">Rs ${(s.total_amount||0).toLocaleString()}</td>
                    <td>${s.payment_status==='unpaid'?'UNPAID':'PAID'}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>
        <div class="footer">This is a system-generated report from ${storeName}</div>
    </body></html>`;

    const printWin = window.open('', '_blank', 'width=800,height=600');
    printWin.document.write(printHTML);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 500);
    document.getElementById('export-modal')?.remove();
}
