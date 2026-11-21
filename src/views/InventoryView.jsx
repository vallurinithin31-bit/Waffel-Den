import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  History,
  Trash2,
  Edit,
  X,
  Search,
  Package
} from 'lucide-react';

export default function InventoryView() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'movements'
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [currentStock, setCurrentStock] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [category, setCategory] = useState('Flour & Mixes');
  const [supplier, setSupplier] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Stock Movement Modal (Purchase / Usage / Wastage / Adjustment)
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementItem, setMovementItem] = useState(null);
  const [movementType, setMovementType] = useState('PURCHASE'); // 'PURCHASE', 'USAGE', 'WASTAGE', 'ADJUSTMENT'
  const [qtyChange, setQtyChange] = useState('');
  const [movementNotes, setMovementNotes] = useState('');

  const unitsList = ['kg', 'g', 'L', 'ml', 'pcs', 'packets', 'boxes'];
  const categoriesList = ['Flour & Mixes', 'Chocolates & Spreads', 'Dairy', 'Toppings', 'Packaging', 'General'];

  useEffect(() => {
    fetchInventory();
    fetchMovements();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await fetch('/api/inventory/movements?limit=60');
      const data = await res.json();
      setMovements(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddItemModal = () => {
    setEditingItem(null);
    setName('');
    setUnit('kg');
    setCurrentStock('');
    setReorderLevel('5');
    setCostPerUnit('');
    setCategory('Flour & Mixes');
    setSupplier('');
    setErrorMsg('');
    setItemModalOpen(true);
  };

  const openEditItemModal = (item) => {
    setEditingItem(item);
    setName(item.name);
    setUnit(item.unit);
    setCurrentStock(String(item.current_stock));
    setReorderLevel(String(item.reorder_level));
    setCostPerUnit(String(item.cost_per_unit));
    setCategory(item.category || 'General');
    setSupplier(item.supplier || '');
    setErrorMsg('');
    setItemModalOpen(true);
  };

  const openMovementModal = (item, defaultType = 'PURCHASE') => {
    setMovementItem(item);
    setMovementType(defaultType);
    setQtyChange('');
    setMovementNotes('');
    setMovementModalOpen(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Ingredient name is required');
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        unit: unit.trim(),
        current_stock: Number(currentStock) || 0,
        reorder_level: Number(reorderLevel) || 0,
        cost_per_unit: Number(costPerUnit) || 0,
        category,
        supplier: supplier.trim()
      };

      let url = '/api/inventory';
      let method = 'POST';
      if (editingItem) {
        url = `/api/inventory/${editingItem.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save inventory item');
      }

      setItemModalOpen(false);
      fetchInventory();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveMovement = async (e) => {
    e.preventDefault();
    const qty = Number(qtyChange);
    if (isNaN(qty) || qty === 0) return;

    // Negate for USAGE or WASTAGE
    const delta = (movementType === 'USAGE' || movementType === 'WASTAGE') ? -Math.abs(qty) : Math.abs(qty);

    try {
      const res = await fetch(`/api/inventory/${movementItem.id}/movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movement_type: movementType,
          quantity_change: delta,
          notes: movementNotes.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record stock movement');
      }

      setMovementModalOpen(false);
      fetchInventory();
      fetchMovements();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteItem = async (id, itemName) => {
    if (!confirm(`Delete ingredient "${itemName}"?`)) return;
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      if (res.ok) fetchInventory();
    } catch (err) {
      console.error(err);
    }
  };

  const lowStockItems = items.filter(i => i.is_low_stock);
  const filteredItems = items.filter(i =>
    !searchQuery.trim() ||
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.category && i.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto space-y-6">
      {/* Low Stock Alert Banner (if any) */}
      {lowStockItems.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-rose-950 text-sm">
                Low Stock Alert: {lowStockItems.length} ingredient(s) need replenishment!
              </h4>
              <p className="text-xs text-rose-700">
                {lowStockItems.map(i => `${i.name} (${i.current_stock} ${i.unit} left)`).join(' • ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => openMovementModal(lowStockItems[0], 'PURCHASE')}
            className="px-3.5 py-1.5 bg-rose-700 text-white rounded-xl text-xs font-semibold hover:bg-rose-800 shrink-0 cursor-pointer"
          >
            Restock
          </button>
        </div>
      )}

      {/* Top Controls: Tabs & Add Button */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tab switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'stock'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Ingredient Stock ({items.length})
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'movements'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Stock Movement Logs ({movements.length})
          </button>
        </div>

        {/* Search & Add */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {activeTab === 'stock' && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={openAddItemModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Ingredient</span>
          </button>
        </div>
      </div>

      {/* View Content */}
      {activeTab === 'stock' ? (
        /* Inventory Items Table */
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100/80 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                  <th className="py-3 px-4">Ingredient / Item</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Current Stock</th>
                  <th className="py-3 px-3 text-right">Reorder Threshold</th>
                  <th className="py-3 px-3 text-right">Cost / Unit</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-stone-400">
                      <div className="animate-spin w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full mx-auto mb-2" />
                      <span>Loading stock levels...</span>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-stone-400">
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr
                      key={item.id}
                      className={`hover:bg-stone-50/80 transition ${
                        item.is_low_stock ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-stone-900">{item.name}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-semibold text-[11px]">
                          {item.category || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-stone-900">
                        {item.current_stock} <span className="font-normal text-stone-500">{item.unit}</span>
                      </td>
                      <td className="py-3 px-3 text-right text-stone-600">
                        {item.reorder_level} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-stone-800">
                        ₹{item.cost_per_unit}/{item.unit}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.is_low_stock ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 animate-pulse">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Adequate
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-stone-500 truncate max-w-[130px]">
                        {item.supplier || '—'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openMovementModal(item, 'PURCHASE')}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded transition cursor-pointer"
                            title="Add Stock"
                          >
                            + Stock
                          </button>
                          <button
                            onClick={() => openMovementModal(item, 'USAGE')}
                            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold rounded transition cursor-pointer"
                            title="Record Usage / Wastage"
                          >
                            - Deduct
                          </button>
                          <button
                            onClick={() => openEditItemModal(item)}
                            className="p-1 text-stone-400 hover:text-stone-800 rounded transition"
                            title="Edit Item"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="p-1 text-stone-400 hover:text-rose-600 rounded transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      ) : (
        /* Movements Log Table */
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100/80 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                  <th className="py-3 px-4">Timestamp (IST)</th>
                  <th className="py-3 px-3">Ingredient</th>
                  <th className="py-3 px-3 text-center">Movement Type</th>
                  <th className="py-3 px-3 text-right">Quantity Change</th>
                  <th className="py-3 px-3 text-right">New Balance</th>
                  <th className="py-3 px-4">Notes / Bill Memo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-stone-400">
                      No stock movement history recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map(m => (
                    <tr key={m.id} className="hover:bg-stone-50 transition">
                      <td className="py-3 px-4 text-stone-500 font-mono">
                        {m.created_at?.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-3 px-3 font-bold text-stone-900">{m.ingredient_name}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.movement_type === 'PURCHASE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.movement_type === 'WASTAGE'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-stone-900">
                        {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change} {m.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-stone-700">
                        {m.new_balance} {m.unit}
                      </td>
                      <td className="py-3 px-4 text-stone-600">{m.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Ingredient Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingItem ? 'Edit Ingredient' : 'Add Inventory Ingredient'}
              </h3>
              <button onClick={() => setItemModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-3.5 text-xs">
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="font-bold text-stone-700 block mb-1">Ingredient / Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Belgian Dark Chocolate Ganache"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                  >
                    {categoriesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Unit of Measure *</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl font-bold focus:outline-none"
                  >
                    {unitsList.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Initial Stock</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="10"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value)}
                    className="w-full px-2 py-1.5 bg-stone-50 border border-stone-300 rounded-lg font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Reorder Alert</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="3"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full px-2 py-1.5 bg-stone-50 border border-stone-300 rounded-lg font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Cost / Unit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="450"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    className="w-full px-2 py-1.5 bg-stone-50 border border-stone-300 rounded-lg font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. Callebaut India Depot"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-3.5 py-1.5 text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                >
                  Save Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Stock Movement Modal */}
      {movementModalOpen && movementItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-stone-200 space-y-3">
            <h3 className="font-bold text-stone-900 text-sm">
              Stock Movement: {movementItem.name}
            </h3>
            <p className="text-xs text-stone-500">
              Current balance: <span className="font-bold text-stone-800">{movementItem.current_stock} {movementItem.unit}</span>
            </p>

            <form onSubmit={handleSaveMovement} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Movement Type</label>
                <div className="grid grid-cols-2 gap-1.5 font-bold">
                  {[
                    { id: 'PURCHASE', label: '+ Stock Purchase' },
                    { id: 'USAGE', label: '- Daily Usage' },
                    { id: 'WASTAGE', label: '- Wastage/Spoil' },
                    { id: 'ADJUSTMENT', label: '± Manual Audit' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMovementType(t.id)}
                      className={`py-1.5 rounded-lg border transition ${
                        movementType === t.id
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-stone-50 text-stone-700 border-stone-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Quantity ({movementItem.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={`Amount in ${movementItem.unit}`}
                  value={qtyChange}
                  onChange={(e) => setQtyChange(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Reason / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Received new stock shipment #402"
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovementModalOpen(false)}
                  className="px-3 py-1.5 text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                >
                  Record Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
