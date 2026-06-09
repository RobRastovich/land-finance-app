import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';
import { Plus, Trash2 } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Land Acquisition', 'Development', 'Infrastructure', 'Engineering',
  'Legal & Permits', 'Marketing', 'Interest & Financing', 'Taxes & Insurance',
  'Management Fees', 'Utilities', 'Other',
];

export default function ProfitLoss() {
  const { projectId } = useApp();
  const [pnl, setPnl] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expForm, setExpForm] = useState({
    category: 'Development', description: '', amount: '', expense_date: '', vendor: '', reference_num: '', notes: '',
  });

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [pnlData, expData] = await Promise.all([
        api.getPnL(projectId),
        api.getExpenses(projectId),
      ]);
      setPnl(pnlData);
      setExpenses(expData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleExpenseSubmit(e) {
    e.preventDefault();
    try {
      await api.createExpense(projectId, {
        ...expForm,
        amount: parseFloat(expForm.amount),
      });
      setExpForm({ category: 'Development', description: '', amount: '', expense_date: '', vendor: '', reference_num: '', notes: '' });
      setShowExpenseForm(false);
      load();
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteExpense(id) {
    if (!window.confirm('Delete this expense?')) return;
    await api.deleteExpense(id);
    load();
  }

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  if (loading) return <div className="text-gray-400 p-8">Loading P&L...</div>;

  return (
    <div className="space-y-6">
      {/* P&L Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="text-xs text-gray-500 uppercase font-semibold">Revenue Received</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{fmt(pnl?.revenue?.total_received)}</div>
          <div className="text-xs text-gray-400 mt-1">of {fmt(pnl?.revenue?.total_expected)} expected</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="text-xs text-gray-500 uppercase font-semibold">Total Expenses</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{fmt(pnl?.expenses?.total)}</div>
          <div className="text-xs text-gray-400 mt-1">{pnl?.expenses?.by_category?.length || 0} categories</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="text-xs text-gray-500 uppercase font-semibold">Net Income</div>
          <div className={`text-2xl font-bold mt-1 ${(pnl?.net_income || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(pnl?.net_income)}
          </div>
          <div className="text-xs text-gray-400 mt-1">Revenue - Expenses</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="text-xs text-gray-500 uppercase font-semibold">Outstanding AR</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">
            {fmt((pnl?.revenue?.total_expected || 0) - (pnl?.revenue?.total_received || 0))}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {pnl?.revenue?.pending_count || 0} pending · {pnl?.revenue?.overdue_count || 0} overdue
          </div>
        </div>
      </div>

      {/* Expenses by Category */}
      {pnl?.expenses?.by_category?.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Expenses by Category</h3>
          <div className="space-y-2">
            {pnl.expenses.by_category.map(cat => {
              const pct = pnl.expenses.total > 0 ? (cat.total / pnl.expenses.total) * 100 : 0;
              return (
                <div key={cat.category} className="flex items-center gap-4">
                  <div className="w-40 text-sm text-gray-700 font-medium truncate">{cat.category}</div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1F4E79] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-28 text-right text-sm font-mono text-gray-800">{fmt(cat.total)}</div>
                  <div className="w-12 text-right text-xs text-gray-500">{pct.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Expenses</h2>
        <button
          onClick={() => setShowExpenseForm(!showExpenseForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#153452] transition"
        >
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {showExpenseForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={handleExpenseSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select
                value={expForm.category}
                onChange={(e) => setExpForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
              <input
                type="number" step="0.01" required
                value={expForm.amount}
                onChange={(e) => setExpForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input
                type="date" required
                value={expForm.expense_date}
                onChange={(e) => setExpForm(f => ({ ...f, expense_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
              <input
                type="text"
                value={expForm.vendor}
                onChange={(e) => setExpForm(f => ({ ...f, vendor: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Vendor name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={expForm.description}
                onChange={(e) => setExpForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reference #</label>
              <input
                type="text"
                value={expForm.reference_num}
                onChange={(e) => setExpForm(f => ({ ...f, reference_num: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-3 flex gap-3">
              <button type="submit" className="px-4 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#153452]">
                Save Expense
              </button>
              <button type="button" onClick={() => setShowExpenseForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.map(exp => (
              <tr key={exp.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{exp.expense_date?.slice(0, 10)}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{exp.category}</td>
                <td className="px-4 py-3 text-gray-600">{exp.description || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{exp.vendor || '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-red-600">{fmt(exp.amount)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No expenses recorded yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
