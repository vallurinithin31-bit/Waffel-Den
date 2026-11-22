// Client-side persistent storage and serverless rehydration sync for Waffel Den
// Guarantees all entered orders, expenses, custom products, and daily closings persist permanently
// across browser refreshes, Vercel serverless cold-starts, and device restarts.

const STORAGE_KEYS = {
  ORDERS: 'waffelden_orders_v1',
  EXPENSES: 'waffelden_expenses_v1',
  CUSTOM_PRODUCTS: 'waffelden_custom_products_v1',
  CLOSINGS: 'waffelden_closings_v1',
  SETTINGS: 'waffelden_settings_v1',
  LAST_SYNC: 'waffelden_last_sync_v1'
};

const safeGetJSON = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`Error reading localStorage for key ${key}:`, e);
    return fallback;
  }
};

const safeSetJSON = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn(`Error writing localStorage for key ${key}:`, e);
  }
};

// --- Orders Persistence ---
export const getLocalOrders = () => safeGetJSON(STORAGE_KEYS.ORDERS, []);

export const saveLocalOrder = (order) => {
  if (!order || (!order.order_number && !order.id)) return;
  const orders = getLocalOrders();
  const existingIdx = orders.findIndex(o => 
    (order.order_number && o.order_number === order.order_number) || 
    (order.id && o.id === order.id)
  );

  if (existingIdx >= 0) {
    orders[existingIdx] = { ...orders[existingIdx], ...order };
  } else {
    orders.unshift(order); // Put newest first
  }
  safeSetJSON(STORAGE_KEYS.ORDERS, orders);
  triggerSyncNotification();
};

export const updateLocalOrderStatus = (orderNumber, updates) => {
  const orders = getLocalOrders();
  let modified = false;
  const updatedOrders = orders.map(o => {
    if (o.order_number === orderNumber) {
      modified = true;
      return { ...o, ...updates, updated_at: new Date().toISOString() };
    }
    return o;
  });
  if (modified) {
    safeSetJSON(STORAGE_KEYS.ORDERS, updatedOrders);
    triggerSyncNotification();
  }
};

// --- Expenses Persistence ---
export const getLocalExpenses = () => safeGetJSON(STORAGE_KEYS.EXPENSES, []);

export const saveLocalExpense = (expense) => {
  if (!expense) return;
  const expenses = getLocalExpenses();
  const key = `${expense.category}_${expense.description || expense.title || ''}_${expense.date}_${expense.amount}`;
  const existingIdx = expenses.findIndex(e => {
    const eKey = `${e.category}_${e.description || e.title || ''}_${e.date}_${e.amount}`;
    return (expense.id && e.id === expense.id) || eKey === key;
  });

  if (existingIdx >= 0) {
    expenses[existingIdx] = { ...expenses[existingIdx], ...expense };
  } else {
    expenses.unshift(expense);
  }
  safeSetJSON(STORAGE_KEYS.EXPENSES, expenses);
  triggerSyncNotification();
};

export const deleteLocalExpense = (idOrKey) => {
  const expenses = getLocalExpenses();
  const filtered = expenses.filter(e => {
    const key = `${e.category}_${e.description || e.title || ''}_${e.date}_${e.amount}`;
    return e.id !== idOrKey && key !== idOrKey;
  });
  safeSetJSON(STORAGE_KEYS.EXPENSES, filtered);
  triggerSyncNotification();
};

// --- Custom Products Persistence ---
export const getLocalCustomProducts = () => safeGetJSON(STORAGE_KEYS.CUSTOM_PRODUCTS, []);

export const saveLocalCustomProduct = (product) => {
  if (!product || !product.name) return;
  const products = getLocalCustomProducts();
  const existingIdx = products.findIndex(p => p.name.trim().toLowerCase() === product.name.trim().toLowerCase());

  if (existingIdx >= 0) {
    products[existingIdx] = { ...products[existingIdx], ...product };
  } else {
    products.push(product);
  }
  safeSetJSON(STORAGE_KEYS.CUSTOM_PRODUCTS, products);
  triggerSyncNotification();
};

// --- Daily Closings Persistence ---
export const getLocalClosings = () => safeGetJSON(STORAGE_KEYS.CLOSINGS, []);

export const saveLocalClosing = (closing) => {
  if (!closing || !closing.closing_date) return;
  const closings = getLocalClosings();
  const existingIdx = closings.findIndex(c => c.closing_date === closing.closing_date);

  if (existingIdx >= 0) {
    closings[existingIdx] = { ...closings[existingIdx], ...closing };
  } else {
    closings.unshift(closing);
  }
  safeSetJSON(STORAGE_KEYS.CLOSINGS, closings);
  triggerSyncNotification();
};

// --- Settings Persistence ---
export const getLocalSettings = () => safeGetJSON(STORAGE_KEYS.SETTINGS, {});

export const saveLocalSettings = (settings) => {
  if (!settings) return;
  const current = getLocalSettings();
  const merged = { ...current, ...settings };
  safeSetJSON(STORAGE_KEYS.SETTINGS, merged);
  triggerSyncNotification();
};

// Helper event dispatcher to inform UI of sync/storage changes
const triggerSyncNotification = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('waffelden_local_data_changed'));
  }
};

// --- Master Sync: Push local snapshot to server + pull server snapshot ---
let isSyncing = false;

