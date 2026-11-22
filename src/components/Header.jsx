import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  PlusCircle, 
  RefreshCw, 
  Clock, 
  User, 
  LogOut, 
  Users, 
  ChevronDown, 
  ShieldCheck 
} from 'lucide-react';

export default function Header({
  title,
  subtitle,
  setMobileOpen,
  onNewOrderClick,
  onRefresh,
  isRefreshing,
  todaySales = 0,
  currentUser,
  onOpenAuth,
  onLogout
}) {
  const [timeStr, setTimeStr] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function updateClock() {
      const now = new Date();
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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 px-4 lg:px-8 py-3 flex items-center justify-between shadow-xs">
      {/* Left side: Hamburger + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
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

      {/* Right side: Live Clock, Today Quick Pill, User Pill & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
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
          className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition border border-stone-200 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
        </button>

        {/* New Order Button */}
        {onNewOrderClick && (
          <button
            onClick={onNewOrderClick}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-amber-600/30 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden xs:inline">New Order</span>
          </button>
        )}

        {/* User Account / Profile Button & Dropdown */}
        <div className="relative" ref={dropdownRef}>
          {currentUser ? (
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1.5 pl-2 rounded-xl bg-stone-100 hover:bg-stone-200/70 border border-stone-200 transition cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {userInitial}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-stone-900 leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-stone-500 capitalize leading-tight">
                  {currentUser.role || 'User'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 mr-0.5" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* Account Menu Dropdown */}
          {dropdownOpen && currentUser && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-stone-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2.5 border-b border-stone-100">
                <div className="text-xs font-bold text-stone-900">{currentUser.name}</div>
                <div className="text-[11px] text-stone-500 font-mono">@{currentUser.username}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md w-fit">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="capitalize">{currentUser.shop_name || 'Waffel Den'}</span>
                </div>
              </div>

              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    if (onOpenAuth) onOpenAuth();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                >
                  <Users className="w-4 h-4 text-stone-400" />
                  <span>Switch / Add Account</span>
                </button>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Log Out of Account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
