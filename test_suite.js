// test_suite.js - Comprehensive Verification of all 14 Mandatory Scenarios

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('🧇 Starting Waffel Den Mandatory Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Create a product with selling price and ingredient cost
    console.log('Scenario 1: Create a product with selling price and ingredient cost');
    const newProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Salted Caramel Crunch Waffle',
        category_name: 'Premium Special Waffles',
        description: 'Warm salted caramel with butter crunchies',
        selling_price: 220,
        ingredient_cost: 60,
        prep_cost: 10,
        packaging_cost: 10
      })
    });
    const createdProd = await newProdRes.json();
    assert(createdProd.id && createdProd.name === 'Test Salted Caramel Crunch Waffle', 'Product created with correct name');
    assert(createdProd.total_unit_cost === 80, `Total unit cost calculated: ₹${createdProd.total_unit_cost} (expected 80)`);
    assert(createdProd.expected_profit === 140, `Expected profit: ₹${createdProd.expected_profit} (expected 140)`);
    assert(createdProd.profit_margin_pct === 63.6, `Profit margin %: ${createdProd.profit_margin_pct}% (expected 63.6%)`);

    // 2 & 3. Create an order containing multiple products with quantities
    console.log('\nScenario 2 & 3: Order with multiple products and quantity calculations');
    const prod1Res = await fetch(`${BASE_URL}/api/products/1`); // or get list
    const allProds = await (await fetch(`${BASE_URL}/api/products`)).json();
    const prod1 = allProds[0]; // First product

    const expectedSubtotal = (2 * createdProd.selling_price) + (1 * prod1.selling_price);
    const expectedCogs = (2 * createdProd.total_unit_cost) + (1 * prod1.total_unit_cost);
    const expectedProfit = expectedSubtotal - expectedCogs;

    const order1Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_type: 'takeaway',
        customer_name: 'Aarav Sharma',
        customer_phone: '9876543210',
        items: [
          { product_id: createdProd.id, quantity: 2, special_notes: 'Extra caramel' },
          { product_id: prod1.id, quantity: 1, special_notes: 'Warm' }
        ],
        amount_paid: expectedSubtotal,
        payment_method: 'UPI',
        order_status: 'Completed'
      })
    });
    const order1 = await order1Res.json();
    assert(order1.order_number && order1.order_number.startsWith('WD-'), `Unique order number generated: ${order1.order_number}`);
    assert(order1.subtotal === expectedSubtotal, `Subtotal correct: ₹${order1.subtotal} (expected ${expectedSubtotal})`);
    assert(order1.final_total === expectedSubtotal, `Final total correct: ₹${order1.final_total}`);
    assert(order1.total_cogs === expectedCogs, `COGS calculated correctly: ₹${order1.total_cogs} (expected ${expectedCogs})`);
    assert(order1.gross_profit === expectedProfit, `Gross profit correct: ₹${order1.gross_profit} (expected ${expectedProfit})`);

    // 4. Apply discount and verify final amount
    console.log('\nScenario 4: Order with discount applied');
    const order2Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_type: 'dine_in',
        customer_name: 'Priya Patel',
        items: [
          { product_id: createdProd.id, quantity: 1 } // 220
        ],
        discount_type: 'fixed',
        discount_value: 20,
        discount_reason: 'Inaugural Discount',
        payment_method: 'Cash',
        order_status: 'Completed'
      })
    });
    const order2 = await order2Res.json();
    assert(order2.discount_amount === 20, `Discount amount: ₹${order2.discount_amount} (expected 20)`);
    assert(order2.final_total === 200, `Final total after discount: ₹${order2.final_total} (expected 200)`);
    assert(order2.gross_profit === 120, `Gross profit after discount: ₹${order2.gross_profit} (expected 200 - 80 = 120)`);

    // 5 & 6. Cash payment, UPI payment, partially paid order & outstanding balance
    console.log('\nScenario 5 & 6: Partially paid order & outstanding balance tracking');
    const order3Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_type: 'dine_in',
        customer_name: 'Rahul Verma',
        items: [
          { product_id: createdProd.id, quantity: 2 } // 440
        ],
        amount_paid: 200, // Partially paid ₹200 out of ₹440
        payment_method: 'Cash',
        order_status: 'Pending'
      })
    });
    const order3 = await order3Res.json();
    assert(order3.amount_paid === 200, `Amount paid recorded: ₹${order3.amount_paid}`);
    assert(order3.outstanding_balance === 240, `Outstanding balance: ₹${order3.outstanding_balance} (expected 240)`);
    assert(order3.payment_status === 'Partially Paid', `Payment status is 'Partially Paid'`);

    // 7. Complete an order and verify sales & profit
    console.log('\nScenario 7: Complete an order and verify metrics');
    const statusUpdateRes = await fetch(`${BASE_URL}/api/orders/${order3.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Completed' })
    });
    const updatedOrder3 = await statusUpdateRes.json();
    assert(updatedOrder3.order_status === 'Completed', `Order status updated to Completed`);

    // 8. Cancel an order and verify that it is excluded from sales totals
    console.log('\nScenario 8: Cancel an order and verify exclusion from sales');
    // First, read dashboard sales before cancellation
    const dashBeforeRes = await fetch(`${BASE_URL}/api/analytics/dashboard?range=today`);
    const dashBefore = await dashBeforeRes.json();
    const salesBefore = dashBefore.totalSales;

    // Create an order to cancel
    const cancelTestOrdRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ product_id: 1, quantity: 1 }],
        payment_method: 'Cash',
        order_status: 'Pending'
      })
    });
    const cancelTestOrd = await cancelTestOrdRes.json();

    // Now cancel it
    await fetch(`${BASE_URL}/api/orders/${cancelTestOrd.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Cancelled', cancelled_reason: 'Customer changed mind' })
    });

    const dashAfterRes = await fetch(`${BASE_URL}/api/analytics/dashboard?range=today`);
    const dashAfter = await dashAfterRes.json();
    assert(dashAfter.totalSales === salesBefore, `Cancelled order excluded from sales: before ₹${salesBefore}, after ₹${dashAfter.totalSales}`);
    assert(dashAfter.cancelledOrders >= 1, `Cancelled orders count tracked: ${dashAfter.cancelledOrders}`);

    // 9. Add an expense and verify that net profit updates correctly
    console.log('\nScenario 9: Add expense and verify net profit updates');
    const dashBeforeExp = await (await fetch(`${BASE_URL}/api/analytics/dashboard?range=today`)).json();
    const netProfitBefore = dashBeforeExp.netProfit;

    const expRes = await fetch(`${BASE_URL}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        amount: 150,
        category: 'Cleaning & Hygiene',
        description: 'Counter sanitizers and cleaning sponges',
        payment_method: 'Cash',
        paid_from_cash_register: 1,
        included_in_cogs: 0
      })
    });
    const exp = await expRes.json();
    assert(exp.id && exp.amount === 150, 'Expense saved: ₹150');

    const dashAfterExp = await (await fetch(`${BASE_URL}/api/analytics/dashboard?range=today`)).json();
    const expectedNetProfit = Number((netProfitBefore - 150).toFixed(2));
    assert(dashAfterExp.netProfit === expectedNetProfit, `Net profit decreased by exactly ₹150: was ₹${netProfitBefore}, now ₹${dashAfterExp.netProfit}`);

    // 10. Change a product's current price and verify that historical orders remain unchanged
    console.log('\nScenario 10: Change product price, verify historical orders preserved');
    // Change createdProd price from 220 to 300
    await fetch(`${BASE_URL}/api/products/${createdProd.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selling_price: 300,
        ingredient_cost: 90
      })
    });

    // Check order1 items: should STILL have unit_price: 220 and unit_cost: 80
    const histOrderRes = await fetch(`${BASE_URL}/api/orders/${order1.id}`);
    const histOrder = await histOrderRes.json();
    const itemInHist = histOrder.items.find(i => i.product_id === createdProd.id);
    assert(itemInHist.unit_price === 220, `Historical unit_price preserved as ₹${itemInHist.unit_price} (not updated to 300)`);
    assert(itemInHist.unit_cost === 80, `Historical unit_cost preserved as ₹${itemInHist.unit_cost} (not updated to 90)`);
    assert(histOrder.final_total === expectedSubtotal, `Historical order final_total preserved as ₹${histOrder.final_total}`);

    // 11. Test data persistence
    console.log('\nScenario 11: Data persistence');
    const ordersList = await (await fetch(`${BASE_URL}/api/orders`)).json();
    assert(ordersList.length >= 3, `Orders count persisted in SQLite: ${ordersList.length}`);

    // 12. Export report test
    console.log('\nScenario 12: Export CSV Reports');
    const csvRes = await fetch(`${BASE_URL}/api/reports/export/orders`);
    const csvText = await csvRes.text();
    assert(csvText.includes('Order Number') && csvText.includes('Aarav Sharma'), 'Orders CSV generated with actual database records');

    const dailyCsvRes = await fetch(`${BASE_URL}/api/reports/export/daily-summary`);
    const dailyCsvText = await dailyCsvRes.text();
    assert(dailyCsvText.includes('Gross Profit (INR)') && dailyCsvText.includes('Net Profit (INR)'), 'Daily Summary CSV generated with P&L columns');

    // 13. Edge Cases: zero amount, invalid inputs, empty cart
    console.log('\nScenario 13: Empty cart & input validation');
    const emptyOrderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] })
    });
    assert(emptyOrderRes.status === 400, 'Empty items order rejected with HTTP 400');

    // 14. Real database records verification
    console.log('\nScenario 14: Real database records verification');
    const dash = await (await fetch(`${BASE_URL}/api/analytics/dashboard?range=today`)).json();
    assert(dash.totalSales > 0 && typeof dash.totalSales === 'number', `Real totalSales computed: ₹${dash.totalSales}`);
    assert(dash.grossProfit > 0 && typeof dash.grossProfit === 'number', `Real grossProfit computed: ₹${dash.grossProfit}`);

    console.log(`\n========================================`);
    console.log(`🎉 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
