import express from 'express';
import { db, getISTTimestamp } from '../db.js';

const router = express.Router();

// List expenses with optional filters
router.get('/', (req, res) => {
  try {
    const { start_date, end_date, category } = req.query;
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

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY date DESC, id DESC';

    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expense summary statistics
router.get('/summary', (req, res) => {
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

    const expenses = db.prepare(query).all(...params);

    let totalExpenses = 0;
    let operatingExpenses = 0; // Excludes included_in_cogs to prevent double counting
    let cashRegisterExpenses = 0;
    const categoryBreakdown = {};

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      totalExpenses += amt;

      if (!exp.included_in_cogs) {
        operatingExpenses += amt;
      }

      if (exp.paid_from_cash_register) {
        cashRegisterExpenses += amt;
      }

      categoryBreakdown[exp.category] = (categoryBreakdown[exp.category] || 0) + amt;
    }

    res.json({
      totalExpenses: Number(totalExpenses.toFixed(2)),
      operatingExpenses: Number(operatingExpenses.toFixed(2)),
      cashRegisterExpenses: Number(cashRegisterExpenses.toFixed(2)),
      categoryBreakdown,
      count: expenses.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create expense
router.post('/', (req, res) => {
  try {
    const {
      date: reqDate,
      amount,
      category,
      description = '',
      payment_method = 'Cash',
      paid_from_cash_register = 1,
      included_in_cogs = 0
    } = req.body;

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Valid expense amount is required' });
    }
    if (!category) {
      return res.status(400).json({ error: 'Expense category is required' });
    }

    const { iso, date: todayDate } = getISTTimestamp();
    const expDate = reqDate || todayDate;

    const info = db.prepare(`
      INSERT INTO expenses (
        date, amount, category, description, payment_method,
        paid_from_cash_register, included_in_cogs, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      expDate,
      Number(amt.toFixed(2)),
      category.trim(),
      description.trim(),
      payment_method,
      paid_from_cash_register ? 1 : 0,
      included_in_cogs ? 1 : 0,
      iso
    );

    const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update expense
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const {
      date = existing.date,
      amount = existing.amount,
      category = existing.category,
      description = existing.description,
      payment_method = existing.payment_method,
      paid_from_cash_register = existing.paid_from_cash_register,
      included_in_cogs = existing.included_in_cogs
    } = req.body;

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Valid expense amount is required' });
    }

    db.prepare(`
      UPDATE expenses SET
        date = ?,
        amount = ?,
        category = ?,
        description = ?,
        payment_method = ?,
        paid_from_cash_register = ?,
        included_in_cogs = ?
      WHERE id = ?
    `).run(
      date,
      Number(amt.toFixed(2)),
      category,
      description,
      payment_method,
      paid_from_cash_register ? 1 : 0,
      included_in_cogs ? 1 : 0,
      id
    );

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete expense
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    res.json({ message: 'Expense deleted successfully', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
