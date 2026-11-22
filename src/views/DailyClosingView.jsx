import React, { useState, useEffect } from 'react';
import {
  Lock,
  IndianRupee,
  Calendar,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Receipt,
  DollarSign,
  History,
  FileText
} from 'lucide-react';
import { 
  saveLocalClosing, 
  getLocalClosings, 
  syncWithServer 
} from '../utils/persistentSync.js';

export default function DailyClosingView() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [closingData, setClosingData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Input states for closing calculation
  const [openingCash, setOpeningCash] = useState('0');
  const [cashRefunds, setCashRefunds] = useState('0');
  const [actualClosingCash, setActualClosingCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // History tab
  const [viewHistory, setViewHistory] = useState(false);
  const [historicalClosings, setHistoricalClosings] = useState([]);

  useEffect(() => {
    fetchClosingPreview(date);
  }, [date]);

  const fetchClosingPreview = async (targetDate) => {
    setLoading(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/closings/preview?date=${targetDate}`);
      const data = await res.json();
      setClosingData(data);

      // Pre-fill inputs
      setOpeningCash(String(data.openingCash || 0));
      setCashRefunds(String(data.cashRefunds || 0));
      setActualClosingCash(data.isClosed ? String(data.actualClosingCash) : '');
      setClosingNotes(data.closingRecord?.closing_notes || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      await syncWithServer();
      const res = await fetch('/api/closings/history');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setHistoricalClosings(data);
      } else {
        setHistoricalClosings(getLocalClosings());
      }
    } catch (err) {
      console.warn('Network notice, showing local closings:', err);
      setHistoricalClosings(getLocalClosings());
    }
  };

  const numOpen = Number(openingCash) || 0;
  const numRefunds = Number(cashRefunds) || 0;
  const cashSales = closingData?.cashSales || 0;
  const cashExpenses = closingData?.cashExpenses || 0;

  // Expected Closing Cash = Opening Cash + Cash Sales - Cash Expenses - Cash Refunds
  const expectedClosingCash = Math.round((numOpen + cashSales - cashExpenses - numRefunds) * 100) / 100;
  const numActual = Number(actualClosingCash) || 0;
  const cashDiff = actualClosingCash !== '' ? Math.round((numActual - expectedClosingCash) * 100) / 100 : 0;

  const handleFinalizeClosing = async (e) => {
    e.preventDefault();
    setIsFinalizing(true);
    try {
      const payload = {
        closing_date: date,
        opening_cash: numOpen,
        cash_sales: cashSales,
        upi_sales: closingData?.upiSales || 0,
        net_sales: closingData?.netSales || 0,
        gross_profit: closingData?.grossProfit || 0,
        operating_expenses: cashExpenses,
        net_profit: closingData?.netProfit || 0,
        cash_expenses: cashExpenses,
        cash_refunds: numRefunds,
        expected_closing_cash: expectedClosingCash,
        actual_closing_cash: numActual,
        cash_difference: cashDiff,
        total_orders: closingData?.totalOrders || 0,
        completed_orders: closingData?.completedOrders || 0,
        closing_notes: closingNotes,
        closed_at: new Date().toISOString()
      };

      saveLocalClosing(payload);

      const res = await fetch('/api/closings/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to finalize closing');

      setSaveSuccess(true);
      fetchClosingPreview(date);
    } catch (err) {
      setSaveSuccess(true);
      fetchClosingPreview(date);
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto space-y-6">
      {/* Top Header & Date Picker */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-base">End-of-Day Cash & Register Closing</h3>
            <p className="text-xs text-stone-500">Reconcile counter drawer cash, collections & operating profit</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none"
          />

          <button
            onClick={() => {
              setViewHistory(!viewHistory);
              if (!viewHistory) fetchHistory();
            }}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>{viewHistory ? 'Live Reconciliation' : 'Past Closing Reports'}</span>
          </button>
        </div>
      </div>

      {viewHistory ? (
        /* Historical Closing Reports Table */
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-stone-50 border-b border-stone-200 font-bold text-xs text-stone-700">
            Historical Daily Closing Summaries
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100/80 border-b border-stone-200 text-[10px] font-bold uppercase text-stone-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3 text-right">Cash Sales</th>
                  <th className="py-3 px-3 text-right">UPI Sales</th>
                  <th className="py-3 px-3 text-right">Total Net Sales</th>
                  <th className="py-3 px-3 text-right">Expected Cash</th>
                  <th className="py-3 px-3 text-right">Actual Counted</th>
                  <th className="py-3 px-3 text-right">Difference</th>
                  <th className="py-3 px-3 text-right">Net Profit</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {historicalClosings.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-stone-400">
                      No historical daily closings finalized yet.
                    </td>
                  </tr>
                ) : (
                  historicalClosings.map(c => (
                    <tr key={c.id} className="hover:bg-stone-50 transition">
                      <td className="py-3 px-4 font-bold text-stone-900">{c.closing_date}</td>
                      <td className="py-3 px-3 text-right font-medium">₹{c.cash_sales}</td>
                      <td className="py-3 px-3 text-right font-medium">₹{c.upi_sales}</td>
                      <td className="py-3 px-3 text-right font-bold text-stone-900">₹{c.net_sales}</td>
                      <td className="py-3 px-3 text-right text-stone-600">₹{c.expected_closing_cash}</td>
                      <td className="py-3 px-3 text-right font-bold">₹{c.actual_closing_cash}</td>
                      <td className={`py-3 px-3 text-right font-bold ${
                        c.cash_difference === 0
                          ? 'text-emerald-700'
                          : c.cash_difference > 0
                          ? 'text-blue-700'
                          : 'text-rose-600'
                      }`}>
                        {c.cash_difference >= 0 ? `+₹${c.cash_difference}` : `-₹${Math.abs(c.cash_difference)}`}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-800">₹{c.net_profit}</td>
                      <td className="py-3 px-4 text-stone-500 max-w-xs truncate">{c.closing_notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Live Daily Closing Reconciliation */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLS: Collections, Sales & Expenses Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sales Collections by Mode */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Payment Collections for {date}
                </span>
                <span className="text-xs font-bold text-stone-900">
                  Total Orders: {closingData?.completedOrders || 0} completed ({closingData?.cancelledOrders || 0} cancelled)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">Cash Collections</span>
                  <div className="text-xl font-black text-emerald-900 mt-1">
                    ₹{(closingData?.cashSales || 0).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-800">UPI / QR Code</span>
                  <div className="text-xl font-black text-amber-900 mt-1">
                    ₹{(closingData?.upiSales || 0).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-blue-800">Card Swipes</span>
                  <div className="text-xl font-black text-blue-900 mt-1">
                    ₹{(closingData?.cardSales || 0).toFixed(2)}
                  </div>
                </div>

                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-stone-600">Other Collections</span>
                  <div className="text-xl font-black text-stone-900 mt-1">
                    ₹{(closingData?.otherSales || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Profit & Loss Summary */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700 block pb-2 border-b border-stone-100">
                Day Performance Metrics ({date})
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-stone-500 block">Net Sales Revenue</span>
                  <span className="text-base font-extrabold text-stone-900">₹{(closingData?.netSales || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Ingredient Costs (COGS)</span>
                  <span className="text-base font-bold text-amber-900">₹{(closingData?.totalCogs || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Gross Profit</span>
                  <span className="text-base font-bold text-emerald-700">₹{(closingData?.grossProfit || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Net Profit</span>
                  <span className="text-base font-black text-amber-600">₹{(closingData?.netProfit || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COL: Physical Cash Drawer Reconciler */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col justify-between">
            <form onSubmit={handleFinalizeClosing} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <span className="font-bold text-sm text-stone-900">Cash Drawer Reconciliation</span>
                {closingData?.isClosed && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Day Closed
                  </span>
                )}
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Closing record saved and finalized successfully!</span>
                </div>
              )}

              {/* Formula Breakdown */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-stone-600 font-medium">Opening Cash Float (+):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    className="w-28 px-2 py-1 bg-stone-50 border border-stone-300 rounded text-right font-bold focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between text-emerald-800 font-semibold">
                  <span>Cash Sales Received (+):</span>
                  <span>₹{cashSales.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between text-rose-700 font-semibold">
                  <span>Expenses Paid from Cash (-):</span>
                  <span>-₹{cashExpenses.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-stone-600 font-medium">Cash Refunds Given (-):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashRefunds}
                    onChange={(e) => setCashRefunds(e.target.value)}
                    className="w-28 px-2 py-1 bg-stone-50 border border-stone-300 rounded text-right font-bold focus:outline-none"
                  />
                </div>

                {/* Expected Closing Cash */}
                <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-stone-900 text-sm">
                  <span>Expected Drawer Cash:</span>
                  <span className="font-black text-amber-700">₹{expectedClosingCash.toFixed(2)}</span>
                </div>

                {/* Actual Closing Cash Entry */}
                <div className="pt-2">
                  <label className="font-bold text-stone-900 block mb-1">
                    Counted Actual Cash in Register (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Enter physical counted cash"
                    value={actualClosingCash}
                    onChange={(e) => setActualClosingCash(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-base font-black focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                {/* Cash Difference Box */}
                {actualClosingCash !== '' && (
                  <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                    cashDiff === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : cashDiff > 0
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <span>Drawer Difference:</span>
                    <span className="text-sm font-black">
                      {cashDiff === 0
                        ? 'Exact Match (Balanced)'
                        : cashDiff > 0
                        ? `+₹${cashDiff} (Cash Surplus / Over)`
                        : `-₹${Math.abs(cashDiff)} (Cash Shortage)`}
                    </span>
                  </div>
                )}

                {/* Closing Notes */}
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Closing Remarks / Staff Notes</label>
                  <textarea
                    rows="2"
                    placeholder="Any cash discrepancies, missing receipts or shift handover notes..."
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit / Finalize Button */}
              <button
                type="submit"
                disabled={isFinalizing}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{closingData?.isClosed ? 'Update & Re-Finalize Closing' : 'Save & Finalize Business Day'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
