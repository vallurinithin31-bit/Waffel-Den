import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Receipt,
  UtensilsCrossed,
  TrendingUp,
  ReceiptIndianRupee,
  Boxes,
  Lock,
  FileSpreadsheet,
  Settings,
  Coffee,
  X
} from 'lucide-react';

export default function Sidebar({
  currentView,
  setCurrentView,
  pendingOrdersCount = 0,
  lowStockCount = 0,
  mobileOpen,
  setMobileOpen,
  shopName = 'Waffel Den'
}) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new_order', label: 'New Order', icon: PlusCircle, highlight: true },
    { id: 'orders', label: 'Orders & History', icon: Receipt, badge: pendingOrdersCount > 0 ? pendingOrdersCount : null },
    { id: 'menu', label: 'Menu & Products', icon: UtensilsCrossed },
    { id: 'analytics', label: 'Sales & Profit', icon: TrendingUp },
    { id: 'expenses', label: 'Expenses', icon: ReceiptIndianRupee },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes, badge: lowStockCount > 0 ? lowStockCount : null, badgeColor: 'bg-rose-500' },
    { id: 'closing', label: 'Daily Closing', icon: Lock },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-stone-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-72 bg-stone-900 text-stone-200 flex flex-col border-r border-stone-800 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand header */}
        <div className="p-5 flex items-center justify-between border-b border-stone-800/80 bg-stone-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-900/40 font-bold text-xl">
              🧇
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight leading-tight">{shopName}</h1>
              <span className="text-xs text-amber-400/90 font-medium tracking-wide uppercase">Counter & Operations</span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? item.highlight
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-700/30'
                      : 'bg-stone-800 text-amber-400 shadow-sm border border-stone-700/50'
                    : item.highlight
                    ? 'text-amber-300 hover:bg-amber-950/40 border border-amber-500/20'
                    : 'text-stone-300 hover:bg-stone-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? (item.highlight ? 'text-white' : 'text-amber-400') : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${
                      item.badgeColor || 'bg-amber-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Shop Footer Status */}
        <div className="p-4 border-t border-stone-800/80 bg-stone-950/30 text-xs text-stone-400">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>POS Connected</span>
            </span>
            <span className="text-stone-400 font-mono">IST (UTC+5:30)</span>
          </div>
          <div className="text-[11px] text-stone-500">
            Internal shop counter system • ₹ INR
          </div>
        </div>
      </aside>
    </>
  );
}
