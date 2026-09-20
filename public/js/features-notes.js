// === NOTES & REMINDERS MODULE ===

window.renderNotes = function() {
    const db = getDB();
    if (!db.personalReminders) db.personalReminders = [];
    const reminders = db.personalReminders;
    const now = new Date();

    // Categorize
    const pending = reminders.filter(r => r.status === 'Pending');
    const done = reminders.filter(r => r.status === 'Done');

    const getStatus = (r) => {
        const dt = new Date(r.datetime);
        const today = new Date();
        today.setHours(0,0,0,0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (dt < now) return 'overdue';
        if (dt >= today && dt < tomorrow) return 'due_today';
        return 'upcoming';
    };

    const statusStyle = (s) => {
        if (s === 'overdue') return 'background:#fef2f2;color:#991b1b;';
        if (s === 'due_today') return 'background:#fef3c7;color:#92400e;';
        return 'background:#ecfdf5;color:#065f46;';
    };

    const statusLabel = (s) => {
        if (s === 'overdue') return '🔴 Overdue';
        if (s === 'due_today') return '🟡 Due Today';
        return '🟢 Upcoming';
    };

    const sortedPending = pending.sort((a,b) => new Date(a.datetime) - new Date(b.datetime));

    contentArea.innerHTML = `
        <div style="max-width:800px;margin:0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <div>
                    <h2 style="margin:0;font-weight:800;color:#0f172a;">📝 Notes & Reminders</h2>
                    <p style="color:#64748b;font-size:0.85rem;margin-top:4px;">${pending.length} pending · ${done.length} completed</p>
                </div>
                <button class="btn btn-primary" style="border-radius:12px;padding:0.8rem 1.5rem;font-weight:700;" onclick="showAddNoteModal()">➕ Add Reminder</button>
            </div>

            <!-- Quick Stats -->
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;">
                <div style="background:#fef2f2;border-radius:14px;padding:1.2rem;text-align:center;border:1px solid #fecaca;">
                    <div style="font-size:1.8rem;font-weight:900;color:#ef4444;">${pending.filter(r=>getStatus(r)==='overdue').length}</div>
                    <div style="font-size:0.8rem;font-weight:700;color:#991b1b;">Overdue</div>
                </div>
                <div style="background:#fef3c7;border-radius:14px;padding:1.2rem;text-align:center;border:1px solid #fde68a;">
                    <div style="font-size:1.8rem;font-weight:900;color:#f59e0b;">${pending.filter(r=>getStatus(r)==='due_today').length}</div>
                    <div style="font-size:0.8rem;font-weight:700;color:#92400e;">Due Today</div>
                </div>
                <div style="background:#ecfdf5;border-radius:14px;padding:1.2rem;text-align:center;border:1px solid #a7f3d0;">
                    <div style="font-size:1.8rem;font-weight:900;color:#10b981;">${pending.filter(r=>getStatus(r)==='upcoming').length}</div>
                    <div style="font-size:0.8rem;font-weight:700;color:#065f46;">Upcoming</div>
                </div>
            </div>

            <!-- Pending Reminders -->
            <div class="data-table-container" style="margin-bottom:2rem;">
                <div class="table-header"><h3>⏰ Active Reminders</h3></div>
                <div style="padding:1rem;">
                    ${sortedPending.length === 0 ? '<div style="text-align:center;color:#94a3b8;padding:2rem;">No pending reminders. Click "Add Reminder" to create one.</div>' : ''}
                    ${sortedPending.map(r => {
                        const s = getStatus(r);
                        const dt = new Date(r.datetime);
                        const cardBg = s === 'overdue' ? '#fff5f5' : s === 'due_today' ? '#fffbeb' : 'white';
                        const borderColor = s === 'overdue' ? '#fecaca' : s === 'due_today' ? '#fde68a' : '#e2e8f0';
                        return `<div style="background:${cardBg};border:1px solid ${borderColor};border-radius:12px;padding:1rem 1.2rem;margin-bottom:0.8rem;">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                                <div style="flex:1;">
                                    <div style="font-size:1rem;font-weight:800;color:#0f172a;margin-bottom:4px;">${r.title}</div>
                                    ${r.description ? `<div style="font-size:0.85rem;color:#64748b;margin-bottom:6px;">${r.description}</div>` : ''}
                                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                                        <span style="font-size:0.8rem;color:#64748b;">📅 ${dt.toLocaleDateString()}</span>
                                        <span style="font-size:0.8rem;color:#64748b;">🕐 ${dt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                                        <span style="font-size:0.7rem;padding:2px 8px;border-radius:6px;font-weight:700;${statusStyle(s)}">${statusLabel(s)}</span>
                                    </div>
                                </div>
                                <div style="display:flex;gap:6px;flex-shrink:0;margin-left:1rem;">
                                    <button style="padding:6px 12px;font-size:0.75rem;border-radius:8px;font-weight:700;background:#10b981;color:white;border:none;cursor:pointer;" onclick="markNoteDone(${r.id})">✅ Done</button>
                                    <button style="padding:6px 12px;font-size:0.75rem;border-radius:8px;font-weight:600;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;cursor:pointer;" onclick="snoozeNote(${r.id})">⏰ Snooze</button>
                                    <button style="padding:6px 12px;font-size:0.75rem;border-radius:8px;font-weight:600;background:#fef2f2;color:#ef4444;border:1px solid #fecaca;cursor:pointer;" onclick="deleteNote(${r.id})">🗑️</button>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <!-- Completed -->
            ${done.length > 0 ? `
            <div class="data-table-container">
                <div class="table-header" style="cursor:pointer;" onclick="document.getElementById('notes-done-list').classList.toggle('hidden')"><h3>✅ Completed (${done.length})</h3></div>
                <div id="notes-done-list" class="hidden" style="padding:1rem;">
                    ${done.sort((a,b)=>new Date(b.completed_at||0)-new Date(a.completed_at||0)).map(r => `
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:0.8rem 1rem;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <div style="font-size:0.9rem;font-weight:600;color:#94a3b8;text-decoration:line-through;">${r.title}</div>
                                <div style="font-size:0.75rem;color:#cbd5e1;">${new Date(r.datetime).toLocaleDateString()} ${r.description ? '· '+r.description : ''}</div>
                            </div>
                            <button style="padding:4px 10px;font-size:0.7rem;border-radius:6px;background:#fef2f2;color:#ef4444;border:1px solid #fecaca;cursor:pointer;" onclick="deleteNote(${r.id})">🗑️</button>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
        </div>`;

    // Update bell with combined khata + personal reminders
    updateGlobalBell();
};

// === ADD NOTE MODAL ===
window.showAddNoteModal = function() {
    const ex = document.getElementById('add-note-modal');
    if (ex) ex.remove();

    const now = new Date();
    const dateVal = now.toISOString().slice(0,10);
    const timeVal = now.toTimeString().slice(0,5);

    const div = document.createElement('div');
    div.id = 'add-note-modal';
    div.className = 'modal';
    div.style.cssText = 'z-index:10001;';
    div.innerHTML = `<div class="modal-content" style="max-width:420px;border-radius:20px;padding:2rem;">
        <div style="text-align:center;margin-bottom:1.5rem;">
            <div style="font-size:2.5rem;">📝</div>
            <h3>Add Reminder</h3>
        </div>
        <div style="margin-bottom:1rem;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Title *</label>
            <input type="text" id="note-title" placeholder="e.g. Buy sugar, Call supplier" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;font-size:1rem;font-weight:600;">
        </div>
        <div style="margin-bottom:1rem;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Description (optional)</label>
            <input type="text" id="note-desc" placeholder="Add details..." style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;font-size:0.9rem;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
            <div>
                <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Date</label>
                <input type="date" id="note-date" value="${dateVal}" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;font-size:0.9rem;font-weight:600;">
            </div>
            <div>
                <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Time</label>
                <input type="time" id="note-time" value="${timeVal}" style="width:100%;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;font-size:0.9rem;font-weight:600;">
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <button class="btn btn-secondary" onclick="document.getElementById('add-note-modal').remove()" style="padding:1rem;border-radius:12px;">Cancel</button>
            <button class="btn btn-primary" style="padding:1rem;border-radius:12px;font-weight:700;" onclick="saveNote()">Save Reminder</button>
        </div>
    </div>`;
    document.body.appendChild(div);
    document.getElementById('note-title').focus();
};

window.saveNote = function() {
    const title = document.getElementById('note-title')?.value?.trim();
    const desc = document.getElementById('note-desc')?.value?.trim() || '';
    const date = document.getElementById('note-date')?.value;
    const time = document.getElementById('note-time')?.value || '09:00';

    if (!title) return showToast('Please enter a title', 'error');
    if (!date) return showToast('Please select a date', 'error');

    const db = getDB();
    if (!db.personalReminders) db.personalReminders = [];
    db.personalReminders.push({
        id: Date.now(),
        title: title,
        description: desc,
        datetime: `${date}T${time}:00`,
        status: 'Pending',
        created_at: new Date().toISOString()
    });
    saveDB(db);

    document.getElementById('add-note-modal').remove();
    showToast('Reminder saved ✅');
    renderNotes();
    updateGlobalBell();
};

// === ACTIONS ===
window.markNoteDone = function(id) {
    const db = getDB();
    const ri = (db.personalReminders || []).findIndex(r => r.id === id);
    if (ri !== -1) {
        db.personalReminders[ri].status = 'Done';
        db.personalReminders[ri].completed_at = new Date().toISOString();
        saveDB(db);
    }
    showToast('Marked as done ✅');
    renderNotes();
    updateGlobalBell();
};

window.snoozeNote = async function(id) {
    const ex = document.getElementById('snooze-modal');
    if (ex) ex.remove();

    const div = document.createElement('div');
    div.id = 'snooze-modal';
    div.className = 'modal';
    div.style.cssText = 'z-index:10002;';
    div.innerHTML = `<div class="modal-content" style="max-width:320px;border-radius:20px;padding:2rem;text-align:center;">
        <div style="font-size:2rem;margin-bottom:0.5rem;">⏰</div>
        <h3 style="margin-bottom:1rem;">Snooze Reminder</h3>
        <div style="display:grid;gap:0.5rem;">
            <button style="padding:0.8rem;border-radius:10px;font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;cursor:pointer;font-size:0.9rem;" onclick="doSnooze(${id},1)">+1 Hour</button>
            <button style="padding:0.8rem;border-radius:10px;font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;cursor:pointer;font-size:0.9rem;" onclick="doSnooze(${id},3)">+3 Hours</button>
            <button style="padding:0.8rem;border-radius:10px;font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;cursor:pointer;font-size:0.9rem;" onclick="doSnooze(${id},24)">+1 Day</button>
            <button style="padding:0.8rem;border-radius:10px;font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;cursor:pointer;font-size:0.9rem;" onclick="doSnooze(${id},168)">+1 Week</button>
            <button class="btn btn-secondary" onclick="document.getElementById('snooze-modal').remove()" style="padding:0.6rem;border-radius:10px;margin-top:0.5rem;">Cancel</button>
        </div>
    </div>`;
    document.body.appendChild(div);
};

window.doSnooze = function(id, hours) {
    const db = getDB();
    const ri = (db.personalReminders || []).findIndex(r => r.id === id);
    if (ri !== -1) {
        const newDate = new Date(db.personalReminders[ri].datetime);
        newDate.setHours(newDate.getHours() + hours);
        db.personalReminders[ri].datetime = newDate.toISOString();
        saveDB(db);
    }
    document.getElementById('snooze-modal')?.remove();
    const label = hours >= 168 ? '1 week' : hours >= 24 ? '1 day' : hours + ' hour(s)';
    showToast(`Snoozed by ${label} ⏰`);
    renderNotes();
    updateGlobalBell();
};

window.deleteNote = async function(id) {
    const confirmed = await showConfirm('Delete Reminder', 'Are you sure you want to delete this reminder?', {
        icon: '🗑️', confirmText: 'Delete', cancelText: 'Cancel'
    });
    if (!confirmed) return;

    const db = getDB();
    db.personalReminders = (db.personalReminders || []).filter(r => r.id !== id);
    saveDB(db);
    showToast('Reminder deleted');
    renderNotes();
    updateGlobalBell();
};

// === GLOBAL BELL (combines khata + personal reminders) ===
window.updateGlobalBell = function() {
    const db = getDB();
    const now = new Date();

    // Khata reminders
    const khataDue = (db.khataReminders || []).filter(r => r.status === 'Pending').length;

    // Personal reminders
    const personalDue = (db.personalReminders || []).filter(r => r.status === 'Pending').length;

    const total = khataDue + personalDue;
    const badge = document.getElementById('reminder-bell-badge');
    if (badge) {
        if (total > 0) {
            badge.style.display = 'block';
            badge.textContent = total;
        } else {
            badge.style.display = 'none';
        }
    }
};

// Override the existing bell dropdown to include personal reminders
const _origRenderDropdown = window.renderReminderDropdown;
window.renderReminderDropdown = function() {
    const dd = document.getElementById('reminder-dropdown');
    if (!dd) return;

    const db = getDB();
    const now = new Date();

    // Khata reminders
    const khataRems = (db.khataReminders || []).filter(r => r.status === 'Pending').map(r => ({
        ...r, type: 'khata', sortDate: new Date(r.reminder_date),
        isDue: new Date(r.reminder_date) <= now
    }));

    // Personal reminders
    const personalRems = (db.personalReminders || []).filter(r => r.status === 'Pending').map(r => ({
        ...r, type: 'personal', sortDate: new Date(r.datetime),
        isDue: new Date(r.datetime) <= now
    }));

    const all = [...khataRems, ...personalRems].sort((a,b) => a.sortDate - b.sortDate);

    if (all.length === 0) {
        dd.innerHTML = `<div style="padding:2rem;text-align:center;color:#94a3b8;font-size:0.9rem;">🔔 No pending reminders</div>`;
        return;
    }

    dd.innerHTML = `<div style="padding:1rem;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:800;font-size:0.95rem;color:#0f172a;">🔔 All Reminders (${all.length})</div>
    </div>
    <div style="max-height:350px;overflow-y:auto;">
        ${all.map(r => {
            if (r.type === 'khata') {
                const phone = typeof _getPhoneForKey === 'function' ? _getPhoneForKey(r.person_key) : '';
                return `<div style="padding:0.8rem 1rem;border-bottom:1px solid #f1f5f9;${r.isDue?'background:#fef2f2;':''}">
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
                        <span style="font-size:0.65rem;padding:1px 6px;border-radius:4px;background:#dbeafe;color:#1d4ed8;font-weight:700;">KHATA</span>
                        <span style="font-weight:700;font-size:0.85rem;color:#0f172a;">${r.person_name}</span>
                        ${r.isDue ? '<span style="color:#ef4444;font-size:0.7rem;">🔴 DUE</span>' : ''}
                    </div>
                    <div style="font-size:0.75rem;color:#64748b;margin-bottom:6px;">📅 ${new Date(r.reminder_date).toLocaleDateString()}${r.reminder_note ? ' · ' + r.reminder_note : ''}</div>
                    <div style="display:flex;gap:6px;">
                        ${phone ? `<button style="padding:3px 8px;font-size:0.7rem;border-radius:5px;font-weight:700;background:#25D366;color:white;border:none;cursor:pointer;" onclick="sendReminderFromBell(${r.id})">Send</button>` : ''}
                        <button style="padding:3px 8px;font-size:0.7rem;border-radius:5px;font-weight:600;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;cursor:pointer;" onclick="dismissReminder(${r.id})">Dismiss</button>
                    </div>
                </div>`;
            } else {
                return `<div style="padding:0.8rem 1rem;border-bottom:1px solid #f1f5f9;${r.isDue?'background:#fef2f2;':''}">
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
                        <span style="font-size:0.65rem;padding:1px 6px;border-radius:4px;background:#fef3c7;color:#92400e;font-weight:700;">NOTE</span>
                        <span style="font-weight:700;font-size:0.85rem;color:#0f172a;">${r.title}</span>
                        ${r.isDue ? '<span style="color:#ef4444;font-size:0.7rem;">🔴 DUE</span>' : ''}
                    </div>
                    <div style="font-size:0.75rem;color:#64748b;margin-bottom:6px;">📅 ${new Date(r.datetime).toLocaleDateString()} 🕐 ${new Date(r.datetime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}${r.description ? ' · ' + r.description : ''}</div>
                    <div style="display:flex;gap:6px;">
                        <button style="padding:3px 8px;font-size:0.7rem;border-radius:5px;font-weight:700;background:#10b981;color:white;border:none;cursor:pointer;" onclick="markNoteDone(${r.id});renderReminderDropdown();">Done</button>
                        <button style="padding:3px 8px;font-size:0.7rem;border-radius:5px;font-weight:600;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;cursor:pointer;" onclick="snoozeNote(${r.id})">Snooze</button>
                    </div>
                </div>`;
            }
        }).join('')}
    </div>`;
};

// Replace updateReminderBell with unified version
window.updateReminderBell = window.updateGlobalBell;

// Auto-check on load
setTimeout(() => { updateGlobalBell(); }, 1500);
