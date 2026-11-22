import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Clock,
  Calendar,
  AlertTriangle,
  Award,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { syncWithServer } from '../utils/persistentSync.js';

export default function AnalyticsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30days'); // 'today', '7days', '30days', 'month', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    fetchDetailedAnalytics();
  }, [range]);

  const fetchDetailedAnalytics = async () => {
    setLoading(true);
    try {
      await syncWithServer();
      let url = `/api/analytics/detailed?range=${range}`;
      if (range === 'custom' && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customStart && customEnd) fetchDetailedAnalytics();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full" />
          <span className="text-sm font-medium text-stone-500">Compiling financial & sales performance...</span>
        </div>
      </div>
    );
  }

  const {
    metrics = {},
    paymentMethods = {},
    hourlyDistribution = [],
    weekdayDistribution = [],
    peakHour,
    busiestDay,
    productBreakdown = [],
    categoryBreakdown = [],
    lowMarginProducts = []
  } = data || {};

  const maxHourOrders = Math.max(...hourlyDistribution.map(h => h.orders), 1);
  const maxDayOrders = Math.max(...weekdayDistribution.map(d => d.orders), 1);

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto space-y-6">
      {/* Date Range Selector */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {[
            { id: 'today', label: 'Today' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'custom', label: 'Custom Range' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                range === r.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg"
              required
            />
            <span>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg"
              required
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold"
            >
              Go
            </button>
          </form>
        )}
      </div>

      {/* Accounting Formula Banner: Net Sales -> Gross Profit -> Net Profit */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Accurate Accounting Breakdown ({range})
            </span>
          </div>
          <span className="text-xs text-stone-400 font-medium">Standard Retail P&L Formula</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 text-center">
          {/* Revenue */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[11px] font-bold text-stone-500 uppercase">Gross Revenue</span>
            <div className="text-xl font-black text-stone-900 mt-1">
              ₹{(metrics.grossSalesRevenue || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">Total tickets billed</div>
          </div>

          {/* Discounts & Net Sales */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[11px] font-bold text-stone-500 uppercase">Net Sales</span>
            <div className="text-xl font-black text-stone-900 mt-1">
              ₹{(metrics.netSales || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">
              Less ₹{metrics.discounts || 0} disc, ₹{metrics.taxes || 0} tax
            </div>
          </div>

          {/* Cost of Goods Sold (COGS) */}
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
            <span className="text-[11px] font-bold text-amber-900 uppercase">Cost of Goods (COGS)</span>
            <div className="text-xl font-black text-amber-900 mt-1">
              ₹{(metrics.costOfGoodsSold || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-amber-800 mt-0.5">Raw materials & packaging</div>
          </div>

          {/* Gross Profit */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-900 uppercase">Gross Profit</span>
            <div className="text-xl font-black text-emerald-700 mt-1">
              ₹{(metrics.grossProfit || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-emerald-800 font-semibold mt-0.5">
              {metrics.grossProfitMarginPct}% Gross Margin
            </div>
          </div>

          {/* Net Profit */}
          <div className="p-3 bg-stone-900 text-white rounded-xl border border-stone-800 shadow-sm">
            <span className="text-[11px] font-bold text-amber-400 uppercase">Net Business Profit</span>
            <div className="text-xl font-black text-amber-400 mt-1">
              ₹{(metrics.netProfit || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">
              After ₹{metrics.operatingExpenses || 0} expenses
            </div>
          </div>
        </div>
      </div>

      {/* Peak Hours & Busiest Weekday Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Hours Chart */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Peak Business Hours</span>
              </h3>
              <p className="text-xs text-stone-500">Order distribution across times of the day</p>
            </div>
            {peakHour && peakHour.orders > 0 && (
              <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-lg">
                Peak: {peakHour.hourLabel} ({peakHour.orders} orders)
              </span>
            )}
          </div>

          {/* 24-hr Bar chart (SVG / HTML) */}
          <div className="h-44 flex items-end gap-1 pt-6 px-1 border-b border-stone-200 overflow-x-auto scrollbar-none">
            {hourlyDistribution.map((h, i) => {
              const pct = maxHourOrders > 0 ? Math.round((h.orders / maxHourOrders) * 100) : 0;
              return (
                <div key={i} className="flex-1 min-w-[14px] flex flex-col items-center h-full justify-end group relative">
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[9px] py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-20">
                    {h.hourLabel}: {h.orders} orders (₹{h.sales})
                  </div>
                  <div
                    style={{ height: `${Math.max(4, pct)}%` }}
                    className={`w-full rounded-t-sm transition-all ${
                      h.orders > 0 ? 'bg-amber-500 group-hover:bg-amber-600' : 'bg-stone-100'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-[10px] text-stone-400 font-mono px-1">
            <span>00:00 (Midnight)</span>
            <span>12:00 (Noon)</span>
            <span>23:00 (Night)</span>
          </div>
        </div>

        {/* Busiest Weekday Chart */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Busiest Days of the Week</span>
              </h3>
              <p className="text-xs text-stone-500">Customer footfall by day</p>
            </div>
            {busiestDay && busiestDay.orders > 0 && (
              <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-2.5 py-1 rounded-lg">
                Top Day: {busiestDay.day} ({busiestDay.orders} orders)
              </span>
            )}
          </div>

          <div className="h-44 flex items-end gap-3 pt-6 px-3 border-b border-stone-200">
            {weekdayDistribution.map((d, i) => {
              const pct = maxDayOrders > 0 ? Math.round((d.orders / maxDayOrders) * 100) : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[9px] py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-20">
                    {d.day}: {d.orders} orders (₹{d.sales})
                  </div>
                  <div
                    style={{ height: `${Math.max(6, pct)}%` }}
                    className={`w-full max-w-[40px] rounded-t-md transition-all ${
                      d.orders > 0 ? 'bg-amber-600 group-hover:bg-amber-700' : 'bg-stone-100'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-xs text-stone-600 font-semibold px-2">
            {weekdayDistribution.map((d, i) => (
              <span key={i} className="flex-1 text-center">{d.day}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Product Profitability Ranking & Low Margins warning */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Full Product Performance Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Product Profitability Breakdown</h3>
              <p className="text-xs text-stone-500">Sales revenue, COGS, and exact profit margin per item</p>
            </div>
            <span className="text-xs text-stone-500 font-medium">Sorted by Revenue</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100/80 border-b border-stone-200 text-[10px] font-bold uppercase text-stone-600">
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-2 text-center">Units</th>
                  <th className="py-2.5 px-2 text-right">Revenue</th>
                  <th className="py-2.5 px-2 text-right">COGS</th>
                  <th className="py-2.5 px-2 text-right">Gross Profit</th>
                  <th className="py-2.5 px-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {productBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-stone-400">
                      No sales data in this date range.
                    </td>
                  </tr>
                ) : (
                  productBreakdown.map((prod, idx) => (
                    <tr key={idx} className="hover:bg-stone-50 transition">
                      <td className="py-2.5 px-3 font-medium text-stone-900">
                        {prod.product_name}
                        <span className="text-[10px] text-stone-400 block font-normal">{prod.category_name}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold">{prod.quantity_sold}</td>
                      <td className="py-2.5 px-2 text-right font-extrabold text-stone-900">₹{prod.revenue}</td>
                      <td className="py-2.5 px-2 text-right text-stone-500">₹{prod.cogs}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-emerald-700">₹{prod.gross_profit}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          prod.margin_pct >= 40
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {prod.margin_pct}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Margin Alerts & Payment Breakdown */}
        <div className="space-y-4">
          {/* Low Margin Warning */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="font-bold text-sm">Low Profit Margin Products</h4>
            </div>

            {lowMarginProducts.length === 0 ? (
              <p className="text-xs text-stone-500">
                All selling products have healthy gross margins (40%+). Great job!
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-stone-500">
                  Products with profit margin under 35%. Consider reviewing ingredient costs or adjusting pricing:
                </p>
                {lowMarginProducts.map((p, idx) => (
                  <div key={idx} className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-rose-950 block">{p.product_name}</span>
                      <span className="text-[10px] text-rose-700">Sold: {p.quantity_sold} units</span>
                    </div>
                    <span className="font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                      {p.margin_pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method Distribution */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-amber-600" />
              <span>Payment Mode Breakdown</span>
            </h4>

            <div className="space-y-2">
              {['UPI', 'Cash', 'Card', 'Other'].map(method => {
                const amt = paymentMethods[method] || 0;
                const totalRev = metrics.grossSalesRevenue || 1;
                const pct = Math.round((amt / totalRev) * 100);

                return (
                  <div key={method} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-stone-700">{method}</span>
                      <span className="font-bold text-stone-900">₹{amt.toLocaleString('en-IN')} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${
                          method === 'UPI' ? 'bg-amber-600' : method === 'Cash' ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
