import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Tag,
  DollarSign,
  TrendingUp,
  Percent,
  X,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';

export default function ProductsView() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [name, setName] = useState('');
  const [categoryName, setCategoryName] = useState('Classic Waffles');
  const [description, setDescription] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [ingredientCost, setIngredientCost] = useState('');
  const [prepCost, setPrepCost] = useState('');
  const [packagingCost, setPackagingCost] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Add Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    fetchProductsAndCategories();
  }, []);

  const fetchProductsAndCategories = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/products/categories')
      ]);
      const prods = await pRes.json();
      const cats = await cRes.json();
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setCategoryName(categories[0]?.name || 'Classic Waffles');
    setDescription('');
    setSellingPrice('');
    setIngredientCost('0');
    setPrepCost('0');
    setPackagingCost('0');
    setIsActive(true);
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCategoryName(prod.category_name);
    setDescription(prod.description || '');
    setSellingPrice(String(prod.selling_price));
    setIngredientCost(String(prod.ingredient_cost));
    setPrepCost(String(prod.prep_cost));
    setPackagingCost(String(prod.packaging_cost));
    setIsActive(Boolean(prod.is_active));
    setErrorMsg('');
    setModalOpen(true);
  };

  // Live Unit Cost & Margin preview calculations
  const priceNum = Number(sellingPrice) || 0;
  const ingNum = Number(ingredientCost) || 0;
  const prepNum = Number(prepCost) || 0;
  const packNum = Number(packagingCost) || 0;
  const totalCostLive = ingNum + prepNum + packNum;
  const unitProfitLive = priceNum - totalCostLive;
  const marginPctLive = priceNum > 0 ? ((unitProfitLive / priceNum) * 100).toFixed(1) : '0';

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Product name is required');
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        category_name: categoryName,
        description: description.trim(),
        selling_price: priceNum,
        ingredient_cost: ingNum,
        prep_cost: prepNum,
        packaging_cost: packNum,
        is_active: isActive ? 1 : 0
      };

      let url = '/api/products';
      let method = 'POST';

      if (editingProduct) {
        url = `/api/products/${editingProduct.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save product');
      }

      setModalOpen(false);
      fetchProductsAndCategories();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteProduct = async (id, prodName) => {
    if (!confirm(`Are you sure you want to remove or deactivate "${prodName}"?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProductsAndCategories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() })
      });
      if (res.ok) {
        setNewCatName('');
        setCatModalOpen(false);
        fetchProductsAndCategories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category_name === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search waffles, menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 w-full sm:w-auto focus:outline-none"
          >
            <option value="All">All Categories ({products.length})</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Buttons: Add Product & Add Category */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setCatModalOpen(true)}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            + Add Category
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Product</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-100/80 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-right">Unit Cost</th>
                <th className="py-3 px-3 text-right">Unit Profit</th>
                <th className="py-3 px-3 text-right">Margin %</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-stone-400">
                    <div className="animate-spin w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full mx-auto mb-2" />
                    <span>Loading menu catalog...</span>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-stone-400">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isMarginHealthy = p.profit_margin_pct >= 40;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-stone-900">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-stone-500 line-clamp-1">{p.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-100/70 text-amber-800">
                          {p.category_name}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-stone-900">
                        ₹{p.selling_price}
                      </td>
                      <td className="py-3.5 px-3 text-right text-stone-600">
                        ₹{p.total_unit_cost?.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-700">
                        ₹{p.expected_profit?.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            isMarginHealthy
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {p.profit_margin_pct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {p.is_active ? (
                          <span className="text-emerald-700 font-semibold text-[11px]">Active</span>
                        ) : (
                          <span className="text-stone-400 font-semibold text-[11px]">Deactivated</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-stone-500 hover:text-amber-800 hover:bg-stone-100 rounded-lg transition"
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete or Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProduct ? 'Edit Menu Product' : 'Add New Waffle / Product'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5">
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Belgian Triple Chocolate Waffle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Category</label>
                  <select
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Availability Status</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-semibold text-stone-700">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Active in POS Menu</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Ingredients, toppings, or customer flavor notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
                />
              </div>

              {/* Selling Price & Unit Costs Grid */}
              <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
                <div className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  <span>Cost of Goods & Pricing Formula</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">Selling Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="150"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-stone-600 block mb-1">Ingredient Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="35"
                      value={ingredientCost}
                      onChange={(e) => setIngredientCost(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-stone-600 block mb-1">Prep Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="8"
                      value={prepCost}
                      onChange={(e) => setPrepCost(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-stone-600 block mb-1">Packaging (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="7"
                      value={packagingCost}
                      onChange={(e) => setPackagingCost(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Real-time Profit Preview badge */}
                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs font-semibold">
                  <div className="text-stone-600">
                    Total Unit Cost: <span className="font-bold text-stone-900">₹{totalCostLive.toFixed(2)}</span>
                  </div>
                  <div className="text-emerald-800">
                    Profit/Unit: <span className="font-extrabold">₹{unitProfitLive.toFixed(2)}</span> ({marginPctLive}%)
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-stone-200 space-y-3">
            <h3 className="font-bold text-stone-900 text-sm">Add New Menu Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Category Name (e.g. Mini Waffles, Savory)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
