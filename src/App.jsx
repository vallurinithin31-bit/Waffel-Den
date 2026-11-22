import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import DashboardView from './views/DashboardView.jsx';
import NewOrderView from './views/NewOrderView.jsx';
import OrdersView from './views/OrdersView.jsx';
import ProductsView from './views/ProductsView.jsx';
import AnalyticsView from './views/AnalyticsView.jsx';
import ExpensesView from './views/ExpensesView.jsx';
import InventoryView from './views/InventoryView.jsx';
import DailyClosingView from './views/DailyClosingView.jsx';
import ReportsView from './views/ReportsView.jsx';
import SettingsView from './views/SettingsView.jsx';
import { 
  syncWithServer, 
  getLocalDashboardMetrics, 
  getLocalSettings, 
  saveLocalSettings 
} from './utils/persistentSync.js';

export default function App() {
  const [currentView, setCurrentView] = useState('new_order'); // Default to Counter Order Entry for fastest shop operations
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settings, setSettings] = useState(() => getLocalSettings());
  const [todaySales, setTodaySales] = useState(() => getLocalDashboardMetrics('today').totalSales);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(() => getLocalDashboardMetrics('today').pendingOrders);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchGlobalMetadata = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // First ensure server is synchronized with client persistent data
      await syncWithServer();

      const [setRes, dashRes, invRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/analytics/dashboard?range=today'),
        fetch('/api/inventory/alerts')
      ]);

      const setData = await setRes.json();
      const dashData = await dashRes.json();
      const invAlerts = await invRes.json();

      if (setData && typeof setData === 'object') {
        setSettings(prev => ({ ...prev, ...setData }));
        saveLocalSettings(setData);
      }
      
      const localMetrics = getLocalDashboardMetrics('today');
      setTodaySales(dashData.totalSales || localMetrics.totalSales || 0);
      setPendingOrdersCount(dashData.pendingOrders ?? localMetrics.pendingOrders ?? 0);
      setLowStockCount(Array.isArray(invAlerts) ? invAlerts.length : 0);
    } catch (err) {
      console.warn('Network sync notice, using local cache:', err);
      const localMetrics = getLocalDashboardMetrics('today');
      setTodaySales(localMetrics.totalSales);
      setPendingOrdersCount(localMetrics.pendingOrders);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalMetadata();

    const handleLocalChange = () => {
      const localMetrics = getLocalDashboardMetrics('today');
      setTodaySales(localMetrics.totalSales);
      setPendingOrdersCount(localMetrics.pendingOrders);
    };

    window.addEventListener('waffelden_local_data_changed', handleLocalChange);
    return () => window.removeEventListener('waffelden_local_data_changed', handleLocalChange);
  }, [fetchGlobalMetadata, refreshTrigger]);

  // Keyboard shortcuts (F2 for New Order, F1 for Dashboard)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setCurrentView('new_order');
      } else if (e.key === 'F1') {
        e.preventDefault();
        setCurrentView('dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleOrderCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // View titles and subtitles mapping
  const viewMeta = {
    dashboard: {
      title: 'Performance Dashboard',
      subtitle: 'Real-time sales, profitability metrics, and business momentum'
    },
    new_order: {
      title: 'Counter Quick Order Entry',
      subtitle: 'Rapid customer ticketing, visual menu, instant calculations & receipts'
    },
    orders: {
      title: 'Orders & Sales Ledger',
      subtitle: 'Complete searchable order history, live status tracking & payment audits'
    },
    menu: {
      title: 'Menu & Product Management',
      subtitle: 'Customize waffles, toppings, selling prices, and unit profit margins'
    },
    analytics: {
      title: 'Sales & Profit Analytics',
      subtitle: 'Comprehensive financial breakdown, peak trading hours & item margins'
    },
    expenses: {
      title: 'Operating Expenses Tracker',
      subtitle: 'Record shop utility bills, rent, packaging, and cash register outflow'
    },
    inventory: {
      title: 'Inventory & Ingredient Stocks',
      subtitle: 'Track chocolate, flour, milk, butter levels, costs & low-stock alerts'
    },
    closing: {
      title: 'Daily Register Closing',
      subtitle: 'Physical cash drawer reconciliation and end-of-day business finalization'
    },
    reports: {
      title: 'Business Reports & CSV Exports',
      subtitle: 'Download accounting spreadsheets, sales summaries, and tax data'
    },
    settings: {
      title: 'Shop Configuration & Backups',
      subtitle: 'Receipt branding, tax rates, currency symbol & database recovery'
    }
  };

  const currentMeta = viewMeta[currentView] || { title: 'Waffel Den', subtitle: '' };

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        pendingOrdersCount={pendingOrdersCount}
        lowStockCount={lowStockCount}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        shopName={settings.shop_name || 'Waffel Den'}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          setMobileOpen={setMobileOpen}
          onNewOrderClick={currentView !== 'new_order' ? () => setCurrentView('new_order') : null}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          todaySales={todaySales}
        />

        {/* View Viewport */}
        <main className="flex-1 overflow-y-auto bg-stone-100/70">
          {currentView === 'dashboard' && (
            <DashboardView
              key={refreshTrigger}
              onNavigateToNewOrder={() => setCurrentView('new_order')}
              onNavigateToOrders={() => setCurrentView('orders')}
            />
          )}

          {currentView === 'new_order' && (
            <NewOrderView
              key={refreshTrigger}
              settings={settings}
              onOrderCreated={handleOrderCreated}
            />
          )}

          {currentView === 'orders' && (
            <OrdersView
              key={refreshTrigger}
              settings={settings}
            />
          )}

          {currentView === 'menu' && (
            <ProductsView key={refreshTrigger} />
          )}

          {currentView === 'analytics' && (
            <AnalyticsView key={refreshTrigger} />
          )}

          {currentView === 'expenses' && (
            <ExpensesView key={refreshTrigger} />
          )}

          {currentView === 'inventory' && (
            <InventoryView key={refreshTrigger} />
          )}

          {currentView === 'closing' && (
            <DailyClosingView key={refreshTrigger} />
          )}

          {currentView === 'reports' && (
            <ReportsView
              key={refreshTrigger}
              settings={settings}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              key={refreshTrigger}
              settings={settings}
              onSettingsUpdated={(newSettings) => {
                setSettings(newSettings);
                handleRefresh();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
