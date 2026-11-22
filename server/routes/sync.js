import express from 'express';
import { db, getISTTimestamp } from '../db.js';

const router = express.Router();

// Get full snapshot of database for client persistent backup
router.get('/', (req, res) => {
  try {
    let orders = [];
    let orderItems = [];
    let products = [];
    let expenses = [];
    let closings = [];
    let settings = {};

    try {
      orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
      orderItems = db.prepare('SELECT * FROM order_items').all();
      products = db.prepare('SELECT * FROM products').all();
      expenses = db.prepare('SELECT * FROM expenses ORDER BY id DESC').all();
      closings = db.prepare('SELECT * FROM daily_closings ORDER BY id DESC').all();
      const rawSettings = db.prepare('SELECT key, value FROM settings').all();
      settings = rawSettings.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {});
    } catch (e) {
      console.warn('Sync GET notice:', e.message);
    }

    const ordersWithItems = orders.map(ord => ({
      ...ord,
      items: orderItems.filter(item => item.order_id === ord.id)
    }));

    res.json({
      orders: ordersWithItems,
      products,
      expenses,
      closings,
      settings
    });
  } catch (err) {
    console.error('Sync GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Rehydrate / sync client persistent backup into server database
router.post('/', (req, res) => {
  try {
    const { orders = [], products = [], expenses = [], closings = [], settings = {} } = req.body;
    const { iso, date: todayDate, time: todayTime } = getISTTimestamp();

    try {
      db.exec('BEGIN TRANSACTION');
    } catch (e) {
      // ignore pragma/transaction warning on memory wrapper
    }

    try {
      // 1. Sync Custom Products
      try {
        const existingProds = new Set(db.prepare('SELECT name FROM products').all().map(p => p.name.trim().toLowerCase()));
        const insProd = db.prepare(`
          INSERT INTO products (
            name, category_id, category_name, description, selling_price,
            ingredient_cost, prep_cost, packaging_cost, total_unit_cost,
            expected_profit, profit_margin_pct, is_active, created_at, updated_at
          ) VALUES (?, (SELECT id FROM categories WHERE name = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const p of products) {
          if (p.name && !existingProds.has(p.name.trim().toLowerCase())) {
            const selling = Number(p.selling_price) || 0;
            const cost = Number(p.total_unit_cost) || 0;
            const profit = Number(p.expected_profit ?? (selling - cost));
            const margin = selling > 0 ? Number(((profit / selling) * 100).toFixed(1)) : 0;

            insProd.run(
              p.name.trim(),
              p.category_name || "Belgium Waffle's",
              p.category_name || "Belgium Waffle's",
              p.description || '',
              selling,
              Number(p.ingredient_cost) || 0,
              Number(p.prep_cost) || 0,
              Number(p.packaging_cost) || 0,
              cost,
              profit,
              margin,
              p.is_active ?? 1,
              p.created_at || iso,
              p.updated_at || iso
            );
            existingProds.add(p.name.trim().toLowerCase());
          }
        }
      } catch (pErr) {
        console.warn('Sync products notice:', pErr.message);
      }

      // 2. Sync Orders
      try {
        const existingOrderNums = new Set(db.prepare('SELECT order_number FROM orders').all().map(o => o.order_number));
        const insOrder = db.prepare(`
          INSERT INTO orders (
            order_number, order_date, order_time, created_at, order_type,
            customer_name, customer_phone, notes, subtotal, discount_type,
            discount_value, discount_amount, discount_reason, tax_rate, tax_amount,
            final_total, amount_paid, outstanding_balance, payment_method,
            payment_status, order_status, total_cogs, gross_profit, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?
          )
        `);

        const updOrder = db.prepare(`
          UPDATE orders SET
            payment_status = ?,
            order_status = ?,
            amount_paid = ?,
            outstanding_balance = ?,
            updated_at = ?
          WHERE order_number = ?
        `);

        const insItem = db.prepare(`
          INSERT INTO order_items (
            order_id, product_id, product_name, category_name, quantity,
            unit_price, unit_cost, total_price, total_cost, unit_profit,
            total_profit, special_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const ord of orders) {
          if (!ord.order_number) continue;

          if (!existingOrderNums.has(ord.order_number)) {
            const info = insOrder.run(
              ord.order_number,
              ord.order_date || todayDate,
              ord.order_time || todayTime,
              ord.created_at || iso,
              ord.order_type || 'takeaway',
              ord.customer_name || '',
              ord.customer_phone || '',
              ord.notes || '',
              Number(ord.subtotal) || 0,
              ord.discount_type || 'fixed',
              Number(ord.discount_value) || 0,
              Number(ord.discount_amount) || 0,
              ord.discount_reason || '',
              Number(ord.tax_rate) || 0,
              Number(ord.tax_amount) || 0,
              Number(ord.final_total) || 0,
              Number(ord.amount_paid) || 0,
              Number(ord.outstanding_balance) || 0,
              ord.payment_method || 'Cash',
              ord.payment_status || 'Paid',
              ord.order_status || 'Completed',
              Number(ord.total_cogs) || 0,
              Number(ord.gross_profit) || 0,
              ord.updated_at || iso
            );

            const newOrderId = info.lastInsertRowid;
            existingOrderNums.add(ord.order_number);

            if (Array.isArray(ord.items)) {
              for (const item of ord.items) {
                const qty = Number(item.quantity) || 1;
                const unitPrice = Number(item.unit_price) || 0;
                const unitCost = Number(item.unit_cost) || 0;
                const totalPrice = Number(item.total_price) || (qty * unitPrice);
                const totalCost = Number(item.total_cost) || (qty * unitCost);
                const unitProfit = Number(item.unit_profit) || (unitPrice - unitCost);
                const totalProfit = Number(item.total_profit) || (qty * unitProfit);

                insItem.run(
                  newOrderId,
                  item.product_id || null,
                  item.product_name || 'Item',
                  item.category_name || 'General',
                  qty,
                  unitPrice,
                  unitCost,
                  totalPrice,
                  totalCost,
                  unitProfit,
                  totalProfit,
                  item.special_notes || ''
                );
              }
            }
          } else {
            // Update status if changed
            try {
              updOrder.run(
                ord.payment_status || 'Paid',
                ord.order_status || 'Completed',
                Number(ord.amount_paid) || 0,
                Number(ord.outstanding_balance) || 0,
                ord.updated_at || iso,
                ord.order_number
              );
            } catch (uErr) {
              // ignore
            }
          }
        }
      } catch (oErr) {
        console.warn('Sync orders notice:', oErr.message);
      }

      // 3. Sync Expenses
      try {
        const existingExpenses = new Set(
          db.prepare('SELECT category, description, date, amount FROM expenses')
            .all()
            .map(e => `${e.category}_${e.description || ''}_${e.date}_${e.amount}`)
        );

        const insExpense = db.prepare(`
          INSERT INTO expenses (
            date, amount, category, description, payment_method, paid_from_cash_register, included_in_cogs, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const exp of expenses) {
          const desc = exp.description || exp.title || '';
          const key = `${exp.category}_${desc}_${exp.date}_${exp.amount}`;
          if (!existingExpenses.has(key)) {
            insExpense.run(
              exp.date || todayDate,
              Number(exp.amount) || 0,
              exp.category || 'Other',
              desc,
              exp.payment_method || 'Cash',
              exp.paid_from_cash_register ? 1 : 0,
              exp.included_in_cogs ? 1 : 0,
              exp.created_at || iso
            );
            existingExpenses.add(key);
          }
        }
      } catch (eErr) {
        console.warn('Sync expenses notice:', eErr.message);
      }

      // 4. Sync Closings
      try {
        const existingClosings = new Set(db.prepare('SELECT closing_date FROM daily_closings').all().map(c => c.closing_date));
        const insClosing = db.prepare(`
          INSERT INTO daily_closings (
            closing_date, opening_cash, cash_sales, upi_sales, card_sales, other_sales,
            cash_expenses, cash_refunds, expected_closing_cash, actual_closing_cash,
            cash_difference, total_orders, completed_orders, cancelled_orders,
            net_sales, gross_profit, operating_expenses, net_profit, closing_notes, closed_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?
          )
        `);

        for (const cls of closings) {
          if (cls.closing_date && !existingClosings.has(cls.closing_date)) {
            insClosing.run(
              cls.closing_date,
              Number(cls.opening_cash) || 0,
              Number(cls.cash_sales) || 0,
              Number(cls.upi_sales) || 0,
              Number(cls.card_sales) || 0,
              Number(cls.other_sales) || 0,
              Number(cls.cash_expenses) || 0,
              Number(cls.cash_refunds) || 0,
              Number(cls.expected_closing_cash) || 0,
              Number(cls.actual_closing_cash) || 0,
              Number(cls.cash_difference) || 0,
              Number(cls.total_orders) || 0,
              Number(cls.completed_orders) || 0,
              Number(cls.cancelled_orders) || 0,
              Number(cls.net_sales) || 0,
              Number(cls.gross_profit) || 0,
              Number(cls.operating_expenses) || 0,
              Number(cls.net_profit) || 0,
              cls.closing_notes || '',
              cls.closed_at || iso
            );
            existingClosings.add(cls.closing_date);
          }
        }
      } catch (cErr) {
        console.warn('Sync closings notice:', cErr.message);
      }

      // 5. Sync Settings
      try {
        const setStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        if (Array.isArray(settings)) {
          for (const s of settings) {
            if (s.key) setStmt.run(s.key, String(s.value ?? ''));
          }
        } else if (settings && typeof settings === 'object') {
          for (const [k, v] of Object.entries(settings)) {
            setStmt.run(k, String(v ?? ''));
          }
        }
      } catch (sErr) {
        console.warn('Sync settings notice:', sErr.message);
      }

      try {
        db.exec('COMMIT');
      } catch (e) {
        // ignore
      }

      res.json({ success: true, message: 'Database rehydrated and synchronized successfully' });
    } catch (innerErr) {
      try {
        db.exec('ROLLBACK');
      } catch (e) {
        // ignore
      }
      throw innerErr;
    }
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
