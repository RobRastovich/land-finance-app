import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';
import { calcTranche, fmtCurrency, fmtPct, fmtDate } from '../utils/calculations';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Building2, Save, X, AlertTriangle, Copy
} from 'lucide-react';

// ── Reusable components ──────────────────────────────────────
function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 mb-1 block">{label}</span>
      <input
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        {...props}
      />
    </label>
  );
}

function Select({ label, children, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 mb-1 block">{label}</span>
      <select
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#1F4E79] to-[#2E75B6]">
          <h3 className="text-white font-semibold text-base">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDelete({ message, onConfirm, onCancel }) {
  return (
    <Modal title="Confirm Delete" onClose={onCancel}>
      <div className="flex items-start gap-3 mb-6">
        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-gray-700">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700">Delete</button>
      </div>
    </Modal>
  );
}

// ── Builder Form ─────────────────────────────────────────────
function BuilderForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: '', contact_name: '', contact_email: '', notes: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <Input label="Builder Name *" value={form.name} onChange={set('name')} required />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Contact Name"  value={form.contact_name  || ''} onChange={set('contact_name')} />
        <Input label="Contact Email" value={form.contact_email || ''} onChange={set('contact_email')} type="email" />
      </div>
      <Input label="Notes" value={form.notes || ''} onChange={set('notes')} />
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Cancel</button>
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F4E79] text-white text-sm hover:bg-[#153452]">
          <Save size={14} /> Save Builder
        </button>
      </div>
    </form>
  );
}

