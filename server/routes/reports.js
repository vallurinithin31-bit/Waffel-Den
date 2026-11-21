import express from 'express';
import { db, getISTTimestamp } from '../db.js';

const router = express.Router();

// Helper to escape CSV cell values
function csvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Export Orders to CSV
router.get('/export/orders', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (start_date) {
      query += ' AND order_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND order_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY id DESC';
    const orders = db.prepare(query).all(...params);

    const itemsStmt = db.prepare('SELECT product_name, quantity, total_price FROM order_items WHERE order_id = ?');

    const headers = [
      'Order Number',
      'Date (IST)',
      'Time (IST)',
      'Order Type',
      'Customer Name',
      'Customer Phone',
      'Items Ordered',
      'Subtotal (INR)',
      'Discount (INR)',
      'Tax (INR)',
      'Final Total (INR)',
      'Amount Paid (INR)',
      'Balance (INR)',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'COGS (INR)',
      'Gross Profit (INR)',
      'Special Notes'
    ];

    const rows = [headers.map(csvCell).join(',')];

    for (const ord of orders) {
      const items = itemsStmt.all(ord.id);
      const itemsSummary = items.map(it => `${it.product_name} x${it.quantity}`).join('; ');

      rows.push([
        csvCell(ord.order_number),
        csvCell(ord.order_date),
        csvCell(ord.order_time),
        csvCell(ord.order_type),
        csvCell(ord.customer_name),
        csvCell(ord.customer_phone),
        csvCell(itemsSummary),
        csvCell(ord.subtotal),
        csvCell(ord.discount_amount),
        csvCell(ord.tax_amount),
        csvCell(ord.final_total),
        csvCell(ord.amount_paid),
        csvCell(ord.outstanding_balance),
        csvCell(ord.payment_method),
        csvCell(ord.payment_status),
        csvCell(ord.order_status),
        csvCell(ord.total_cogs),
        csvCell(ord.gross_profit),
        csvCell(ord.notes)
      ].join(','));
    }

    const csvContent = rows.join('\r\n');
    const filename = `WaffelDen_Orders_${start_date || 'all'}_to_${end_date || 'all'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Daily Sales & Profit Summary to CSV
router.get('/export/daily-summary', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let orderQuery = `
      SELECT
        order_date,
        COUNT(*) as total_orders,
        SUM(CASE WHEN order_status = 'Completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN order_status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        SUM(CASE WHEN order_status != 'Cancelled' THEN final_total ELSE 0 END) as gross_revenue,
        SUM(CASE WHEN order_status != 'Cancelled' THEN discount_amount ELSE 0 END) as total_discount,
        SUM(CASE WHEN order_status != 'Cancelled' THEN tax_amount ELSE 0 END) as total_tax,
        SUM(CASE WHEN order_status != 'Cancelled' THEN (final_total - tax_amount) ELSE 0 END) as net_sales,
        SUM(CASE WHEN order_status != 'Cancelled' THEN total_cogs ELSE 0 END) as cogs,
        SUM(CASE WHEN order_status != 'Cancelled' THEN gross_profit ELSE 0 END) as gross_profit
      FROM orders
      WHERE 1=1
    `;
    const params = [];
    if (start_date) {
      orderQuery += ' AND order_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      orderQuery += ' AND order_date <= ?';
      params.push(end_date);
    }
    orderQuery += ' GROUP BY order_date ORDER BY order_date DESC';

    const dailyOrders = db.prepare(orderQuery).all(...params);

    const expenseQuery = `
      SELECT
        date,
        SUM(CASE WHEN included_in_cogs = 0 THEN amount ELSE 0 END) as operating_expenses,
        SUM(amount) as total_expenses
      FROM expenses
      GROUP BY date
    `;
    const dailyExpenses = db.prepare(expenseQuery).all();
    const expMap = {};
    for (const e of dailyExpenses) {
      expMap[e.date] = e;
    }

    const headers = [
      'Date',
      'Total Orders',
      'Completed Orders',
      'Cancelled Orders',
      'Gross Revenue (INR)',
      'Discounts (INR)',
      'Taxes (INR)',
      'Net Sales (INR)',
      'COGS (INR)',
      'Gross Profit (INR)',
      'Operating Expenses (INR)',
      'Net Profit (INR)',
      'Gross Margin %'
    ];

    const rows = [headers.map(csvCell).join(',')];

    for (const d of dailyOrders) {
      const exp = expMap[d.order_date] || { operating_expenses: 0, total_expenses: 0 };
      const opExp = exp.operating_expenses || 0;
      const netProfit = Number((d.gross_profit - opExp).toFixed(2));
      const margin = d.net_sales > 0 ? Number(((d.gross_profit / d.net_sales) * 100).toFixed(1)) : 0;

      rows.push([
        csvCell(d.order_date),
        csvCell(d.total_orders),
        csvCell(d.completed_orders),
        csvCell(d.cancelled_orders),
        csvCell(Number((d.gross_revenue || 0).toFixed(2))),
        csvCell(Number((d.total_discount || 0).toFixed(2))),
        csvCell(Number((d.total_tax || 0).toFixed(2))),
        csvCell(Number((d.net_sales || 0).toFixed(2))),
        csvCell(Number((d.cogs || 0).toFixed(2))),
        csvCell(Number((d.gross_profit || 0).toFixed(2))),
        csvCell(Number(opExp.toFixed(2))),
        csvCell(netProfit),
        csvCell(`${margin}%`)
      ].join(','));
    }

    const csvContent = rows.join('\r\n');
    const filename = `WaffelDen_Daily_Summary_${start_date || 'all'}_to_${end_date || 'all'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Product Performance to CSV
router.get('/export/products', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT
        oi.product_name,
        oi.category_name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total_price) as total_revenue,
        SUM(oi.total_cost) as total_cogs,
        SUM(oi.total_profit) as total_profit,
        ROUND((SUM(oi.total_profit) / NULLIF(SUM(oi.total_price), 0)) * 100, 1) as margin_pct
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.order_status != 'Cancelled'
    `;
    const params = [];
    if (start_date) {
      query += ' AND o.order_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND o.order_date <= ?';
      params.push(end_date);
    }
    query += ' GROUP BY oi.product_name ORDER BY total_revenue DESC';

    const items = db.prepare(query).all(...params);

    const headers = [
      'Product Name',
      'Category',
      'Units Sold',
      'Total Sales Revenue (INR)',
      'Total COGS (INR)',
      'Gross Profit (INR)',
      'Profit Margin %'
    ];

    const rows = [headers.map(csvCell).join(',')];
    for (const it of items) {
      rows.push([
        csvCell(it.product_name),
        csvCell(it.category_name),
        csvCell(it.quantity_sold),
        csvCell(Number((it.total_revenue || 0).toFixed(2))),
        csvCell(Number((it.total_cogs || 0).toFixed(2))),
        csvCell(Number((it.total_profit || 0).toFixed(2))),
        csvCell(`${it.margin_pct || 0}%`)
      ].join(','));
    }

    const csvContent = rows.join('\r\n');
    const filename = `WaffelDen_Product_Performance_${start_date || 'all'}_to_${end_date || 'all'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Expenses to CSV
router.get('/export/expenses', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    if (start_date) {
      query += ' AND date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND date <= ?';
      params.push(end_date);
    }
    query += ' ORDER BY date DESC';

    const expenses = db.prepare(query).all(...params);

    const headers = [
      'Date',
      'Category',
      'Amount (INR)',
      'Description',
      'Payment Method',
      'Paid From Cash Register',
      'Included in COGS'
    ];

    const rows = [headers.map(csvCell).join(',')];
    for (const exp of expenses) {
      rows.push([
        csvCell(exp.date),
        csvCell(exp.category),
        csvCell(exp.amount),
        csvCell(exp.description),
        csvCell(exp.payment_method),
        csvCell(exp.paid_from_cash_register ? 'Yes' : 'No'),
        csvCell(exp.included_in_cogs ? 'Yes' : 'No')
      ].join(','));
    }

    const csvContent = rows.join('\r\n');
    const filename = `WaffelDen_Expenses_${start_date || 'all'}_to_${end_date || 'all'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
