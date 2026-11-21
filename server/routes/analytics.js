import express from 'express';
import { db, getISTTimestamp } from '../db.js';

const router = express.Router();

// Helper to compute date range boundaries in IST
function getDateRange(rangeType, customStart, customEnd) {
  const { date: today } = getISTTimestamp();
  const d = new Date(today);

  if (rangeType === 'today') {
    return { start: today, end: today, label: 'Today' };
  } else if (rangeType === 'yesterday') {
    const y = new Date(d);
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().slice(0, 10);
    return { start: yStr, end: yStr, label: 'Yesterday' };
  } else if (rangeType === '7days') {
    const s = new Date(d);
    s.setDate(s.getDate() - 6);
    return { start: s.toISOString().slice(0, 10), end: today, label: 'Last 7 Days' };
  } else if (rangeType === '30days') {
    const s = new Date(d);
    s.setDate(s.getDate() - 29);
    return { start: s.toISOString().slice(0, 10), end: today, label: 'Last 30 Days' };
  } else if (rangeType === 'month') {
    const startOfMonth = today.slice(0, 7) + '-01';
    return { start: startOfMonth, end: today, label: 'This Month' };
  } else if (rangeType === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd, label: `${customStart} to ${customEnd}` };
  }

  // Default to today
  return { start: today, end: today, label: 'Today' };
}

