import express from 'express';
import { db, getISTTimestamp, initDatabase, dbPath } from '../db.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get all settings
router.get('/', (req, res) => {
  try {
    const globalRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of globalRows) {
      settings[r.key] = r.value;
    }

    if (req.userId) {
      try {
        const userRows = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(req.userId);
        for (const ur of userRows) {
          settings[ur.key] = ur.value;
        }
      } catch (uErr) {
        // user_settings might be empty
      }
    }

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings
router.post('/', (req, res) => {
  try {
    const updates = req.body; // e.g. { shop_name: "Waffel Den", tax_enabled: "1", ... }
    const uid = req.userId || 1;

    const userStmt = db.prepare(`
      INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
    `);
    const globalStmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    db.exec('BEGIN TRANSACTION');
    try {
      for (const [key, value] of Object.entries(updates)) {
        userStmt.run(uid, key, String(value));
        if (uid === 1) {
          globalStmt.run(key, String(value));
        }
      }
      db.exec('COMMIT');

      const globalRows = db.prepare('SELECT key, value FROM settings').all();
      const settings = {};
      for (const r of globalRows) {
        settings[r.key] = r.value;
      }
      const userRows = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(uid);
      for (const ur of userRows) {
        settings[ur.key] = ur.value;
      }

      res.json({ success: true, settings });
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full JSON Backup of entire database
router.get('/backup/json', (req, res) => {
  try {
    const { iso, date } = getISTTimestamp();
    const backup = {
      app: 'Waffel Den Order Management',
      version: '1.0.0',
      exported_at: iso,
      settings: db.prepare('SELECT * FROM settings').all(),
      categories: db.prepare('SELECT * FROM categories').all(),
      products: db.prepare('SELECT * FROM products').all(),
      orders: db.prepare('SELECT * FROM orders').all(),
      order_items: db.prepare('SELECT * FROM order_items').all(),
      order_audits: db.prepare('SELECT * FROM order_audits').all(),
      expenses: db.prepare('SELECT * FROM expenses').all(),
      inventory_items: db.prepare('SELECT * FROM inventory_items').all(),
      inventory_movements: db.prepare('SELECT * FROM inventory_movements').all(),
      daily_closings: db.prepare('SELECT * FROM daily_closings').all()
    };

    const filename = `WaffelDen_Backup_${date.replace(/-/g, '')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download actual SQLite DB file
router.get('/backup/db', (req, res) => {
  try {
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }
    const { date } = getISTTimestamp();
    const filename = `waffelden_${date.replace(/-/g, '')}.db`;
    res.download(dbPath, filename);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore from JSON backup
router.post('/restore/json', (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.products || !backup.orders) {
      return res.status(400).json({ error: 'Invalid backup file structure' });
    }

    db.exec('BEGIN TRANSACTION');
    try {
      // Clear existing records safely
      db.exec(`
        DELETE FROM order_items;
        DELETE FROM order_audits;
        DELETE FROM orders;
        DELETE FROM products;
        DELETE FROM categories;
        DELETE FROM expenses;
        DELETE FROM inventory_movements;
        DELETE FROM inventory_items;
        DELETE FROM daily_closings;
      `);

      // Restore settings
      if (Array.isArray(backup.settings)) {
        const insSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        for (const s of backup.settings) insSetting.run(s.key, s.value);
      }

      // Restore categories
      if (Array.isArray(backup.categories)) {
        const insCat = db.prepare('INSERT INTO categories (id, name, sort_order, color, icon, active) VALUES (?, ?, ?, ?, ?, ?)');
        for (const c of backup.categories) insCat.run(c.id, c.name, c.sort_order, c.color, c.icon, c.active);
      }

      // Restore products
      if (Array.isArray(backup.products)) {
        const insProd = db.prepare(`
          INSERT INTO products (
            id, name, category_id, category_name, description, selling_price,
            ingredient_cost, prep_cost, packaging_cost, total_unit_cost,
            expected_profit, profit_margin_pct, is_active, image_url, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of backup.products) {
          insProd.run(
            p.id, p.name, p.category_id, p.category_name, p.description, p.selling_price,
            p.ingredient_cost, p.prep_cost, p.packaging_cost, p.total_unit_cost,
            p.expected_profit, p.profit_margin_pct, p.is_active, p.image_url, p.created_at, p.updated_at
          );
        }
      }

      // Restore orders
      if (Array.isArray(backup.orders)) {
        const insOrd = db.prepare(`
          INSERT INTO orders (
            id, order_number, order_date, order_time, created_at, order_type,
            customer_name, customer_phone, notes, subtotal, discount_type,
            discount_value, discount_amount, discount_reason, tax_rate, tax_amount,
            final_total, amount_paid, outstanding_balance, payment_method,
            payment_status, order_status, total_cogs, gross_profit, cancelled_reason,
            cancelled_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const o of backup.orders) {
          insOrd.run(
            o.id, o.order_number, o.order_date, o.order_time, o.created_at, o.order_type,
            o.customer_name, o.customer_phone, o.notes, o.subtotal, o.discount_type,
            o.discount_value, o.discount_amount, o.discount_reason, o.tax_rate, o.tax_amount,
            o.final_total, o.amount_paid, o.outstanding_balance, o.payment_method,
            o.payment_status, o.order_status, o.total_cogs, o.gross_profit, o.cancelled_reason,
            o.cancelled_at, o.updated_at
          );
        }
      }

      // Restore order items
      if (Array.isArray(backup.order_items)) {
        const insItem = db.prepare(`
          INSERT INTO order_items (
            id, order_id, product_id, product_name, category_name, quantity,
            unit_price, unit_cost, total_price, total_cost, unit_profit, total_profit, special_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const it of backup.order_items) {
          insItem.run(
            it.id, it.order_id, it.product_id, it.product_name, it.category_name, it.quantity,
            it.unit_price, it.unit_cost, it.total_price, it.total_cost, it.unit_profit, it.total_profit, it.special_notes
          );
        }
      }

      // Restore expenses
      if (Array.isArray(backup.expenses)) {
        const insExp = db.prepare(`
          INSERT INTO expenses (id, date, amount, category, description, payment_method, paid_from_cash_register, included_in_cogs, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const e of backup.expenses) {
          insExp.run(e.id, e.date, e.amount, e.category, e.description, e.payment_method, e.paid_from_cash_register, e.included_in_cogs, e.created_at);
        }
      }

      // Restore inventory items
      if (Array.isArray(backup.inventory_items)) {
        const insInv = db.prepare(`
          INSERT INTO inventory_items (id, name, unit, current_stock, reorder_level, cost_per_unit, category, supplier, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const inv of backup.inventory_items) {
          insInv.run(inv.id, inv.name, inv.unit, inv.current_stock, inv.reorder_level, inv.cost_per_unit, inv.category, inv.supplier, inv.updated_at);
        }
      }

      // Restore daily closings
      if (Array.isArray(backup.daily_closings)) {
        const insClosing = db.prepare(`
          INSERT INTO daily_closings (
            id, closing_date, opening_cash, cash_sales, upi_sales, card_sales, other_sales,
            cash_expenses, cash_refunds, expected_closing_cash, actual_closing_cash,
            cash_difference, total_orders, completed_orders, cancelled_orders,
            net_sales, gross_profit, operating_expenses, net_profit, closing_notes, closed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const dc of backup.daily_closings) {
          insClosing.run(
            dc.id, dc.closing_date, dc.opening_cash, dc.cash_sales, dc.upi_sales, dc.card_sales, dc.other_sales,
            dc.cash_expenses, dc.cash_refunds, dc.expected_closing_cash, dc.actual_closing_cash,
            dc.cash_difference, dc.total_orders, dc.completed_orders, dc.cancelled_orders,
            dc.net_sales, dc.gross_profit, dc.operating_expenses, dc.net_profit, dc.closing_notes, dc.closed_at
          );
        }
      }

      db.exec('COMMIT');
      res.json({ success: true, message: 'Database successfully restored from backup' });
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
