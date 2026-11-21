import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  DollarSign,
  Calendar,
  Trash2,
  Edit,
  Tag,
  CreditCard,
  AlertCircle,
  X,
  FileText
} from 'lucide-react';

export default function ExpensesView() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Ingredients and stock purchases');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidFromCashRegister, setPaidFromCashRegister] = useState(true);
  const [includedInCogs, setIncludedInCogs] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const expenseCategories = [
    'Ingredients and stock purchases',
    'Electricity & Power',
    'Shop Rent',
    'Staff Salaries & Wages',
    'Packaging Materials',
    'Equipment Maintenance',
    'Delivery & Logistics',
    'Cleaning & Hygiene',
    'Other Operating Expenses'
  ];

  useEffect(() => {
    fetchExpenses();
  }, [categoryFilter, startDate, endDate]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let url = '/api/expenses?';
      if (categoryFilter !== 'All') url += `&category=${encodeURIComponent(categoryFilter)}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      let sumUrl = '/api/expenses/summary?';
      if (startDate) sumUrl += `&start_date=${startDate}`;
      if (endDate) sumUrl += `&end_date=${endDate}`;

      const [res, sumRes] = await Promise.all([
        fetch(url),
        fetch(sumUrl)
      ]);

      const exps = await res.json();
      const sum = await sumRes.json();

      setExpenses(exps);
      setSummary(sum);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingExpense(null);
    const today = new Date().toISOString().slice(0, 10);
    setDate(today);
    setAmount('');
    setCategory(expenseCategories[0]);
    setDescription('');
    setPaymentMethod('Cash');
    setPaidFromCashRegister(true);
    setIncludedInCogs(false);
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setDate(exp.date);
    setAmount(String(exp.amount));
    setCategory(exp.category);
    setDescription(exp.description || '');
    setPaymentMethod(exp.payment_method || 'Cash');
    setPaidFromCashRegister(Boolean(exp.paid_from_cash_register));
    setIncludedInCogs(Boolean(exp.included_in_cogs));
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setErrorMsg('Please enter a valid expense amount');
      return;
    }

    try {
      const payload = {
        date,
        amount: numAmt,
        category,
        description: description.trim(),
        payment_method: paymentMethod,
        paid_from_cash_register: paidFromCashRegister ? 1 : 0,
        included_in_cogs: includedInCogs ? 1 : 0
      };

      let url = '/api/expenses';
      let method = 'POST';

      if (editingExpense) {
        url = `/api/expenses/${editingExpense.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save expense');
      }

      setModalOpen(false);
      fetchExpenses();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense entry?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) fetchExpenses();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto space-y-6">
      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Total Recorded Expenses</span>
          <div className="text-2xl font-black text-stone-900 mt-2">
            ₹{(summary?.totalExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">All purchases, bills & costs combined</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Operating Expenses</span>
          <div className="text-2xl font-black text-rose-700 mt-2">
            ₹{(summary?.operatingExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Deducted from gross profit for net profit</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Cash Register Outflow</span>
          <div className="text-2xl font-black text-amber-800 mt-2">
            ₹{(summary?.cashRegisterExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Paid directly from shop counter cash</p>
        </div>
      </div>

      {/* Filter and Action bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-medium text-stone-700 focus:outline-none"
          >
            <option value="All">All Categories</option>
            {expenseCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
          />
          <span className="text-stone-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
          />

          {(categoryFilter !== 'All' || startDate || endDate) && (
            <button
              onClick={() => {
                setCategoryFilter('All');
                setStartDate('');
                setEndDate('');
              }}
              className="text-stone-500 hover:text-stone-800 underline text-xs ml-1"
            >
              Reset
            </button>
          )}
        </div>

        {/* Add Expense Button */}
        <button
          onClick={openAddModal}
          className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Shop Expense</span>
        </button>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100/80 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-4">Description / Purpose</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3 text-center">Payment Mode</th>
                <th className="py-3 px-3 text-center">Cash Register Outflow</th>
                <th className="py-3 px-3 text-center">In COGS?</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-stone-400">
                    <div className="animate-spin w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full mx-auto mb-2" />
                    <span>Loading expense entries...</span>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-stone-400">
                    No expense records found. Click "Record Shop Expense" above to add.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-stone-50/80 transition">
                    <td className="py-3 px-4 font-semibold text-stone-900 whitespace-nowrap">{exp.date}</td>
                    <td className="py-3 px-3 font-medium text-stone-800">
                      <span className="px-2 py-0.5 rounded bg-stone-100 font-semibold text-[11px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-600 max-w-xs truncate">
                      {exp.description || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-stone-900 whitespace-nowrap">
                      ₹{exp.amount?.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-bold text-[10px] uppercase">
                        {exp.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {exp.paid_from_cash_register ? (
                        <span className="text-emerald-700 font-bold text-[10px]">Yes (Shop Cash)</span>
                      ) : (
                        <span className="text-stone-400 text-[10px]">No (Bank/Online)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {exp.included_in_cogs ? (
                        <span className="text-amber-700 font-bold text-[10px]">Tracked in COGS</span>
                      ) : (
                        <span className="text-stone-500 text-[10px]">Operating Exp</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(exp)}
                          className="p-1.5 text-stone-500 hover:text-amber-800 hover:bg-stone-100 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingExpense ? 'Edit Shop Expense' : 'Record New Expense'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-3.5 text-xs">
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Expense Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-none"
                >
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Description / Bill Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Purchased 10kg sugar & waffle cartons from supplier"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Toggles for Daily Closing & COGS Double Count Prevention */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paidFromCashRegister}
                    onChange={(e) => setPaidFromCashRegister(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600"
                  />
                  <div>
                    <span className="font-bold text-stone-800 block">Paid from counter cash register</span>
                    <span className="text-[10px] text-stone-500">Will be deducted from expected cash during Daily Closing</span>
                  </div>
                </label>

                <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-stone-200">
                  <input
                    type="checkbox"
                    checked={includedInCogs}
                    onChange={(e) => setIncludedInCogs(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600"
                  />
                  <div>
                    <span className="font-bold text-stone-800 block">Already accounted in Unit COGS (raw stock)</span>
                    <span className="text-[10px] text-stone-500">
                      Prevents double subtraction from Net Profit if this raw material is already tracked in product unit costs
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
