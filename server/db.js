import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
let dataDir;
let dbPath;

if (isVercel) {
  dataDir = os.tmpdir();
  dbPath = path.join(dataDir, 'waffelden.db');

  // If cold-starting in Vercel lambda and db doesn't exist in /tmp, copy template if available
  const templatePath = path.join(__dirname, 'data', 'waffelden.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(templatePath)) {
    try {
      fs.copyFileSync(templatePath, dbPath);
    } catch (e) {
      console.warn('Could not copy template db, will initialize fresh:', e);
    }
  }
} else {
  dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  dbPath = path.join(dataDir, 'waffelden.db');
}

class SqlJsWrapper {
  constructor(sqlDb, filePath = null) {
    this.sqlDb = sqlDb;
    this.filePath = filePath;
  }

  save() {
    if (this.filePath) {
      try {
        const data = this.sqlDb.export();
        fs.writeFileSync(this.filePath, Buffer.from(data));
      } catch (e) {
        // Ignore write errors on read-only environments
      }
    }
  }

  exec(sql) {
    this.sqlDb.run(sql);
    this.save();
  }

  prepare(sql) {
    const self = this;
    return {
      all(...params) {
        const stmt = self.sqlDb.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params);
          }
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          stmt.free();
        }
      },
      get(...params) {
        const stmt = self.sqlDb.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params);
          }
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      run(...params) {
        const stmt = self.sqlDb.prepare(sql);
        try {
          if (params.length > 0) {
            stmt.bind(params);
          }
          stmt.step();
          self.save();
          const rowIdRes = self.sqlDb.exec('SELECT last_insert_rowid() as id');
          const lastId = rowIdRes?.[0]?.values?.[0]?.[0] || 0;
          const changesRes = self.sqlDb.exec('SELECT changes() as ch');
          const changes = changesRes?.[0]?.values?.[0]?.[0] || 0;
          return { lastInsertRowid: lastId, changes };
        } finally {
          stmt.free();
        }
      }
    };
  }
}

let rawDb;
try {
  const { DatabaseSync } = await import('node:sqlite');
  rawDb = new DatabaseSync(dbPath);
  try {
    rawDb.exec(`
      PRAGMA journal_mode = ${isVercel ? 'MEMORY' : 'WAL'};
      PRAGMA foreign_keys = ON;
    `);
  } catch (e) {
    console.warn('Pragma set warning:', e);
  }
} catch (err) {
  console.warn('node:sqlite not natively supported, falling back to WebAssembly sql.js:', err.message);
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs();
  let initialBuffer = null;
  if (fs.existsSync(dbPath)) {
    try {
      initialBuffer = fs.readFileSync(dbPath);
    } catch (e) {
      console.warn('Could not read existing database file:', e.message);
    }
  }
  const wasmDb = initialBuffer ? new SQL.Database(initialBuffer) : new SQL.Database();
  rawDb = new SqlJsWrapper(wasmDb, dbPath);
}

export const db = rawDb;
export { dbPath };

// Helper to get current Indian Standard Time (IST) strings
export function getISTTimestamp() {
  const now = new Date();
  // IST is UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  
  const iso = istDate.toISOString(); // e.g. 2026-11-21T17:15:00.000Z
  const date = iso.slice(0, 10); // YYYY-MM-DD
  const time = iso.slice(11, 19); // HH:mm:ss
  return { iso: iso.replace('Z', '+05:30'), date, time };
}

