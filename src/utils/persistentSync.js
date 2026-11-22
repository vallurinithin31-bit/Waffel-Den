// Client-side persistent storage, user authentication & serverless rehydration sync for Waffel Den
// Guarantees all entered orders, expenses, custom products, and daily closings are strictly isolated
// per user account and persist permanently across browser refreshes, Vercel cold-starts, and device restarts.

export const AUTH_USER_KEY = 'waffelden_auth_current_user_v1';

// --- Current User Authentication State ---
export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const setCurrentUser = (user, token) => {
  try {
    const fullUser = { ...user, token: token || user.token };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(fullUser));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('waffelden_auth_changed', { detail: fullUser }));
      window.dispatchEvent(new CustomEvent('waffelden_local_data_changed'));
    }
  } catch (e) {
    console.warn('Error setting current user:', e);
  }
};

export const logoutUser = () => {
  try {
    localStorage.removeItem(AUTH_USER_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('waffelden_auth_changed', { detail: null }));
      window.dispatchEvent(new CustomEvent('waffelden_local_data_changed'));
    }
  } catch (e) {
    console.warn('Error logging out:', e);
  }
};

// Automatic fetch interceptor for all /api calls
if (typeof window !== 'undefined' && !window.__waffelden_fetch_intercepted) {
  window.__waffelden_fetch_intercepted = true;
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const user = getCurrentUser();
      if (user?.id) {
        options = options || {};
        const headers = options.headers || {};
        if (headers instanceof Headers) {
          headers.set('x-user-id', String(user.id));
          if (user.token) headers.set('Authorization', `Bearer ${user.token}`);
          options.headers = headers;
        } else if (Array.isArray(headers)) {
          headers.push(['x-user-id', String(user.id)]);
          if (user.token) headers.push(['Authorization', `Bearer ${user.token}`]);
          options.headers = headers;
        } else {
          options.headers = {
            ...headers,
            'x-user-id': String(user.id),
            ...(user.token ? { 'Authorization': `Bearer ${user.token}` } : {})
          };
        }
      }
    }
    return originalFetch.call(this, url, options);
  };
}

// User-scoped Local Storage Key Generator
const getUserKey = (base) => {
  const user = getCurrentUser();
  const uid = user ? user.id : 'default';
  return `waffelden_${base}_u${uid}_v1`;
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

// --- Orders Persistence (User-Scoped) ---
export const getLocalOrders = () => {
  const key = getUserKey('orders');
  let orders = safeGetJSON(key, null);
  // Migrate from un-scoped legacy key if needed
  if (orders === null) {
    const legacy = safeGetJSON('waffelden_orders_v1', null);
    if (legacy !== null) {
      safeSetJSON(key, legacy);
      orders = legacy;
    } else {
      orders = [];
    }
  }
  return orders;
};

export const saveLocalOrder = (order) => {
  if (!order || (!order.order_number && !order.id)) return;
  const user = getCurrentUser();
  const orderWithUser = { ...order, user_id: user?.id || order.user_id || 1 };

  const orders = getLocalOrders();
  const existingIdx = orders.findIndex(o => 
    (orderWithUser.order_number && o.order_number === orderWithUser.order_number) || 
    (orderWithUser.id && o.id === orderWithUser.id)
  );

  if (existingIdx >= 0) {
    orders[existingIdx] = { ...orders[existingIdx], ...orderWithUser };
  } else {
    orders.unshift(orderWithUser); // Put newest first
  }
  safeSetJSON(getUserKey('orders'), orders);
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
    safeSetJSON(getUserKey('orders'), updatedOrders);
    triggerSyncNotification();
  }
};

// --- Expenses Persistence (User-Scoped) ---
export const getLocalExpenses = () => {
  const key = getUserKey('expenses');
  let exps = safeGetJSON(key, null);
  if (exps === null) {
    const legacy = safeGetJSON('waffelden_expenses_v1', null);
    if (legacy !== null) {
      safeSetJSON(key, legacy);
      exps = legacy;
    } else {
      exps = [];
    }
  }
  return exps;
};

export const saveLocalExpense = (expense) => {
  if (!expense) return;
  const user = getCurrentUser();
  const expWithUser = { ...expense, user_id: user?.id || expense.user_id || 1 };

  const expenses = getLocalExpenses();
  const key = `${expWithUser.category}_${expWithUser.description || expWithUser.title || ''}_${expWithUser.date}_${expWithUser.amount}`;
  const existingIdx = expenses.findIndex(e => {
    const eKey = `${e.category}_${e.description || e.title || ''}_${e.date}_${e.amount}`;
    return (expWithUser.id && e.id === expWithUser.id) || eKey === key;
  });

  if (existingIdx >= 0) {
    expenses[existingIdx] = { ...expenses[existingIdx], ...expWithUser };
  } else {
    expenses.unshift(expWithUser);
  }
  safeSetJSON(getUserKey('expenses'), expenses);
  triggerSyncNotification();
};

