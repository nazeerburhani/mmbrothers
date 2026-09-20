# Islamic Retail Business Management System

A fully functional, production-ready full-stack Point of Sale (POS), Inventory, and Dashboard system tailored for an Islamic retail shop (Perfumes, Topis, Honey, etc.).

## 🌟 Features
- **Dashboard**: Real-time sales, profit tracking, and low-stock alerts. Includes interactive charts.
- **POS System**: Add items to the cart, automatically calculate totals, process checkouts, and print professional receipts.
- **Inventory Management**: Create, edit, and track products. Stock automatically deducts upon sale.
- **Reports**: View detailed history of all transactions and profit margins.
- **Responsive & Premium UI**: Deep emerald and soft gold aesthetic, using clean, vanilla CSS (glassmorphism, micro-animations) for a native app feel.

## 📁 Project Structure

```text
stitch_integrated_islamic_retail_suite/
├── package.json          # Node.js dependencies and scripts
├── server.js             # Main Express backend & SQLite setup
├── database.sqlite       # Auto-generated database file (created on first run)
├── public/               # Static Frontend Assets (Vanilla JS SPA)
│   ├── index.html        # Main App Shell
│   ├── css/
│   │   └── style.css     # Premium UI styling and design system
│   └── js/
│       └── app.js        # Frontend logic, routing, POS state, and API fetching
└── README.md             # Setup and run instructions
```

## 🛠️ Setup Instructions

This system uses a lightweight, fast stack: **Node.js, Express, and SQLite** for the backend, with a highly optimized **Vanilla HTML/CSS/JS** frontend (Zero build-step needed for the UI).

### Prerequisites
1. You must have [Node.js](https://nodejs.org/) installed on your computer.

### Installation Steps
1. Open your terminal or command prompt.
2. Navigate to this project folder:
   ```bash
   cd path/to/stitch_integrated_islamic_retail_suite
   ```
3. Install the required backend dependencies:
   ```bash
   npm install
   ```

## 🚀 How to Run Locally

1. Start the server:
   ```bash
   npm start
   ```
2. You will see a message: `Server is running on http://localhost:3000`
3. Open your web browser (Chrome, Edge, Firefox) and go to:
   **[http://localhost:3000](http://localhost:3000)**

*Note: On the first run, the system will automatically create `database.sqlite` and seed it with sample Islamic retail products so you can start testing the POS immediately.*