export function initDatabase() {
  db.exec(`
    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      color TEXT DEFAULT '#d97706',
      icon TEXT DEFAULT 'Utensils',
      active INTEGER DEFAULT 1
    );

    -- Products / Menu table
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      category_name TEXT NOT NULL,
      description TEXT,
      selling_price REAL NOT NULL,
      ingredient_cost REAL DEFAULT 0,
      prep_cost REAL DEFAULT 0,
      packaging_cost REAL DEFAULT 0,
      total_unit_cost REAL DEFAULT 0,
      expected_profit REAL DEFAULT 0,
      profit_margin_pct REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Orders table
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      order_date TEXT NOT NULL,
      order_time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      order_type TEXT DEFAULT 'takeaway',
      customer_name TEXT,
      customer_phone TEXT,
      notes TEXT,
      subtotal REAL NOT NULL,
      discount_type TEXT DEFAULT 'fixed',
      discount_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_reason TEXT,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      final_total REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      outstanding_balance REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash',
      payment_status TEXT DEFAULT 'Paid',
      order_status TEXT DEFAULT 'Completed',
      total_cogs REAL DEFAULT 0,
      gross_profit REAL DEFAULT 0,
      cancelled_reason TEXT,
      cancelled_at TEXT,
      updated_at TEXT NOT NULL
    );

    -- Order items table (with HISTORICAL price & cost snapshots)
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      category_name TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_price REAL NOT NULL,
      total_cost REAL NOT NULL,
      unit_profit REAL NOT NULL,
      total_profit REAL NOT NULL,
      special_notes TEXT
    );

    -- Order audit logs
    CREATE TABLE IF NOT EXISTS order_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      timestamp TEXT NOT NULL
    );

    -- Operating Expenses table
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      payment_method TEXT DEFAULT 'Cash',
      paid_from_cash_register INTEGER DEFAULT 1,
      included_in_cogs INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Inventory items table
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      reorder_level REAL NOT NULL DEFAULT 5,
      cost_per_unit REAL NOT NULL DEFAULT 0,
      category TEXT,
      supplier TEXT,
      updated_at TEXT NOT NULL
    );

    -- Inventory movement logs
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      movement_type TEXT NOT NULL,
      quantity_change REAL NOT NULL,
      new_balance REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    -- Daily Closing records
    CREATE TABLE IF NOT EXISTS daily_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      closing_date TEXT NOT NULL,
      user_id INTEGER,
      opening_cash REAL DEFAULT 0,
      cash_sales REAL DEFAULT 0,
      upi_sales REAL DEFAULT 0,
      card_sales REAL DEFAULT 0,
      other_sales REAL DEFAULT 0,
      cash_expenses REAL DEFAULT 0,
      cash_refunds REAL DEFAULT 0,
      expected_closing_cash REAL DEFAULT 0,
      actual_closing_cash REAL DEFAULT 0,
      cash_difference REAL DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      completed_orders INTEGER DEFAULT 0,
      cancelled_orders INTEGER DEFAULT 0,
      net_sales REAL DEFAULT 0,
      gross_profit REAL DEFAULT 0,
      operating_expenses REAL DEFAULT 0,
      net_profit REAL DEFAULT 0,
      closing_notes TEXT,
      closed_at TEXT NOT NULL
    );

    -- Users & Accounts table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'owner',
      shop_name TEXT DEFAULT 'Waffel Den',
      created_at TEXT NOT NULL
    );

    -- User-specific settings table
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );
  `);

  // Safely migrate existing tables to have user_id column
  const addColumnIfNotExists = (table, column, colDef) => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all();
      if (!cols.some(c => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${colDef}`);
      }
    } catch (err) {
      console.warn(`Could not add column ${column} to ${table}:`, err.message);
    }
  };

  addColumnIfNotExists('orders', 'user_id', 'INTEGER');
  addColumnIfNotExists('expenses', 'user_id', 'INTEGER');
  addColumnIfNotExists('products', 'user_id', 'INTEGER');
  addColumnIfNotExists('daily_closings', 'user_id', 'INTEGER');

  seedDefaultSettings();
  seedDefaultUsers();
  seedMenuFromCards();
}

function seedDefaultUsers() {
  try {
    const existing = db.prepare('SELECT count(*) as count FROM users').get();
    if (!existing || existing.count === 0) {
      const { iso } = getISTTimestamp();
      // Simple sha256 hash for default user
      const salt = 'waffelden_default_salt';
      const hash = createPasswordHash('admin123', salt);
      db.prepare(`
        INSERT INTO users (username, email, password_hash, salt, name, role, shop_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('admin', 'admin@waffelden.com', hash, salt, 'Store Manager', 'owner', 'Waffel Den', iso);
    }
  } catch (err) {
    console.warn('Seed users notice:', err.message);
  }
}

export function createPasswordHash(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

export function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function seedDefaultSettings() {
  const defaults = [
    ['shop_name', 'Waffel Den'],
    ['tagline', 'Freshly Baked Waffles, Shakes & Snacks'],
    ['phone', '+91 98765 43210'],
    ['address', 'Waffel Den, Food Court Counter'],
    ['currency_symbol', '₹'],
    ['tax_enabled', '0'],
    ['tax_rate', '5'],
    ['tax_type', 'exclusive'],
    ['receipt_footer', 'Thank you for visiting Waffel Den! Have a sweet day :)'],
    ['order_prefix', 'WD-'],
    ['thermal_width', '80mm'],
    ['track_inventory_auto', '0']
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of defaults) {
    stmt.run(k, v);
  }
}

export const DEFAULT_CATEGORIES = [
  { id: 1, name: "Belgium Waffle's", sort_order: 1, color: '#f59e0b', icon: 'Waffle', active: 1 },
  { id: 2, name: "Bubble Waffle's", sort_order: 2, color: '#d97706', icon: 'Sparkles', active: 1 },
  { id: 3, name: "Brownie Cake's", sort_order: 3, color: '#451a03', icon: 'Cookie', active: 1 },
  { id: 4, name: "Bowl Cake's", sort_order: 4, color: '#78350f', icon: 'Cake', active: 1 },
  { id: 5, name: 'Non Veg Items', sort_order: 5, color: '#dc2626', icon: 'Drumstick', active: 1 },
  { id: 6, name: 'Veg Items', sort_order: 6, color: '#16a34a', icon: 'Carrot', active: 1 },
  { id: 7, name: 'Hot Snacks & Momos', sort_order: 7, color: '#ea580c', icon: 'Flame', active: 1 },
  { id: 8, name: 'Sandwich', sort_order: 8, color: '#ca8a04', icon: 'Sandwich', active: 1 },
  { id: 9, name: 'Mojito Drinks', sort_order: 9, color: '#0284c7', icon: 'GlassWater', active: 1 },
  { id: 10, name: 'Extra Add-ons', sort_order: 10, color: '#8b5cf6', icon: 'PlusCircle', active: 1 }
];

export const RAW_MENU_PRODUCTS = [
  // 1. Belgium Waffle's (Image 2)
  { name: 'Dark Chocolate Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 39 },
  { name: 'Milk Chocolate Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 39 },
  { name: 'White Chocolate Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 39 },
  { name: 'Triple Chocolate Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 49 },
  { name: 'Kitkat Crunch Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 59 },
  { name: 'Oreo Blast Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 59 },
  { name: 'Choco Almond Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 69 },
  { name: 'Caramel Club Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 69 },
  { name: 'Naughty Nutella Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 69 },
  { name: 'Lotus Biscoff Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 79 },
  { name: 'Pistachio Delight Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 79 },
  { name: 'Ferrero Rocher Belgium Waffle', category_name: "Belgium Waffle's", selling_price: 79 },

  // 2. Bubble Waffle's (Image 2)
  { name: 'Dark Chocolate Bubble Waffle', category_name: "Bubble Waffle's", selling_price: 139 },
  { name: 'Milk Chocolate Bubble Waffle', category_name: "Bubble Waffle's", selling_price: 149 },
  { name: 'White Chocolate Bubble Waffle', category_name: "Bubble Waffle's", selling_price: 149 },
  { name: 'Triple Chocolate Bubble Waffle', category_name: "Bubble Waffle's", selling_price: 159 },
  { name: 'Kitkat Crunch Bubble Waffle', category_name: "Bubble Waffle's", selling_price: 159 },
  { name: 'Oreo Blast Bubble Waffle', category_name: "Bubble Waffle's", selling_price: 159 },
  { name: 'Choco Almond Bubble Waffle', category_name: "Bubble Waffle's", selling_price: 169 },
  { name: 'Caramel Club Bubble Waffle', category_name: "Bubble Waffle's", selling_price: 169 },
  { name: 'Naughty Nutella Bubble Waffle', category_name: "Bubble Waffle's", selling_price: 169 },

  // 3. Brownie Cake's (Image 2)
  { name: 'Triple Chocolate Layer Brownie', category_name: "Brownie Cake's", selling_price: 79 },
  { name: "Brownie Bite's With Nutella", category_name: "Brownie Cake's", selling_price: 89 },
  { name: 'Brownie With Chocolate Crunch', category_name: "Brownie Cake's", selling_price: 109 },
  { name: 'Kunaffa Chocolate Tub', category_name: "Brownie Cake's", selling_price: 139 },

  // 4. Bowl Cake's (Image 2)
  { name: 'Triple Choco Overload Bowl Cake', category_name: "Bowl Cake's", selling_price: 139 },
  { name: 'Kitkat Crunch Bowl Cake', category_name: "Bowl Cake's", selling_price: 149 },
  { name: 'Orea Bowl Cake', category_name: "Bowl Cake's", selling_price: 149 },
  { name: 'Naughty Nutella Bowl Cake', category_name: "Bowl Cake's", selling_price: 170 },
  { name: 'Ferrero Rocher Bowl Cake', category_name: "Bowl Cake's", selling_price: 159 },

  // 5. Non Veg Items (Image 1)
  { name: 'French Fries Chicken Loaded Bowl', category_name: 'Non Veg Items', selling_price: 149 },
  { name: 'French Fries Chicken Cheese Bowl', category_name: 'Non Veg Items', selling_price: 169 },
  { name: 'French Fries Chicken Kurekure Bowl', category_name: 'Non Veg Items', selling_price: 179 },
  { name: 'French Fries Chicken Double Loaded Bowl', category_name: 'Non Veg Items', selling_price: 199 },

  // 6. Veg Items (Image 1)
  { name: 'French Fries Peri Peri Masala', category_name: 'Veg Items', selling_price: 49 },
  { name: 'Cheese French Fries', category_name: 'Veg Items', selling_price: 59 },
  { name: 'Veg Fingers', category_name: 'Veg Items', selling_price: 109 },
  { name: 'Smiles', category_name: 'Veg Items', selling_price: 79 },
  { name: 'Sweet Samosa', category_name: 'Veg Items', selling_price: 99 },
  { name: 'Veg Cheese Ball', category_name: 'Veg Items', selling_price: 59 },

  // 7. Hot Snacks & Momos (Image 2)
  { name: 'Potato Twister Kurukure', category_name: 'Hot Snacks & Momos', selling_price: 69 },
  { name: 'Potato Twister', category_name: 'Hot Snacks & Momos', selling_price: 49 },
  { name: "Panner Momo's", category_name: 'Hot Snacks & Momos', selling_price: 79 },
  { name: "Corn Cheese Momo's", category_name: 'Hot Snacks & Momos', selling_price: 89 },

  // 8. Sandwich (Image 2)
  { name: 'Veg Cheese Sandwich', category_name: 'Sandwich', selling_price: 49 },
  { name: 'Sweetcorn Cheese Sandwich', category_name: 'Sandwich', selling_price: 69 },
  { name: 'Panner Cheese Sandwich', category_name: 'Sandwich', selling_price: 79 },
  { name: 'Chicken Cheese Sandwich', category_name: 'Sandwich', selling_price: 99 },

  // 9. Mojito Drinks (Image 1)
  { name: 'Blue Curacao Mojito', category_name: 'Mojito Drinks', selling_price: 49 },
  { name: 'Black Currant Mojito', category_name: 'Mojito Drinks', selling_price: 49 },
  { name: 'Watermelon Mojito', category_name: 'Mojito Drinks', selling_price: 49 },
  { name: 'Lime and Mint Mojito', category_name: 'Mojito Drinks', selling_price: 49 },
  { name: 'Blue Berry Mojito', category_name: 'Mojito Drinks', selling_price: 49 },
  { name: 'Mango Mojito', category_name: 'Mojito Drinks', selling_price: 49 }
];

export const DEFAULT_PRODUCTS = RAW_MENU_PRODUCTS.map((p, idx) => ({
  id: idx + 1,
  name: p.name,
  category_name: p.category_name,
  description: '',
  selling_price: p.selling_price,
  ingredient_cost: 0,
  prep_cost: 0,
  packaging_cost: 0,
  total_unit_cost: 0,
  expected_profit: p.selling_price,
  profit_margin_pct: 100,
  is_active: 1
}));

export function seedMenuFromCards(force = false) {
  if (force) {
    db.exec('DELETE FROM products; DELETE FROM categories;');
  }

  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0 || force) {
    const insCat = db.prepare('INSERT OR IGNORE INTO categories (id, name, sort_order, color, icon, active) VALUES (?, ?, ?, ?, ?, 1)');
    for (const c of DEFAULT_CATEGORIES) {
      insCat.run(c.id, c.name, c.sort_order, c.color, c.icon);
    }
  }

  const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (prodCount === 0 || force) {
    const { iso } = getISTTimestamp();

    const insProd = db.prepare(`
      INSERT INTO products (
        name, category_id, category_name, description, selling_price,
        ingredient_cost, prep_cost, packaging_cost, total_unit_cost,
        expected_profit, profit_margin_pct, is_active, created_at, updated_at
      ) VALUES (?, (SELECT id FROM categories WHERE name = ?), ?, '', ?, 0, 0, 0, 0, ?, 100, 1, ?, ?)
    `);

    for (const p of RAW_MENU_PRODUCTS) {
      insProd.run(
        p.name,
        p.category_name,
        p.category_name,
        p.selling_price,
        p.selling_price,
        iso,
        iso
      );
    }
  }
}

// Function to generate the next unique order number
export function generateNextOrderNumber(userId = null) {
  const { date } = getISTTimestamp();
  const dateCompact = date.replace(/-/g, ''); // 20261121
  
  // Get prefix from user_settings or general settings
  let prefix = 'WD-';
  try {
    if (userId) {
      const uPrefix = db.prepare("SELECT value FROM user_settings WHERE user_id = ? AND key = 'order_prefix'").get(userId);
      if (uPrefix?.value) prefix = uPrefix.value;
    }
    if (prefix === 'WD-') {
      const prefixRow = db.prepare("SELECT value FROM settings WHERE key = 'order_prefix'").get();
      if (prefixRow?.value) prefix = prefixRow.value;
    }
  } catch (e) {
    // fallback
  }

  // Count orders created today
  let nextSeq = 1;
  try {
    const countRow = userId
      ? db.prepare("SELECT COUNT(*) as count FROM orders WHERE order_date = ? AND (user_id = ? OR user_id IS NULL)").get(date, userId)
      : db.prepare("SELECT COUNT(*) as count FROM orders WHERE order_date = ?").get(date);
    nextSeq = (countRow ? countRow.count : 0) + 1;
  } catch (e) {
    // fallback
  }
  const seqPadded = String(nextSeq).padStart(3, '0');

  let orderNum = `${prefix}${dateCompact}-${seqPadded}`;

  // Ensure uniqueness
  try {
    let collision = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNum);
    let attempt = 1;
    while (collision) {
      orderNum = `${prefix}${dateCompact}-${String(nextSeq + attempt).padStart(3, '0')}`;
      collision = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNum);
      attempt++;
    }
  } catch (e) {
    // fallback
  }

  return orderNum;
}
