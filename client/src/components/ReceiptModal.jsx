import React from 'react';
import { Printer, X, CheckCircle, ArrowRight } from 'lucide-react';

export default function ReceiptModal({
  order,
  settings = {},
  onClose,
  onNextOrder
}) {
  if (!order) return null;

  const shopName = settings.shop_name || 'Waffel Den';
  const tagline = settings.tagline || 'Freshly Baked Belgian & Chocolate Waffles';
  const address = settings.address || 'Shop 4, Market Promenade, Main Road';
  const phone = settings.phone || '+91 98765 43210';
  const footerMsg = settings.receipt_footer || 'Thank you for visiting Waffel Den! Have a sweet day :)';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header toolbar */}
        <div className="px-5 py-3.5 bg-stone-100 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-stone-900 text-sm">Order Saved Successfully</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Receipt Paper Layout */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div
            id="printable-receipt"
            className="font-mono text-xs text-stone-900 bg-amber-50/30 p-5 rounded-xl border border-stone-300 shadow-inner"
          >
            {/* Shop Brand */}
            <div className="text-center pb-3 border-b border-dashed border-stone-400">
              <h3 className="font-bold text-base tracking-wide uppercase">{shopName}</h3>
              <p className="text-[11px] text-stone-600 font-sans">{tagline}</p>
              <p className="text-[10px] text-stone-500 font-sans mt-0.5">{address}</p>
              <p className="text-[10px] text-stone-500 font-sans">Tel: {phone}</p>
            </div>

            {/* Order Details Header */}
            <div className="py-2.5 border-b border-dashed border-stone-400 space-y-1 text-[11px]">
              <div className="flex justify-between font-bold">
                <span>ORDER: {order.order_number}</span>
                <span className="uppercase px-1.5 py-0.2 bg-stone-200 rounded font-sans">{order.order_type}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Date: {order.order_date}</span>
                <span>Time: {order.order_time}</span>
              </div>
              {order.customer_name && (
                <div className="text-stone-700">
                  <span>Customer: {order.customer_name} {order.customer_phone ? `(${order.customer_phone})` : ''}</span>
                </div>
              )}
            </div>

            {/* Line Items Grouped by Item Type / Category */}
            <div className="py-2.5 border-b border-dashed border-stone-400 space-y-3">
              {(() => {
                const grouped = (order.items || []).reduce((acc, it) => {
                  const cat = it.category_name || 'General Items';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(it);
                  return acc;
                }, {});

                return Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                      <span>• {cat}</span>
                      <span>{items.reduce((sum, i) => sum + i.quantity, 0)} items</span>
                    </div>

                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-stone-300 text-[9px] text-stone-500 uppercase">
                          <th className="pb-0.5 w-8">Qty</th>
                          <th className="pb-0.5">Item</th>
                          <th className="pb-0.5 text-right">Price</th>
                          <th className="pb-0.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {items.map((it, idx) => (
                          <tr key={idx} className="align-top">
                            <td className="py-1 font-bold">{it.quantity}x</td>
                            <td className="py-1">
                              <div className="font-medium">{it.product_name}</div>
                              {it.special_notes && (
                                <div className="text-[10px] text-amber-800 italic">*{it.special_notes}</div>
                              )}
                            </td>
                            <td className="py-1 text-right text-stone-600">₹{it.unit_price}</td>
                            <td className="py-1 text-right font-bold">₹{it.total_price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ));
              })()}
            </div>

            {/* Calculation Totals */}
            <div className="py-2.5 border-b border-dashed border-stone-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{order.subtotal?.toFixed(2)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount {order.discount_reason ? `(${order.discount_reason})` : ''}:</span>
                  <span>-₹{order.discount_amount?.toFixed(2)}</span>
                </div>
              )}
              {order.tax_amount > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Tax ({order.tax_rate}% GST):</span>
                  <span>+₹{order.tax_amount?.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-stone-300 text-stone-900">
                <span>TOTAL AMOUNT:</span>
                <span>₹{order.final_total?.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="py-2.5 border-b border-dashed border-stone-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-semibold uppercase">{order.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span>₹{order.amount_paid?.toFixed(2)}</span>
              </div>
              {order.outstanding_balance > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Balance Due:</span>
                  <span>₹{order.outstanding_balance?.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-stone-500 pt-0.5">
                <span>Status:</span>
                <span className="font-semibold">{order.payment_status} • {order.order_status}</span>
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="text-center pt-3 text-[10px] text-stone-500 font-sans">
              <p>{footerMsg}</p>
              <p className="mt-1 font-mono text-[9px] text-stone-400">Printed: {order.order_date} {order.order_time} IST</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            onClick={handlePrint}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-3.5 py-2 text-stone-600 hover:bg-stone-200/70 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              Done
            </button>
            {onNextOrder && (
              <button
                onClick={() => {
                  onClose();
                  onNextOrder();
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <span>Next Customer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
