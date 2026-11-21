import React, { useState, useEffect } from 'react';
import { Menu, PlusCircle, RefreshCw, Clock, IndianRupee } from 'lucide-react';

export default function Header({
  title,
  subtitle,
  setMobileOpen,
  onNewOrderClick,
  onRefresh,
  isRefreshing,
  todaySales = 0
}) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      // Format in IST
      const options = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setTimeStr(new Intl.DateTimeFormat('en-IN', options).format(now));
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-xs">
      {/* Left side: Hamburger + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-stone-500 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      {/* Right side: Live Clock, Today Quick Pill, Refresh & New Order */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Today's Quick Sales Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-semibold">
          <span className="text-amber-700">Today:</span>
          <span>₹{Number(todaySales || 0).toLocaleString('en-IN')}</span>
        </div>

        {/* Live IST Clock */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-600 text-xs font-medium font-mono">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          <span>{timeStr || 'Loading clock...'}</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh data"
          className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition border border-stone-200"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
        </button>

        {/* New Order Button */}
        {onNewOrderClick && (
          <button
            onClick={onNewOrderClick}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-amber-600/30 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden xs:inline">New Order</span>
          </button>
        )}
      </div>
    </header>
  );
}
