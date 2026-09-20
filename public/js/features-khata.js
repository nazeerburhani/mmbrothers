// === KHATA (CREDIT) SYSTEM — FULL UPGRADE ===

function renderKhata() {
    const db = getDB();
    const records = db.khataRecords || [];
    window.khataTab = window.khataTab || 'all';
    window.khataSearch = window.khataSearch || '';
    window.khataSort = window.khataSort || 'pending_first';

    // Calculate totals
    let totalReceivable = 0, totalPayable = 0;
    records.forEach(r => {
        const balance = (r.total_amount || 0) - (r.paid_amount || 0);
        if(balance <= 0) return;
        if(r.type === 'customer_credit' || !r.type) totalReceivable += balance;
        else totalPayable += balance;
    });
    const netBalance = totalReceivable - totalPayable;

    // Count overdue reminders
    const now = new Date();
    const overdueCount = records.filter(r => {
        if (r.status === 'paid') return false;
        const bal = (r.total_amount||0) - (r.paid_amount||0);
        if (bal <= 0) return false;
        return r.next_reminder_date && new Date(r.next_reminder_date) <= now;
    }).length;

    // Filter by tab
    let filtered = records;
    if(window.khataTab === 'receivable') filtered = records.filter(r => r.type === 'customer_credit' || !r.type);
    else if(window.khataTab === 'payable') filtered = records.filter(r => r.type === 'shopkeeper_credit' || r.type === 'borrowed');
    else if(window.khataTab === 'overdue') filtered = records.filter(r => {
        if (r.status === 'paid') return false;
        const bal = (r.total_amount||0) - (r.paid_amount||0);
        return bal > 0 && r.next_reminder_date && new Date(r.next_reminder_date) <= now;
    });

    // Search filter
    if(window.khataSearch) {
        const q = window.khataSearch.toLowerCase();
        filtered = filtered.filter(r => {
            const name = r.person_name || '';
            const cust = r.customer_id ? (db.customers.find(c => c.id === r.customer_id) || {}) : {};
            const phone = cust.phone || '';
            return name.toLowerCase().includes(q) || phone.includes(q);
        });
    }

    // Group by person
    const groups = {};
    filtered.forEach(r => {
        const key = r.customer_id ? `cust_${r.customer_id}` : `person_${r.person_name || 'Unknown'}`;
        if(!groups[key]) groups[key] = { records: [], name: '', phone: '', totalDue: 0, totalPaid: 0 };
        const cust = r.customer_id ? (db.customers.find(c => c.id === r.customer_id) || { name: r.person_name || 'Unknown', phone: '' }) : { name: r.person_name || 'Unknown', phone: '' };
        groups[key].name = cust.name;
        groups[key].phone = cust.phone || '';
        groups[key].records.push(r);
        groups[key].totalDue += r.total_amount || 0;
        groups[key].totalPaid += r.paid_amount || 0;
        groups[key].advance = db.khataAdvance?.[key] || 0;
    });

    const pendingCount = records.filter(r => r.status !== 'paid').length;

    // Sort groups
    let groupKeys = Object.keys(groups);
    const sortFn = window.khataSort;
    if (sortFn === 'a_z') groupKeys.sort((a,b) => groups[a].name.localeCompare(groups[b].name));
    else if (sortFn === 'z_a') groupKeys.sort((a,b) => groups[b].name.localeCompare(groups[a].name));
    else if (sortFn === 'highest') groupKeys.sort((a,b) => (groups[b].totalDue-groups[b].totalPaid) - (groups[a].totalDue-groups[a].totalPaid));
    else if (sortFn === 'lowest') groupKeys.sort((a,b) => (groups[a].totalDue-groups[a].totalPaid) - (groups[b].totalDue-groups[b].totalPaid));
    else { // pending_first
        groupKeys.sort((a,b) => {
            const balA = groups[a].totalDue - groups[a].totalPaid;
            const balB = groups[b].totalDue - groups[b].totalPaid;
            if (balA > 0 && balB <= 0) return -1;
            if (balA <= 0 && balB > 0) return 1;
            return balB - balA;
        });
    }

    contentArea.innerHTML = `
        <div style="max-width:1000px;margin:0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <button class="btn btn-secondary" style="border-radius:12px;padding:0.8rem 1.5rem;background:#25D366;color:white;border:none;font-weight:700;" onclick="sendAllDueReminders()">📲 Send All Due Reminders</button>
                <button class="btn btn-primary" style="border-radius:12px;padding:0.8rem 1.5rem;" onclick="showManualKhataModal()">➕ New Entry</button>
            </div>

            <div class="khata-summary-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem;">
                <div style="background:white;border-radius:16px;padding:1.5rem;text-align:center;border:1px solid #e2e8f0;">
                    <div style="font-size:0.8rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:0.5rem;">Receivable</div>
                    <div style="font-size:1.6rem;font-weight:800;color:#ef4444;">Rs ${totalReceivable.toLocaleString()}</div>
                </div>
                <div style="background:white;border-radius:16px;padding:1.5rem;text-align:center;border:1px solid #e2e8f0;">
                    <div style="font-size:0.8rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:0.5rem;">Payable</div>
                    <div style="font-size:1.6rem;font-weight:800;color:#f59e0b;">Rs ${totalPayable.toLocaleString()}</div>
                </div>
                <div style="background:white;border-radius:16px;padding:1.5rem;text-align:center;border:1px solid #e2e8f0;">
                    <div style="font-size:0.8rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:0.5rem;">Net Balance</div>
                    <div style="font-size:1.6rem;font-weight:800;color:${netBalance >= 0 ? '#10b981' : '#ef4444'};">Rs ${netBalance.toLocaleString()}</div>
                </div>
                <div style="background:${overdueCount > 0 ? '#fef2f2' : 'white'};border-radius:16px;padding:1.5rem;text-align:center;border:1px solid ${overdueCount > 0 ? '#fecaca' : '#e2e8f0'};cursor:pointer;" onclick="setKhataTab('overdue')">
                    <div style="font-size:0.8rem;color:${overdueCount > 0 ? '#991b1b' : '#64748b'};font-weight:700;text-transform:uppercase;margin-bottom:0.5rem;">Due Reminders</div>
                    <div style="font-size:1.6rem;font-weight:800;color:${overdueCount > 0 ? '#ef4444' : '#6366f1'};">${overdueCount}</div>
                </div>
            </div>

            <!-- SEARCH BAR -->
            <div style="margin-bottom:1rem;">
                <div style="position:relative;">
                    <input type="text" id="khata-search-input" placeholder="🔍 Search by name or phone..." value="${window.khataSearch || ''}"
                        style="width:100%;padding:10px 14px;border-radius:12px;border:1px solid #e2e8f0;font-size:0.9rem;outline:none;background:#fff;font-weight:500;"
                        oninput="searchKhata(this.value)">
                </div>
            </div>

            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">
                <div style="display:flex;background:#f1f5f9;padding:4px;border-radius:10px;border:1px solid #e2e8f0;flex-wrap:wrap;">
                    ${['all','receivable','payable','overdue'].map(t => {
                        const labels = {all:'📒 All', receivable:'💰 Receivable', payable:'📤 Payable', overdue:'🔔 Overdue'};
                        const active = window.khataTab === t;
                        return `<button onclick="setKhataTab('${t}')" style="padding:8px 16px;border:none;border-radius:7px;font-weight:600;cursor:pointer;font-size:0.85rem;transition:all 0.2s;${active?'background:white;color:#0f172a;box-shadow:0 2px 4px rgba(0,0,0,0.05);':'background:transparent;color:#64748b;'}">${labels[t]}${t==='overdue' && overdueCount > 0 ? ' <span style="background:#ef4444;color:white;padding:1px 6px;border-radius:10px;font-size:0.7rem;">'+overdueCount+'</span>' : ''}</button>`;
                    }).join('')}
                </div>
                <select onchange="setKhataSort(this.value)" style="padding:8px 14px;border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem;font-weight:600;color:#64748b;background:white;cursor:pointer;outline:none;">
                    <option value="pending_first" ${window.khataSort==='pending_first'?'selected':''}>Pending First</option>
                    <option value="a_z" ${window.khataSort==='a_z'?'selected':''}>Name A → Z</option>
                    <option value="z_a" ${window.khataSort==='z_a'?'selected':''}>Name Z → A</option>
                    <option value="highest" ${window.khataSort==='highest'?'selected':''}>Highest Due</option>
                    <option value="lowest" ${window.khataSort==='lowest'?'selected':''}>Lowest Due</option>
                </select>
            </div>

            <div class="data-table-container" style="margin-bottom:2rem;">
                <div class="table-header"><h3>📒 Khata Entries</h3></div>
                <div style="padding:1.5rem;" id="khata-customer-list">
                    ${groupKeys.length === 0 ? `<div style="text-align:center;color:var(--text-muted);padding:3rem;">${window.khataSearch ? 'No results for "'+window.khataSearch+'"' : 'No records yet. Add a new entry or use "Credit Order" in POS.'}</div>` : ''}
                    ${groupKeys.map(key => {
                        const data = groups[key];
                        const balance = data.totalDue - data.totalPaid;
                        const status = balance <= 0 ? 'paid' : data.totalPaid > 0 ? 'partial' : 'pending';
                        const firstType = data.records[0]?.type || 'customer_credit';
                        const typeBadge = firstType === 'customer_credit' || !firstType ? '<span style="background:#fef2f2;color:#991b1b;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">RECEIVABLE</span>' :
                            firstType === 'shopkeeper_credit' ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">PAYABLE</span>' :
                            '<span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">LOAN</span>';
                        const statusLabel = status === 'paid' ? 'PAID' : status === 'partial' ? 'PARTIAL' : 'PENDING';
                        const remStatus = typeof getReminderStatus === 'function' ? getReminderStatus(data.records[0] || {}) : 'none';
                        const remBadge = typeof getReminderBadge === 'function' ? getReminderBadge(remStatus) : '';
                        const lastRem = data.records[0]?.last_reminder_sent ? new Date(data.records[0].last_reminder_sent).toLocaleDateString() : 'Never';
                        const nextRem = data.records[0]?.next_reminder_date ? new Date(data.records[0].next_reminder_date).toLocaleDateString() : '—';
                        const gdJson = JSON.stringify({name:data.name,phone:data.phone,totalDue:data.totalDue,totalPaid:data.totalPaid,records:data.records.map(r=>({id:r.id,last_reminder_sent:r.last_reminder_sent,reminder_frequency:r.reminder_frequency||'monthly'}))}).replace(/"/g,'&quot;');
                        return `<div style="background:white;border:1px solid #e2e8f0;border-radius:16px;margin-bottom:1rem;overflow:hidden;">
                            <div style="padding:1.2rem 1.5rem;cursor:pointer;" onclick="toggleKhataExpand('${key}')">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.8rem;">
                                    <div>
                                        <div style="font-size:1.1rem;font-weight:800;color:#0f172a;margin-bottom:4px;">${data.name} ${typeBadge}</div>
                                <div style="font-size:0.85rem;color:#64748b;">${data.phone ? `<a href="https://wa.me/${typeof formatPhone==='function'?formatPhone(data.phone)||'':data.phone}" target="_blank" onclick="event.stopPropagation()" style="color:#25D366;text-decoration:none;font-weight:600;">📞 ${data.phone}</a>` : '<span style="color:#94a3b8;">No phone</span>'} · ${data.records.length} entries${data.advance > 0 ? ` · <span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">Advance: Rs ${data.advance.toLocaleString()}</span>` : ''}${(()=>{ const db2=getDB(); const cReminders=(db2.khataReminders||[]).filter(rm=>rm.person_key===key && rm.status==='Pending'); if(cReminders.length===0) return ''; const isDue=cReminders.some(rm=>new Date(rm.reminder_date)<=new Date()); return isDue ? ' <span style="background:#fef2f2;color:#991b1b;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">🔴 Reminder Due</span>' : ' <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">⏰ Reminder Set</span>'; })()}</div>
                                    </div>
                                    <div style="text-align:right;">
                                        <div style="font-size:1.4rem;font-weight:900;color:${balance>0?'#ef4444':'#10b981'};">${balance > 0 ? 'Rs ' + balance.toLocaleString() : 'Cleared'}</div>
                                        <span style="font-size:0.75rem;padding:3px 10px;border-radius:6px;font-weight:700;background:${status==='paid'?'#ecfdf5':status==='partial'?'#fff7ed':'#fef2f2'};color:${status==='paid'?'#065f46':status==='partial'?'#c2410c':'#991b1b'};">${statusLabel}</span>
                                    </div>
                                </div>
                                <div style="display:flex;gap:12px;font-size:0.75rem;color:#94a3b8;">
                                    <span>Last Reminder: <b style="color:#64748b;">${lastRem}</b></span>
                                    <span>Next: <b style="color:${remStatus==='overdue'?'#ef4444':'#64748b'};">${nextRem}</b></span>
                                    ${remBadge}
                                </div>
                            </div>
                            <div style="padding:0 1.5rem 1rem;display:flex;gap:0.6rem;flex-wrap:wrap;">
                                ${balance > 0 ? `<button class="btn btn-primary" style="padding:0.5rem 1rem;font-size:0.8rem;border-radius:10px;font-weight:700;" onclick="event.stopPropagation();showSmartPayment('${key}')">💰 Receive Payment</button>` : ''}
                                ${balance > 0 && data.phone ? `<button style="padding:0.5rem 1rem;font-size:0.8rem;border-radius:10px;font-weight:700;background:#25D366;color:white;border:none;cursor:pointer;" onclick="event.stopPropagation();sendWhatsAppReminder('${key}',${gdJson})">📲 Send Reminder</button>` : ''}
                                <button style="padding:0.5rem 1rem;font-size:0.8rem;border-radius:10px;font-weight:700;background:#f59e0b;color:white;border:none;cursor:pointer;" onclick="event.stopPropagation();showSetReminderModal('${key}','${data.name.replace(/'/g,"\\'")}')">⏰ Set Reminder</button>
                                <button style="padding:0.5rem 1rem;font-size:0.8rem;border-radius:10px;font-weight:700;background:#0f172a;color:white;border:none;cursor:pointer;" onclick="event.stopPropagation();showKhataReceipt('${key}',${gdJson})">🧾 View Receipt</button>
                            </div>
                            <div class="hidden" id="khata-expand-${key.replace(/[^a-zA-Z0-9]/g,'_')}" style="border-top:1px solid #e2e8f0;padding:1rem 1.5rem;background:#fafafa;">
                                <table style="width:100%;font-size:0.85rem;border-collapse:collapse;"><thead><tr style="border-bottom:2px solid #e2e8f0;"><th style="text-align:left;padding:8px;color:#64748b;font-size:0.75rem;text-transform:uppercase;">Date</th><th style="padding:8px;color:#64748b;font-size:0.75rem;text-transform:uppercase;">Details</th><th style="padding:8px;color:#64748b;font-size:0.75rem;text-transform:uppercase;">Amount</th><th style="padding:8px;color:#64748b;font-size:0.75rem;text-transform:uppercase;">Received</th><th style="padding:8px;color:#64748b;font-size:0.75rem;text-transform:uppercase;">Balance</th><th style="padding:8px;color:#64748b;font-size:0.75rem;text-transform:uppercase;">Status</th><th style="padding:8px;color:#64748b;font-size:0.75rem;text-transform:uppercase;">Action</th></tr></thead>
                                <tbody>${(()=>{ let runBal=0; return data.records.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(r => {
                                    runBal += (r.total_amount||0) - (r.paid_amount||0);
                                    const rBal = (r.total_amount||0) - (r.paid_amount||0);
                                    const rStatus = rBal <= 0 ? 'paid' : r.paid_amount > 0 ? 'partial' : 'pending';
                                    const rLabel = rStatus === 'paid' ? 'Paid' : rStatus === 'partial' ? 'Partial' : 'Pending';
                                    return `<tr style="border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:8px;">${new Date(r.created_at).toLocaleDateString()}</td>
                                        <td style="padding:8px;color:#64748b;">${r.description || (r.sale_id ? 'Order #'+r.sale_id : 'Khata Entry')}</td>
                                        <td style="padding:8px;font-weight:700;">Rs ${(r.total_amount||0).toLocaleString()}</td>
                                        <td style="padding:8px;color:#10b981;font-weight:700;">Rs ${(r.paid_amount||0).toLocaleString()}</td>
                                        <td style="padding:8px;font-weight:800;color:${runBal>0?'#ef4444':'#10b981'};">Rs ${runBal.toLocaleString()}</td>
                                        <td style="padding:8px;"><span style="font-size:0.75rem;padding:2px 8px;border-radius:6px;font-weight:700;background:${rStatus==='paid'?'#ecfdf5':rStatus==='partial'?'#fff7ed':'#fef2f2'};color:${rStatus==='paid'?'#065f46':rStatus==='partial'?'#c2410c':'#991b1b'};">${rLabel}</span></td>
                                        <td style="padding:8px;">${rBal > 0 ? `<button class="btn btn-primary" style="padding:0.3rem 0.8rem;font-size:0.75rem;border-radius:8px;" onclick="event.stopPropagation();showKhataPaymentModal(${r.id})">${rStatus === 'partial' ? '💰 Pay Rest' : '💰 Pay'}</button>` : '<span style="color:#10b981;font-weight:700;">✅ Paid</span>'}</td>
                                    </tr>`;
                                }).join('');})()}</tbody></table>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;

    // Re-focus search input if user was typing
    if(window.khataSearch) {
        const searchInput = document.getElementById('khata-search-input');
        if(searchInput) { searchInput.focus(); searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length); }
    }
}

