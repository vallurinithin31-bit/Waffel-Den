import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  IndianRupee,
  CheckCircle,
  Clock,
  XCircle,
  Award,
  DollarSign,
  PieChart,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard
} from 'lucide-react';
import { getLocalDashboardMetrics, syncWithServer } from '../utils/persistentSync.js';

export default function DashboardView({ onNavigateToNewOrder, onNavigateToOrders }) {
  const [data, setData] = useState(() => getLocalDashboardMetrics('today'));
  const [loading, setLoading] = useState(false);
  const [selectedRange, setSelectedRange] = useState('today'); // 'today', 'yesterday', '7days', '30days', 'month', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartMetric, setChartMetric] = useState('sales'); // 'sales' or 'netProfit'

  useEffect(() => {
    fetchDashboardData();

    const handleLocalUpdate = () => {
      const local = getLocalDashboardMetrics(selectedRange);
      setData(prev => ({
        ...(prev || {}),
        ...local,
        totalSales: Math.max(prev?.totalSales || 0, local.totalSales),
        grossProfit: Math.max(prev?.grossProfit || 0, local.grossProfit),
        netProfit: prev?.netProfit !== undefined ? Math.max(prev.netProfit, local.netProfit) : local.netProfit,
        totalOrdersCount: Math.max(prev?.totalOrdersCount || 0, local.totalOrdersCount)
      }));
    };

    window.addEventListener('waffelden_local_data_changed', handleLocalUpdate);
    return () => window.removeEventListener('waffelden_local_data_changed', handleLocalUpdate);
  }, [selectedRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await syncWithServer();
      let url = `/api/analytics/dashboard?range=${selectedRange}`;
      if (selectedRange === 'custom' && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      
      const local = getLocalDashboardMetrics(selectedRange);
      // If server returned 0 on a cold start or before sync processed, fallback to local metrics
      const merged = {
        ...json,
        totalSales: json.totalSales || local.totalSales,
        totalExpenses: json.totalExpenses || local.totalExpenses,
        grossProfit: json.grossProfit || local.grossProfit,
        netProfit: (json.netProfit !== undefined && json.totalSales > 0) ? json.netProfit : local.netProfit,
        totalOrdersCount: json.totalOrdersCount || local.totalOrdersCount,
        validOrdersCount: json.validOrdersCount || local.validOrdersCount,
        completedOrders: json.completedOrders || local.completedOrders,
        pendingOrders: json.pendingOrders || local.pendingOrders,
        cancelledOrders: json.cancelledOrders || local.cancelledOrders,
        averageOrderValue: json.averageOrderValue || local.averageOrderValue
      };
      setData(merged);
    } catch (err) {
      console.warn('Dashboard fetch notice, using persistent local metrics:', err);
      setData(getLocalDashboardMetrics(selectedRange));
    } finally {
      setLoading(false);
    }
  };

  const handleCustomFilter = (e) => {
    e.preventDefault();
    if (customStart && customEnd) {
      fetchDashboardData();
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full" />
          <span className="text-sm font-medium text-stone-500">Calculating real-time shop performance...</span>
        </div>
      </div>
    );
  }

  const {
    totalSales = 0,
    totalExpenses = 0,
    grossProfit = 0,
    netProfit = 0,
    totalOrdersCount = 0,
    validOrdersCount = 0,
    completedOrders = 0,
    pendingOrders = 0,
    cancelledOrders = 0,
    paidOrdersCount = 0,
    unpaidOrdersCount = 0,
    partiallyPaidOrdersCount = 0,
    averageOrderValue = 0,
    bestSelling,
    mostProfitable,
    comparisonVsYesterday,
    trend = []
  } = data || {};

  // Maximum value for SVG chart scaling
  const maxTrendVal = Math.max(
    ...trend.map(t => (chartMetric === 'sales' ? t.sales : Math.max(0, t.netProfit))),
    100
  );

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto space-y-6">
      {/* Date Range Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Quick Range Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold w-full md:w-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'custom', label: 'Custom Range' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRange(r.id)}
              className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                selectedRange === r.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Custom Date Form */}
        {selectedRange === 'custom' && (
          <form onSubmit={handleCustomFilter} className="flex items-center gap-2 text-xs w-full md:w-auto">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none"
              required
            />
            <span className="text-stone-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none"
              required
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition"
            >
              Apply
            </button>
          </form>
        )}

        {/* Yesterday Comparison Badge */}
        {selectedRange === 'today' && comparisonVsYesterday && (
          <div className="flex items-center gap-2 text-xs font-medium bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
            <span className="text-stone-500">Vs Yesterday:</span>
            <div className={`flex items-center gap-1 font-bold ${
              comparisonVsYesterday.diff >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              {comparisonVsYesterday.diff >= 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>
                {comparisonVsYesterday.diff >= 0 ? '+' : ''}₹{comparisonVsYesterday.diff.toLocaleString('en-IN')}
                {comparisonVsYesterday.percent !== 0 && ` (${comparisonVsYesterday.percent}%)`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales Card */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Total Sales</span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-stone-900 tracking-tight">
              ₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
              <span>{validOrdersCount} completed orders</span>
              <span>•</span>
              <span>AOV: ₹{averageOrderValue}</span>
            </div>
          </div>
        </div>

        {/* Gross Profit Card */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Gross Profit</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-700 tracking-tight">
              ₹{grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Sales minus item ingredient & unit costs
            </div>
          </div>
        </div>

        {/* Operating Expenses Card */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Shop Expenses</span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-800">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-rose-600 tracking-tight">
              ₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-stone-500 mt-1">
              Operating costs (rent, power, salaries, etc.)
            </div>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="bg-gradient-to-br from-stone-900 to-stone-950 text-white rounded-2xl p-5 border border-stone-800 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Net Business Profit</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-3xl font-black tracking-tight ${netProfit >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
              ₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-stone-400 mt-1">
              Gross Profit − Operating Expenses
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Status & Order Pipeline Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold text-stone-500 uppercase">Total Tickets</div>
          <div className="text-xl font-bold text-stone-900 mt-1">{totalOrdersCount}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Completed</span>
          </div>
          <div className="text-xl font-bold text-emerald-800 mt-1">{completedOrders}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-700 uppercase flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending/Prep</span>
          </div>
          <div className="text-xl font-bold text-amber-800 mt-1">{pendingOrders}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold text-rose-700 uppercase flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </div>
          <div className="text-xl font-bold text-rose-800 mt-1">{cancelledOrders}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold text-stone-600 uppercase flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Paid In Full</span>
          </div>
          <div className="text-xl font-bold text-stone-800 mt-1">{paidOrdersCount}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-[11px] font-semibold text-rose-600 uppercase">
            <span>Unpaid / Balance</span>
          </div>
          <div className="text-xl font-bold text-rose-700 mt-1">
            {unpaidOrdersCount + partiallyPaidOrdersCount}
          </div>
        </div>
      </div>

      {/* Chart & Top Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Line / Bar Chart (SVG) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
            <div>
              <h3 className="font-bold text-stone-900 text-base">Sales & Profit Trend</h3>
              <p className="text-xs text-stone-500">Daily business momentum and net returns</p>
            </div>

            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setChartMetric('sales')}
                className={`px-3 py-1 rounded-lg transition ${
                  chartMetric === 'sales' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Sales (₹)
              </button>
              <button
                onClick={() => setChartMetric('netProfit')}
                className={`px-3 py-1 rounded-lg transition ${
                  chartMetric === 'netProfit' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                Net Profit (₹)
              </button>
            </div>
          </div>

          {/* Interactive SVG Chart */}
          <div className="py-6">
            {trend.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-stone-400 text-xs">
                No orders recorded in this date window yet.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-52 flex items-end gap-2 pt-6 px-2 border-b border-stone-200">
                  {trend.map((pt, i) => {
                    const val = chartMetric === 'sales' ? pt.sales : Math.max(0, pt.netProfit);
                    const pct = Math.max(4, Math.round((val / maxTrendVal) * 100));

                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative"
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                          <div className="font-bold">{pt.date}</div>
                          <div>Sales: ₹{pt.sales} • Profit: ₹{pt.netProfit}</div>
                        </div>

                        <div
                          style={{ height: `${pct}%` }}
                          className={`w-full max-w-[36px] rounded-t-md transition-all ${
                            chartMetric === 'sales'
                              ? 'bg-amber-500 group-hover:bg-amber-600'
                              : 'bg-emerald-600 group-hover:bg-emerald-700'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X-axis labels */}
                <div className="flex items-center justify-between text-[10px] text-stone-400 px-2 font-mono">
                  {trend.map((pt, i) => (
                    <span key={i} className="flex-1 text-center truncate">
                      {pt.displayDate}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <span className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded ${chartMetric === 'sales' ? 'bg-amber-500' : 'bg-emerald-600'}`} />
              <span>{chartMetric === 'sales' ? 'Daily Sales Volume' : 'Net Business Returns'}</span>
            </span>
            <button
              onClick={onNavigateToOrders}
              className="text-amber-700 font-semibold hover:underline cursor-pointer"
            >
              View Order History →
            </button>
          </div>
        </div>

        {/* Best Seller & Most Profitable Side Card */}
        <div className="space-y-4">
          {/* Best-selling waffle */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                🥇
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Top Best-Seller</span>
                <h4 className="font-bold text-stone-900 text-sm">
                  {bestSelling ? bestSelling.product_name : 'No sales recorded yet'}
                </h4>
              </div>
            </div>

            {bestSelling && (
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/60 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-600">Category:</span>
                  <span className="font-semibold text-stone-900">{bestSelling.category_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Total Units Sold:</span>
                  <span className="font-bold text-amber-900">{bestSelling.total_qty} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Total Revenue:</span>
                  <span className="font-extrabold text-stone-900">₹{bestSelling.total_revenue}</span>
                </div>
              </div>
            )}
          </div>

          {/* Most Profitable product */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                💎
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Most Profitable Product</span>
                <h4 className="font-bold text-stone-900 text-sm">
                  {mostProfitable ? mostProfitable.product_name : 'No sales recorded yet'}
                </h4>
              </div>
            </div>

            {mostProfitable && (
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/60 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-600">Units Sold:</span>
                  <span className="font-semibold text-stone-900">{mostProfitable.total_qty} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Gross Profit Contribution:</span>
                  <span className="font-bold text-emerald-800">₹{mostProfitable.total_profit?.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Order Button */}
          <button
            onClick={onNavigateToNewOrder}
            className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Open New Order Counter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
