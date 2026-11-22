import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Utensils,
  Receipt,
  Sparkles,
  ShoppingBag,
  IndianRupee,
  Tag,
  CheckCircle2,
  RotateCcw,
  User,
  Phone,
  FileText
} from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal.jsx';
import { 
  saveLocalOrder, 
  saveLocalCustomProduct, 
  getLocalCustomProducts, 
  getLocalOrders 
} from '../utils/persistentSync.js';

const categoryIcons = {
  "Belgium Waffle's": '🧇',
  "Bubble Waffle's": '🫧',
  "Brownie Cake's": '🍫',
  "Bowl Cake's": '🥣',
  'Non Veg Items': '🍗',
  'Veg Items': '🥗',
  'Hot Snacks & Momos': '🍢',
  'Sandwich': '🥪',
  'Mojito Drinks': '🍹',
  'Extra Add-ons': '✨',
  'General': '🍴'
};

const categoryDescriptions = {
  "Belgium Waffle's": 'Crispy golden & chocolate Belgian waffles',
  "Bubble Waffle's": 'Fluffy bubble dessert waffles with loaded toppings',
  "Brownie Cake's": 'Rich fudge brownies & crunchy chocolate bites',
  "Bowl Cake's": 'Loaded sweet indulgence bowls & tubs',
  'Non Veg Items': 'Chicken loaded fries & crispy chicken bowls',
  'Veg Items': 'Peri peri fries, cheese balls, samosas & smiles',
  'Hot Snacks & Momos': 'Spiral potato twisters, paneer & corn momos',
  'Sandwich': 'Toasted cheese, paneer & chicken sandwiches',
  'Mojito Drinks': 'Chilled fruit, mint & citrus mojito coolers',
  'Extra Add-ons': 'Extra dips, toppings & add-ons'
};

