import express from 'express';
import { db, getISTTimestamp, generateNextOrderNumber } from '../db.js';

const router = express.Router();

// Get next available order number
router.get('/next-number', (req, res) => {
  try {
    const nextNum = generateNextOrderNumber(req.userId);
    if (nextNum) return res.json({ order_number: nextNum });
  } catch (err) {
    console.warn('generateNextOrderNumber notice:', err.message);
  }
  const { date } = getISTTimestamp();
  const dateCompact = date.replace(/-/g, '');
  res.json({ order_number: `WD-${dateCompact}-001` });
});

// List orders with search and filters
router.get('/', (req, res) => {
  try {
    const {
      start_date,
      end_date,
      status,
      payment_method,
      payment_status,
      search,
      limit = 100,
      offset = 0
    } = req.query;

    let query = 'SELECT * FROM orders WHERE (user_id = ? OR (user_id IS NULL AND ? = 1))';
    const params = [req.userId, req.userId];

    if (start_date) {
      query += ' AND order_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND order_date <= ?';
      params.push(end_date);
    }

    if (status && status !== 'All') {
      query += ' AND order_status = ?';
      params.push(status);
    }

    if (payment_method && payment_method !== 'All') {
      query += ' AND payment_method = ?';
      params.push(payment_method);
    }

    if (payment_status && payment_status !== 'All') {
      query += ' AND payment_status = ?';
      params.push(payment_status);
    }

    if (search && search.trim() !== '') {
      const q = `%${search.trim()}%`;
      query += ' AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
      params.push(q, q, q);
    }

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const orders = db.prepare(query).all(...params);

    // Attach items for each order
    const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const enrichedOrders = orders.map(ord => {
      const items = itemsStmt.all(ord.id);
      return { ...ord, items };
    });

    res.json(enrichedOrders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single order with items and audit trail
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
    const audits = db.prepare('SELECT * FROM order_audits WHERE order_id = ? ORDER BY id DESC').all(id);

    res.json({ ...order, items, audits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new order (Atomic Transaction)
router.post('/', (req, res) => {
  try {
    const {
      order_type = 'takeaway',
      customer_name = '',
      customer_phone = '',
      notes = '',
      items = [],
      discount_type = 'fixed',
      discount_value = 0,
      discount_reason = '',
      tax_rate: reqTaxRate,
      amount_paid: reqAmountPaid,
      payment_method = 'Cash',
      order_status = 'Completed'
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    const { iso, date, time } = getISTTimestamp();
    const orderNumber = generateNextOrderNumber(req.userId);

    // Check tax setting if tax_rate is not explicitly passed
    let taxRate = Number(reqTaxRate);
    if (isNaN(taxRate)) {
      const taxEnabledRow = db.prepare("SELECT value FROM settings WHERE key = 'tax_enabled'").get();
      const taxRateRow = db.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
      taxRate = (taxEnabledRow && taxEnabledRow.value === '1') ? (Number(taxRateRow.value) || 0) : 0;
    }

    // Process items and compute snapshot prices/costs
    let subtotal = 0;
    let totalCogs = 0;
    const processedItems = [];

    const getProdStmt = db.prepare('SELECT * FROM products WHERE id = ?');

    for (const item of items) {
      let unitPrice = Number(item.unit_price);
      let unitCost = Number(item.unit_cost);
      let prodName = item.product_name;
      let catName = item.category_name;

      if (item.product_id) {
        const prod = getProdStmt.get(item.product_id);
        if (prod) {
          if (isNaN(unitPrice) || unitPrice <= 0) unitPrice = prod.selling_price;
          if (isNaN(unitCost)) unitCost = prod.total_unit_cost;
          if (!prodName) prodName = prod.name;
          if (!catName) catName = prod.category_name;
        }
      }

      const qty = Math.max(1, Number(item.quantity) || 1);
      unitPrice = Number(unitPrice) || 0;
      unitCost = Number(unitCost) || 0;

      const totalPrice = Number((qty * unitPrice).toFixed(2));
      const totalCost = Number((qty * unitCost).toFixed(2));
      const unitProfit = Number((unitPrice - unitCost).toFixed(2));
      const totalProfit = Number((totalPrice - totalCost).toFixed(2));

      subtotal += totalPrice;
      totalCogs += totalCost;

      processedItems.push({
        product_id: item.product_id || null,
        product_name: prodName || 'Waffle Item',
        category_name: catName || 'Classic Waffles',
        quantity: qty,
        unit_price: unitPrice,
        unit_cost: unitCost,
        total_price: totalPrice,
        total_cost: totalCost,
        unit_profit: unitProfit,
        total_profit: totalProfit,
        special_notes: item.special_notes || ''
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    totalCogs = Number(totalCogs.toFixed(2));

    // Calculate discount
    let discountAmount = 0;
    const discVal = Number(discount_value) || 0;
    if (discVal > 0) {
      if (discount_type === 'percent') {
        discountAmount = Number(((subtotal * discVal) / 100).toFixed(2));
      } else {
        discountAmount = Math.min(subtotal, discVal);
      }
    }
    discountAmount = Number(discountAmount.toFixed(2));

    const afterDiscount = Math.max(0, subtotal - discountAmount);

    // Calculate tax
    let taxAmount = 0;
    if (taxRate > 0) {
      taxAmount = Number(((afterDiscount * taxRate) / 100).toFixed(2));
    }

    const finalTotal = Number((afterDiscount + taxAmount).toFixed(2));

    // Payment calculations
    let amountPaid = reqAmountPaid !== undefined ? Number(reqAmountPaid) : finalTotal;
    amountPaid = Math.max(0, Number(amountPaid.toFixed(2)));
    const outstandingBalance = Number(Math.max(0, finalTotal - amountPaid).toFixed(2));

    let paymentStatus = 'Paid';
    if (amountPaid === 0 && finalTotal > 0) {
      paymentStatus = 'Unpaid';
    } else if (outstandingBalance > 0) {
      paymentStatus = 'Partially Paid';
    }

    // Gross Profit = (finalTotal - taxAmount) - totalCogs
    const netSalesRevenue = Number((finalTotal - taxAmount).toFixed(2));
    const grossProfit = Number((netSalesRevenue - totalCogs).toFixed(2));

    // Execute within database transaction
    db.exec('BEGIN TRANSACTION');
    try {
      const insOrderStmt = db.prepare(`
        INSERT INTO orders (
          order_number, order_date, order_time, created_at, order_type,
          customer_name, customer_phone, notes, subtotal, discount_type,
          discount_value, discount_amount, discount_reason, tax_rate, tax_amount,
          final_total, amount_paid, outstanding_balance, payment_method,
          payment_status, order_status, total_cogs, gross_profit, updated_at, user_id
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      const orderInfo = insOrderStmt.run(
        orderNumber,
        date,
        time,
        iso,
        order_type,
        customer_name.trim(),
        customer_phone.trim(),
        notes.trim(),
        subtotal,
        discount_type,
        discVal,
        discountAmount,
        discount_reason.trim(),
        taxRate,
        taxAmount,
        finalTotal,
        amountPaid,
        outstandingBalance,
        payment_method,
        paymentStatus,
        order_status,
        totalCogs,
        grossProfit,
        iso,
        req.userId
      );

      const orderId = orderInfo.lastInsertRowid;

      // Insert line items
      const insItemStmt = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, category_name, quantity,
          unit_price, unit_cost, total_price, total_cost, unit_profit,
          total_profit, special_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pItem of processedItems) {
        insItemStmt.run(
          orderId,
          pItem.product_id,
          pItem.product_name,
          pItem.category_name,
          pItem.quantity,
          pItem.unit_price,
          pItem.unit_cost,
          pItem.total_price,
          pItem.total_cost,
          pItem.unit_profit,
          pItem.total_profit,
          pItem.special_notes
        );
      }

      // Record audit
      db.prepare(`
        INSERT INTO order_audits (order_id, action, description, new_values, timestamp)
        VALUES (?, 'CREATED', 'Order created with ' || ? || ' items. Total: ₹' || ?, ?, ?)
      `).run(
        orderId,
        processedItems.length,
        finalTotal,
        JSON.stringify({ finalTotal, amountPaid, paymentStatus, orderStatus: order_status }),
        iso
      );

      db.exec('COMMIT');

      // Return fully hydrated created order
      const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const itemsList = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

      res.status(201).json({ ...createdOrder, items: itemsList });
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status (with audit trail)
router.patch('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancelled_reason = '' } = req.body;

    const validStatuses = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { iso } = getISTTimestamp();
    const oldStatus = order.order_status;

    let cancelledAt = order.cancelled_at;
    let cancelReason = order.cancelled_reason;

    if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
      cancelledAt = iso;
      cancelReason = cancelled_reason || 'Cancelled by staff';
    } else if (status !== 'Cancelled') {
      cancelledAt = null;
      cancelReason = null;
    }

    db.prepare(`
      UPDATE orders SET
        order_status = ?,
        cancelled_reason = ?,
        cancelled_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(status, cancelReason, cancelledAt, iso, id);

    db.prepare(`
      INSERT INTO order_audits (order_id, action, description, old_values, new_values, timestamp)
      VALUES (?, 'STATUS_CHANGE', 'Status changed from ' || ? || ' to ' || ?, ?, ?, ?)
    `).run(id, oldStatus, status, JSON.stringify({ status: oldStatus }), JSON.stringify({ status, cancelReason }), iso);

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
    res.json({ ...updated, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update payment details
router.patch('/:id/payment', (req, res) => {
  try {
    const { id } = req.params;
    const { amount_paid, payment_method } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { iso } = getISTTimestamp();
    const paid = Number(amount_paid) >= 0 ? Number(Number(amount_paid).toFixed(2)) : order.amount_paid;
    const method = payment_method || order.payment_method;
    const balance = Number(Math.max(0, order.final_total - paid).toFixed(2));

    let status = 'Paid';
    if (paid === 0 && order.final_total > 0) {
      status = 'Unpaid';
    } else if (balance > 0) {
      status = 'Partially Paid';
    }

    db.prepare(`
      UPDATE orders SET
        amount_paid = ?,
        outstanding_balance = ?,
        payment_method = ?,
        payment_status = ?,
        updated_at = ?
      WHERE id = ?
    `).run(paid, balance, method, status, iso, id);

    db.prepare(`
      INSERT INTO order_audits (order_id, action, description, old_values, new_values, timestamp)
      VALUES (?, 'PAYMENT_UPDATE', 'Payment updated: paid ₹' || ? || ', status ' || ?, ?, ?, ?)
    `).run(
      id,
      paid,
      status,
      JSON.stringify({ amount_paid: order.amount_paid, payment_status: order.payment_status }),
      JSON.stringify({ amount_paid: paid, payment_status: status, payment_method: method }),
      iso
    );

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
    res.json({ ...updated, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