export const syncWithServer = async () => {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const localOrders = getLocalOrders();
    const localExpenses = getLocalExpenses();
    const localProducts = getLocalCustomProducts();
    const localClosings = getLocalClosings();
    const localSettings = getLocalSettings();

    // Step 1: If there is any local data, rehydrate the serverless backend
    if (localOrders.length > 0 || localExpenses.length > 0 || localProducts.length > 0 || localClosings.length > 0) {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orders: localOrders,
            expenses: localExpenses,
            products: localProducts,
            closings: localClosings,
            settings: localSettings
          })
        });
      } catch (postErr) {
        console.warn('Rehydration push warning:', postErr);
      }
    }

    // Step 2: Fetch current server snapshot to merge any new/updated records
    try {
      const getRes = await fetch('/api/sync');
      if (getRes.ok) {
        const serverSnapshot = await getRes.json();

        // Merge orders
        if (Array.isArray(serverSnapshot.orders)) {
          const mergedOrdersMap = new Map();
          // Server orders first
          for (const ord of serverSnapshot.orders) {
            if (ord.order_number) mergedOrdersMap.set(ord.order_number, ord);
          }
          // Preserve local orders
          for (const ord of localOrders) {
            if (ord.order_number && !mergedOrdersMap.has(ord.order_number)) {
              mergedOrdersMap.set(ord.order_number, ord);
            }
          }
          const finalOrders = Array.from(mergedOrdersMap.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
          safeSetJSON(STORAGE_KEYS.ORDERS, finalOrders);
        }

        // Merge expenses
        if (Array.isArray(serverSnapshot.expenses)) {
          const mergedExpensesMap = new Map();
          for (const exp of serverSnapshot.expenses) {
            const key = `${exp.category}_${exp.description || exp.title || ''}_${exp.date}_${exp.amount}`;
            mergedExpensesMap.set(key, exp);
          }
          for (const exp of localExpenses) {
            const key = `${exp.category}_${exp.description || exp.title || ''}_${exp.date}_${exp.amount}`;
            if (!mergedExpensesMap.has(key)) {
              mergedExpensesMap.set(key, exp);
            }
          }
          safeSetJSON(STORAGE_KEYS.EXPENSES, Array.from(mergedExpensesMap.values()));
        }

        // Merge custom products
        if (Array.isArray(serverSnapshot.products)) {
          const customServerProds = serverSnapshot.products.filter(p => p.is_active === 1);
          const mergedProdsMap = new Map();
          for (const p of customServerProds) {
            if (p.name) mergedProdsMap.set(p.name.trim().toLowerCase(), p);
          }
          for (const p of localProducts) {
            if (p.name && !mergedProdsMap.has(p.name.trim().toLowerCase())) {
              mergedProdsMap.set(p.name.trim().toLowerCase(), p);
            }
          }
          safeSetJSON(STORAGE_KEYS.CUSTOM_PRODUCTS, Array.from(mergedProdsMap.values()));
        }

        // Merge closings
        if (Array.isArray(serverSnapshot.closings)) {
          const closingsMap = new Map();
          for (const c of serverSnapshot.closings) {
            if (c.closing_date) closingsMap.set(c.closing_date, c);
          }
          for (const c of localClosings) {
            if (c.closing_date && !closingsMap.has(c.closing_date)) {
              closingsMap.set(c.closing_date, c);
            }
          }
          safeSetJSON(STORAGE_KEYS.CLOSINGS, Array.from(closingsMap.values()));
        }

        // Merge settings
        if (serverSnapshot.settings && typeof serverSnapshot.settings === 'object') {
          const mergedSettings = { ...localSettings, ...serverSnapshot.settings };
          safeSetJSON(STORAGE_KEYS.SETTINGS, mergedSettings);
        }

        safeSetJSON(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        triggerSyncNotification();
      }
    } catch (getErr) {
      console.warn('Sync snapshot fetch warning:', getErr);
    }
  } catch (err) {
    console.error('Master sync error:', err);
  } finally {
    isSyncing = false;
  }
};

// --- Instant local stats calculation for zero-latency dashboard on refresh ---
export const getLocalDashboardMetrics = (range = 'today') => {
  const orders = getLocalOrders();
  const expenses = getLocalExpenses();

  // Determine date filter
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  
  let validOrders = orders.filter(o => o.order_status !== 'Cancelled');
  let filteredExpenses = expenses;

  if (range === 'today') {
    validOrders = validOrders.filter(o => o.order_date === todayStr);
    filteredExpenses = filteredExpenses.filter(e => e.date === todayStr);
  } else if (range === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);
    validOrders = validOrders.filter(o => o.order_date === yestStr);
    filteredExpenses = filteredExpenses.filter(e => e.date === yestStr);
  }

  const totalSales = validOrders.reduce((sum, o) => sum + (Number(o.final_total) || 0), 0);
  const totalCogs = validOrders.reduce((sum, o) => sum + (Number(o.total_cogs) || 0), 0);
  const grossProfit = Math.max(0, totalSales - totalCogs);
  const totalExpensesAmt = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = grossProfit - totalExpensesAmt;

  const pendingOrders = validOrders.filter(o => o.order_status === 'Pending').length;
  const completedOrders = validOrders.filter(o => o.order_status === 'Completed').length;
  const cancelledOrders = orders.filter(o => o.order_status === 'Cancelled').length;

  return {
    totalSales: Number(totalSales.toFixed(2)),
    totalExpenses: Number(totalExpensesAmt.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    totalOrdersCount: orders.length,
    validOrdersCount: validOrders.length,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    averageOrderValue: validOrders.length > 0 ? Number((totalSales / validOrders.length).toFixed(2)) : 0
  };
};
