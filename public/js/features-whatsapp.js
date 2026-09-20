// === WHATSAPP REMINDER MODULE ===

function formatPhone(phone) {
    if (!phone || phone === 'N/A') return null;
    let p = phone.replace(/[\s\-\(\)]/g, '');
    if (p.startsWith('+')) p = p.slice(1);
    if (p.startsWith('0')) p = '92' + p.slice(1);
    if (!/^92\d{10}$/.test(p)) return null;
    return p;
}

function getWhatsAppMessage(name, balance) {
    return `السلام علیکم،\n\nMM Brothers Islamic Mart کی جانب سے آپ کو مطلع کیا جاتا ہے کہ آپ کے کھاتے میں *Rs ${balance.toLocaleString()}* بقایا ہے۔\n\nبراہِ کرم اپنا بقایا ادھار جلد از جلد ادا کرنے کی زحمت فرمائیں۔\n\nشکریہ۔`;
}

function wasSentToday(record) {
    if (!record.last_reminder_sent) return false;
    return new Date(record.last_reminder_sent).toDateString() === new Date().toDateString();
}

function calcNextReminder(freq) {
    const now = new Date();
    if (freq === 'weekly') now.setDate(now.getDate() + 7);
    else now.setDate(now.getDate() + 30);
    return now.toISOString();
}

function getReminderStatus(record) {
    if (!record.next_reminder_date) return 'none';
    const next = new Date(record.next_reminder_date);
    const diff = (next - new Date()) / (86400000);
    if (diff < 0) return 'overdue';
    if (diff <= 2) return 'due_soon';
    return 'sent';
}

function getReminderBadge(status) {
    const m = { sent: ['#ecfdf5','#065f46','Sent'], due_soon: ['#fef3c7','#92400e','Due Soon'], overdue: ['#fef2f2','#991b1b','Overdue'], none: ['#f1f5f9','#64748b','—'] };
    const s = m[status] || m.none;
    return `<span style="font-size:0.7rem;padding:2px 8px;border-radius:6px;font-weight:700;background:${s[0]};color:${s[1]};">${s[2]}</span>`;
}

// Show message preview then open WhatsApp, then confirm
window.sendWhatsAppReminder = async function(personKey, gd) {
    const phone = formatPhone(gd.phone);
    if (!phone) return showToast('Invalid phone! Use format: 03XXXXXXXXX', 'error');
    const balance = gd.totalDue - gd.totalPaid;
    if (balance <= 0) return showToast('No pending balance', 'error');
    if ((gd.records || []).some(r => wasSentToday(r))) return showToast('Already sent today!', 'error');

    const msg = getWhatsAppMessage(gd.name, balance);

    // Show preview modal
    const ex = document.getElementById('wa-preview-modal');
    if (ex) ex.remove();
    const div = document.createElement('div');
    div.id = 'wa-preview-modal';
    div.className = 'modal';
    div.innerHTML = `<div class="modal-content" style="max-width:450px;border-radius:20px;padding:2rem;">
        <div style="text-align:center;margin-bottom:1rem;"><div style="font-size:2.5rem;">📲</div>
        <h3>Send Reminder</h3>
        <p style="color:#64748b;font-size:0.85rem;">${gd.name} — Rs ${balance.toLocaleString()}</p></div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:1rem;margin-bottom:1.5rem;direction:rtl;font-size:0.9rem;line-height:1.8;max-height:200px;overflow-y:auto;" id="wa-msg-preview">${msg.replace(/\n/g,'<br>')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <button class="btn btn-secondary" onclick="document.getElementById('wa-preview-modal').remove()" style="padding:1rem;border-radius:12px;">Cancel</button>
            <button class="btn btn-primary" id="wa-send-btn" style="padding:1rem;border-radius:12px;background:#25D366;border:none;font-weight:700;">Send via WhatsApp</button>
        </div>
    </div>`;
    document.body.appendChild(div);

    document.getElementById('wa-send-btn').addEventListener('click', function() {
        document.getElementById('wa-preview-modal').remove();
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        if (window.api && window.api.openExternal) window.api.openExternal(url);
        else window.open(url, '_blank');

        // After 2s, ask confirmation
        setTimeout(async () => {
            const confirmed = await showConfirm('Message Sent?', 'Did you actually send the WhatsApp message?', {
                icon: '✅', confirmText: 'Yes, Sent', cancelText: 'No, Cancel'
            });
            if (confirmed) {
                _markReminderSent(gd, phone, msg);
            }
        }, 2000);
    });
};