window.searchKhata = function(val) {
    window.khataSearch = val;
    renderKhata();
}

window.setKhataTab = function(tab) { window.khataTab = tab; renderKhata(); }

window.setKhataSort = function(val) { window.khataSort = val; renderKhata(); }

window.toggleKhataExpand = function(key) {
    const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
    const el = document.getElementById(`khata-expand-${safeKey}`);
    if(el) el.classList.toggle('hidden');
}

// === MANUAL KHATA ENTRY ===
window.showManualKhataModal = function() {
    const existing = document.getElementById('manual-khata-modal');
    if(existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'manual-khata-modal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="modal-content" style="max-width:450px;border-radius:20px;padding:2rem;">
            <div style="text-align:center;margin-bottom:1.5rem;">
                <div style="font-size:2.5rem;">📒</div>
                <h3>New Khata Entry</h3>
                <p style="color:#64748b;font-size:0.85rem;margin-top:4px;">Record a credit or loan entry</p>
            </div>
            <form id="manual-khata-form">
                <div class="form-group" style="margin-bottom:1rem;">
                    <label style="font-weight:700;display:block;margin-bottom:0.5rem;">Name</label>
                    <input type="text" id="khata-person-name" class="form-control" placeholder="Person or shop name..." required style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;">
                </div>
                <div class="form-group" style="margin-bottom:1rem;">
                    <label style="font-weight:700;display:block;margin-bottom:0.5rem;">Type</label>
                    <select id="khata-entry-type" class="form-control" required style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;">
                        <option value="customer_credit">💰 Credit to Customer (Receivable)</option>
                        <option value="shopkeeper_credit">📤 Owed to Supplier (Payable)</option>
                        <option value="borrowed">🏦 Loan Taken (To Repay)</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:1rem;">
                    <label style="font-weight:700;display:block;margin-bottom:0.5rem;">Amount (Rs)</label>
                    <input type="number" id="khata-entry-amount" class="form-control" placeholder="Enter amount" required min="1" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;font-size:1.1rem;font-weight:700;">
                </div>
                <div class="form-group" style="margin-bottom:1.5rem;">
                    <label style="font-weight:700;display:block;margin-bottom:0.5rem;">Note / Reason</label>
                    <input type="text" id="khata-entry-desc" class="form-control" placeholder="e.g. Shop supplies purchased, loan given etc." style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('manual-khata-modal').remove()" style="padding:1rem;border-radius:12px;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="padding:1rem;border-radius:12px;">✅ Save Entry</button>
                </div>
            </form>
        </div>`;
    document.body.appendChild(div);

    document.getElementById('manual-khata-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('khata-person-name').value.trim();
        const type = document.getElementById('khata-entry-type').value;
        const amount = parseFloat(document.getElementById('khata-entry-amount').value);
        const desc = document.getElementById('khata-entry-desc').value;

        if(!name || !amount || amount <= 0) return showToast('Please fill all required fields', 'error');

        const db = getDB();
        if(!db.khataRecords) db.khataRecords = [];
        db.khataRecords.push({
            id: Date.now(), customer_id: null, sale_id: null,
            type: type, person_name: name,
            total_amount: amount, paid_amount: 0,
            description: desc || '',
            created_at: new Date().toISOString(), payments: [], status: 'pending'
        });
        saveDB(db);
        state.khataRecords = db.khataRecords;
        document.getElementById('manual-khata-modal').remove();
        renderKhata();
        showToast('Khata entry saved! ✅');
    });
}

// === KHATA ORDER FROM POS ===
window.processKhataOrder = async function() {
    if(state.cart.length === 0) return showToast('Cart khaali hai!', 'error');
    const custId = parseInt(document.getElementById('cart-customer-select')?.value);
    if(!custId || custId === 1) return showToast('Pehle customer select karo (Walk-in nahi chalega)', 'error');

    const confirmed = await showConfirm('Confirm Credit Order?', 'This order will be saved as UNPAID and added to the customer\'s Khata.', { icon: '📒', confirmText: 'Yes, Save as Credit' });
    if(!confirmed) return;

    const db = getDB();
    let totAmt = 0, totProf = 0;
    state.cart.forEach(item => {
        totAmt += item.price * item.quantity;
        totProf += (item.price - item.cost) * item.quantity;
        if(!item.is_attar) {
            const pi = db.products.findIndex(p => p.id === item.product_id);
            if(pi !== -1) db.products[pi].stock -= item.quantity;
        }
    });

    const saleRecord = {
        id: Date.now(), customer_id: custId, payment_method: 'Khata (Udhaar)',
        total_amount: totAmt, profit: totProf, created_at: new Date().toISOString(),
        items: [...state.cart], payment_status: 'unpaid',
        salesman_id: parseInt(document.getElementById('cart-salesman-select')?.value || state.currentUser.id)
    };
    db.salesHistory.push(saleRecord);

    if(!db.khataRecords) db.khataRecords = [];
    const cust = db.customers.find(c => c.id === custId) || { name: 'Customer' };
    const personKey = 'cust_' + custId;

    // Check for advance balance and auto-deduct
    let advanceUsed = 0;
    if (db.khataAdvance && db.khataAdvance[personKey] > 0) {
        advanceUsed = Math.min(db.khataAdvance[personKey], totAmt);
        db.khataAdvance[personKey] -= advanceUsed;
        if (db.khataAdvance[personKey] <= 0) delete db.khataAdvance[personKey];
        if (!db.khataAdvanceHistory) db.khataAdvanceHistory = [];
        db.khataAdvanceHistory.push({
            personKey: personKey, type: 'used', amount: advanceUsed,
            sale_id: saleRecord.id, date: new Date().toISOString(),
            note: 'Auto-deducted for Order #' + saleRecord.id
        });
    }

    db.khataRecords.push({
        id: Date.now() + 1, customer_id: custId, sale_id: saleRecord.id,
        type: 'customer_credit', person_name: cust.name,
        total_amount: totAmt, paid_amount: advanceUsed,
        description: 'Order #' + saleRecord.id,
        created_at: new Date().toISOString(),
        payments: advanceUsed > 0 ? [{ amount: advanceUsed, date: new Date().toISOString(), note: 'From Advance Balance' }] : [],
        status: advanceUsed >= totAmt ? 'paid' : (advanceUsed > 0 ? 'partial' : 'pending')
    });

    if (advanceUsed >= totAmt) {
        saleRecord.payment_status = 'paid';
        saleRecord.payment_method = 'Advance Balance';
    }

    saveDB(db);
    if (advanceUsed > 0 && advanceUsed < totAmt) {
        showToast('Credit order saved! Rs ' + advanceUsed.toLocaleString() + ' deducted from advance ✅');
    } else if (advanceUsed >= totAmt) {
        showToast('Order fully paid from advance balance! ✅');
    } else {
        showToast('Credit order saved! 📒');
    }
    showReceiptModal(saleRecord.id);
    state.cart = []; fetchProducts(); fetchSalesHistory(); fetchKhata(); renderPOS();
}

// === KHATA PAYMENT MODAL ===
window.showKhataPaymentModal = function(recordId) {
    const db = getDB();
    const record = (db.khataRecords || []).find(r => r.id === recordId);
    if(!record) return;
    const balance = (record.total_amount || 0) - (record.paid_amount || 0);
    const name = record.person_name || (db.customers.find(c => c.id === record.customer_id) || {}).name || 'Person';

    const existing = document.getElementById('khata-pay-modal');
    if(existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'khata-pay-modal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="modal-content" style="max-width:400px;border-radius:20px;padding:2rem;text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:0.5rem;">💰</div>
            <h3 style="margin-bottom:0.5rem;">Record Payment</h3>
            <p style="color:#64748b;margin-bottom:1.5rem;">${name} — Balance: <strong style="color:#ef4444;">Rs ${balance.toLocaleString()}</strong></p>
            <form id="khata-pay-form">
                <input type="number" id="khata-pay-amount" class="form-control" placeholder="Amount received" required min="1" style="width:100%;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;font-size:1.2rem;font-weight:700;text-align:center;margin-bottom:1rem;">
                <input type="text" id="khata-pay-note" class="form-control" placeholder="Note (optional)" style="width:100%;padding:0.8rem;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:1.5rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('khata-pay-modal').remove()" style="padding:1rem;border-radius:12px;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="padding:1rem;border-radius:12px;background:#10b981;border:none;">✅ Confirm Payment</button>
                </div>
            </form>
        </div>`;
    document.body.appendChild(div);

    document.getElementById('khata-pay-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const amt = parseFloat(document.getElementById('khata-pay-amount').value);
        const note = document.getElementById('khata-pay-note').value;
        if(!amt || amt <= 0) return showToast('Enter a valid amount', 'error');

        const db2 = getDB();
        const ri = (db2.khataRecords || []).findIndex(r => r.id === recordId);
        if(ri !== -1) {
            let applyAmt = amt;
            let advanceAmt = 0;
            if (amt > balance) {
                advanceAmt = amt - balance;
            }

            db2.khataRecords[ri].paid_amount = (db2.khataRecords[ri].paid_amount || 0) + applyAmt;
            if(!db2.khataRecords[ri].payments) db2.khataRecords[ri].payments = [];
            db2.khataRecords[ri].payments.push({ amount: applyAmt, date: new Date().toISOString(), note: note || '' });
            const newBal = db2.khataRecords[ri].total_amount - db2.khataRecords[ri].paid_amount;
            db2.khataRecords[ri].status = newBal <= 0 ? 'paid' : 'partial';

            if (advanceAmt > 0) {
                const personKey = db2.khataRecords[ri].customer_id ? 'cust_' + db2.khataRecords[ri].customer_id : 'person_' + db2.khataRecords[ri].person_name;
                if (!db2.khataAdvance) db2.khataAdvance = {};
                db2.khataAdvance[personKey] = (db2.khataAdvance[personKey] || 0) + advanceAmt;
                if (!db2.khataAdvanceHistory) db2.khataAdvanceHistory = [];
                db2.khataAdvanceHistory.push({
                    personKey: personKey, type: 'received', amount: advanceAmt,
                    date: new Date().toISOString(), note: 'Overpayment advance'
                });
            }

            saveDB(db2);
        }
        document.getElementById('khata-pay-modal').remove();
        fetchKhata();
        renderKhata();
        if (amt > balance) {
            showToast('Payment applied! Rs ' + (amt - balance).toLocaleString() + ' saved as advance ✅');
        } else {
            showToast(`Rs ${amt.toLocaleString()} payment recorded! ✅`);
        }
    });
}