// ── Contract Form ────────────────────────────────────────────
function ContractForm({ initial, builders, onSave, onClose }) {
  const [form, setForm] = useState({
    builder_id: initial?.builder_id || builders[0]?.id || '',
    lot_size_label: initial?.lot_size_label || '60s',
    ff_width: initial?.ff_width || 60,
    ff_price: initial?.ff_price || 2500,
    total_qty: initial?.total_qty || 0,
    escalator_rate: initial?.escalator_rate || 0,
    escalator_start: initial?.escalator_start || '2027-01-01',
    em_pct: initial?.em_pct || 0.10,
    notes: initial?.notes || '',
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // When editing, ensure date is in YYYY-MM-DD format for date input
  useEffect(() => {
    if (initial) {
      setForm({
        builder_id: initial.builder_id || builders[0]?.id || '',
        lot_size_label: initial.lot_size_label || '60s',
        ff_width: initial.ff_width || 60,
        ff_price: initial.ff_price || 2500,
        total_qty: initial.total_qty || 0,
        escalator_rate: initial.escalator_rate || 0,
        escalator_start: initial.escalator_start ? initial.escalator_start.split('T')[0] : '2027-01-01',
        em_pct: initial.em_pct || 0.10,
        notes: initial.notes || '',
      });
    }
  }, [initial, builders]);
  const lotPrice = parseFloat(form.ff_width || 0) * parseFloat(form.ff_price || 0);

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <Select label="Builder *" value={form.builder_id} onChange={set('builder_id')} required>
        {builders.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Lot Size Label" value={form.lot_size_label} onChange={set('lot_size_label')} placeholder="e.g. 60s" required />
        <Input label="FF Width (ft)" value={form.ff_width} onChange={set('ff_width')} type="number" step="0.01" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Price per FF ($)" value={form.ff_price} onChange={set('ff_price')} type="number" step="0.01" required />
        <div>
          <span className="text-xs font-medium text-gray-600 mb-1 block">Lot Price (calculated)</span>
          <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 font-semibold text-green-700">
            {fmtCurrency(lotPrice)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Total Qty (Lots)" value={form.total_qty} onChange={set('total_qty')} type="number" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Escalator Rate (% per year)" value={parseFloat(form.escalator_rate) * 100} onChange={e => setForm(f => ({ ...f, escalator_rate: e.target.value / 100 }))} type="number" step="0.01" min="0" />
        <Input label="Escalator Start Date" value={form.escalator_start} onChange={set('escalator_start')} type="date" />
      </div>
      <Input label="Notes" value={form.notes || ''} onChange={set('notes')} />
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Cancel</button>
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F4E79] text-white text-sm hover:bg-[#153452]">
          <Save size={14} /> Save Contract
        </button>
      </div>
    </form>
  );
}

// ── Tranche Form ─────────────────────────────────────────────
function TrancheForm({ initial, contract, existingTranches, onSave, onClose }) {
  const [form, setForm] = useState(initial || { scheduled_date: '', lot_count: '', notes: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // When editing, ensure date is in YYYY-MM-DD format for date input
  useEffect(() => {
    if (initial) {
      setForm({
        ...initial,
        scheduled_date: initial.scheduled_date ? initial.scheduled_date.split('T')[0] : ''
      });
    }
  }, [initial]);
  const preview = form.scheduled_date && form.lot_count
    ? calcTranche(contract, { scheduled_date: form.scheduled_date, lot_count: parseInt(form.lot_count) })
    : null;

  // Calculate remaining lots available
  const usedLots = existingTranches.reduce((sum, t) => sum + parseInt(t.lot_count, 10), 0);
  const currentTrancheLots = initial ? parseInt(initial.lot_count, 10) : 0;
  const remainingLots = parseInt(contract.total_qty, 10) - usedLots + currentTrancheLots;
  const proposedLots = parseInt(form.lot_count, 10) || 0;
  const exceedsLimit = proposedLots > remainingLots;

  return (
    <form onSubmit={e => { e.preventDefault(); if (exceedsLimit) { alert(`Cannot exceed ${remainingLots} remaining lots`); return; } onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Takedown Date *" value={form.scheduled_date} onChange={set('scheduled_date')} type="date" required />
        <div>
          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">Lot Count *</span>
            <input
              className={`w-full border ${exceedsLimit ? 'border-red-500' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${exceedsLimit ? 'focus:ring-red-500' : 'focus:ring-blue-500'} focus:border-transparent`}
              value={form.lot_count}
              onChange={set('lot_count')}
              type="number"
              min="1"
              max={remainingLots}
              required
            />
            <span className="text-xs text-gray-500 mt-1 block">{remainingLots} lots remaining on contract</span>
          </label>
        </div>
      </div>
      {preview && (
        <div className="grid grid-cols-3 gap-3 bg-blue-50 rounded-lg p-3">
          <div className="text-center">
            <div className="text-xs text-gray-500">Adj. $/Lot</div>
            <div className="text-sm font-semibold text-gray-800">{fmtCurrency(preview.adj_lot_price)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Revenue</div>
            <div className="text-sm font-semibold text-green-700">{fmtCurrency(preview.projected_revenue)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Earnest Money</div>
            <div className="text-sm font-semibold text-blue-700">{fmtCurrency(preview.projected_em)}</div>
          </div>
        </div>
      )}
      <Input label="Notes" value={form.notes || ''} onChange={set('notes')} />
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Cancel</button>
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F4E79] text-white text-sm hover:bg-[#153452]">
          <Save size={14} /> Save Tranche
        </button>
      </div>
    </form>
  );
}

// ── Contract Card with Tranche Sub-table ─────────────────────
function ContractCard({ contract, builders, onEditContract, onDeleteContract, onDuplicateContract, onReload }) {
  const [open, setOpen] = useState(false);
  const [tranches, setTranches] = useState([]);
  const [loadingTranches, setLoadingTranches] = useState(false);
  const [showTrancheForm, setShowTrancheForm] = useState(false);
  const [editTranche, setEditTranche] = useState(null);
  const [deleteTranche, setDeleteTranche] = useState(null);
  const [showEarnestForm, setShowEarnestForm] = useState(false);
  const [earnestMoney, setEarnestMoney] = useState([]);
  const [editEarnest, setEditEarnest] = useState(null);
  const [trancheCredits, setTrancheCredits] = useState({});
  const [editCreditTranche, setEditCreditTranche] = useState(null);
  const [showCreditForm, setShowCreditForm] = useState(false);

  const builder = builders.find(b => b.id === contract.builder_id);
  const lotPrice = parseFloat(contract.ff_width) * parseFloat(contract.ff_price);

  useEffect(() => {
    if (!open) return;
    setLoadingTranches(true);
    Promise.all([
      api.getTranches(contract.id),
      api.getEarnestMoney(contract.id)
    ])
      .then(async ([tranchesData, earnestData]) => {
        setTranches(tranchesData);
        setEarnestMoney(earnestData);
        // Load earnest credits for each tranche
        const creditsByTranche = {};
        for (const tranche of tranchesData) {
          const credits = await api.getTrancheEarnestCredits(tranche.id);
          creditsByTranche[tranche.id] = credits;
        }
        setTrancheCredits(creditsByTranche);
      })
      .finally(() => setLoadingTranches(false));
  }, [open, contract.id]);

  async function saveTranche(form) {
    try {
      if (editTranche) {
        await api.updateTranche(editTranche.id, form);
      } else {
        await api.createTranche(contract.id, form);
      }
      const updated = await api.getTranches(contract.id);
      setTranches(updated);
      setShowTrancheForm(false);
      setEditTranche(null);
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteTranche() {
    try {
      await api.deleteTranche(deleteTranche.id);
      setTranches(t => t.filter(x => x.id !== deleteTranche.id));
      setDeleteTranche(null);
    } catch (e) { alert(e.message); }
  }

  async function handleDuplicateTranche(tranche) {
    try {
      await api.duplicateTranche(tranche.id);
      const updated = await api.getTranches(contract.id);
      setTranches(updated);
    } catch (e) { alert(e.message); }
  }

  async function saveEarnestMoney(form) {
    try {
      if (editEarnest) {
        await api.updateEarnestMoney(editEarnest.id, form);
      } else {
        await api.createEarnestMoney(contract.id, form);
      }
      setShowEarnestForm(false);
      setEditEarnest(null);
      const updated = await api.getEarnestMoney(contract.id);
      setEarnestMoney(updated);
    } catch (e) { alert(e.message); }
  }

  async function saveTrancheCredit(amount) {
    try {
      if (!editCreditTranche) return;
      const credits = trancheCredits[editCreditTranche.id] || [];
      if (credits.length > 0) {
        // Update existing credit
        await api.updateTrancheEarnestCredit(credits[0].id, { amount });
      } else {
        // Create new credit
        await api.createTrancheEarnestCredit(editCreditTranche.id, { amount });
      }
      const updated = await api.getTrancheEarnestCredits(editCreditTranche.id);
      setTrancheCredits(prev => ({ ...prev, [editCreditTranche.id]: updated }));
      setShowCreditForm(false);
      setEditCreditTranche(null);
    } catch (e) { alert(e.message); }
  }

  const totalRevenue = tranches.reduce((s, t) => {
    const calc = calcTranche(contract, t);
    const credits = trancheCredits[t.id] || [];
    const totalCredit = credits.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    return s + calc.projected_revenue + totalCredit;
  }, 0) + earnestMoney.reduce((s, em) => s + parseFloat(em.amount), 0);
  const totalEM      = tranches.reduce((s, t) => {
    const credits = trancheCredits[t.id] || [];
    return s + credits.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  }, 0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Contract header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        <div className="flex-1 flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="font-semibold text-sm text-gray-800">{builder?.name}</span>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">{contract.lot_size_label}</span>
          <span className="text-xs text-gray-500">{contract.total_qty} lots · {fmtCurrency(lotPrice)}/lot</span>
          <span className="text-xs text-gray-500">Escal: {fmtPct(parseFloat(contract.escalator_rate))}</span>
          <span className="text-xs text-gray-500">EM: {fmtPct(parseFloat(contract.em_pct))}</span>
          {open && <span className="text-xs text-green-700 font-semibold ml-auto">{fmtCurrency(totalRevenue)} total · {fmtCurrency(totalEM)} EM</span>}
        </div>
        <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => onDuplicateContract(contract)} title="Duplicate contract" className="p-1.5 rounded hover:bg-white text-gray-500 hover:text-green-600 transition"><Copy size={14} /></button>
          <button onClick={() => onEditContract(contract)} className="p-1.5 rounded hover:bg-white text-gray-500 hover:text-blue-600 transition"><Pencil size={14} /></button>
          <button onClick={() => onDeleteContract(contract)} className="p-1.5 rounded hover:bg-white text-gray-500 hover:text-red-600 transition"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Tranche sub-table */}
      {open && (
        <div className="border-t border-gray-200">
          {loadingTranches ? (
            <div className="py-6 text-center text-sm text-gray-400">Loading take downs…</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1F4E79] text-white text-xs">
                    {['Type','Date','Lots','Base $/Lot','Months Escal.','Adj $/Lot','EM Credit','Revenue',''].map(h => (
                      <th key={h} className="px-3 py-2 text-right first:text-left last:text-center font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tranches.length === 0 && earnestMoney.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-6 text-gray-400 italic text-xs">No revenue entries yet. Add one below.</td></tr>
                  )}
                  {earnestMoney.map((em, i) => (
                    <tr key={em.id} className={i % 2 === 0 ? 'bg-white' : 'bg-green-50/40'}>
                      <td className="px-3 py-2 text-green-700 font-medium">EM</td>
                      <td className="px-3 py-2 text-right">{fmtDate(em.received_date)}</td>
                      <td className="px-3 py-2 text-gray-400">—</td>
                      <td className="px-3 py-2 text-gray-400">—</td>
                      <td className="px-3 py-2 text-gray-400">—</td>
                      <td className="px-3 py-2 text-gray-400">—</td>
                      <td className="px-3 py-2 text-gray-400">—</td>
                      <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtCurrency(em.amount)}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => setEditEarnest(em)} className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition"><Pencil size={12} /></button>
                          <button onClick={() => { if (window.confirm('Delete this entry?')) { api.deleteEarnestMoney(em.id).then(() => api.getEarnestMoney(contract.id).then(setEarnestMoney)); } }} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition"><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tranches.map((tr, i) => {
                    const calc = calcTranche(contract, tr);
                    const credits = trancheCredits[tr.id] || [];
                    const totalCredit = credits.reduce((sum, c) => sum + parseFloat(c.amount), 0);
                    const totalRevenue = calc.projected_revenue + totalCredit;
                    return (
                      <tr key={tr.id} className={(earnestMoney.length + i) % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'}>
                        <td className="px-3 py-2 text-gray-600 font-medium">Take Down</td>
                        <td className="px-3 py-2 text-right">{fmtDate(tr.scheduled_date)}</td>
                        <td className="px-3 py-2 text-right">{tr.lot_count}</td>
                        <td className="px-3 py-2 text-right">{fmtCurrency(calc.base_lot_price)}</td>
                        <td className="px-3 py-2 text-right">{calc.months_escalated}</td>
                        <td className="px-3 py-2 text-right">{fmtCurrency(calc.adj_lot_price, 2)}</td>
                        <td className="px-3 py-2 text-right text-red-700">
                          <div className="flex items-center justify-end gap-1">
                            <span>{fmtCurrency(totalCredit)}</span>
                            <button onClick={() => { setEditCreditTranche(tr); setShowCreditForm(true); }} className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition"><Pencil size={10} /></button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtCurrency(totalRevenue)}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => handleDuplicateTranche(tr)} title="Duplicate tranche" className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition"><Copy size={12} /></button>
                            <button onClick={() => setEditTranche(tr)} className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition"><Pencil size={12} /></button>
                            <button onClick={() => setDeleteTranche(tr)} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(tranches.length > 0 || earnestMoney.length > 0) && (
                    <tr className="bg-blue-900 text-white text-xs font-bold">
                      <td className="px-3 py-2" colSpan={4}>TOTALS</td>
                      <td />
                      <td />
                      <td className="px-3 py-2 text-right">{fmtCurrency(totalEM)}</td>
                      <td className="px-3 py-2 text-right">{fmtCurrency(totalRevenue)}</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => { setShowTrancheForm(true); setEditTranche(null); }}
                  className="flex items-center gap-2 text-xs font-medium text-blue-700 hover:text-blue-900 transition"
                >
                  <Plus size={14} /> Add Take Down
                </button>
                <button
                  onClick={() => { setShowEarnestForm(true); setEditEarnest(null); }}
                  className="flex items-center gap-2 text-xs font-medium text-green-700 hover:text-green-900 transition"
                >
                  <Plus size={14} /> Add Earnest Money
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {(showTrancheForm || editTranche) && (
        <Modal title={editTranche ? 'Edit Take Down' : 'Add Take Down'} onClose={() => { setShowTrancheForm(false); setEditTranche(null); }}>
          <TrancheForm
            initial={editTranche}
            contract={contract}
            existingTranches={tranches}
            onSave={saveTranche}
            onClose={() => { setShowTrancheForm(false); setEditTranche(null); }}
          />
        </Modal>
      )}

      {deleteTranche && (
        <ConfirmDelete
          message={`Delete tranche #${deleteTranche.tranche_number} (${fmtDate(deleteTranche.scheduled_date)}, ${deleteTranche.lot_count} lots)? This cannot be undone.`}
          onConfirm={handleDeleteTranche}
          onCancel={() => setDeleteTranche(null)}
        />
      )}

      {(showEarnestForm || editEarnest) && (
        <Modal title={editEarnest ? 'Edit Earnest Money' : 'Add Earnest Money'} onClose={() => { setShowEarnestForm(false); setEditEarnest(null); }}>
          <form onSubmit={e => { e.preventDefault(); saveEarnestMoney({ amount: e.target.amount.value, received_date: e.target.received_date.value, notes: e.target.notes.value }); }} className="space-y-4">
            <Input label="Amount ($)" name="amount" type="number" step="0.01" required defaultValue={editEarnest?.amount} />
            <Input label="Received Date" name="received_date" type="date" defaultValue={editEarnest?.received_date ? editEarnest.received_date.split('T')[0] : ''} />
            <Input label="Notes" name="notes" defaultValue={editEarnest?.notes || ''} />
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => { setShowEarnestForm(false); setEditEarnest(null); }} className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F4E79] text-white text-sm hover:bg-[#153452]">
                <Save size={14} /> Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showCreditForm && editCreditTranche && (
        <Modal title="Edit Earnest Money Credit" onClose={() => { setShowCreditForm(false); setEditCreditTranche(null); }}>
          <form onSubmit={e => { e.preventDefault(); saveTrancheCredit(parseFloat(e.target.amount.value)); }} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Total Available Earnest Money</label>
              <div className="text-sm font-semibold text-green-700">{fmtCurrency(earnestMoney.reduce((sum, em) => sum + parseFloat(em.amount), 0))}</div>
            </div>
            <Input label="Credit Amount ($)" name="amount" type="number" step="0.01" required defaultValue={(trancheCredits[editCreditTranche.id] || [])[0]?.amount || 0} />
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => { setShowCreditForm(false); setEditCreditTranche(null); }} className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F4E79] text-white text-sm hover:bg-[#153452]">
                <Save size={14} /> Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function BuilderManager() {
  const { projectId, builders, contracts, reload } = useApp();
  const [showBuilderForm, setShowBuilderForm] = useState(false);
  const [editBuilder, setEditBuilder]         = useState(null);
  const [deleteBuilder, setDeleteBuilder]     = useState(null);
  const [showContractForm, setShowContractForm] = useState(false);
  const [editContract, setEditContract]         = useState(null);
  const [deleteContract, setDeleteContract]     = useState(null);
  const [filterBuilder, setFilterBuilder]       = useState('all');

  async function saveBuilder(form) {
    try {
      if (editBuilder) await api.updateBuilder(editBuilder.id, form);
      else await api.createBuilder(projectId, form);
      await reload();
      setShowBuilderForm(false);
      setEditBuilder(null);
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteBuilder() {
    try {
      await api.deleteBuilder(deleteBuilder.id);
      await reload();
      setDeleteBuilder(null);
    } catch (e) { alert(e.message); }
  }

  async function saveContract(form) {
    try {
      if (editContract) await api.updateContract(editContract.id, form);
      else await api.createContract(projectId, form);
      await reload();
      setShowContractForm(false);
      setEditContract(null);
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteContract() {
    try {
      await api.deleteContract(deleteContract.id);
      await reload();
      setDeleteContract(null);
    } catch (e) { alert(e.message); }
  }

  async function handleDuplicateContract(contract) {
    try {
      await api.duplicateContract(contract.id);
      await reload();
    } catch (e) { alert(e.message); }
  }

  const filteredContracts = filterBuilder === 'all'
    ? contracts
    : contracts.filter(c => c.builder_id === filterBuilder);

  return (
    <div className="space-y-6">
      {/* Builders section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Building2 size={18} className="text-blue-600" /> Builders
          </h2>
          <button
            onClick={() => { setShowBuilderForm(true); setEditBuilder(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F4E79] text-white text-sm hover:bg-[#153452] transition"
          >
            <Plus size={14} /> Add Builder
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {builders.map(b => (
            <div key={b.id} className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg">
              <span className="text-sm font-medium text-gray-800">{b.name}</span>
              <span className="text-xs text-gray-500">({contracts.filter(c => c.builder_id === b.id).length} contracts)</span>
              <button onClick={() => setEditBuilder(b)} className="text-gray-400 hover:text-blue-600 transition"><Pencil size={12} /></button>
              <button onClick={() => setDeleteBuilder(b)} className="text-gray-400 hover:text-red-600 transition"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Contracts + Take Downs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Contracts & Take Downs</h2>
          <div className="flex items-center gap-3">
            <select
              value={filterBuilder}
              onChange={e => setFilterBuilder(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Builders</option>
              {builders.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button
              onClick={() => { setShowContractForm(true); setEditContract(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F4E79] text-white text-sm hover:bg-[#153452] transition"
            >
              <Plus size={14} /> Add Contract
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {filteredContracts.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No contracts yet. Add one above.</div>
          ) : (
            filteredContracts.map(c => (
              <ContractCard
                key={c.id}
                contract={c}
                builders={builders}
                onEditContract={c => { setEditContract(c); setShowContractForm(true); }}
                onDeleteContract={setDeleteContract}
                onDuplicateContract={handleDuplicateContract}
                onReload={reload}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {(showBuilderForm || editBuilder) && (
        <Modal title={editBuilder ? 'Edit Builder' : 'Add Builder'} onClose={() => { setShowBuilderForm(false); setEditBuilder(null); }}>
          <BuilderForm initial={editBuilder} onSave={saveBuilder} onClose={() => { setShowBuilderForm(false); setEditBuilder(null); }} />
        </Modal>
      )}
      {(showContractForm || editContract) && (
        <Modal title={editContract ? 'Edit Contract' : 'Add Contract'} onClose={() => { setShowContractForm(false); setEditContract(null); }}>
          <ContractForm initial={editContract} builders={builders} onSave={saveContract} onClose={() => { setShowContractForm(false); setEditContract(null); }} />
        </Modal>
      )}
      {deleteBuilder && (
        <ConfirmDelete
          message={`Delete ${deleteBuilder.name}? All contracts and take downs for this builder will also be deleted.`}
          onConfirm={handleDeleteBuilder}
          onCancel={() => setDeleteBuilder(null)}
        />
      )}
      {deleteContract && (
        <ConfirmDelete
          message={`Delete the ${deleteContract.lot_size_label} contract? All take downs will also be deleted.`}
          onConfirm={handleDeleteContract}
          onCancel={() => setDeleteContract(null)}
        />
      )}
    </div>
  );
}
