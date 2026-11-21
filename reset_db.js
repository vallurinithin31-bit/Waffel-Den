import { db, seedMenuFromCards } from './server/db.js';

console.log('Clearing database records to start fresh with 0 values...');

// Clean all orders, items, expenses, closings, inventory
db.exec(`
  DELETE FROM order_items;
  DELETE FROM order_audits;
  DELETE FROM orders;
  DELETE FROM expenses;
  DELETE FROM daily_closings;
  DELETE FROM inventory_movements;
  DELETE FROM inventory_items;
`);

// Re-seed exact menu from cards with all costs = 0
seedMenuFromCards(true);

const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
const expCount = db.prepare('SELECT COUNT(*) as count FROM expenses').get().count;

console.log(`Database reset completed!`);
console.log(`- Categories: ${catCount}`);
console.log(`- Products: ${prodCount}`);
console.log(`- Orders: ${orderCount} (Strictly 0)`);
console.log(`- Expenses: ${expCount} (Strictly 0)`);