// === KHATA RECEIPT SYSTEM ===
window.showKhataReceipt = function(personKey, gd) {
    const db = getDB();
    // Get full records from DB for this person
    const allRecs = (db.khataRecords || []).filter(r => {
        const k = r.customer_id ? `cust_${r.customer_id}` : `person_${r.person_name}`;
        return k === personKey;
    }).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

    if (allRecs.length === 0) return showToast('No records found', 'error');

    const hasOverpaid = allRecs.some(r => (r.paid_amount||0) > (r.total_amount||0));
    const globalAdv = db.khataAdvance ? (db.khataAdvance[personKey] || 0) : 0;
    const retroAdv = (!hasOverpaid && globalAdv > 0) ? globalAdv : 0;

    const totalAmt = allRecs.reduce((s,r) => s + (r.total_amount||0), 0);
    const totalPaid = allRecs.reduce((s,r) => s + (r.paid_amount||0), 0) + retroAdv;
    const remaining = Math.max(0, totalAmt - totalPaid);
    const today = new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'});

    let events = [];
    allRecs.forEach((r, i) => {
        // 1. The charge/order itself
        if ((r.total_amount || 0) > 0 || !r.payments || r.payments.length === 0) {
            events.push({
                date: new Date(r.created_at),
                desc: (r.description || (r.sale_id ? 'Order #'+r.sale_id : 'Entry')).replace('POS Order','Order'),
                amount: r.total_amount || 0,
                paid: 0
            });
        }
        
        // 2. Individual payments against this order
        if (r.payments && r.payments.length > 0) {
            r.payments.forEach(p => {
                if ((p.amount || 0) > 0) {
                    events.push({
                        date: new Date(p.date || r.created_at),
                        desc: 'Payment' + (p.note && p.note.toLowerCase() !== 'smart payment' ? ` (${p.note})` : ''),
                        amount: 0,
                        paid: p.amount || 0
                    });
                }
            });
        }
        
        // 3. Retroactive advance applied at the end
        if (i === allRecs.length - 1 && retroAdv > 0) {
            events.push({
                date: new Date(),
                desc: 'Advance Balance (Unused)',
                amount: 0,
                paid: retroAdv
            });
        }
    });

    events.sort((a,b) => a.date - b.date);

    let runBal = 0;
    const rows = events.map(ev => {
        runBal += ev.amount - ev.paid;
        return `<tr style="border-bottom:1px solid #ddd;">
            <td style="padding:8px 6px;font-size:11px;">${ev.date.toLocaleDateString()}</td>
            <td style="padding:8px 6px;font-size:11px;">${ev.desc}</td>
            <td style="padding:8px 6px;font-size:11px;text-align:right;">${ev.amount > 0 ? 'Rs ' + ev.amount.toLocaleString() : '-'}</td>
            <td style="padding:8px 6px;font-size:11px;text-align:right;color:#2E7D32;">${ev.paid > 0 ? 'Rs ' + ev.paid.toLocaleString() : '-'}</td>
            <td style="padding:8px 6px;font-size:11px;text-align:right;font-weight:700;color:${runBal>0?'#C62828':'#2E7D32'};">Rs ${runBal.toLocaleString()}</td>
        </tr>`;
    }).join('');

    const ex = document.getElementById('khata-receipt-modal');
    if (ex) ex.remove();
    const div = document.createElement('div');
    div.id = 'khata-receipt-modal';
    div.className = 'modal';
    div.style.cssText = 'z-index:10000;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;';
    div.innerHTML = `<div class="modal-content" style="max-width:500px;border-radius:16px;padding:0;overflow:hidden;margin:auto;display:flex;flex-direction:column;max-height:85vh;">
        <div style="flex:1;overflow-y:auto;overflow-x:hidden;">
            <div id="khata-receipt-print" style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
                <div style="background:linear-gradient(135deg, #A90011 0%, #7A000C 100%);color:white;padding:1.5rem;text-align:center;border-bottom:3px solid #D4AF37;">
                <div style="font-size:20px;font-weight:900;letter-spacing:1.5px;">MM BROTHERS</div>
                <div style="font-size:14px;font-weight:600;color:#D4AF37;letter-spacing:2px;"><span style="margin-right:6px;">ISLAMIC</span><span>MART</span></div>
                <div style="font-size:10px;margin-top:6px;opacity:0.85;letter-spacing:0.3px;"><span style="margin-right:3px;">Saleem</span><span style="margin-right:3px;">Market</span><span style="margin-right:3px;">Par</span><span style="margin-right:3px;">Hoti,</span><span style="margin-right:3px;">Mardan</span><span>·</span><span style="margin-left:3px;">03025731705</span></div>
            </div>
            <div style="padding:1.5rem;">
                <div style="display:flex;justify-content:space-between;margin-bottom:1rem;padding-bottom:0.8rem;border-bottom:2px dashed #e2e8f0;">
                    <div>
                        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Customer</div>
                        <div style="font-size:14px;font-weight:800;color:#0f172a;">${gd.name}</div>
                        ${gd.phone ? `<div style="font-size:11px;color:#64748b;">${gd.phone}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;"><span style="margin-right:4px;">STATEMENT</span><span>DATE</span></div>
                        <div style="font-size:13px;font-weight:700;color:#0f172a;">${today}</div>
                        <div style="font-size:10px;color:#64748b;">${allRecs.length} ${allRecs.length === 1 ? 'transaction' : 'transactions'}</div>
                    </div>
                </div>
                <table style="width:100%;border-collapse:collapse;margin-bottom:1rem;">
                    <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                        <th style="padding:8px 6px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Date</th>
                        <th style="padding:8px 6px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Details</th>
                        <th style="padding:8px 6px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Amount</th>
                        <th style="padding:8px 6px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Paid</th>
                        <th style="padding:8px 6px;text-align:right;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">Balance</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <div style="border-top:2px solid #1a1a1a;padding-top:1rem;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="font-size:12px;color:#475569;font-weight:600;"><span style="margin-right:5px;">Total</span><span>Amount</span></span>
                        <span style="font-size:13px;font-weight:600;color:#1a1a1a;">Rs ${totalAmt.toLocaleString()}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <span style="font-size:12px;color:#475569;font-weight:600;"><span style="margin-right:5px;">Total</span><span>Paid</span></span>
                        <span style="font-size:13px;font-weight:600;color:#10b981;">Rs ${totalPaid.toLocaleString()}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px solid #e2e8f0;">
                        <span style="font-size:13px;font-weight:600;color:${remaining>0?'#ef4444':'#10b981'};"><span style="margin-right:5px;">Remaining</span><span>Balance</span></span>
                        <span style="font-size:16px;font-weight:700;color:${remaining>0?'#ef4444':'#10b981'};">Rs ${remaining.toLocaleString()}</span>
                    </div>
                </div>
                ${(function(){
                    var adv = db.khataAdvance ? (db.khataAdvance[personKey] || 0) : 0;
                    var advAll = (db.khataAdvanceHistory || []).filter(function(h){ return h.personKey === personKey; });
                    var totalUsed = advAll.filter(function(h){ return h.type === 'used'; }).reduce(function(s,h){ return s + (h.amount||0); }, 0);
                    if (adv <= 0 && totalUsed <= 0) return '';
                    var html = '<div style="margin-top:8px;padding:8px 10px;background:#E3F2FD;border:1px solid #90CAF9;border-radius:8px;">';
                    if (totalUsed > 0) html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span style="color:#1565C0;font-weight:600;"><span style="margin-right:4px;">Used</span><span style="margin-right:4px;">from</span><span>Advance</span></span><span style="font-weight:700;color:#1565C0;">Rs ' + totalUsed.toLocaleString() + '</span></div>';
                    if (adv > 0) {
                        var recvRecs = advAll.filter(function(h){ return h.type === 'received'; });
                        var sinceStr = '';
                        if (recvRecs.length > 0) {
                            sinceStr = ' <span style="font-size:9px;color:#1565C0;">(Since ' + new Date(recvRecs[recvRecs.length-1].date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ')</span>';
                        }
                        html += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;"><span style="color:#1565C0;font-weight:600;"><span style="margin-right:4px;">Advance</span><span>Balance</span>' + sinceStr + '</span><span style="font-weight:700;color:#1565C0;">Rs ' + adv.toLocaleString() + '</span></div>';
                    }
                    html += '</div>';
                    return html;
                })()}
                <div style="text-align:center;margin-top:1.2rem;padding-top:1rem;border-top:1px dashed #e2e8f0;">
                    <div style="font-size:9px;color:#777;margin-top:5px;border-top:1px solid #ddd;padding-top:8px;display:inline-block;">
                        <span style="margin-right:3px;">Developed</span><span style="margin-right:3px;">By</span><span style="margin-right:2px;">:</span><span style="font-weight:700;color:#000;letter-spacing:0.8px;margin-left:2px;">Nazeer Ahmad</span><br>
                        <span style="font-size:8.5px;letter-spacing:0.5px;">\ud83d\udcde 03419781283</span>
                    </div>
                </div>
            </div>
        </div>
        <div style="padding:1rem 1.5rem;border-top:1px solid #e2e8f0;display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;background:#fafafa;flex-shrink:0;">
            <button class="btn btn-secondary" onclick="document.getElementById('khata-receipt-modal').remove()" style="padding:0.6rem 1.2rem;border-radius:10px;font-size:0.8rem;">Close</button>
            <button style="padding:0.6rem 1.2rem;border-radius:10px;font-size:0.8rem;font-weight:700;background:#25D366;color:white;border:none;cursor:pointer;" onclick="shareKhataReceipt('${personKey}')">📲 Share WhatsApp</button>
            <button style="padding:0.6rem 1.2rem;border-radius:10px;font-size:0.8rem;font-weight:700;background:#0f172a;color:white;border:none;cursor:pointer;" onclick="printKhataReceipt()">🖨️ Print</button>
        </div>
    </div>`;
    document.body.appendChild(div);
};

window.shareKhataReceipt = async function(personKey) {
    const receiptEl = document.getElementById('khata-receipt-print');
    if (!receiptEl) return showToast('Receipt not found. Open receipt first.', 'error');

    const db = getDB();
    const recs = (db.khataRecords || []).filter(r => {
        const k = r.customer_id ? `cust_${r.customer_id}` : `person_${r.person_name}`;
        return k === personKey;
    });
    if (recs.length === 0) return;

    const name = recs[0].person_name || 'Customer';
    const cust = recs[0].customer_id ? (db.customers.find(c => c.id === recs[0].customer_id) || {}) : {};
    const phone = formatPhone(cust.phone || '');
    if (!phone) return showToast('No valid phone number for this customer', 'error');

    const totalAmt = recs.reduce((s,r) => s + (r.total_amount||0), 0);
    const totalPaid = recs.reduce((s,r) => s + (r.paid_amount||0), 0);
    const remaining = totalAmt - totalPaid;

    if (typeof html2canvas === 'undefined') return showToast('Unable to generate receipt image', 'error');

    showToast('Preparing receipt...');

    try {
        // Ensure all fonts are fully loaded before rendering to prevent blurry/cut text
        await document.fonts.ready;
        
        // Temporarily remove overflow constraints to prevent clipping during capture
        const modalContent = receiptEl.closest('.modal-content');
        const origOverflow = modalContent ? modalContent.style.overflow : '';
        if (modalContent) modalContent.style.overflow = 'visible';
        
        // Apply device pixel ratio and increased scaling for HD sharpness
        const scale = (window.devicePixelRatio || 1) * 4;

        const canvas = await html2canvas(receiptEl, {
            scale: scale, 
            useCORS: true, 
            backgroundColor: '#ffffff', 
            logging: false,
            allowTaint: true,
            windowWidth: receiptEl.scrollWidth,
            windowHeight: receiptEl.scrollHeight
        });
        
        // Enable high-quality smoothing internally
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (modalContent) modalContent.style.overflow = origOverflow;

        // 1. Generate image and copy to clipboard immediately via Web API
        let copied = false;
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            copied = true;
        } catch(e) {
            console.error('Clipboard write failed:', e);
        }

        // 2. Build Urdu caption
        const caption = [
            'السلام علیکم،',
            '',
            '*ایم ایم برادرز اسلامک مارٹ* کی جانب سے آپ کے کھاتے کی تفصیل درج ذیل ہے:',
            '',
            'کل رقم: *Rs ' + totalAmt.toLocaleString() + '*',
            'ادا شدہ رقم: *Rs ' + totalPaid.toLocaleString() + '*',
            'بقایا رقم: *Rs ' + remaining.toLocaleString() + '*',
            '',
            'براہِ کرم بقایا رقم جلد از جلد ادا کریں۔',
            '',
            'مزید تفصیل کے لیے رسید ساتھ منسلک ہے۔',
            '',
            'شکریہ'
        ].join('\n');

        window._waCaption = caption;
        window._waPhone = phone;

        // 3. Show correct popup exactly matching reference
        const ex2 = document.getElementById('wa-share-guide');
        if (ex2) ex2.remove();
        const guide = document.createElement('div');
        guide.id = 'wa-share-guide';
        guide.className = 'modal';
        guide.style.cssText = 'z-index:10002;';
        
        const successIcon = '<div style="background:#22c55e;color:white;width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 1.2rem;box-shadow:0 10px 15px -3px rgba(34, 197, 94, 0.3);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>';
        const fallbackIcon = '<div style="background:#f59e0b;color:white;width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 1.2rem;box-shadow:0 10px 15px -3px rgba(245, 158, 11, 0.3);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>';

        guide.innerHTML = '<div class="modal-content" style="max-width:440px;border-radius:24px;padding:2.5rem 2rem;text-align:center;font-family:\'Segoe UI\', system-ui, sans-serif;">'
            + (copied ? successIcon : fallbackIcon)
            + '<h2 style="margin:0 0 0.5rem;font-size:1.5rem;font-weight:800;color:#0f172a;">' + (copied ? 'Image Copied!' : 'Action Required') + '</h2>'
            + '<p style="color:#64748b;font-size:0.95rem;margin:0 0 1.5rem;line-height:1.5;">' + (copied
                ? 'Receipt image is copied to your clipboard.<br><strong style="color:#334155;">Just paste (Ctrl+V) in WhatsApp!</strong>'
                : 'Browser blocked auto-copy. <br><strong>Please copy the image manually!</strong>') + '</p>'
            + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;padding:1.2rem;margin-bottom:1.5rem;text-align:left;">'
            + '<div style="font-weight:700;font-size:0.9rem;margin-bottom:10px;color:#166534;display:flex;align-items:center;gap:6px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg> Steps:</div>'
            + '<div style="font-size:0.85rem;color:#374151;line-height:1.8;font-weight:500;">'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><div style="background:#dcfce7;color:#166534;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;">1</div> Click <strong style="color:#111;">"Open WhatsApp"</strong> below</div>'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><div style="background:#dcfce7;color:#166534;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;">2</div> Press <strong style="color:#111;">Ctrl + V</strong> to paste receipt image</div>'
            + '<div style="display:flex;align-items:center;gap:8px;"><div style="background:#dcfce7;color:#166534;width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;">3</div> Send the message!</div>'
            + '</div></div>'
            + '<div style="display:grid;gap:0.8rem;">'
            + '<button style="padding:1.1rem;border-radius:14px;font-weight:700;background:#22c55e;color:white;border:none;cursor:pointer;font-size:1.05rem;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 6px -1px rgba(34, 197, 94, 0.2);" onclick="window._openWaShare()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Open WhatsApp</button>'
            + '<button style="padding:0.9rem;border-radius:12px;font-weight:600;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;gap:6px;" onclick="window._copyCaption()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy Caption Text</button>'
            + '<button class="btn btn-secondary" onclick="document.getElementById(\'wa-share-guide\').remove()" style="padding:0.9rem;border-radius:12px;font-size:0.95rem;font-weight:600;background:white;border:1px solid #e2e8f0;color:#0f172a;">Close</button>'
            + '</div></div>';
        document.body.appendChild(guide);

    } catch (err) {
        console.error('Receipt image error:', err);
        showToast('Unable to generate receipt image', 'error');
    }
};

window._openWaShare = function() {
    const phone = window._waPhone;
    const caption = window._waCaption || '';
    if (!phone) return showToast('Phone number not found', 'error');
    
    // IMPORTANT: DO NOT write to clipboard here. It overwrites the image!
    
    const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(caption);
    if (window.api && window.api.openExternal) {
        window.api.openExternal(url);
    } else {
        window.open(url, '_blank');
    }
    
    const ex2 = document.getElementById('wa-share-guide');
    if(ex2) ex2.remove();
};

window._copyCaption = function() {
    const caption = window._waCaption || '';
    if (!caption) return showToast('No caption to copy', 'error');
    navigator.clipboard.writeText(caption).then(function() {
        showToast('Caption copied! \u2705');
    }).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = caption;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Caption copied! \u2705');
    });
};

window.printKhataReceipt = function() {
    const content = document.getElementById('khata-receipt-print');
    if (!content) return;
    const win = window.open('', '_blank', 'width=500,height=700');
    win.document.write(`<html><head><title>Khata Receipt</title><style>
        body{font-family:'Segoe UI',sans-serif;margin:0;padding:0;color:#000;}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
    </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
};

// === SMART PAYMENT SYSTEM (FIFO) ===
window.showSmartPayment = function(personKey) {
    const db = getDB();
    const recs = (db.khataRecords || []).filter(r => {
        const k = r.customer_id ? `cust_${r.customer_id}` : `person_${r.person_name}`;
        return k === personKey;
    }).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

    const pendingRecs = recs.filter(r => {
        const bal = (r.total_amount||0) - (r.paid_amount||0);
        return bal > 0;
    });

    if (pendingRecs.length === 0) return showToast('No pending balance', 'error');

    const totalDue = pendingRecs.reduce((s,r) => s + ((r.total_amount||0)-(r.paid_amount||0)), 0);
    const name = pendingRecs[0].person_name || 'Customer';
    const cust = pendingRecs[0].customer_id ? (db.customers.find(c => c.id === pendingRecs[0].customer_id) || {}) : {};

    const ex = document.getElementById('smart-pay-modal');
    if (ex) ex.remove();
    const div = document.createElement('div');
    div.id = 'smart-pay-modal';
    div.className = 'modal';
    div.style.cssText = 'z-index:10001;';

    const entryRows = pendingRecs.map((r,i) => {
        const bal = (r.total_amount||0) - (r.paid_amount||0);
        return `<div class="sp-entry" data-id="${r.id}" data-bal="${bal}" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:0.85rem;">
            <div><span style="color:#64748b;">#${i+1}</span> ${r.description || (r.sale_id ? 'Order #'+r.sale_id : 'Entry')} <span style="color:#94a3b8;font-size:0.75rem;">${new Date(r.created_at).toLocaleDateString()}</span></div>
            <div style="display:flex;gap:8px;align-items:center;">
                <span style="color:#64748b;">Rs ${bal.toLocaleString()}</span>
                <span class="sp-status" style="font-size:0.7rem;padding:2px 6px;border-radius:4px;font-weight:700;background:#fef2f2;color:#991b1b;">Pending</span>
            </div>
        </div>`;
    }).join('');

    div.innerHTML = `<div class="modal-content" style="max-width:480px;border-radius:20px;padding:2rem;">
        <div style="text-align:center;margin-bottom:1rem;">
            <div style="font-size:2.5rem;">\ud83d\udcb0</div>
            <h3 style="margin-bottom:4px;">Receive Payment</h3>
            <p style="color:#64748b;font-size:0.85rem;">${cust.name || name} \u2014 Total Due: <strong style="color:#ef4444;">Rs ${totalDue.toLocaleString()}</strong></p>
        </div>
        <div style="margin-bottom:1rem;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Amount Received (Rs)</label>
            <input type="number" id="sp-amount" class="form-control" placeholder="Enter any amount" min="1" style="width:100%;padding:1rem;border-radius:12px;border:1px solid #e2e8f0;font-size:1.3rem;font-weight:800;text-align:center;" oninput="previewSmartPay()">
        </div>
        <div id="sp-preview" style="max-height:200px;overflow-y:auto;margin-bottom:1rem;">
            ${entryRows}
        </div>
        <div id="sp-advance-note" style="display:none;background:#dbeafe;color:#1d4ed8;padding:8px 12px;border-radius:8px;font-size:0.8rem;font-weight:600;margin-bottom:1rem;text-align:center;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <button class="btn btn-secondary" onclick="document.getElementById('smart-pay-modal').remove()" style="padding:1rem;border-radius:12px;">Cancel</button>
            <button class="btn btn-primary" id="sp-confirm-btn" onclick="confirmSmartPay('${personKey}')" style="padding:1rem;border-radius:12px;background:#10b981;border:none;font-weight:700;" disabled>\u2705 Confirm Payment</button>
        </div>
    </div>`;
    document.body.appendChild(div);

    // Store pending data for preview
    window._spPending = pendingRecs;
    window._spTotalDue = totalDue;
};

window.previewSmartPay = function() {
    const amt = parseFloat(document.getElementById('sp-amount')?.value) || 0;
    const entries = document.querySelectorAll('.sp-entry');
    const pending = window._spPending || [];
    const totalDue = window._spTotalDue || 0;
    const advNote = document.getElementById('sp-advance-note');
    const btn = document.getElementById('sp-confirm-btn');

    if (amt <= 0) {
        btn && (btn.disabled = true);
        entries.forEach(el => {
            el.querySelector('.sp-status').textContent = 'Pending';
            el.querySelector('.sp-status').style.cssText = 'font-size:0.7rem;padding:2px 6px;border-radius:4px;font-weight:700;background:#fef2f2;color:#991b1b;';
        });
        advNote && (advNote.style.display = 'none');
        return;
    }

    btn && (btn.disabled = false);
    let remaining = amt;

    entries.forEach((el, i) => {
        const bal = pending[i] ? ((pending[i].total_amount||0) - (pending[i].paid_amount||0)) : 0;
        const st = el.querySelector('.sp-status');
        if (remaining >= bal && bal > 0) {
            st.textContent = 'Paid \u2714';
            st.style.cssText = 'font-size:0.7rem;padding:2px 6px;border-radius:4px;font-weight:700;background:#ecfdf5;color:#065f46;';
            remaining -= bal;
        } else if (remaining > 0 && bal > 0) {
            st.textContent = `Partial (Rs ${remaining.toLocaleString()})`;
            st.style.cssText = 'font-size:0.7rem;padding:2px 6px;border-radius:4px;font-weight:700;background:#fff7ed;color:#c2410c;';
            remaining = 0;
        } else {
            st.textContent = 'Pending';
            st.style.cssText = 'font-size:0.7rem;padding:2px 6px;border-radius:4px;font-weight:700;background:#fef2f2;color:#991b1b;';
        }
    });

    if (remaining > 0 && advNote) {
        advNote.style.display = 'block';
        advNote.innerHTML = `\ud83d\udcb3 Rs ${remaining.toLocaleString()} will be stored as <strong>Advance Balance</strong>`;
    } else if (advNote) {
        advNote.style.display = 'none';
    }
};

window.confirmSmartPay = function(personKey) {
    const amt = parseFloat(document.getElementById('sp-amount')?.value) || 0;
    if (amt <= 0) return showToast('Enter a valid amount', 'error');

    const db = getDB();
    const pending = window._spPending || [];
    let remaining = amt;

    // FIFO distribution
    let lastRi = -1;
    pending.forEach(r => {
        if (remaining <= 0) return;
        const ri = (db.khataRecords || []).findIndex(kr => kr.id === r.id);
        if (ri === -1) return;

        lastRi = ri;
        const bal = (r.total_amount||0) - (r.paid_amount||0);
        const apply = Math.min(remaining, bal);

        db.khataRecords[ri].paid_amount = (db.khataRecords[ri].paid_amount || 0) + apply;
        if (!db.khataRecords[ri].payments) db.khataRecords[ri].payments = [];
        db.khataRecords[ri].payments.push({ amount: apply, date: new Date().toISOString(), note: 'Smart Payment' });

        const newBal = db.khataRecords[ri].total_amount - db.khataRecords[ri].paid_amount;
        db.khataRecords[ri].status = newBal <= 0 ? 'paid' : 'partial';

        remaining -= apply;
    });

    // Handle advance balance
    if (remaining > 0) {
        // Add the excess to the last paid record so it displays correctly on receipts
        if (lastRi !== -1) {
            db.khataRecords[lastRi].paid_amount += remaining;
            db.khataRecords[lastRi].payments[db.khataRecords[lastRi].payments.length - 1].amount += remaining;
        }

        if (!db.khataAdvance) db.khataAdvance = {};
        db.khataAdvance[personKey] = (db.khataAdvance[personKey] || 0) + remaining;
        // Track advance received
        if (!db.khataAdvanceHistory) db.khataAdvanceHistory = [];
        db.khataAdvanceHistory.push({
            personKey: personKey, type: 'received', amount: remaining,
            date: new Date().toISOString(), note: 'Overpayment advance'
        });
    }

    saveDB(db);
    document.getElementById('smart-pay-modal').remove();
    fetchKhata();
    renderKhata();

    if (remaining > 0) {
        showToast('Payment applied! Rs ' + remaining.toLocaleString() + ' saved as advance \u2705');
    } else {
        showToast('Rs ' + amt.toLocaleString() + ' payment distributed! \u2705');
    }
};

// === SET REMINDER SYSTEM ===
window.showSetReminderModal = function(personKey, personName) {
    const ex = document.getElementById('set-reminder-modal');
    if (ex) ex.remove();

    const today = new Date();
    const defaultDate = new Date(today);
    defaultDate.setDate(today.getDate() + 7); // Default Weekly
    const defaultDateStr = defaultDate.toISOString().slice(0,10);
    const minDateStr = today.toISOString().slice(0,10);

    const div = document.createElement('div');
    div.id = 'set-reminder-modal';
    div.className = 'modal';
    div.style.cssText = 'z-index:10001;display:flex;align-items:center;justify-content:center;';
    div.innerHTML = `<div class="modal-content" style="max-width:440px;border-radius:24px;padding:2.5rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <div style="text-align:center;margin-bottom:2rem;">
            <div style="font-size:3rem;margin-bottom:0.5rem;display:inline-block;animation:pulse 2s infinite;">⏰</div>
            <h3 style="font-size:1.6rem;font-weight:900;color:#0f172a;margin-bottom:0.2rem;">Set Reminder</h3>
            <p style="color:#64748b;font-size:0.95rem;font-weight:600;">${personName}</p>
        </div>
        
        <div style="margin-bottom:1.5rem;">
            <label style="font-weight:700;font-size:0.85rem;color:#475569;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Frequency</label>
            <div style="display:flex;gap:0.5rem;background:#f1f5f9;padding:6px;border-radius:12px;">
                <button type="button" class="freq-btn" data-val="1" onclick="selectRemFreq(this, 1)" style="flex:1;padding:10px 4px;border:none;border-radius:8px;background:transparent;font-weight:600;color:#64748b;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">Daily</button>
                <button type="button" class="freq-btn active" data-val="7" onclick="selectRemFreq(this, 7)" style="flex:1;padding:10px 4px;border:none;border-radius:8px;background:white;font-weight:700;color:#1e293b;box-shadow:0 2px 4px rgba(0,0,0,0.05);cursor:pointer;font-size:0.85rem;transition:all 0.2s;">Weekly</button>
                <button type="button" class="freq-btn" data-val="30" onclick="selectRemFreq(this, 30)" style="flex:1;padding:10px 4px;border:none;border-radius:8px;background:transparent;font-weight:600;color:#64748b;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">Monthly</button>
                <button type="button" class="freq-btn" data-val="custom" onclick="selectRemFreq(this, 'custom')" style="flex:1;padding:10px 4px;border:none;border-radius:8px;background:transparent;font-weight:600;color:#64748b;cursor:pointer;font-size:0.85rem;transition:all 0.2s;">Custom</button>
            </div>
        </div>

        <div style="margin-bottom:1.5rem;">
            <label style="font-weight:700;font-size:0.85rem;color:#475569;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Next Reminder Date</label>
            <input type="date" id="rem-date" min="${minDateStr}" value="${defaultDateStr}" style="width:100%;padding:1rem;border-radius:12px;border:2px solid #e2e8f0;font-size:1.05rem;font-weight:700;color:#0f172a;outline:none;transition:border-color 0.2s;" onchange="syncFreqBtn()">
        </div>
        
        <div style="margin-bottom:2rem;">
            <label style="font-weight:700;font-size:0.85rem;color:#475569;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Note (optional)</label>
            <input type="text" id="rem-note" placeholder="e.g. Call for outstanding balance" style="width:100%;padding:1rem;border-radius:12px;border:2px solid #e2e8f0;font-size:0.95rem;font-weight:500;outline:none;transition:border-color 0.2s;">
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <button class="btn btn-secondary" onclick="document.getElementById('set-reminder-modal').remove()" style="padding:1rem;border-radius:14px;font-weight:700;font-size:1rem;border:2px solid #e2e8f0;background:white;color:#64748b;transition:all 0.2s;">Cancel</button>
            <button class="btn btn-primary" style="padding:1rem;border-radius:14px;background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);border:none;font-weight:800;font-size:1rem;color:white;box-shadow:0 4px 12px rgba(245, 158, 11, 0.3);transition:all 0.2s;" onclick="saveReminder('${personKey}','${personName.replace(/'/g,"\\\\'")}')">Save Reminder</button>
        </div>
    </div>`;
    document.body.appendChild(div);
};

window.selectRemFreq = function(btn, days) {
    const btns = document.querySelectorAll('.freq-btn');
    btns.forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#64748b';
        b.style.fontWeight = '600';
        b.style.boxShadow = 'none';
        b.classList.remove('active');
    });
    btn.style.background = 'white';
    btn.style.color = '#1e293b';
    btn.style.fontWeight = '700';
    btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
    btn.classList.add('active');

    if (days !== 'custom') {
        const today = new Date();
        today.setDate(today.getDate() + parseInt(days));
        document.getElementById('rem-date').value = today.toISOString().slice(0,10);
    } else {
        const dp = document.getElementById('rem-date');
        dp.focus();
        if (dp.showPicker) dp.showPicker();
    }
};