export const deleteLocalExpense = (idOrKey) => {
  const expenses = getLocalExpenses();
  const filtered = expenses.filter(e => {
    const key = `${e.category}_${e.description || e.title || ''}_${e.date}_${e.amount}`;
    return e.id !== idOrKey && key !== idOrKey;
  });
  safeSetJSON(getUserKey('expenses'), filtered);
  triggerSyncNotification();
};

// --- Custom Products Persistence (User-Scoped) ---
export const getLocalCustomProducts = () => safeGetJSON(getUserKey('custom_products'), []);

export const saveLocalCustomProduct = (product) => {
  if (!product || !product.name) return;
  const user = getCurrentUser();
  const prodWithUser = { ...product, user_id: user?.id || product.user_id || 1 };

  const products = getLocalCustomProducts();
  const existingIdx = products.findIndex(p => p.name.trim().toLowerCase() === prodWithUser.name.trim().toLowerCase());

  if (existingIdx >= 0) {
    products[existingIdx] = { ...products[existingIdx], ...prodWithUser };
  } else {
    products.push(prodWithUser);
  }
  safeSetJSON(getUserKey('custom_products'), products);
  triggerSyncNotification();
};

// --- Daily Closings Persistence (User-Scoped) ---
export const getLocalClosings = () => safeGetJSON(getUserKey('closings'), []);

export const saveLocalClosing = (closing) => {
  if (!closing || !closing.closing_date) return;
  const user = getCurrentUser();
  const clsWithUser = { ...closing, user_id: user?.id || closing.user_id || 1 };

  const closings = getLocalClosings();
  const existingIdx = closings.findIndex(c => c.closing_date === clsWithUser.closing_date);

  if (existingIdx >= 0) {
    closings[existingIdx] = { ...closings[existingIdx], ...clsWithUser };
  } else {
    closings.unshift(clsWithUser);
  }
  safeSetJSON(getUserKey('closings'), closings);
  triggerSyncNotification();
};

// --- Settings Persistence (User-Scoped) ---
export const getLocalSettings = () => safeGetJSON(getUserKey('settings'), {});

export const saveLocalSettings = (settings) => {
  if (!settings) return;
  const current = getLocalSettings();
  const merged = { ...current, ...settings };
  safeSetJSON(getUserKey('settings'), merged);
  triggerSyncNotification();
};

// Helper event dispatcher to inform UI of sync/storage changes
export const triggerSyncNotification = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('waffelden_local_data_changed'));
  }
};

// --- Master Sync: Push current user's local snapshot + pull current user's server snapshot ---
let isSyncing = false;

export const syncWithServer = async () => {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const user = getCurrentUser();
    const headers = { 'Content-Type': 'application/json' };
    if (user?.id) {
      headers['x-user-id'] = String(user.id);
      if (user.token) headers['Authorization'] = `Bearer ${user.token}`;
    }

    const localOrders = getLocalOrders();
    const localExpenses = getLocalExpenses();
    const localProducts = getLocalCustomProducts();
    const localClosings = getLocalClosings();
    const localSettings = getLocalSettings();

    // Step 1: Push user's local data to server
    if (localOrders.length > 0 || localExpenses.length > 0 || localProducts.length > 0 || localClosings.length > 0) {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers,
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

    // Step 2: Fetch current user's server snapshot
    try {
      const getRes = await fetch('/api/sync', { headers });
      if (getRes.ok) {
        const serverSnapshot = await getRes.json();

        // Merge orders
        if (Array.isArray(serverSnapshot.orders)) {
          const mergedOrdersMap = new Map();
          for (const ord of serverSnapshot.orders) {
            if (ord.order_number) mergedOrdersMap.set(ord.order_number, ord);
          }
          for (const ord of localOrders) {
            if (ord.order_number && !mergedOrdersMap.has(ord.order_number)) {
              mergedOrdersMap.set(ord.order_number, ord);
            }
          }
          const finalOrders = Array.from(mergedOrdersMap.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
          safeSetJSON(getUserKey('orders'), finalOrders);
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
          safeSetJSON(getUserKey('expenses'), Array.from(mergedExpensesMap.values()));
        }

        // Merge custom products
        if (Array.isArray(serverSnapshot.products)) {
          const customServerProds = serverSnapshot.products.filter(p => p.is_active === 1 && p.user_id === user?.id);
          const mergedProdsMap = new Map();
          for (const p of customServerProds) {
            if (p.name) mergedProdsMap.set(p.name.trim().toLowerCase(), p);
          }
          for (const p of localProducts) {
            if (p.name && !mergedProdsMap.has(p.name.trim().toLowerCase())) {
              mergedProdsMap.set(p.name.trim().toLowerCase(), p);
            }
          }
          safeSetJSON(getUserKey('custom_products'), Array.from(mergedProdsMap.values()));
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
          safeSetJSON(getUserKey('closings'), Array.from(closingsMap.values()));
        }

        // Merge settings
        if (serverSnapshot.settings && typeof serverSnapshot.settings === 'object') {
          const mergedSettings = { ...localSettings, ...serverSnapshot.settings };
          safeSetJSON(getUserKey('settings'), mergedSettings);
        }

        safeSetJSON(`waffelden_last_sync_u${user?.id || 1}`, new Date().toISOString());
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
