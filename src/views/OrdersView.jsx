import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Eye,
  Printer,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  X,
  CreditCard,
  FileText
} from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal.jsx';
import { 
  getLocalOrders, 
  saveLocalOrder, 
  updateLocalOrderStatus, 
  syncWithServer 
} from '../utils/persistentSync.js';

export default function OrdersView({ settings = {} }) {
  const [orders, setOrders] = useState(() => getLocalOrders());
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodChoice, setPaymentMethodChoice] = useState('Cash');

  useEffect(() => {
    fetchOrders();

    const handleLocalUpdate = () => {
      setOrders(getLocalOrders());
    };
    window.addEventListener('waffelden_local_data_changed', handleLocalUpdate);
    return () => window.removeEventListener('waffelden_local_data_changed', handleLocalUpdate);
  }, [statusFilter, paymentFilter, startDate, endDate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      await syncWithServer();
      let url = '/api/orders?limit=150';
      if (statusFilter !== 'All') url += `&status=${statusFilter}`;
      if (paymentFilter !== 'All') url += `&payment_method=${paymentFilter}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetch(url);
      const data = await res.json();
      
      const local = getLocalOrders();
      if (Array.isArray(data) && data.length > 0) {
        setOrders(data);
        data.forEach(o => saveLocalOrder(o));
      } else if (local.length > 0) {
        let filtered = [...local];
        if (statusFilter !== 'All') filtered = filtered.filter(o => o.order_status === statusFilter);
        if (paymentFilter !== 'All') filtered = filtered.filter(o => o.payment_method === paymentFilter);
        if (startDate) filtered = filtered.filter(o => o.order_date >= startDate);
        if (endDate) filtered = filtered.filter(o => o.order_date <= endDate);
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(o => 
            o.order_number?.toLowerCase().includes(q) || 
            o.customer_name?.toLowerCase().includes(q) ||
            o.customer_phone?.includes(q)
          );
        }
        setOrders(filtered);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.warn('Network notice, displaying local orders:', err);
      setOrders(getLocalOrders());
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const updateOrderStatus = async (orderId, newStatus, reason = '') => {
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      if (targetOrder?.order_number) {
        updateLocalOrderStatus(targetOrder.order_number, { 
          order_status: newStatus, 
          cancelled_reason: reason 
        });
      }
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, cancelled_reason: reason })
      });
      if (res.ok) {
        setCancelModalOrder(null);
        setCancelReason('');
        fetchOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          const updated = await res.json();
          setSelectedOrder(updated);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePayment = async () => {
    if (!paymentModalOrder) return;
    try {
      const amt = Number(paymentAmount) || 0;
      const newPaid = (paymentModalOrder.amount_paid || 0) + amt;
      const newBal = Math.max(0, (paymentModalOrder.final_total || 0) - newPaid);
      const newPayStatus = newBal <= 0 ? 'Paid' : 'Partial';

      updateLocalOrderStatus(paymentModalOrder.order_number, {
        amount_paid: newPaid,
        outstanding_balance: newBal,
        payment_status: newPayStatus,
        payment_method: paymentMethodChoice
      });

      const res = await fetch(`/api/orders/${paymentModalOrder.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_paid: amt,
          payment_method: paymentMethodChoice
        })
      });
      if (res.ok) {
        setPaymentModalOrder(null);
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openOrderDetails = async (orderId) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const full = await res.json();
      setSelectedOrder(full);
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Completed</span>;
      case 'Ready':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">Ready for Pickup</span>;
      case 'Preparing':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">Preparing</span>;
      case 'Pending':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-200 text-stone-700">Pending</span>;
      case 'Cancelled':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 line-through">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-800">{status}</span>;
    }
  };

  const getPaymentBadge = (status, balance) => {
    if (status === 'Paid') {
      return <span className="text-emerald-700 font-bold text-xs">Paid</span>;
    } else if (status === 'Unpaid') {
      return <span className="text-rose-700 font-bold text-xs">Unpaid</span>;
    } else {
      return (
        <span className="text-amber-800 font-bold text-xs">
          Bal: ₹{balance?.toFixed(0)}
        </span>
      );
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by order #, customer, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-20 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
            >
              Search
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-medium text-stone-700 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Preparing">Preparing</option>
              <option value="Ready">Ready</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-medium text-stone-700 focus:outline-none"
            >
              <option value="All">All Payment Modes</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>
            </select>

            {/* Date Filters */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
                placeholder="From date"
              />
              <span className="text-stone-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
                placeholder="To date"
              />
            </div>

            {(startDate || endDate || statusFilter !== 'All' || paymentFilter !== 'All' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setStatusFilter('All');
                  setPaymentFilter('All');
                  setSearchQuery('');
                  fetchOrders();
                }}
                className="text-stone-500 hover:text-stone-800 underline text-xs ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-100/80 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Customer / Type</th>
                <th className="py-3 px-4">Items Summary</th>
                <th className="py-3 px-3 text-right">Total Bill</th>
                <th className="py-3 px-3 text-right">Payment</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Profit</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-stone-400">
                    <div className="animate-spin w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full mx-auto mb-2" />
                    <span>Loading order logs...</span>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-stone-400">
                    <FileText className="w-8 h-8 text-stone-300 mx-auto mb-1.5" />
                    <p className="font-semibold text-stone-600">No orders match the filter</p>
                    <p className="text-[11px] text-stone-400">Create an order or adjust filters above</p>
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const isCancelled = ord.order_status === 'Cancelled';
                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-stone-50/80 transition ${
                        isCancelled ? 'bg-rose-50/30 opacity-70' : ''
                      }`}
                    >
                      {/* Order Number */}
                      <td className="py-3.5 px-4 font-bold font-mono text-stone-900 whitespace-nowrap">
                        <button
                          onClick={() => openOrderDetails(ord.id)}
                          className="text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
                        >
                          {ord.order_number}
                        </button>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-stone-800">{ord.order_date}</div>
                        <div className="text-[10px] text-stone-500 font-mono">{ord.order_time} IST</div>
                      </td>

                      {/* Customer / Type */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-stone-900 truncate max-w-[130px]">
                          {ord.customer_name || 'Walk-in Guest'}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-stone-400">
                          {ord.order_type}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="text-stone-800 text-xs space-y-0.5">
                          {(() => {
                            const grouped = (ord.items || []).reduce((acc, it) => {
                              const cat = it.category_name || 'General';
                              if (!acc[cat]) acc[cat] = [];
                              acc[cat].push(`${it.product_name} (${it.quantity})`);
                              return acc;
                            }, {});

                            return Object.entries(grouped).map(([cat, its]) => (
                              <div key={cat} className="truncate">
                                <span className="font-bold text-[10px] uppercase text-amber-800 bg-amber-50 px-1 py-0.2 rounded mr-1">
                                  {cat}
                                </span>
                                <span className="font-medium text-stone-700">{its.join(', ')}</span>
                              </div>
                            ));
                          })()}
                        </div>
                        {ord.notes && (
                          <div className="text-[10px] text-amber-700 italic truncate mt-0.5">
                            Note: {ord.notes}
                          </div>
                        )}
                      </td>

                      {/* Total Bill */}
                      <td className="py-3.5 px-3 text-right font-extrabold text-stone-900 whitespace-nowrap">
                        ₹{ord.final_total?.toFixed(2)}
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[10px] uppercase px-1.5 py-0.5 bg-stone-100 rounded text-stone-600 font-bold">
                            {ord.payment_method}
                          </span>
                          {getPaymentBadge(ord.payment_status, ord.outstanding_balance)}
                        </div>
                        {ord.outstanding_balance > 0 && (
                          <button
                            onClick={() => {
                              setPaymentModalOrder(ord);
                              setPaymentAmount(String(ord.outstanding_balance));
                            }}
                            className="text-[10px] text-amber-700 hover:underline block font-semibold mt-0.5"
                          >
                            Collect Balance
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {getStatusBadge(ord.order_status)}
                      </td>

                      {/* Gross Profit */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {isCancelled ? (
                          <span className="text-stone-400 italic">Excluded</span>
                        ) : (
                          <span className="font-bold text-emerald-700">
                            ₹{ord.gross_profit?.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* View details */}
                          <button
                            onClick={() => openOrderDetails(ord.id)}
                            title="View Full Details"
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Print Receipt */}
                          <button
                            onClick={() => setReceiptOrder(ord)}
                            title="Print Receipt"
                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Quick Status Changes */}
                          {ord.order_status === 'Pending' && (
                            <button
                              onClick={() => updateOrderStatus(ord.id, 'Preparing')}
                              title="Mark Preparing"
                              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded transition"
                            >
                              Prep
                            </button>
                          )}
                          {ord.order_status === 'Preparing' && (
                            <button
                              onClick={() => updateOrderStatus(ord.id, 'Ready')}
                              title="Mark Ready"
                              className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-900 text-[10px] font-bold rounded transition"
                            >
                              Ready
                            </button>
                          )}
                          {ord.order_status === 'Ready' && (
                            <button
                              onClick={() => updateOrderStatus(ord.id, 'Completed')}
                              title="Mark Completed"
                              className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded transition"
                            >
                              Complete
                            </button>
                          )}

                          {/* Cancel Order */}
                          {!isCancelled && ord.order_status !== 'Completed' && (
                            <button
                              onClick={() => setCancelModalOrder(ord)}
                              title="Cancel Order"
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal / Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-stone-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-amber-400">{selectedOrder.order_number}</span>
                  <span className="text-xs uppercase px-2 py-0.5 rounded bg-stone-800">{selectedOrder.order_type}</span>
                </div>
                <div className="text-xs text-stone-400 mt-0.5">
                  Ordered: {selectedOrder.order_date} at {selectedOrder.order_time} IST
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Customer info */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                <div>
                  <span className="text-stone-500 block">Customer Name</span>
                  <span className="font-bold text-stone-900">{selectedOrder.customer_name || 'Walk-in'}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Phone Number</span>
                  <span className="font-bold text-stone-900">{selectedOrder.customer_phone || 'None'}</span>
                </div>
              </div>

              {/* Items Breakdown Table with COGS & Profit - Grouped by Category */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Items Ordered by Category & Station
                </h4>
                <div className="space-y-3">
                  {(() => {
                    const grouped = (selectedOrder.items || []).reduce((acc, it) => {
                      const cat = it.category_name || 'General Items';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(it);
                      return acc;
                    }, {});

                    return Object.entries(grouped).map(([catName, catItems]) => (
                      <div key={catName} className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
                        <div className="bg-amber-100/70 px-3 py-1.5 text-[11px] font-bold text-amber-950 uppercase tracking-wide flex items-center justify-between border-b border-amber-200/80">
                          <span>• {catName}</span>
                          <span className="bg-white/80 px-2 py-0.2 rounded font-semibold text-stone-700">
                            {catItems.reduce((s, i) => s + i.quantity, 0)} items
                          </span>
                        </div>
                        <table className="w-full text-xs text-left">
                          <thead className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200">
                            <tr>
                              <th className="py-1.5 px-3">Item</th>
                              <th className="py-1.5 px-2 text-center">Qty</th>
                              <th className="py-1.5 px-2 text-right">Price</th>
                              <th className="py-1.5 px-2 text-right">Unit Cost</th>
                              <th className="py-1.5 px-3 text-right">Total</th>
                              <th className="py-1.5 px-3 text-right">Profit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {catItems.map((it, idx) => (
                              <tr key={idx} className="hover:bg-stone-50/50">
                                <td className="py-1.5 px-3 font-medium text-stone-900">
                                  {it.product_name}
                                  {it.special_notes && (
                                    <div className="text-[10px] text-amber-800 italic">*{it.special_notes}</div>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-center font-bold">{it.quantity}</td>
                                <td className="py-1.5 px-2 text-right">₹{it.unit_price}</td>
                                <td className="py-1.5 px-2 text-right text-stone-500">₹{it.unit_cost}</td>
                                <td className="py-1.5 px-3 text-right font-bold">₹{it.total_price}</td>
                                <td className="py-1.5 px-3 text-right font-bold text-emerald-700">₹{it.total_profit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Financial Totals */}
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-600">Subtotal:</span>
                  <span className="font-semibold text-stone-900">₹{selectedOrder.subtotal?.toFixed(2)}</span>
                </div>
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Discount ({selectedOrder.discount_reason || 'Applied'}):</span>
                    <span>-₹{selectedOrder.discount_amount?.toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">GST ({selectedOrder.tax_rate}%):</span>
                    <span className="font-semibold text-stone-900">+₹{selectedOrder.tax_amount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-stone-900 text-sm pt-1 border-t border-amber-200">
                  <span>Final Total:</span>
                  <span>₹{selectedOrder.final_total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>Order Gross Profit:</span>
                  <span>₹{selectedOrder.gross_profit?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Total COGS (Item Ingredients & Cost):</span>
                  <span>₹{selectedOrder.total_cogs?.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-500 block">Payment Mode</span>
                  <span className="font-bold text-stone-900">{selectedOrder.payment_method}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Paid Amount</span>
                  <span className="font-bold text-emerald-700">₹{selectedOrder.amount_paid?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Balance Due</span>
                  <span className="font-bold text-rose-600">₹{selectedOrder.outstanding_balance?.toFixed(2)}</span>
                </div>
              </div>

              {/* Audit trail */}
              {selectedOrder.audits && selectedOrder.audits.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">Audit History</h4>
                  <div className="space-y-1 text-[11px] text-stone-600">
                    {selectedOrder.audits.map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-stone-50 p-2 rounded border border-stone-100">
                        <span>{a.description}</span>
                        <span className="text-stone-400 font-mono">{a.timestamp?.slice(0, 19).replace('T', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
              <button
                onClick={() => setReceiptOrder(selectedOrder)}
                className="flex items-center gap-1.5 px-3 py-2 bg-stone-800 text-white rounded-xl text-xs font-semibold hover:bg-stone-900 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold hover:bg-stone-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Reason Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-stone-200 space-y-3">
            <h3 className="font-bold text-stone-900 text-sm">Cancel Order #{cancelModalOrder.order_number}?</h3>
            <p className="text-xs text-stone-500">
              Cancelled orders are excluded from revenue and profit calculations while keeping an audit record.
            </p>
            <input
              type="text"
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalOrder(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Go Back
              </button>
              <button
                onClick={() => updateOrderStatus(cancelModalOrder.id, 'Cancelled', cancelReason)}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Update Modal */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-stone-200 space-y-3">
            <h3 className="font-bold text-stone-900 text-sm">Collect Payment for {paymentModalOrder.order_number}</h3>
            <div className="text-xs text-stone-500">
              Total Order: ₹{paymentModalOrder.final_total} • Outstanding: ₹{paymentModalOrder.outstanding_balance}
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-stone-700 block">Total Amount Paid so far:</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-stone-700 block">Payment Method:</label>
                <select
                  value={paymentMethodChoice}
                  onChange={(e) => setPaymentMethodChoice(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPaymentModalOrder(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePayment}
                className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt */}
      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          settings={settings}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
}
