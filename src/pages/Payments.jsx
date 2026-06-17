import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';
import { Plus, Trash2 } from 'lucide-react';

const STATUS_COLORS = {
  paid:    'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700',
};

const PAYMENT_TYPES = [
  { value: 'earnest_money', label: 'Earnest Money' },
  { value: 'lot_purchase', label: 'Lot Purchase' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'other', label: 'Other' },
];

export default function Payments() {
  const { projectId, contracts } = useApp();
  const [payments, setPayments] = useState([]);
  const [takedowns, setTakedowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    contract_id: '', tranche_id: '', payment_type: 'lot_purchase', amount_expected: '',
    amount_received: '', due_date: '', received_date: '', status: 'pending',
    reference_num: '', notes: '',
  });

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.getPayments(projectId);
      setPayments(data);
      // Load all takedowns for all contracts
      const allTakedowns = await Promise.all(
        contracts.map(c => api.getTranches(c.id).then(ts => ts.map(t => ({ ...t, contract_id: c.id }))))
      );
      setTakedowns(allTakedowns.flat());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId, contracts]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm({
      contract_id: '', takedown_id: '', payment_type: 'lot_purchase', amount_expected: '',
      amount_received: '', due_date: '', received_date: '', status: 'pending',
      reference_num: '', notes: '',
    });
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updatePayment(editingId, {
          amount_expected: parseFloat(form.amount_expected),
          amount_received: parseFloat(form.amount_received) || 0,
          due_date: form.due_date,
          received_date: form.received_date || null,
          status: form.status,
          reference_num: form.reference_num,
          notes: form.notes,
          tranche_id: form.takedown_id || null,
        });
      } else {
        await api.createPayment(projectId, {
          ...form,
          amount_expected: parseFloat(form.amount_expected),
          amount_received: parseFloat(form.amount_received) || 0,
          tranche_id: form.takedown_id || null,
        });
      }
      resetForm();
      load();
    } catch (err) { alert(err.message); }
  }

  function editPayment(p) {
    setForm({
      contract_id: p.contract_id,
      takedown_id: p.tranche_id || '',
      payment_type: p.payment_type,
      amount_expected: p.amount_expected,
      amount_received: p.amount_received || '',
      due_date: p.due_date?.slice(0, 10) || '',
      received_date: p.received_date?.slice(0, 10) || '',
      status: p.status,
      reference_num: p.reference_num || '',
      notes: p.notes || '',
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this payment record?')) return;
    await api.deletePayment(id);
    load();
  }

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  const totalExpected = payments.reduce((s, p) => s + parseFloat(p.amount_expected || 0), 0);
  const totalReceived = payments.reduce((s, p) => s + parseFloat(p.amount_received || 0), 0);

  // Filter takedowns by selected contract
  const contractTakedowns = form.contract_id
    ? takedowns.filter(t => t.contract_id === form.contract_id)
    : [];

  if (loading) return <div className="text-gray-400 p-8">Loading payments...</div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">Total Expected</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{fmt(totalExpected)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">Total Received</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{fmt(totalReceived)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">Outstanding</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{fmt(totalExpected - totalReceived)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">Payments</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{payments.length}</div>
        </div>
      </div>

      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Payment Records</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#153452] transition"
        >
          <Plus size={16} /> Record Payment
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">
            {editingId ? 'Update Payment' : 'New Payment'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contract *</label>
              <select
                value={form.contract_id}
                onChange={(e) => setForm(f => ({ ...f, contract_id: e.target.value, takedown_id: '' }))}
                required
                disabled={editingId}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100"
              >
                <option value="">Select contract...</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.builder_name || 'Builder'} — {c.lot_size_label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Takedown (Optional)</label>
              <select
                value={form.takedown_id}
                onChange={(e) => setForm(f => ({ ...f, takedown_id: e.target.value }))}
                disabled={!form.contract_id}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100"
              >
                <option value="">Select takedown...</option>
                {contractTakedowns.map(t => (
                  <option key={t.id} value={t.id}>
                    Takedown #{t.tranche_number} — {t.scheduled_date} ({t.lot_count} lots)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type *</label>
              <select
                value={form.payment_type}
                onChange={(e) => setForm(f => ({ ...f, payment_type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount Expected *</label>
              <input
                type="number" step="0.01" required
                value={form.amount_expected}
                onChange={(e) => setForm(f => ({ ...f, amount_expected: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date *</label>
              <input
                type="date" required
                value={form.due_date}
                onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount Received</label>
              <input
                type="number" step="0.01"
                value={form.amount_received}
                onChange={(e) => setForm(f => ({ ...f, amount_received: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Received Date</label>
              <input
                type="date"
                value={form.received_date}
                onChange={(e) => setForm(f => ({ ...f, received_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reference #</label>
              <input
                type="text"
                value={form.reference_num}
                onChange={(e) => setForm(f => ({ ...f, reference_num: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Check #, wire ref, etc."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="px-4 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#153452]">
                {editingId ? 'Update' : 'Save Payment'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Builder</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Takedown</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Expected</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Received</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ref #</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => editPayment(p)}>
                <td className="px-4 py-3 font-medium text-gray-800">{p.builder_name}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {p.tranche_number ? `#${p.tranche_number} — ${p.tranche_date?.slice(0, 10)}` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 capitalize">{p.payment_type.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(p.amount_expected)}</td>
                <td className="px-4 py-3 text-right font-mono text-green-600">{fmt(p.amount_received)}</td>
                <td className="px-4 py-3 text-gray-600">{p.due_date?.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || ''}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.reference_num || '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                    className="text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No payments recorded yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
