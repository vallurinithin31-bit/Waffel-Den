# 🧇 Waffel Den — Shop Order Management, Sales & Profit Analytics App

A professional, fast, counter-optimized web application built specifically for internal waffle shop operations. It replaces manual handwritten order notebooks with rapid 2-click digital order entry, automatic calculation of item costs, gross and net profits, live cash drawer reconciliation, inventory tracking, and sales analytics.

---

## 🚀 Quick Start

### 1. Start the Application
From the project root directory, run:
```bash
npm start
```
The server will start on **`http://localhost:5000`** with the built production frontend and SQLite database.

### 2. Run in Development Mode
To run with live reloading:
```bash
# Terminal 1: Backend server
npm run server

# Terminal 2: Vite React frontend
npm run client
```
Access the dev server on `http://localhost:5173`.

---

## 🛠 Features & Modules

1. **Main Dashboard**:
   - Live KPI cards: Today's Total Sales, Gross Profit, Operating Expenses, Net Business Profit.
   - Comparison with yesterday (₹ difference and % growth/decline).
   - Order pipeline status counters (Completed, Pending/Preparing, Cancelled, Full Paid, Unpaid balance).
   - Interactive SVG trend charts for 7-day and 30-day periods.
   - Highlights for Top Best-Selling Waffle and Most Profitable Product.

2. **Quick Order Entry (Counter POS)**:
   - Dedicated counter screen optimized for minimal typing.
   - Unique order numbers generated automatically (`WD-YYYYMMDD-###`).
   - Category filters & instant search across all waffles, shakes, and toppings.
   - 1-click quantity adjustments, item-level special notes & quick chips (*Extra Chocolate, No Nuts, Crispy*).
   - Flat ₹ or % discount calculation with reason logging.
   - Configurable GST/tax calculation.
   - Payment method support: **Cash, UPI, Card, Other**.
   - Track **Full Paid, Partially Paid, and Unpaid (Credit)** orders with real-time outstanding balance calculation.
   - 80mm/58mm printable thermal receipt modal with instant reset for the next customer.

3. **Product & Menu Management**:
   - Manage waffles, beverages, and toppings.
   - Automatic formula: `Total Unit Cost = Ingredient Cost + Prep Cost + Packaging Cost`.
   - Real-time `Unit Profit` and `Profit Margin (%)` calculator.
   - **Historical Price & Cost Preservation**: Changing a product's price or ingredient cost updates future orders while preserving historical snapshots on past tickets.

4. **Order Management & Audit Trail**:
   - Complete searchable and filterable order history.
   - Status updates: *Pending ➔ Preparing ➔ Ready ➔ Completed ➔ Cancelled*.
   - Cancelled orders are strictly excluded from sales revenue and profit calculations while preserving audit trail logs.
   - Inspect full line-item costs, discounts, and payment history.
   - Record balance collection on credit/partially paid orders.

5. **Sales & Profit Analytics**:
   - Accurate retail P&L accounting:
     - `Net Sales = Completed Order Revenue − Discounts − Taxes`
     - `Gross Profit = Net Sales − Cost of Goods Sold (COGS)`
     - `Net Profit = Gross Profit − Recorded Operating Expenses`
   - 24-hour Peak Trading Hours distribution chart.
   - Busiest Weekdays customer footfall analysis.
   - Product profitability table and Low Profit Margin (<35%) alert panel.

6. **Expenses Management**:
   - Track rent, electricity, packaging, maintenance, salaries, and stock purchases.
   - Dedicated flags: *Paid from Counter Cash Register* (used for daily cash drawer reconciliation) and *Already Tracked in Unit COGS* (prevents double-counting raw materials in Net Profit).

7. **Inventory & Ingredient Stocks**:
   - Track stock levels for flour mix, chocolates, spreads, dairy, and boxes.
   - Automatic low-stock warnings when inventory drops below reorder thresholds.
   - Movement log tracking (*Stock Purchase, Daily Usage, Wastage, Adjustment*).

8. **Daily Closing Report (Cash Reconciliation)**:
   - Calculate expected counter cash: `Opening Cash + Cash Sales − Cash Expenses − Cash Refunds`.
   - Record counted physical cash and compute cash surplus/shortage differences.
   - Save and finalize end-of-day reports with historical archive.

9. **Reports & Excel/CSV Export**:
   - Download date-filtered Excel-compatible CSV reports:
     - Complete Orders History CSV
     - Daily Sales & Profit Summary CSV
     - Product Performance & Margin CSV
     - Operating Expenses CSV

10. **Settings & Backup**:
    - Customize shop name, tagline, address, phone, and receipt footer message.
    - Currency format (₹ INR) and order numbering prefix.
    - 1-click portable JSON backup and raw SQLite `.db` download.
    - Safe database restoration from JSON backup.

---

## 🔒 Mandatory Verification Passed
All 14 operational scenarios in the master prompt were verified using `test_suite.js`:
- Product creation and margin calculation ✅
- Multi-product order with quantities and COGS calculation ✅
- Discount deductions and net profit tracking ✅
- Partial payments and balance due tracking ✅
- Order status lifecycle transitions ✅
- Cancellation exclusion from sales totals ✅
- Operating expense deduction from net profit ✅
- Preservation of historical order costs when menu prices change ✅
- Zero-dependency persistent SQLite storage with WAL mode ✅
- Excel CSV report generation ✅