window.syncFreqBtn = function() {
    const customBtn = document.querySelector('.freq-btn[data-val="custom"]');
    if (customBtn) window.selectRemFreq(customBtn, 'custom');
};

window.saveReminder = function(personKey, personName) {
    const date = document.getElementById('rem-date')?.value;
    const note = document.getElementById('rem-note')?.value || '';

    if (!date) return showToast('Please select a date', 'error');

    const db = getDB();
    if (!db.khataReminders) db.khataReminders = [];
    db.khataReminders.push({
        id: Date.now(),
        person_key: personKey,
        person_name: personName,
        reminder_date: date,
        reminder_note: note,
        status: 'Pending',
        created_at: new Date().toISOString()
    });
    saveDB(db);

    document.getElementById('set-reminder-modal').remove();
    showToast(`Reminder set for ${new Date(date).toLocaleDateString()} \u2705`);
    updateReminderBell();
    renderKhata();
};

// === NOTIFICATION BELL ===
window.toggleReminderDropdown = function() {
    const dd = document.getElementById('reminder-dropdown');
    if (!dd) return;
    dd.classList.toggle('hidden');
    if (!dd.classList.contains('hidden')) renderReminderDropdown();
};

window.updateReminderBell = function() {
    const db = getDB();
    const now = new Date();
    // Reset hours to compare dates strictly without current time pushing it out
    now.setHours(0,0,0,0);
    const due = (db.khataReminders || []).filter(r => r.status === 'Pending' && new Date(r.reminder_date) <= new Date());
    const badge = document.getElementById('reminder-bell-badge');
    
    if (badge) {
        const bellIcon = badge.previousElementSibling;
        
        if (due.length > 0) {
            badge.style.display = 'block';
            badge.textContent = due.length;
            badge.style.animation = 'pulse 2s infinite';
            
            if (bellIcon) {
                bellIcon.style.color = '#ef4444';
                bellIcon.style.transform = 'rotate(15deg)';
                setTimeout(() => bellIcon.style.transform = 'rotate(-15deg)', 150);
                setTimeout(() => bellIcon.style.transform = 'rotate(10deg)', 300);
                setTimeout(() => bellIcon.style.transform = 'rotate(-10deg)', 450);
                setTimeout(() => bellIcon.style.transform = 'rotate(0deg)', 600);
            }
            
            if (!window._remindedForDue) {
                showToast(`🔔 You have ${due.length} pending reminder(s)!`, 'error');
                window._remindedForDue = true;
            }
        } else {
            badge.style.display = 'none';
            badge.style.animation = 'none';
            if (bellIcon) {
                bellIcon.style.color = '';
                bellIcon.style.transform = '';
            }
            window._remindedForDue = false;
        }
    }
};

