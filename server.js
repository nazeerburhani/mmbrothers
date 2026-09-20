const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            // Create Tables
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                category TEXT,
                cost_price REAL,
                sale_price REAL,
                stock INTEGER,
                min_stock INTEGER DEFAULT 10,
                image_url TEXT
            )`);
            db.run("ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 10", (err) => {
                // Ignore error if column already exists
            });

            db.run(`CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                phone TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                total_amount REAL,
                profit REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER,
                product_id INTEGER,
                quantity INTEGER,
                price REAL,
                cost REAL
            )`);

            // Seed initial data if products table is empty
            db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
                if (row.count === 0) {
                    console.log('Database initialized. No default products seeded.');
                }
            });
        });
    }
});

// API Routes

// --- PRODUCTS ---
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/products', (req, res) => {
    const { name, category, cost_price, sale_price, stock, min_stock, image_url } = req.body;
    const minStockVal = min_stock !== undefined ? min_stock : 10;
    db.run(
        "INSERT INTO products (name, category, cost_price, sale_price, stock, min_stock, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [name, category, cost_price, sale_price, stock, minStockVal, image_url],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, name, category, cost_price, sale_price, stock, min_stock: minStockVal, image_url });
        }
    );
});

app.put('/api/products/:id', (req, res) => {
    const { name, category, cost_price, sale_price, stock, min_stock, image_url } = req.body;
    const minStockVal = min_stock !== undefined ? min_stock : 10;
    db.run(
        "UPDATE products SET name = ?, category = ?, cost_price = ?, sale_price = ?, stock = ?, min_stock = ?, image_url = ? WHERE id = ?",
        [name, category, cost_price, sale_price, stock, minStockVal, image_url, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Product updated successfully" });
        }
    );
});

app.delete('/api/products/:id', (req, res) => {
    db.run("DELETE FROM products WHERE id = ?", req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Product deleted successfully" });
    });
});

// --- CUSTOMERS ---
app.get('/api/customers', (req, res) => {
    db.all("SELECT * FROM customers", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- SALES / POS ---
app.post('/api/sales', (req, res) => {
    const { customer_id, items } = req.body;
    
    // items should be [{product_id, quantity, price, cost}]
    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
    }

    let total_amount = 0;
    let total_profit = 0;

    items.forEach(item => {
        total_amount += item.price * item.quantity;
        total_profit += (item.price - item.cost) * item.quantity;
    });

    db.run(
        "INSERT INTO sales (customer_id, total_amount, profit) VALUES (?, ?, ?)",
        [customer_id || null, total_amount, total_profit],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const saleId = this.lastID;

            const stmt = db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, price, cost) VALUES (?, ?, ?, ?, ?)");
            const updateStockStmt = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                items.forEach(item => {
                    stmt.run(saleId, item.product_id, item.quantity, item.price, item.cost);
                    updateStockStmt.run(item.quantity, item.product_id);
                });
                stmt.finalize();
                updateStockStmt.finalize();
                db.run("COMMIT", (commitErr) => {
                    if (commitErr) return res.status(500).json({ error: commitErr.message });
                    res.json({ message: "Sale completed successfully", sale_id: saleId });
                });
            });
        }
    );
});

// --- DASHBOARD / REPORTS ---
app.get('/api/stats', (req, res) => {
    const stats = {
        total_sales: 0,
        total_profit: 0,
        low_stock_count: 0,
        recent_sales: []
    };

    db.get("SELECT SUM(total_amount) as sales, SUM(profit) as profit FROM sales", (err, row) => {
        if (!err && row) {
            stats.total_sales = row.sales || 0;
            stats.total_profit = row.profit || 0;
        }

        db.get("SELECT COUNT(*) as count FROM products WHERE stock <= IFNULL(min_stock, 10)", (err, row) => {
            if (!err && row) {
                stats.low_stock_count = row.count || 0;
            }

            db.all("SELECT * FROM sales ORDER BY created_at DESC LIMIT 5", (err, rows) => {
                if (!err && rows) {
                    stats.recent_sales = rows;
                }
                res.json(stats);
            });
        });
    });
});

app.get('/api/sales/history', (req, res) => {
    db.all("SELECT * FROM sales ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Fallback for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
