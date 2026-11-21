import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Receipt,
  Percent,
  Database,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  Save,
  RotateCcw
} from 'lucide-react';

export default function SettingsView({ settings = {}, onSettingsUpdated }) {
  const [formData, setFormData] = useState({
    shop_name: 'Waffel Den',
    tagline: 'Freshly Baked Belgian & Chocolate Waffles',
    phone: '+91 98765 43210',
    address: 'Shop 4, Market Promenade, Main Road',
    currency_symbol: '₹',
    tax_enabled: '0',
    tax_rate: '5',
    tax_type: 'exclusive',
    receipt_footer: 'Thank you for visiting Waffel Den! Have a sweet day :)',
    order_prefix: 'WD-',
    thermal_width: '80mm',
    track_inventory_auto: '0'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Restore state
  const [restoreStatus, setRestoreStatus] = useState('');

  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      setFormData(prev => ({ ...prev, ...settings }));
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? '1' : '0') : value
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMsg('');

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Failed to save settings');

      const data = await res.json();
      setSaveSuccess(true);
      if (onSettingsUpdated) onSettingsUpdated(data.settings);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Restore JSON file handler
  const handleFileRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Warning: Restoring a backup will overwrite current database records. Proceed?')) {
      e.target.value = '';
      return;
    }

    setRestoreStatus('Reading backup file...');
    try {
      const text = await file.text();
      const backupJson = JSON.parse(text);

      setRestoreStatus('Restoring database records...');
      const res = await fetch('/api/settings/restore/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupJson)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Restore failed');
      }

      setRestoreStatus('Database successfully restored! Reloading application...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      alert(`Error restoring backup: ${err.message}`);
      setRestoreStatus('');
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-base">Shop Settings & Configuration</h3>
            <p className="text-xs text-stone-500">Customize receipt headers, taxes, currency, and database backups</p>
          </div>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-semibold animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Shop Profile & Identity */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
            <Store className="w-4 h-4 text-amber-600" />
            <h4 className="font-bold text-stone-900 text-sm">Shop Identity & Receipt Headers</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-stone-700 block mb-1">Shop Name *</label>
              <input
                type="text"
                name="shop_name"
                required
                value={formData.shop_name}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 block mb-1">Tagline</label>
              <input
                type="text"
                name="tagline"
                value={formData.tagline}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 block mb-1">Contact Phone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 block mb-1">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-stone-700 block mb-1">Thermal Receipt Footer Message</label>
              <input
                type="text"
                name="receipt_footer"
                value={formData.receipt_footer}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Taxes & Currency Configuration */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
            <Percent className="w-4 h-4 text-amber-600" />
            <h4 className="font-bold text-stone-900 text-sm">Taxes & POS Configuration</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-stone-700 block mb-1">Currency Symbol</label>
              <input
                type="text"
                name="currency_symbol"
                value={formData.currency_symbol}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 block mb-1">Order Number Prefix</label>
              <input
                type="text"
                name="order_prefix"
                value={formData.order_prefix}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold text-stone-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-stone-700 block mb-1">Default GST / Tax Rate (%)</label>
              <input
                type="number"
                name="tax_rate"
                value={formData.tax_rate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-900 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-700">
                <input
                  type="checkbox"
                  name="tax_enabled"
                  checked={formData.tax_enabled === '1'}
                  onChange={handleChange}
                  className="rounded text-amber-600"
                />
                <span>Enable GST / Tax calculation by default on new orders</span>
              </label>
            </div>
          </div>
        </div>

        {/* Save button bar */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Database Backup & Disaster Recovery Card */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
          <Database className="w-4 h-4 text-emerald-600" />
          <h4 className="font-bold text-stone-900 text-sm">Database Backup & Safe Restore</h4>
        </div>

        <p className="text-xs text-stone-500">
          Your orders, menu, inventory, and expense data are stored securely on this computer in a persistent SQLite database.
          Create regular backups to safeguard your business records.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Download JSON Backup */}
          <a
            href="/api/settings/backup/json"
            download
            className="p-4 rounded-xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50/30 transition flex flex-col justify-between group cursor-pointer"
          >
            <div>
              <span className="font-bold text-stone-900 text-xs block group-hover:text-amber-800">
                1-Click JSON Backup
              </span>
              <span className="text-[11px] text-stone-500 mt-0.5 block">
                Export complete database records to portable JSON file
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </div>
          </a>

          {/* Download Raw SQLite DB */}
          <a
            href="/api/settings/backup/db"
            download
            className="p-4 rounded-xl border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition flex flex-col justify-between group cursor-pointer"
          >
            <div>
              <span className="font-bold text-stone-900 text-xs block group-hover:text-emerald-800">
                Raw SQLite DB File
              </span>
              <span className="text-[11px] text-stone-500 mt-0.5 block">
                Direct copy of `waffelden.db` binary file
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Download className="w-3.5 h-3.5" />
              <span>Download .db</span>
            </div>
          </a>

          {/* Restore JSON */}
          <div className="p-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 flex flex-col justify-between">
            <div>
              <span className="font-bold text-stone-900 text-xs block">Restore From Backup</span>
              <span className="text-[11px] text-stone-500 mt-0.5 block">
                Upload a previously saved JSON backup file
              </span>
            </div>
            <div className="mt-3">
              <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg text-xs font-semibold text-stone-700 cursor-pointer shadow-xs">
                <Upload className="w-3.5 h-3.5" />
                <span>Choose Backup File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileRestore}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {restoreStatus && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-900">
            {restoreStatus}
          </div>
        )}
      </div>
    </div>
  );
}