function _markReminderSent(gd, phone, msg) {
    const db = getDB();
    const now = new Date().toISOString();
    const freq = gd.records[0]?.reminder_frequency || 'monthly';
    (gd.records || []).forEach(r => {
        const ri = (db.khataRecords || []).findIndex(kr => kr.id === r.id);
        if (ri !== -1) {
            db.khataRecords[ri].last_reminder_sent = now;
            db.khataRecords[ri].reminder_status = 'Sent';
            db.khataRecords[ri].next_reminder_date = calcNextReminder(freq);
            db.khataRecords[ri].reminder_frequency = freq;
        }
    });
    if (!db.reminderLog) db.reminderLog = [];
    db.reminderLog.push({ id: Date.now(), person_name: gd.name, phone, message: msg, sent_at: now, status: 'Sent' });
    saveDB(db);
    showToast(`Reminder to ${gd.name} recorded! ✅`);
    fetchKhata(); renderKhata();
}

window.sendAllDueReminders = async function() {
    const db = getDB();
    const now = new Date();
    const groups = {};
    (db.khataRecords || []).forEach(r => {
        if (r.status === 'paid') return;
        const bal = (r.total_amount || 0) - (r.paid_amount || 0);
        if (bal <= 0) return;
        const key = r.customer_id ? `cust_${r.customer_id}` : `person_${r.person_name}`;
        if (!groups[key]) groups[key] = { records: [], name: '', phone: '', totalDue: 0, totalPaid: 0 };
        const cust = r.customer_id ? (db.customers.find(c => c.id === r.customer_id) || { name: r.person_name, phone: '' }) : { name: r.person_name, phone: '' };
        groups[key].name = cust.name;
        groups[key].phone = cust.phone || '';
        groups[key].records.push(r);
        groups[key].totalDue += r.total_amount || 0;
        groups[key].totalPaid += r.paid_amount || 0;
    });

    const dueList = Object.keys(groups).filter(key => {
        const g = groups[key];
        if (!formatPhone(g.phone)) return false;
        if (g.records.some(r => wasSentToday(r))) return false;
        return g.records.some(r => !r.next_reminder_date || new Date(r.next_reminder_date) <= now);
    });

    if (dueList.length === 0) return showToast('No due reminders to send', 'error');

    // Show list of due customers
    const nameList = dueList.map((k,i) => `${i+1}. ${groups[k].name} — Rs ${(groups[k].totalDue - groups[k].totalPaid).toLocaleString()}`).join('\n');
    const proceed = await showConfirm('Send Reminders', `${dueList.length} customer(s) due:\n\n${nameList.slice(0, 500)}${nameList.length > 500 ? '\n...' : ''}\n\nEach will open one by one. You confirm after each.`, {
        icon: '📲', confirmText: `Start (${dueList.length} customers)`
    });
    if (!proceed) return;

    let sent = 0;
    for (let i = 0; i < dueList.length; i++) {
        const key = dueList[i];
        const g = groups[key];
        const phone = formatPhone(g.phone);
        const balance = g.totalDue - g.totalPaid;
        const msg = getWhatsAppMessage(g.name, balance);
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

        if (window.api && window.api.openExternal) window.api.openExternal(url);
        else window.open(url, '_blank');

        await new Promise(r => setTimeout(r, 2500));

        const confirmed = await showConfirm(
            `(${i+1}/${dueList.length}) Message Sent?`,
            `Did you send the message to ${g.name}?\nBalance: Rs ${balance.toLocaleString()}`,
            { icon: '✅', confirmText: 'Yes, Sent — Next', cancelText: 'Skip — Next' }
        );
        if (confirmed) {
            _markReminderSent(g, phone, msg);
            sent++;
        }

        // After every send, offer to stop if many remaining
        if (i < dueList.length - 1) {
            const remaining = dueList.length - i - 1;
            const cont = await showConfirm('Continue?', `${sent} sent so far. ${remaining} remaining.`, {
                icon: '📲', confirmText: `Continue (${remaining} left)`, cancelText: 'Stop Here'
            });
            if (!cont) break;
        }
    }

    showToast(`${sent} of ${dueList.length} reminders sent ✅`);
    fetchKhata(); renderKhata();
};