window.renderReminderDropdown = function() {
    const dd = document.getElementById('reminder-dropdown');
    if (!dd) return;

    const db = getDB();
    const now = new Date();
    const reminders = (db.khataReminders || []).filter(r => r.status === 'Pending').sort((a,b) => new Date(a.reminder_date) - new Date(b.reminder_date));

    if (reminders.length === 0) {
        dd.innerHTML = `<div style="padding:2rem;text-align:center;color:#94a3b8;font-size:0.9rem;">\ud83d\udd14 No pending reminders</div>`;
        return;
    }

    dd.innerHTML = `<div style="padding:1rem;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:800;font-size:0.95rem;color:#0f172a;">\ud83d\udd14 Reminders (${reminders.length})</div>
    </div>
    <div style="max-height:320px;overflow-y:auto;">
        ${reminders.map(r => {
            const isDue = new Date(r.reminder_date) <= now;
            const phone = _getPhoneForKey(r.person_key);
            return `<div style="padding:0.8rem 1rem;border-bottom:1px solid #f1f5f9;${isDue?'background:#fef2f2;':''}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                    <div>
                        <div style="font-weight:700;font-size:0.9rem;color:#0f172a;">${r.person_name} ${isDue ? '<span style="color:#ef4444;font-size:0.75rem;">\ud83d\udd34 DUE</span>' : ''}</div>
                        <div style="font-size:0.75rem;color:#64748b;">\ud83d\udcc5 ${new Date(r.reminder_date).toLocaleDateString()}${r.reminder_note ? ' \u00b7 ' + r.reminder_note : ''}</div>
                    </div>
                </div>
                <div style="display:flex;gap:6px;">
                    ${phone ? `<button style="padding:4px 10px;font-size:0.75rem;border-radius:6px;font-weight:700;background:#25D366;color:white;border:none;cursor:pointer;" onclick="sendReminderFromBell(${r.id})">Send Reminder</button>` : ''}
                    <button style="padding:4px 10px;font-size:0.75rem;border-radius:6px;font-weight:600;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;cursor:pointer;" onclick="dismissReminder(${r.id})">Dismiss</button>
                </div>
            </div>`;
        }).join('')}
    </div>`;
};