export default function NewOrderView({ settings = {}, onOrderCreated }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Belgium Waffle's");
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Active Order State
  const [orderNumber, setOrderNumber] = useState('');
  const [orderType, setOrderType] = useState('takeaway'); // 'takeaway', 'dine_in', 'delivery'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [cartItems, setCartItems] = useState([]);

  // Discount & Taxes
  const [discountType, setDiscountType] = useState('fixed'); // 'fixed' or 'percent'
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [applyTax, setApplyTax] = useState(settings.tax_enabled === '1');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // UPI and Cash are most popular in India
  const [customAmountPaid, setCustomAmountPaid] = useState('');
  const [paymentChoice, setPaymentChoice] = useState('full'); // 'full', 'unpaid', 'custom'

  // Submitting & Receipt Modal
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Quick Add New Item Modal
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemPrice, setQuickItemPrice] = useState('');
  const [quickItemCategory, setQuickItemCategory] = useState("Belgium Waffle's");
  const [quickCustomCategory, setQuickCustomCategory] = useState('');
  const [quickItemNotes, setQuickItemNotes] = useState('');
  const [quickSaveToMenu, setQuickSaveToMenu] = useState(true);
  const [quickAddQty, setQuickAddQty] = useState(1);
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  // Common quick notes chips
  const quickNotesList = ['Extra Chocolate', 'Less Sweet', 'Crispy Extra', 'No Nuts', 'Packed Separately', 'Extra Tissues'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [prodRes, catRes, numRes] = await Promise.allSettled([
        fetch('/api/products?active=1'),
        fetch('/api/products/categories'),
        fetch('/api/orders/next-number')
      ]);

      let prods = [];
      let cats = [];
      let nextNum = 'WD-001';

      if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
        try {
          const data = await prodRes.value.json();
          if (Array.isArray(data)) prods = data;
        } catch (e) {
          console.warn('Could not parse products JSON:', e);
        }
      }

      if (catRes.status === 'fulfilled' && catRes.value.ok) {
        try {
          const data = await catRes.value.json();
          if (Array.isArray(data)) cats = data;
        } catch (e) {
          console.warn('Could not parse categories JSON:', e);
        }
      }

      if (numRes.status === 'fulfilled' && numRes.value.ok) {
        try {
          const data = await numRes.value.json();
          if (data?.order_number) nextNum = data.order_number;
        } catch (e) {
          console.warn('Could not parse order number JSON:', e);
        }
      }

      const localCustom = getLocalCustomProducts();
      const combinedProds = [...prods];
      for (const cp of localCustom) {
        if (!combinedProds.some(p => p.name.trim().toLowerCase() === cp.name.trim().toLowerCase())) {
          combinedProds.push(cp);
        }
      }

      // Calculate highest order number considering local orders
      const localOrders = getLocalOrders();
      if (localOrders.length > 0) {
        let maxNum = 0;
        for (const o of localOrders) {
          const m = o.order_number?.match(/WD-(\d+)/i);
          if (m) {
            const val = parseInt(m[1], 10);
            if (val > maxNum) maxNum = val;
          }
        }
        if (maxNum > 0) {
          const nextVal = maxNum + 1;
          const localNextNum = `WD-${String(nextVal).padStart(3, '0')}`;
          const serverNumVal = parseInt(nextNum.replace(/\D/g, '') || '0', 10);
          if (nextVal > serverNumVal) {
            nextNum = localNextNum;
          }
        }
      }

      if (combinedProds.length > 0) {
        setProducts(combinedProds);
        setCategories(cats);
        setOrderNumber(nextNum);
      } else {
        setErrorMsg('Failed to load products. Ensure the server is running.');
      }
    } catch (err) {
      console.error('Failed to load menu:', err);
      setErrorMsg('Failed to load products. Ensure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const refreshNextOrderNumber = async () => {
    try {
      const res = await fetch('/api/orders/next-number');
      const data = await res.json();
      setOrderNumber(data.order_number || '');
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenQuickAdd = (initialName = '') => {
    setQuickItemName(initialName);
    setQuickItemPrice('');
    setQuickItemCategory(selectedCategory !== 'All' ? selectedCategory : (categories[0]?.name || "Belgium Waffle's"));
    setQuickCustomCategory('');
    setQuickItemNotes('');
    setQuickSaveToMenu(true);
    setQuickAddQty(1);
    setShowQuickAddModal(true);
  };

  const handleCreateQuickItem = async (e) => {
    e.preventDefault();
    if (!quickItemName.trim()) return;
    const price = Number(quickItemPrice) || 0;
    const finalCategory = quickItemCategory === '__custom__' ? (quickCustomCategory.trim() || 'General') : quickItemCategory;

    setQuickAddSaving(true);
    try {
      let createdProductId = null;
      let finalUnitCost = 0;

      if (quickSaveToMenu) {
        // Save to menu database
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: quickItemName.trim(),
            category_name: finalCategory,
            description: quickItemNotes.trim(),
            selling_price: price,
            ingredient_cost: 0,
            prep_cost: 0,
            packaging_cost: 0
          })
        });

        if (res.ok) {
          const newProd = await res.json();
          createdProductId = newProd.id;
          finalUnitCost = newProd.total_unit_cost || 0;
          saveLocalCustomProduct(newProd);
          fetchInitialData();
        } else {
          // Even if server failed, save locally
          saveLocalCustomProduct({
            id: Date.now(),
            name: quickItemName.trim(),
            category_name: finalCategory,
            description: quickItemNotes.trim(),
            selling_price: price,
            ingredient_cost: 0,
            prep_cost: 0,
            packaging_cost: 0,
            total_unit_cost: 0,
            expected_profit: price,
            profit_margin_pct: 100,
            is_active: 1
          });
        }
      } else {
        saveLocalCustomProduct({
          id: Date.now(),
          name: quickItemName.trim(),
          category_name: finalCategory,
          description: quickItemNotes.trim(),
          selling_price: price,
          ingredient_cost: 0,
          prep_cost: 0,
          packaging_cost: 0,
          total_unit_cost: 0,
          expected_profit: price,
          profit_margin_pct: 100,
          is_active: 1
        });
      }

      // Add directly to active cart
      setCartItems(prev => [
        ...prev,
        {
          product_id: createdProductId,
          product_name: quickItemName.trim(),
          category_name: finalCategory,
          unit_price: price,
          unit_cost: finalUnitCost,
          quantity: Math.max(1, Number(quickAddQty) || 1),
          special_notes: quickItemNotes.trim()
        }
      ]);

      setShowQuickAddModal(false);
    } catch (err) {
      console.error(err);
      alert('Error adding item: ' + err.message);
    } finally {
      setQuickAddSaving(false);
    }
  };

  // Cart operations
  const addToCart = (product) => {
    setErrorMsg('');
    setCartItems(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            category_name: product.category_name,
            unit_price: product.selling_price,
            unit_cost: product.total_unit_cost,
            quantity: 1,
            special_notes: ''
          }
        ];
      }
    });
  };

  const updateQuantity = (productId, delta) => {
    setCartItems(prev =>
      prev
        .map(item => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeItem = (productId) => {
    setCartItems(prev => prev.filter(item => item.product_id !== productId));
  };

  const updateItemNotes = (productId, notes) => {
    setCartItems(prev =>
      prev.map(item => (item.product_id === productId ? { ...item, special_notes: notes } : item))
    );
  };

  const appendQuickNote = (productId, chip) => {
    setCartItems(prev =>
      prev.map(item => {
        if (item.product_id === productId) {
          const current = item.special_notes ? item.special_notes.trim() : '';
          const updated = current ? `${current}, ${chip}` : chip;
          return { ...item, special_notes: updated };
        }
        return item;
      })
    );
  };

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const numDiscountVal = Number(discountValue) || 0;
  let discountAmount = 0;
  if (numDiscountVal > 0) {
    if (discountType === 'percent') {
      discountAmount = (subtotal * numDiscountVal) / 100;
    } else {
      discountAmount = Math.min(subtotal, numDiscountVal);
    }
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxRate = applyTax ? Number(settings.tax_rate || 5) : 0;
  const taxAmount = (afterDiscount * taxRate) / 100;
  const finalTotal = Math.round((afterDiscount + taxAmount) * 100) / 100;

  // Paid amount logic
  let amountPaid = finalTotal;
  if (paymentChoice === 'unpaid') {
    amountPaid = 0;
  } else if (paymentChoice === 'custom') {
    amountPaid = Number(customAmountPaid) || 0;
  }
  const outstandingBalance = Math.max(0, Math.round((finalTotal - amountPaid) * 100) / 100);

  // Clear / Reset Entire Order form
  const resetForm = () => {
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setOrderNotes('');
    setDiscountValue('');
    setDiscountReason('');
    setCustomAmountPaid('');
    setPaymentChoice('full');
    setPaymentMethod('UPI');
    setErrorMsg('');
    refreshNextOrderNumber();
  };

  // Submit Order
  const handleSaveOrder = async () => {
    if (cartItems.length === 0) {
      setErrorMsg('Please select at least one waffle or item before saving');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        order_type: orderType,
        customer_name: customerName,
        customer_phone: customerPhone,
        notes: orderNotes,
        items: cartItems,
        discount_type: discountType,
        discount_value: numDiscountVal,
        discount_reason: discountReason,
        tax_rate: taxRate,
        amount_paid: amountPaid,
        payment_method: paymentMethod,
        order_status: 'Completed'
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save order');
      }

      const created = await res.json();
      saveLocalOrder(created);
      setSavedOrder(created);
      setShowReceipt(true);
      if (onOrderCreated) onOrderCreated(created);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred while saving order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered products list
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category_name === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-5 p-4 lg:p-6 max-w-[1700px] mx-auto min-h-[calc(100vh-80px)]">
      {/* LEFT PANE: Visual Menu & Search */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar: Category tabs & search */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search waffles, shakes, toppings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs px-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick stats & Add New Item Button */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-xs text-stone-500 hidden md:inline">{filteredProducts.length} items</span>
              <button
                type="button"
                onClick={() => handleOpenQuickAdd(searchQuery)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add New Item</span>
              </button>
            </div>
          </div>

          {/* Category Navigation Pills - Grouped with Icons and Item Counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
            {categories.map(cat => {
              const count = products.filter(p => p.category_name === cat.name).length;
              const isSelected = selectedCategory === cat.name;
              const icon = categoryIcons[cat.name] || '🍴';
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 hover:border-stone-300'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{cat.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-amber-700/80 text-white' : 'bg-stone-200/80 text-stone-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                selectedCategory === 'All'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <span>📂</span>
              <span>All Types</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCategory === 'All' ? 'bg-amber-700 text-white' : 'bg-stone-200 text-stone-600'
              }`}>
                {products.length}
              </span>
            </button>

            <button
              onClick={() => handleOpenQuickAdd()}
              className="px-3 py-1.5 rounded-xl border border-dashed border-emerald-500 text-emerald-700 hover:bg-emerald-50 text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>+ Add New Item</span>
            </button>
          </div>
        </div>

        {/* Product Catalog Display - Cleanly Separated by Type */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-stone-400">
              <div className="animate-spin w-7 h-7 border-3 border-amber-600 border-t-transparent rounded-full mr-3" />
              <span>Loading menu items...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-stone-300 space-y-3">
              <Utensils className="w-10 h-10 text-stone-300 mx-auto" />
              <div>
                <h3 className="font-semibold text-stone-700">No products found</h3>
                <p className="text-xs text-stone-400 mt-1">
                  {searchQuery ? `No item matching "${searchQuery}"` : 'Try a different category or add a new item'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenQuickAdd(searchQuery)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add "{searchQuery || 'New Product'}" to Menu</span>
              </button>
            </div>
          ) : selectedCategory !== 'All' && !searchQuery ? (
            /* Single Category View with Station Banner */
            <div className="space-y-3">
              <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 bg-amber-50 rounded-xl border border-amber-200/80">
                    {categoryIcons[selectedCategory] || '🍴'}
                  </span>
                  <div>
                    <h3 className="font-extrabold text-stone-900 text-base">{selectedCategory}</h3>
                    <p className="text-xs text-stone-500">{categoryDescriptions[selectedCategory] || 'Items in this section'}</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-200">
                  {filteredProducts.length} Options
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map(product => {
                  const inCart = cartItems.find(i => i.product_id === product.id);
                  return (
                    <div
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`bg-white rounded-2xl p-3.5 border transition cursor-pointer flex flex-col justify-between group hover:shadow-md select-none relative ${
                        inCart
                          ? 'border-amber-500 ring-2 ring-amber-400/20 bg-amber-50/20 shadow-xs'
                          : 'border-stone-200/80 hover:border-amber-300'
                      }`}
                    >
                      {inCart && (
                        <span className="absolute -top-2 -right-2 bg-amber-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-in zoom-in-75">
                          {inCart.quantity}
                        </span>
                      )}

                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md inline-block mb-1.5">
                          {categoryIcons[product.category_name] || '🍴'} {product.category_name}
                        </span>
                        <h4 className="font-bold text-stone-900 text-sm leading-snug line-clamp-2 group-hover:text-amber-800">
                          {product.name}
                        </h4>
                        {product.description && (
                          <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                            {product.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                        <div className="font-extrabold text-base text-stone-900">
                          ₹{product.selling_price}
                        </div>
                        <button
                          type="button"
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition ${
                            inCart
                              ? 'bg-amber-600 text-white'
                              : 'bg-stone-100 text-stone-700 group-hover:bg-amber-600 group-hover:text-white'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Multi-Category Separated Sections (Never Mixed Together!) */
            <div className="space-y-6">
              {categories.map(cat => {
                const catItems = filteredProducts.filter(p => p.category_name === cat.name);
                if (catItems.length === 0) return null;

                return (
                  <div key={cat.id} className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs space-y-3">
                    {/* Clean Distinct Section Divider */}
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{categoryIcons[cat.name] || '🍴'}</span>
                        <h3 className="font-extrabold text-stone-900 text-sm tracking-tight">{cat.name}</h3>
                      </div>
                      <span className="text-[11px] font-bold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-full">
                        {catItems.length} items
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                      {catItems.map(product => {
                        const inCart = cartItems.find(i => i.product_id === product.id);
                        return (
                          <div
                            key={product.id}
                            onClick={() => addToCart(product)}
                            className={`bg-stone-50/50 hover:bg-white rounded-2xl p-3 border transition cursor-pointer flex flex-col justify-between group hover:shadow-md select-none relative ${
                              inCart
                                ? 'border-amber-500 ring-2 ring-amber-400/20 bg-amber-50/20'
                                : 'border-stone-200/80 hover:border-amber-300'
                            }`}
                          >
                            {inCart && (
                              <span className="absolute -top-2 -right-2 bg-amber-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-in zoom-in-75">
                                {inCart.quantity}
                              </span>
                            )}

                            <div>
                              <h4 className="font-bold text-stone-900 text-sm leading-snug line-clamp-2 group-hover:text-amber-800">
                                {product.name}
                              </h4>
                              {product.description && (
                                <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                                  {product.description}
                                </p>
                              )}
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between">
                              <div className="font-extrabold text-base text-stone-900">
                                ₹{product.selling_price}
                              </div>
                              <button
                                type="button"
                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition ${
                                  inCart
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-white border border-stone-200 text-stone-700 group-hover:bg-amber-600 group-hover:text-white'
                                }`}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Counter POS Order Cart & Checkout */}
      <div className="w-full lg:w-105 xl:w-115 flex flex-col shrink-0">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col h-full overflow-hidden">
          {/* Order Header */}
          <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-400 bg-stone-800 px-2 py-0.5 rounded">
                  {orderNumber}
                </span>
                <span className="text-xs text-stone-400">New Order</span>
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">Counter Terminal</div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={resetForm}
                title="Clear order"
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 text-xs flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* Customer & Order Type Strip */}
          <div className="p-3 bg-stone-50 border-b border-stone-200 space-y-2">
            {/* Dine-in / Takeaway / Delivery Switch */}
            <div className="grid grid-cols-3 gap-1.5 bg-stone-200/70 p-1 rounded-xl text-xs font-semibold">
              {[
                { id: 'takeaway', label: 'Takeaway' },
                { id: 'dine_in', label: 'Dine-In' },
                { id: 'delivery', label: 'Delivery' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOrderType(t.id)}
                  className={`py-1.5 rounded-lg transition ${
                    orderType === t.id
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Optional Customer Name & Phone */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <User className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Customer Name (opt)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Phone (opt)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Cart Items List - Cleanly Grouped by Type for Packing & Delivery */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[160px] max-h-[35vh] lg:max-h-[38vh]">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 text-stone-400">
                <ShoppingBag className="w-10 h-10 text-stone-300 mb-2 stroke-1" />
                <p className="text-xs font-medium text-stone-600">Cart is empty</p>
                <p className="text-[11px] text-stone-400 mt-0.5">Select a category on the left to add items</p>
              </div>
            ) : (
              (() => {
                const groupedCart = cartItems.reduce((acc, item) => {
                  const cat = item.category_name || 'General Items';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {});

                return Object.entries(groupedCart).map(([catName, items]) => (
                  <div key={catName} className="bg-stone-50/90 rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
                    {/* Station / Category Header */}
                    <div className="px-3 py-1.5 bg-stone-200/70 border-b border-stone-200 flex items-center justify-between text-[11px] font-bold text-stone-800 uppercase tracking-wide">
                      <div className="flex items-center gap-1.5">
                        <span>{categoryIcons[catName] || '🍴'}</span>
                        <span>{catName}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-stone-600 bg-white px-2 py-0.2 rounded-full border border-stone-200">
                        {items.reduce((sum, i) => sum + i.quantity, 0)} pcs
                      </span>
                    </div>

                    <div className="p-2 space-y-2 divide-y divide-stone-100">
                      {items.map((item) => (
                        <div key={item.product_id} className="pt-2 first:pt-0 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <h5 className="font-bold text-xs text-stone-900 truncate">{item.product_name}</h5>
                              <span className="text-[11px] text-stone-500">₹{item.unit_price} each</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Qty +/- */}
                              <div className="flex items-center border border-stone-200 bg-white rounded-lg overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product_id, -1)}
                                  className="px-2 py-1 text-stone-600 hover:bg-stone-100 transition"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="px-2 text-xs font-bold text-stone-800">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product_id, 1)}
                                  className="px-2 py-1 text-stone-600 hover:bg-stone-100 transition"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="w-14 text-right font-extrabold text-xs text-stone-900">
                                ₹{item.quantity * item.unit_price}
                              </div>

                              <button
                                type="button"
                                onClick={() => removeItem(item.product_id)}
                                className="text-stone-400 hover:text-rose-600 p-1 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Special instruction text + Quick Chips */}
                          <div>
                            <input
                              type="text"
                              placeholder="Special note (e.g. extra crispy, less cream)..."
                              value={item.special_notes}
                              onChange={(e) => updateItemNotes(item.product_id, e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-stone-200 rounded text-[11px] text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />

                            {/* Quick instruction chips */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {quickNotesList.slice(0, 4).map(chip => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => appendQuickNote(item.product_id, chip)}
                                  className="text-[9px] bg-white border border-stone-200 hover:bg-amber-100 hover:text-amber-900 text-stone-600 px-1.5 py-0.5 rounded transition cursor-pointer"
                                >
                                  +{chip}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>

          {/* Discount & Taxes Accordion */}
          <div className="px-3 py-2 bg-stone-100/70 border-t border-stone-200 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-700" />
                <span className="font-semibold text-stone-700">Discount:</span>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  className="bg-white border border-stone-300 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                >
                  <option value="fixed">₹ Flat</option>
                  <option value="percent">% Pct</option>
                </select>
                <input
                  type="number"
                  placeholder="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-16 bg-white border border-stone-300 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            {/* Quick discount chips */}
            <div className="flex items-center gap-1.5">
              {[
                { label: '5%', type: 'percent', val: '5' },
                { label: '10%', type: 'percent', val: '10' },
                { label: '₹20', type: 'fixed', val: '20' },
                { label: '₹50', type: 'fixed', val: '50' }
              ].map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setDiscountType(chip.type);
                    setDiscountValue(chip.val);
                  }}
                  className="px-2 py-0.5 bg-white border border-stone-200 text-[10px] text-stone-600 rounded hover:bg-amber-50 hover:border-amber-300 cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
              {discountValue && (
                <button
                  type="button"
                  onClick={() => setDiscountValue('')}
                  className="text-[10px] text-stone-400 hover:text-stone-600 ml-auto"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Tax toggle */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
              <label className="flex items-center gap-2 cursor-pointer text-stone-600">
                <input
                  type="checkbox"
                  checked={applyTax}
                  onChange={(e) => setApplyTax(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-0"
                />
                <span>Apply GST ({settings.tax_rate || 5}%)</span>
              </label>
              {applyTax && <span className="font-medium text-stone-800">+₹{taxAmount.toFixed(2)}</span>}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="p-3 bg-white border-t border-stone-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
              <span>Payment Mode:</span>
              <span className="text-[11px] font-normal text-stone-500">
                {paymentChoice === 'full' ? 'Full Paid' : paymentChoice === 'unpaid' ? 'Unpaid' : `Paid ₹${amountPaid}`}
              </span>
            </div>

            {/* Payment Mode buttons */}
            <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
              {['UPI', 'Cash', 'Card', 'Other'].map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-1.5 rounded-xl border text-center transition cursor-pointer ${
                    paymentMethod === method
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Payment Status (Full / Split / Unpaid) */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPaymentChoice('full')}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-lg border transition ${
                  paymentChoice === 'full'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-stone-200 text-stone-600'
                }`}
              >
                Full Paid
              </button>
              <button
                type="button"
                onClick={() => setPaymentChoice('unpaid')}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-lg border transition ${
                  paymentChoice === 'unpaid'
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-white border-stone-200 text-stone-600'
                }`}
              >
                Unpaid (Credit)
              </button>
              <button
                type="button"
                onClick={() => setPaymentChoice('custom')}
                className={`flex-1 py-1 text-[11px] font-semibold rounded-lg border transition ${
                  paymentChoice === 'custom'
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-white border-stone-200 text-stone-600'
                }`}
              >
                Partial Paid
              </button>
            </div>

            {paymentChoice === 'custom' && (
              <div className="flex items-center gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200">
                <span className="text-xs text-stone-600">Amount Paid:</span>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={customAmountPaid}
                  onChange={(e) => setCustomAmountPaid(e.target.value)}
                  className="w-28 px-2 py-1 bg-white border border-stone-300 rounded text-xs font-bold focus:outline-none"
                />
                <span className="text-xs text-stone-400">Balance: ₹{outstandingBalance.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Subtotal, Discount & Grand Total Bar */}
          <div className="p-4 bg-stone-900 text-white border-t border-stone-800 space-y-1.5">
            <div className="flex justify-between text-xs text-stone-400">
              <span>Subtotal:</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-xs text-amber-400">
                <span>Discount:</span>
                <span>-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}

            {taxAmount > 0 && (
              <div className="flex justify-between text-xs text-stone-400">
                <span>Tax ({taxRate}%):</span>
                <span>+₹{taxAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-stone-800">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-stone-400 block">Total Due</span>
                <span className="text-2xl font-black text-amber-400">₹{finalTotal.toFixed(2)}</span>
              </div>

              {outstandingBalance > 0 && (
                <div className="text-right">
                  <span className="text-[10px] text-rose-400 block uppercase font-semibold">Balance Due</span>
                  <span className="text-sm font-bold text-rose-300">₹{outstandingBalance.toFixed(2)}</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-2 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-200 text-xs mt-2">
                {errorMsg}
              </div>
            )}

            {/* Save Order CTA Button */}
            <button
              type="button"
              disabled={isSubmitting || cartItems.length === 0}
              onClick={handleSaveOrder}
              className={`w-full mt-2 py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-md flex items-center justify-center gap-2 transition cursor-pointer ${
                cartItems.length === 0 || isSubmitting
                  ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-600/30'
              }`}
            >
              {isSubmitting ? (
                <span>Saving Order...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>COMPLETE & PRINT RECEIPT</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {showReceipt && savedOrder && (
        <ReceiptModal
          order={savedOrder}
          settings={settings}
          onClose={() => setShowReceipt(false)}
          onNextOrder={() => {
            setShowReceipt(false);
            resetForm();
          }}
        />
      )}

      {/* Quick Add New Item / Custom Product Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-600 rounded-lg text-white">
                  <Plus className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-sm">Add New Item to Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddModal(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickItem} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Strawberry Nutella Shake, Extra Dip"
                  value={quickItemName}
                  onChange={(e) => setQuickItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="e.g. 89"
                    value={quickItemPrice}
                    onChange={(e) => setQuickItemPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quickAddQty}
                    onChange={(e) => setQuickAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-stone-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Category</label>
                <select
                  value={quickItemCategory}
                  onChange={(e) => setQuickItemCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-none"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="__custom__">+ Create New Category...</option>
                </select>
              </div>

              {quickItemCategory === '__custom__' && (
                <div>
                  <label className="font-bold text-stone-700 block mb-1">New Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Seasonal Specials, Combos"
                    value={quickCustomCategory}
                    onChange={(e) => setQuickCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-stone-700 block mb-1">Special Preparation Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Extra hot, Less sugar, No ice"
                  value={quickItemNotes}
                  onChange={(e) => setQuickItemNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                />
              </div>

              {/* Checkbox to save permanently */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-800">
                  <input
                    type="checkbox"
                    checked={quickSaveToMenu}
                    onChange={(e) => setQuickSaveToMenu(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-0"
                  />
                  <span>Save permanently to Menu catalog for future orders</span>
                </label>
                <span className="text-[10px] text-stone-500 block ml-5 mt-0.5">
                  If unchecked, will only be added to this current customer ticket as a custom item.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{quickAddSaving ? 'Adding...' : 'Add to Current Ticket'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