// Main Dashboard Summary API
router.get('/dashboard', (req, res) => {
  try {
    const { range = 'today', start_date, end_date } = req.query;
    const { start, end } = getDateRange(range, start_date, end_date);
    const { date: todayDate } = getISTTimestamp();

    // 1. Current Period Orders (Non-cancelled)
    const validOrders = db.prepare(`
      SELECT * FROM orders
      WHERE order_date >= ? AND order_date <= ? AND order_status != 'Cancelled'
    `).all(start, end);

    // All orders in period (including cancelled)
    const allOrders = db.prepare(`
      SELECT * FROM orders
      WHERE order_date >= ? AND order_date <= ?
    `).all(start, end);

    let totalSales = 0;
    let totalCogs = 0;
    let grossProfit = 0;
    let paidOrdersCount = 0;
    let unpaidOrdersCount = 0;
    let partiallyPaidOrdersCount = 0;
    let completedOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    for (const ord of allOrders) {
      if (ord.order_status === 'Cancelled') {
        cancelledOrders++;
        continue;
      }

      if (ord.order_status === 'Completed') completedOrders++;
      else pendingOrders++;

      if (ord.payment_status === 'Paid') paidOrdersCount++;
      else if (ord.payment_status === 'Unpaid') unpaidOrdersCount++;
      else partiallyPaidOrdersCount++;

      totalSales += ord.final_total;
      totalCogs += ord.total_cogs;
      grossProfit += ord.gross_profit;
      totalDiscount += ord.discount_amount;
      totalTax += ord.tax_amount;
    }

    totalSales = Number(totalSales.toFixed(2));
    totalCogs = Number(totalCogs.toFixed(2));
    grossProfit = Number(grossProfit.toFixed(2));

    const totalOrdersCount = allOrders.length;
    const validOrdersCount = validOrders.length;
    const aov = validOrdersCount > 0 ? Number((totalSales / validOrdersCount).toFixed(2)) : 0;

    // 2. Expenses in period
    const expenses = db.prepare(`
      SELECT * FROM expenses
      WHERE date >= ? AND date <= ?
    `).all(start, end);

    let totalExpenses = 0;
    let operatingExpenses = 0; // Excludes purchases marked included_in_cogs

    for (const exp of expenses) {
      totalExpenses += exp.amount;
      if (!exp.included_in_cogs) {
        operatingExpenses += exp.amount;
      }
    }

    totalExpenses = Number(totalExpenses.toFixed(2));
    operatingExpenses = Number(operatingExpenses.toFixed(2));
    const netProfit = Number((grossProfit - operatingExpenses).toFixed(2));

    // 3. Best-Selling Waffle & Most Profitable Product in period
    const productStats = db.prepare(`
      SELECT
        oi.product_id,
        oi.product_name,
        oi.category_name,
        SUM(oi.quantity) as total_qty,
        SUM(oi.total_price) as total_revenue,
        SUM(oi.total_cost) as total_cogs,
        SUM(oi.total_profit) as total_profit
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.order_date >= ? AND o.order_date <= ? AND o.order_status != 'Cancelled'
      GROUP BY oi.product_name
      ORDER BY total_qty DESC
    `).all(start, end);

    const bestSelling = productStats.length > 0 ? productStats[0] : null;

    const mostProfitable = [...productStats].sort((a, b) => b.total_profit - a.total_profit)[0] || null;

    // 4. Comparison with Yesterday
    const yesterdayDateObj = new Date(todayDate);
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
    const yesterdayStr = yesterdayDateObj.toISOString().slice(0, 10);

    const yesterdaySalesRow = db.prepare(`
      SELECT SUM(final_total) as sales, COUNT(*) as orders_count
      FROM orders
      WHERE order_date = ? AND order_status != 'Cancelled'
    `).get(yesterdayStr);

    const yesterdaySales = yesterdaySalesRow && yesterdaySalesRow.sales ? Number(yesterdaySalesRow.sales.toFixed(2)) : 0;
    const todaySalesRow = db.prepare(`
      SELECT SUM(final_total) as sales, COUNT(*) as orders_count
      FROM orders
      WHERE order_date = ? AND order_status != 'Cancelled'
    `).get(todayDate);
    const todayActualSales = todaySalesRow && todaySalesRow.sales ? Number(todaySalesRow.sales.toFixed(2)) : 0;

    let salesChangeVsYesterday = Number((todayActualSales - yesterdaySales).toFixed(2));
    let salesPctChangeVsYesterday = 0;
    if (yesterdaySales > 0) {
      salesPctChangeVsYesterday = Number((((todayActualSales - yesterdaySales) / yesterdaySales) * 100).toFixed(1));
    } else if (todayActualSales > 0) {
      salesPctChangeVsYesterday = 100;
    }

    // 5. Daily Trend (last 7 or 30 days)
    const trendDays = range === '30days' ? 30 : 7;
    const trendStartObj = new Date(todayDate);
    trendStartObj.setDate(trendStartObj.getDate() - (trendDays - 1));
    const trendStartStr = trendStartObj.toISOString().slice(0, 10);

    const dailyOrdersAgg = db.prepare(`
      SELECT
        order_date,
        COUNT(*) as order_count,
        SUM(final_total) as daily_sales,
        SUM(total_cogs) as daily_cogs,
        SUM(gross_profit) as daily_gross_profit
      FROM orders
      WHERE order_date >= ? AND order_date <= ? AND order_status != 'Cancelled'
      GROUP BY order_date
    `).all(trendStartStr, todayDate);

    const dailyExpensesAgg = db.prepare(`
      SELECT
        date,
        SUM(CASE WHEN included_in_cogs = 0 THEN amount ELSE 0 END) as operating_expenses,
        SUM(amount) as total_expenses
      FROM expenses
      WHERE date >= ? AND date <= ?
      GROUP BY date
    `).all(trendStartStr, todayDate);

    // Map into consecutive daily points
    const trendMap = {};
    for (let i = 0; i < trendDays; i++) {
      const cur = new Date(trendStartObj);
      cur.setDate(cur.getDate() + i);
      const cStr = cur.toISOString().slice(0, 10);
      trendMap[cStr] = {
        date: cStr,
        displayDate: cStr.slice(5), // MM-DD
        sales: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
        orders: 0
      };
    }

    for (const d of dailyOrdersAgg) {
      if (trendMap[d.order_date]) {
        trendMap[d.order_date].sales = Number((d.daily_sales || 0).toFixed(2));
        trendMap[d.order_date].grossProfit = Number((d.daily_gross_profit || 0).toFixed(2));
        trendMap[d.order_date].orders = d.order_count || 0;
      }
    }

    for (const e of dailyExpensesAgg) {
      if (trendMap[e.date]) {
        trendMap[e.date].expenses = Number((e.operating_expenses || 0).toFixed(2));
      }
    }

    const trendPoints = Object.values(trendMap).map(pt => ({
      ...pt,
      netProfit: Number((pt.grossProfit - pt.expenses).toFixed(2))
    }));

    res.json({
      period: { start, end, range },
      todayDate,
      totalSales,
      totalExpenses,
      operatingExpenses,
      grossProfit,
      netProfit,
      totalOrdersCount,
      validOrdersCount,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      paidOrdersCount,
      unpaidOrdersCount,
      partiallyPaidOrdersCount,
      averageOrderValue: aov,
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      bestSelling,
      mostProfitable,
      comparisonVsYesterday: {
        todaySales: todayActualSales,
        yesterdaySales,
        diff: salesChangeVsYesterday,
        percent: salesPctChangeVsYesterday
      },
      trend: trendPoints
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deep Detailed Analytics API (Sales & Profit breakdown)
router.get('/detailed', (req, res) => {
  try {
    const { range = '30days', start_date, end_date } = req.query;
    const { start, end } = getDateRange(range, start_date, end_date);

    // Orders in period (excluding cancelled)
    const orders = db.prepare(`
      SELECT * FROM orders
      WHERE order_date >= ? AND order_date <= ? AND order_status != 'Cancelled'
      ORDER BY order_date ASC
    `).all(start, end);

    // Cancelled orders count
    const cancelledCount = db.prepare(`
      SELECT COUNT(*) as count FROM orders
      WHERE order_date >= ? AND order_date <= ? AND order_status = 'Cancelled'
    `).get(start, end).count;

    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalCogs = 0;
    let grossProfit = 0;

    const paymentMethods = { Cash: 0, UPI: 0, Card: 0, Other: 0 };
    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      hourLabel: `${String(i).padStart(2, '0')}:00`,
      orders: 0,
      sales: 0
    }));

    const weekdayDistribution = [
      { day: 'Sun', dayIndex: 0, orders: 0, sales: 0 },
      { day: 'Mon', dayIndex: 1, orders: 0, sales: 0 },
      { day: 'Tue', dayIndex: 2, orders: 0, sales: 0 },
      { day: 'Wed', dayIndex: 3, orders: 0, sales: 0 },
      { day: 'Thu', dayIndex: 4, orders: 0, sales: 0 },
      { day: 'Fri', dayIndex: 5, orders: 0, sales: 0 },
      { day: 'Sat', dayIndex: 6, orders: 0, sales: 0 }
    ];

    for (const ord of orders) {
      totalRevenue += ord.final_total;
      totalDiscount += ord.discount_amount;
      totalTax += ord.tax_amount;
      totalCogs += ord.total_cogs;
      grossProfit += ord.gross_profit;

      // Payment Breakdown
      const m = ord.payment_method || 'Other';
      paymentMethods[m] = (paymentMethods[m] || 0) + ord.final_total;

      // Hourly peak breakdown
      if (ord.order_time) {
        const hour = parseInt(ord.order_time.slice(0, 2), 10);
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          hourlyDistribution[hour].orders += 1;
          hourlyDistribution[hour].sales += ord.final_total;
        }
      }

      // Weekday breakdown
      if (ord.order_date) {
        const dayIdx = new Date(ord.order_date).getDay();
        if (weekdayDistribution[dayIdx]) {
          weekdayDistribution[dayIdx].orders += 1;
          weekdayDistribution[dayIdx].sales += ord.final_total;
        }
      }
    }

    totalRevenue = Number(totalRevenue.toFixed(2));
    totalDiscount = Number(totalDiscount.toFixed(2));
    totalTax = Number(totalTax.toFixed(2));
    totalCogs = Number(totalCogs.toFixed(2));
    grossProfit = Number(grossProfit.toFixed(2));

    const netSales = Number((totalRevenue - totalTax).toFixed(2));
    const profitMarginPct = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0;

    // Operating expenses
    const expenses = db.prepare(`
      SELECT * FROM expenses WHERE date >= ? AND date <= ?
    `).all(start, end);

    let totalExpenses = 0;
    let operatingExpenses = 0;
    const expenseCategoryMap = {};

    for (const exp of expenses) {
      totalExpenses += exp.amount;
      if (!exp.included_in_cogs) {
        operatingExpenses += exp.amount;
      }
      expenseCategoryMap[exp.category] = (expenseCategoryMap[exp.category] || 0) + exp.amount;
    }

    totalExpenses = Number(totalExpenses.toFixed(2));
    operatingExpenses = Number(operatingExpenses.toFixed(2));
    const netProfit = Number((grossProfit - operatingExpenses).toFixed(2));
    const netProfitMarginPct = netSales > 0 ? Number(((netProfit / netSales) * 100).toFixed(1)) : 0;

    // Product Performance & Margin Analysis
    const productBreakdown = db.prepare(`
      SELECT
        oi.product_id,
        oi.product_name,
        oi.category_name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total_price) as revenue,
        SUM(oi.total_cost) as cogs,
        SUM(oi.total_profit) as gross_profit,
        ROUND((SUM(oi.total_profit) / NULLIF(SUM(oi.total_price), 0)) * 100, 1) as margin_pct
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.order_date >= ? AND o.order_date <= ? AND o.order_status != 'Cancelled'
      GROUP BY oi.product_name
      ORDER BY revenue DESC
    `).all(start, end);

    // Category Breakdown
    const categoryBreakdown = db.prepare(`
      SELECT
        oi.category_name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total_price) as revenue,
        SUM(oi.total_profit) as gross_profit
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.order_date >= ? AND o.order_date <= ? AND o.order_status != 'Cancelled'
      GROUP BY oi.category_name
      ORDER BY revenue DESC
    `).all(start, end);

    // Identify low margin products (< 35% margin)
    const lowMarginProducts = productBreakdown.filter(p => p.margin_pct < 35 && p.quantity_sold > 0);

    // Identify Peak business hour
    const peakHour = [...hourlyDistribution].sort((a, b) => b.orders - a.orders)[0] || null;

    // Identify Busiest weekday
    const busiestDay = [...weekdayDistribution].sort((a, b) => b.orders - a.orders)[0] || null;

    res.json({
      dateRange: { start, end, range },
      metrics: {
        totalOrders: orders.length,
        cancelledOrders: cancelledCount,
        averageOrderValue: orders.length > 0 ? Number((totalRevenue / orders.length).toFixed(2)) : 0,
        grossSalesRevenue: totalRevenue,
        discounts: totalDiscount,
        taxes: totalTax,
        netSales,
        costOfGoodsSold: totalCogs,
        grossProfit,
        grossProfitMarginPct: profitMarginPct,
        operatingExpenses,
        totalExpenses,
        netProfit,
        netProfitMarginPct,
        profitPerOrder: orders.length > 0 ? Number((netProfit / orders.length).toFixed(2)) : 0
      },
      paymentMethods,
      hourlyDistribution,
      weekdayDistribution,
      peakHour,
      busiestDay,
      productBreakdown,
      categoryBreakdown,
      expenseCategoryMap,
      lowMarginProducts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
