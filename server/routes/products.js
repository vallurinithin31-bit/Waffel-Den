import express from 'express';
import { db, getISTTimestamp, DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from '../db.js';

const router = express.Router();

// In-memory catalog store in case of serverless cold-start without db
let memoryProducts = [...DEFAULT_PRODUCTS];
let memoryCategories = [...DEFAULT_CATEGORIES];

// Get all products (with optional filters)
router.get('/', (req, res) => {
  try {
    const { category, active, search } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (active !== undefined && active !== '') {
      query += ' AND is_active = ?';
      params.push(Number(active));
    }

    if (category && category !== 'All') {
      query += ' AND category_name = ?';
      params.push(category);
    }

    if (search && search.trim() !== '') {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY category_name ASC, name ASC';

    try {
      const products = db.prepare(query).all(...params);
      if (products && products.length > 0) {
        return res.json(products);
      }
    } catch (dbErr) {
      console.warn('DB prepare notice on products, using memory store:', dbErr.message);
    }

    // Fallback: filter memoryProducts
    let filtered = [...memoryProducts];
    if (active !== undefined && active !== '') {
      filtered = filtered.filter(p => Number(p.is_active) === Number(active));
    }
    if (category && category !== 'All') {
      filtered = filtered.filter(p => p.category_name === category);
    }
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    return res.json(filtered);
  } catch (err) {
    console.error('Products route error:', err);
    res.json(memoryProducts);
  }
});

// Get all categories
router.get('/categories', (req, res) => {
  try {
    try {
      const categories = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC, name ASC').all();
      if (categories && categories.length > 0) {
        return res.json(categories);
      }
    } catch (dbErr) {
      console.warn('DB prepare notice on categories, using memory store:', dbErr.message);
    }
    return res.json(memoryCategories);
  } catch (err) {
    console.error('Categories route error:', err);
    res.json(memoryCategories);
  }
});

// Add new category
router.post('/categories', (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const maxSort = db.prepare('SELECT MAX(sort_order) as maxSort FROM categories').get();
    const nextSort = (maxSort.maxSort || 0) + 1;

    const info = db.prepare(`
      INSERT INTO categories (name, sort_order, color, icon, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(name.trim(), nextSort, color || '#d97706', icon || 'Utensils');

    res.status(201).json({ id: info.lastInsertRowid, name: name.trim(), success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product
router.post('/', (req, res) => {
  try {
    const {
      name,
      category_name,
      description,
      selling_price,
      ingredient_cost = 0,
      prep_cost = 0,
      packaging_cost = 0,
      image_url
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const price = Number(selling_price) || 0;
    const ingCost = Number(ingredient_cost) || 0;
    const pCost = Number(prep_cost) || 0;
    const packCost = Number(packaging_cost) || 0;

    const totalCost = Number((ingCost + pCost + packCost).toFixed(2));
    const profit = Number((price - totalCost).toFixed(2));
    const margin = price > 0 ? Number(((profit / price) * 100).toFixed(1)) : 0;

    const { iso } = getISTTimestamp();

    const info = db.prepare(`
      INSERT INTO products (
        name, category_id, category_name, description, selling_price,
        ingredient_cost, prep_cost, packaging_cost, total_unit_cost,
        expected_profit, profit_margin_pct, is_active, image_url, created_at, updated_at
      ) VALUES (
        ?, (SELECT id FROM categories WHERE name = ?), ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, 1, ?, ?, ?
      )
    `).run(
      name.trim(),
      category_name || 'Classic Waffles',
      category_name || 'Classic Waffles',
      description || '',
      price,
      ingCost,
      pCost,
      packCost,
      totalCost,
      profit,
      margin,
      image_url || '',
      iso,
      iso
    );

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const {
      name = existing.name,
      category_name = existing.category_name,
      description = existing.description,
      selling_price = existing.selling_price,
      ingredient_cost = existing.ingredient_cost,
      prep_cost = existing.prep_cost,
      packaging_cost = existing.packaging_cost,
      is_active = existing.is_active,
      image_url = existing.image_url
    } = req.body;

    const price = Number(selling_price) || 0;
    const ingCost = Number(ingredient_cost) || 0;
    const pCost = Number(prep_cost) || 0;
    const packCost = Number(packaging_cost) || 0;

    const totalCost = Number((ingCost + pCost + packCost).toFixed(2));
    const profit = Number((price - totalCost).toFixed(2));
    const margin = price > 0 ? Number(((profit / price) * 100).toFixed(1)) : 0;

    const { iso } = getISTTimestamp();

    db.prepare(`
      UPDATE products SET
        name = ?,
        category_id = (SELECT id FROM categories WHERE name = ?),
        category_name = ?,
        description = ?,
        selling_price = ?,
        ingredient_cost = ?,
        prep_cost = ?,
        packaging_cost = ?,
        total_unit_cost = ?,
        expected_profit = ?,
        profit_margin_pct = ?,
        is_active = ?,
        image_url = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      name.trim(),
      category_name,
      category_name,
      description,
      price,
      ingCost,
      pCost,
      packCost,
      totalCost,
      profit,
      margin,
      is_active ? 1 : 0,
      image_url,
      iso,
      id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete or toggle product
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    // Check if product is referenced in order items
    const ordersCount = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?').get(id).count;

    if (ordersCount > 0) {
      // If historical orders exist, deactivate instead of hard delete to preserve relational integrity
      db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
      return res.json({ message: 'Product deactivated to preserve order history', deactivated: true });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ message: 'Product deleted permanently', deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
