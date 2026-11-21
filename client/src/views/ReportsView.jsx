import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Clock,
  Printer,
  CheckCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Receipt
} from 'lucide-react';

export default function ReportsView({ settings = {} }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickPeriod, setQuickPeriod] = useState('all'); // 'all', 'today', 'this_month', 'last_month'

  const handlePeriodChange = (period) => {
    setQuickPeriod(period);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (period === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (period === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (period === '7days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (period === 'this_month') {
      const startOfMonth = todayStr.slice(0, 7) + '-01';
      setStartDate(startOfMonth);
      setEndDate(todayStr);
    }
  };

  const buildExportUrl = (endpoint) => {
    let url = `/api/reports/export/${endpoint}?`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    return url;
  };

  const reportsList = [
    {
      id: 'orders',
      title: 'Complete Order History Export',
      description: 'Comprehensive line-item spreadsheet of all customer orders, item subtotals, discounts, taxes, payment modes, outstanding balance, and COGS profit.',
      endpoint: 'orders',
      icon: Receipt,
      color: 'amber'
    },
    {
      id: 'daily-summary',
      title: 'Daily Sales & Profit Ledger',
      description: 'Day-by-day financial reconciliation containing gross sales, applied discounts, net revenue, material costs, gross profit, operating expenses, and net profit.',
      endpoint: 'daily-summary',
      icon: TrendingUp,
      color: 'emerald'
    },
    {
      id: 'products',
      title: 'Product Performance & Margins',
      description: 'Breakdown of units sold, total revenue collected, cost of goods consumed, and gross profit margin percentage per waffle and beverage.',
      endpoint: 'products',
      icon: FileSpreadsheet,
      color: 'blue'
    },
    {
      id: 'expenses',
      title: 'Operating Expenses Ledger',
      description: 'All recorded shop expenditures categorized by power, rent, salaries, packaging, stock purchases, and counter cash outflows.',
      endpoint: 'expenses',
      icon: DollarSign,
      color: 'rose'
    }
  ];

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto space-y-6">
      {/* Date Filter & Control Card */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <span>Generate Business Reports & Data Exports</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Select a reporting timeframe and download Excel/CSV files directly from actual database records.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2 border-t border-stone-100">
          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold w-full md:w-auto">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today Only' },
              { id: '7days', label: 'Last 7 Days' },
              { id: 'this_month', label: 'This Month' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePeriodChange(p.id)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  quickPeriod === p.id
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-2 text-xs w-full md:w-auto justify-end">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setQuickPeriod('custom');
              }}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
              placeholder="From"
            />
            <span className="text-stone-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setQuickPeriod('custom');
              }}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportsList.map(report => {
          const Icon = report.icon;
          const downloadUrl = buildExportUrl(report.endpoint);

          return (
            <div
              key={report.id}
              className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col justify-between hover:shadow-md transition"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                    .CSV / Excel
                  </span>
                </div>

                <h4 className="font-bold text-stone-900 text-base">{report.title}</h4>
                <p className="text-xs text-stone-500 leading-relaxed">{report.description}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[11px] text-stone-400">
                  {startDate && endDate ? `${startDate} to ${endDate}` : 'Complete records'}
                </span>

                <a
                  href={downloadUrl}
                  download
                  className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
