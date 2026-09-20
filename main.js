const { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage, shell } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

let mainWindow;
let splashWindow;
let db;

function initDB() {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    db = new Database(dbPath);
    
    db.prepare(`
        CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();

    // Check if data exists. If not, seed testing data.
    const stmt = db.prepare("SELECT value FROM kv_store WHERE key = 'mm_brothers_data'");
    const row = stmt.get();
    
    if (!row) {
        const initialData = {
            users: [
                { id: 1, username: "admin", password: "123", role: "admin", name: "Admin", phone: "", avatar: "" }
            ],
            categories: [],
            products: [],
            customers: [
                { id: 1, name: "Walk-in Customer", phone: "N/A", address: "" }
            ],
            salesHistory: [],
            expenses: [],
            workers: [],
            khataRecords: [],
            attarProducts: [],
            bottles: [],
            settings: { 
                tax_rate: 0, 
                currency: "Rs", 
                store_name: "My Store", 
                store_address: "",
                store_contact: "",
                official_number: "",
                receipt_footer: "Thanks for shopping with us!",
                printer_settings: {
                    printer_name: "",
                    paper_size: "80mm",
                    silent_print: false
                }
            }
        };
        db.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?)").run('mm_brothers_data', JSON.stringify(initialData));
    } else {
        // MIGRATION: fix old JazakAllahu footer in existing databases
        try {
            const existing = JSON.parse(row.value);
            if (existing && existing.settings && existing.settings.receipt_footer &&
                existing.settings.receipt_footer.toLowerCase().includes('jazak')) {
                existing.settings.receipt_footer = "Thanks for shopping with us!\nPlease check your items before leaving.";
                db.prepare("UPDATE kv_store SET value = ? WHERE key = 'mm_brothers_data'").run(JSON.stringify(existing));
            }
        } catch(e) { /* ignore migration errors */ }
    }
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 400,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        webPreferences: { nodeIntegration: false }
    });
    splashWindow.loadFile(path.join(__dirname, 'public/splash.html'));
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        icon: path.join(__dirname, 'public/logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, 'public/index.html'));

    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            splashWindow.close();
            mainWindow.show();
            mainWindow.maximize();
        }, 2500); 
    });
}

app.whenReady().then(() => {
    initDB();
    createSplashWindow();
    createMainWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.on('read-db', (event, key) => {
    try {
        const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
        event.returnValue = row ? row.value : null;
    } catch(e) { event.returnValue = null; }
});

ipcMain.on('write-db', (event, key, value) => {
    try {
        db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, value);
        event.returnValue = true;
    } catch(e) { event.returnValue = false; }
});

ipcMain.on('print-receipt', (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    let pageSize = options.pageSize || 'A4';
    // Map POS paper sizes to micron dimensions (1mm = 1000 microns)
    if (pageSize === '80mm') {
        pageSize = { width: 80000, height: 297000 }; // Standard 80mm thermal roll
    } else if (pageSize === '58mm') {
        pageSize = { width: 58000, height: 210000 }; // Standard 58mm thermal roll
    }

    // Respect the silent flag from settings:
    // silent=true  → sends directly to the selected printer (no dialog)
    // silent=false → shows system print dialog (user picks printer)
    const useSilent = options.silent === true;

    const printOptions = {
        silent: useSilent,
        printBackground: true,
        deviceName: options.deviceName || '',
        margins: { marginType: 'none' },
        pageSize: pageSize
    };
    
    win.webContents.print(printOptions, (success, errorType) => {
        if (!success && errorType !== 'cancelled') {
            console.log('Print failed:', errorType);
        }
    });
});

ipcMain.handle('get-printers', async () => {
    return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('export-db', async (event) => {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export Database Backup',
        defaultPath: path.join(app.getPath('documents'), 'MM_Brothers_Backup.sqlite'),
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
    });

    if (!canceled && filePath) {
        try {
            fs.copyFileSync(dbPath, filePath);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    return { success: false, canceled: true };
});

ipcMain.handle('import-db', async (event) => {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Database Backup',
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
        properties: ['openFile']
    });

    if (!canceled && filePaths.length > 0) {
        try {
            if (db) db.close(); // Close existing connection safely
            fs.copyFileSync(filePaths[0], dbPath);
            initDB(); // Re-initialize with new file
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    return { success: false, canceled: true };
});

// Clipboard image copy for WhatsApp sharing
ipcMain.handle('copy-image-clipboard', async (event, dataUrl) => {
    try {
        const img = nativeImage.createFromDataURL(dataUrl);
        clipboard.writeImage(img);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Open external URL (for WhatsApp)
ipcMain.handle('open-external', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});
