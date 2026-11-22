import express from 'express';
import { db, getISTTimestamp } from '../db.js';

const router = express.Router();

// Get live daily closing numbers for a given date (defaults to today)
router.get('/preview', (req, res) => {
  try {
    const { date: reqDate } = req.query;
    const { date: todayDate } = getISTTimestamp();
    const queryDate = reqDate || todayDate;
    const uid = req.userId;

    // Check if day is already closed
    const existingClosing = db.prepare('SELECT * FROM daily_closings WHERE closing_date = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))').get(queryDate, uid, uid);

    // Get orders for this date
    const orders = db.prepare('SELECT * FROM orders WHERE order_date = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))').all(queryDate, uid, uid);

    let totalOrders = orders.length;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let pendingOrders = 0;

    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let otherSales = 0;

    let netSales = 0;
    let totalCogs = 0;
    let grossProfit = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    for (const ord of orders) {
      if (ord.order_status === 'Cancelled') {
        cancelledOrders++;
        continue; // Cancelled orders strictly excluded from sales & profit
      }

      if (ord.order_status === 'Completed') {
        completedOrders++;
      } else {
        pendingOrders++;
      }

      // Money collected by payment method
      const paid = ord.amount_paid || 0;
      if (ord.payment_method === 'Cash') {
        cashSales += paid;
      } else if (ord.payment_method === 'UPI') {
        upiSales += paid;
      } else if (ord.payment_method === 'Card') {
        cardSales += paid;
      } else {
        otherSales += paid;
      }

      // Sales & profit metrics
      netSales += (ord.final_total - ord.tax_amount);
      totalCogs += ord.total_cogs;
      grossProfit += ord.gross_profit;
      totalDiscount += ord.discount_amount;
      totalTax += ord.tax_amount;
    }

    // Get expenses for this date
    const expenses = db.prepare('SELECT * FROM expenses WHERE date = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))').all(queryDate, uid, uid);
    let cashExpenses = 0;
    let operatingExpenses = 0;

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      if (exp.paid_from_cash_register) {
        cashExpenses += amt;
      }
      if (!exp.included_in_cogs) {
        operatingExpenses += amt;
      }
    }

    const netProfit = Number((grossProfit - operatingExpenses).toFixed(2));
    const openingCash = existingClosing ? existingClosing.opening_cash : 0;
    const cashRefunds = existingClosing ? existingClosing.cash_refunds : 0;
    const expectedClosingCash = Number((openingCash + cashSales - cashExpenses - cashRefunds).toFixed(2));

    res.json({
      date: queryDate,
      isClosed: !!existingClosing,
      closingRecord: existingClosing || null,
      openingCash: Number(openingCash.toFixed(2)),
      cashSales: Number(cashSales.toFixed(2)),
      upiSales: Number(upiSales.toFixed(2)),
      cardSales: Number(cardSales.toFixed(2)),
      otherSales: Number(otherSales.toFixed(2)),
      totalCollected: Number((cashSales + upiSales + cardSales + otherSales).toFixed(2)),
      cashExpenses: Number(cashExpenses.toFixed(2)),
      cashRefunds: Number(cashRefunds.toFixed(2)),
      expectedClosingCash,
      actualClosingCash: existingClosing ? existingClosing.actual_closing_cash : expectedClosingCash,
      cashDifference: existingClosing ? existingClosing.cash_difference : 0,
      totalOrders,
      completedOrders,
      cancelledOrders,
      pendingOrders,
      netSales: Number(netSales.toFixed(2)),
      totalCogs: Number(totalCogs.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      operatingExpenses: Number(operatingExpenses.toFixed(2)),
      netProfit,
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Finalize / Save Daily Closing
router.post('/finalize', (req, res) => {
  try {
    const {
      closing_date,
      opening_cash = 0,
      cash_refunds = 0,
      actual_closing_cash = 0,
      closing_notes = ''
    } = req.body;

    const { iso, date: todayDate } = getISTTimestamp();
    const targetDate = closing_date || todayDate;
    const uid = req.userId;

    // Get live calculated figures for the day
    const orders = db.prepare('SELECT * FROM orders WHERE order_date = ? AND order_status != ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))').all(targetDate, 'Cancelled', uid, uid);
    const allOrdersCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE order_date = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))').get(targetDate, uid, uid).count;
    const cancelledCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE order_date = ? AND order_status = 'Cancelled' AND (user_id = ? OR (user_id IS NULL AND ? = 1))").get(targetDate, uid, uid).count;

    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let otherSales = 0;
    let netSales = 0;
    let grossProfit = 0;

    for (const ord of orders) {
      const paid = ord.amount_paid || 0;
      if (ord.payment_method === 'Cash') cashSales += paid;
      else if (ord.payment_method === 'UPI') upiSales += paid;
      else if (ord.payment_method === 'Card') cardSales += paid;
      else otherSales += paid;

      netSales += (ord.final_total - ord.tax_amount);
      grossProfit += ord.gross_profit;
    }

    const expenses = db.prepare('SELECT * FROM expenses WHERE date = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))').all(targetDate, uid, uid);
    let cashExpenses = 0;
    let operatingExpenses = 0;
    for (const exp of expenses) {
      if (exp.paid_from_cash_register) cashExpenses += exp.amount;
      if (!exp.included_in_cogs) operatingExpenses += exp.amount;
    }

    const openCash = Number(Number(opening_cash).toFixed(2));
    const refunds = Number(Number(cash_refunds).toFixed(2));
    const actualCash = Number(Number(actual_closing_cash).toFixed(2));
    const expectedCash = Number((openCash + cashSales - cashExpenses - refunds).toFixed(2));
    const difference = Number((actualCash - expectedCash).toFixed(2));
    const netProfit = Number((grossProfit - operatingExpenses).toFixed(2));

    // Upsert daily closing
    try {
      db.prepare(`
        INSERT INTO daily_closings (
          closing_date, opening_cash, cash_sales, upi_sales, card_sales, other_sales,
          cash_expenses, cash_refunds, expected_closing_cash, actual_closing_cash,
          cash_difference, total_orders, completed_orders, cancelled_orders,
          net_sales, gross_profit, operating_expenses, net_profit, closing_notes, closed_at, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        targetDate,
        openCash,
        Number(cashSales.toFixed(2)),
        Number(upiSales.toFixed(2)),
        Number(cardSales.toFixed(2)),
        Number(otherSales.toFixed(2)),
        Number(cashExpenses.toFixed(2)),
        refunds,
        expectedCash,
        actualCash,
        difference,
        allOrdersCount,
        orders.length,
        cancelledCount,
        Number(netSales.toFixed(2)),
        Number(grossProfit.toFixed(2)),
        Number(operatingExpenses.toFixed(2)),
        netProfit,
        closing_notes.trim(),
        iso,
        uid
      );
    } catch (e) {
      // If conflict, update
      db.prepare(`
        UPDATE daily_closings SET
          opening_cash = ?, cash_sales = ?, upi_sales = ?, card_sales = ?, other_sales = ?,
          cash_expenses = ?, cash_refunds = ?, expected_closing_cash = ?, actual_closing_cash = ?,
          cash_difference = ?, total_orders = ?, completed_orders = ?, cancelled_orders = ?,
          net_sales = ?, gross_profit = ?, operating_expenses = ?, net_profit = ?, closing_notes = ?, closed_at = ?
        WHERE closing_date = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))
      `).run(
        openCash, Number(cashSales.toFixed(2)), Number(upiSales.toFixed(2)), Number(cardSales.toFixed(2)), Number(otherSales.toFixed(2)),
        Number(cashExpenses.toFixed(2)), refunds, expectedCash, actualCash, difference, allOrdersCount, orders.length, cancelledCount,
        Number(netSales.toFixed(2)), Number(grossProfit.toFixed(2)), Number(operatingExpenses.toFixed(2)), netProfit, closing_notes.trim(), iso,
        targetDate, uid, uid
      );
    }

    const record = db.prepare('SELECT * FROM daily_closings WHERE closing_date = ? AND (user_id = ? OR (user_id IS NULL AND ? = 1))').get(targetDate, uid, uid);
    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List historical daily closing records
router.get('/history', (req, res) => {
  try {
    const uid = req.userId;
    const records = db.prepare('SELECT * FROM daily_closings WHERE (user_id = ? OR (user_id IS NULL AND ? = 1)) ORDER BY closing_date DESC LIMIT 60').all(uid, uid);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