function _getPhoneForKey(personKey) {
    const db = getDB();
    if (personKey.startsWith('cust_')) {
        const id = parseInt(personKey.replace('cust_', ''));
        const c = (db.customers || []).find(c => c.id === id);
        return c?.phone || '';
    }
    return '';
}

window.dismissReminder = function(remId) {
    const db = getDB();
    const ri = (db.khataReminders || []).findIndex(r => r.id === remId);
    if (ri !== -1) {
        db.khataReminders[ri].status = 'Dismissed';
        saveDB(db);
    }
    updateReminderBell();
    renderReminderDropdown();
    renderKhata();
    showToast('Reminder dismissed');
};

window.sendReminderFromBell = async function(remId) {
    const db = getDB();
    const rem = (db.khataReminders || []).find(r => r.id === remId);
    if (!rem) return;

    const phone = _getPhoneForKey(rem.person_key);
    if (!phone) return showToast('No phone number found', 'error');

    const fPhone = formatPhone(phone);
    if (!fPhone) return showToast('Invalid phone format', 'error');

    // Get balance
    const recs = (db.khataRecords || []).filter(r => {
        const k = r.customer_id ? `cust_${r.customer_id}` : `person_${r.person_name}`;
        return k === rem.person_key;
    });
    const totalDue = recs.reduce((s,r) => s + (r.total_amount||0), 0);
    const totalPaid = recs.reduce((s,r) => s + (r.paid_amount||0), 0);
    const balance = totalDue - totalPaid;

    const msg = getWhatsAppMessage(rem.person_name, balance);
    const url = `https://wa.me/${fPhone}?text=${encodeURIComponent(msg)}`;
    if (window.api && window.api.openExternal) window.api.openExternal(url);
    else window.open(url, '_blank');

    setTimeout(async () => {
        const confirmed = await showConfirm('Message Sent?', `Did you send the message to ${rem.person_name}?`, {
            icon: '\u2705', confirmText: 'Yes, Sent', cancelText: 'No, Cancel'
        });
        if (confirmed) {
            completeReminder(remId);
        }
    }, 2000);
};

window.completeReminder = function(remId) {
    const db = getDB();
    const ri = (db.khataReminders || []).findIndex(r => r.id === remId);
    if (ri !== -1) {
        db.khataReminders[ri].status = 'Completed';
        db.khataReminders[ri].completed_at = new Date().toISOString();
        saveDB(db);
    }
    updateReminderBell();
    renderReminderDropdown();
    renderKhata();
    showToast('Reminder completed \u2705');
};

// Auto-check reminders on load and every 60s
setTimeout(() => { updateReminderBell(); }, 1000);
setInterval(() => { updateReminderBell(); }, 60000);

// Close dropdown on outside click
document.addEventListener('click', function(e) {
    const wrap = document.getElementById('reminder-bell-wrap');
    const dd = document.getElementById('reminder-dropdown');
    if (wrap && dd && !wrap.contains(e.target)) {
        dd.classList.add('hidden');
    }
});
