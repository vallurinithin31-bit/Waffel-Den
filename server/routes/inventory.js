import express from 'express';
import { db, getISTTimestamp } from '../db.js';

const router = express.Router();

// List all inventory items
router.get('/', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM inventory_items ORDER BY name ASC').all();
    const enriched = items.map(item => ({
      ...item,
      is_low_stock: item.current_stock <= item.reorder_level
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get low stock alert items
router.get('/alerts', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM inventory_items WHERE current_stock <= reorder_level ORDER BY current_stock ASC').all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create inventory item
router.post('/', (req, res) => {
  try {
    const { name, unit, current_stock = 0, reorder_level = 5, cost_per_unit = 0, category, supplier } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    if (!unit || !unit.trim()) {
      return res.status(400).json({ error: 'Unit of measurement is required' });
    }

    const { iso } = getISTTimestamp();

    const info = db.prepare(`
      INSERT INTO inventory_items (name, unit, current_stock, reorder_level, cost_per_unit, category, supplier, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      unit.trim(),
      Number(current_stock) || 0,
      Number(reorder_level) || 0,
      Number(cost_per_unit) || 0,
      category || 'General',
      supplier || '',
      iso
    );

    const created = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update inventory item
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const {
      name = existing.name,
      unit = existing.unit,
      current_stock = existing.current_stock,
      reorder_level = existing.reorder_level,
      cost_per_unit = existing.cost_per_unit,
      category = existing.category,
      supplier = existing.supplier
    } = req.body;

    const { iso } = getISTTimestamp();

    db.prepare(`
      UPDATE inventory_items SET
        name = ?,
        unit = ?,
        current_stock = ?,
        reorder_level = ?,
        cost_per_unit = ?,
        category = ?,
        supplier = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      name.trim(),
      unit.trim(),
      Number(current_stock),
      Number(reorder_level),
      Number(cost_per_unit),
      category,
      supplier,
      iso,
      id
    );

    const updated = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record inventory movement (Purchase, Usage, Wastage, Adjustment)
router.post('/:id/movement', (req, res) => {
  try {
    const { id } = req.params;
    const { movement_type, quantity_change, notes = '' } = req.body;

    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const change = Number(quantity_change);
    if (isNaN(change) || change === 0) {
      return res.status(400).json({ error: 'Valid non-zero quantity change required' });
    }

    const validTypes = ['PURCHASE', 'USAGE', 'WASTAGE', 'ADJUSTMENT'];
    if (!validTypes.includes(movement_type)) {
      return res.status(400).json({ error: 'Invalid movement type' });
    }

    const newBalance = Number((item.current_stock + change).toFixed(2));
    if (newBalance < 0) {
      return res.status(400).json({ error: 'Insufficient stock balance for this deduction' });
    }

    const { iso } = getISTTimestamp();
    const unitCost = item.cost_per_unit || 0;
    const totalCost = Number((Math.abs(change) * unitCost).toFixed(2));

    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(`
        UPDATE inventory_items SET current_stock = ?, updated_at = ? WHERE id = ?
      `).run(newBalance, iso, id);

      db.prepare(`
        INSERT INTO inventory_movements (
          ingredient_id, movement_type, quantity_change, new_balance, unit_cost, total_cost, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, movement_type, change, newBalance, unitCost, totalCost, notes.trim(), iso);

      db.exec('COMMIT');

      const updatedItem = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
      res.json({
        item: updatedItem,
        movement: { movement_type, quantity_change: change, newBalance, notes }
      });
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get movements history
router.get('/movements', (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const movements = db.prepare(`
      SELECT m.*, i.name as ingredient_name, i.unit
      FROM inventory_movements m
      JOIN inventory_items i ON m.ingredient_id = i.id
      ORDER BY m.id DESC LIMIT ?
    `).all(Number(limit));
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete inventory item
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id);
    res.json({ message: 'Inventory item deleted', success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
