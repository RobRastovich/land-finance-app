import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';
import { Save, Check } from 'lucide-react';

const LAND_COST_FIELDS = [
  { key: 'lot_cost', code: '10000', label: 'Lot Cost' },
  { key: 'lot_closing', code: '10110', label: 'Lot Closing' },
  { key: 'lot_marketing_fee', code: '10112', label: 'Lot Marketing Fee' },
  { key: 'lot_amenity_fee', code: '10113', label: 'Lot Amenity Fee' },
  { key: 'other_development_fee', code: '10115', label: 'Other Development Fee' },
  { key: 'lot_interest', code: '10200', label: 'Lot Interest' },
  { key: 'land_bank_interest', code: '10200', label: 'Land Bank Interest' },
  { key: 'area_cost_geotech', code: '10300', label: 'Area Cost (Geotech)' },
  { key: 'other_development_costs', code: '8145', label: 'Other Development Costs' },
  { key: 'hoa_dues', code: '81855', label: 'HOA Dues' },
];

const SALES_AMOUNT_FIELDS = [
  { key: 'hhl_incentive', label: 'HHL Incentive' },
  { key: 'incentive', label: 'Incentive' },
];

const SALES_TEXT_FIELDS = [
  { key: 'plan_line_up', label: 'Plan Line Up', rows: 3 },
  { key: 'specifications', label: 'Specifications', rows: 3 },
  { key: 'asp', label: 'ASP', rows: 1 },
  { key: 'target_margin', label: 'Target Margin', rows: 1 },
  { key: 'ideal_starting_price', label: 'Ideal Starting Price', rows: 1 },
  { key: 'builders_competition_graph', label: 'Builders for Competition Graph', rows: 3 },
];

const EMPTY_FORM = {
  lot_cost: '',
  lot_closing: '',
  lot_marketing_fee: '',
  lot_amenity_fee: '',
  other_development_fee: '',
  lot_interest: '',
  land_bank_interest: '',
  area_cost_geotech: '',
  other_development_costs: '',
  hoa_dues: '',
  land_notes: '',
  pid: '',
  hhl_incentive: '',
  incentive: '',
  plan_line_up: '',
  specifications: '',
  asp: '',
  target_margin: '',
  ideal_starting_price: '',
  builders_competition_graph: '',
  sales_notes: '',
  erosion: '',
  city_requirements: '',
  construction_notes: '',
};

function toForm(data) {
  const form = { ...EMPTY_FORM };
  if (!data) return form;
  for (const key of Object.keys(EMPTY_FORM)) {
    form[key] = data[key] == null ? '' : String(data[key]);
  }
  return form;
}

function parseAmount(value) {
  if (value === '' || value == null) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

export default function ProgramOutline() {
  const { projectId } = useApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getProgramOutline(projectId);
      setForm(toForm(data));
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const savedData = await api.saveProgramOutline(projectId, form);
      setForm(toForm(savedData));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const landTotal = LAND_COST_FIELDS.reduce((sum, field) => sum + parseAmount(form[field.key]), 0);
  const salesIncentiveTotal = SALES_AMOUNT_FIELDS.reduce((sum, field) => sum + parseAmount(form[field.key]), 0);

  if (loading) return <div className="text-gray-400 p-8">Loading program outline...</div>;

  return (
    <form onSubmit={handleSave} className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Manually record land, sales, and construction notes for this community.</p>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#153452] transition disabled:opacity-50"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Outline'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
      )}

      {/* LAND */}
      <section className="bg-white rounded-xl border overflow-hidden">
        <div className="bg-[#1F4E79] px-5 py-3">
          <h2 className="text-white font-semibold text-sm tracking-wide">LAND</h2>
        </div>
        <div className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600 w-28">Code</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Land Costs</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600 w-48">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {LAND_COST_FIELDS.map(field => (
                <tr key={field.key} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-500">{field.code}</td>
                  <td className="px-5 py-2.5 text-gray-800">{field.label}</td>
                  <td className="px-5 py-2.5">
                    <input
                      type="number"
                      step="0.01"
                      value={form[field.key]}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="px-5 py-3" />
                <td className="px-5 py-3 text-sm font-semibold text-gray-700">Land Costs Total</td>
                <td className="px-5 py-3 text-right font-mono font-semibold text-gray-800">{fmt(landTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes / Information</label>
            <textarea
              value={form.land_notes}
              onChange={(e) => setField('land_notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PID</label>
            <input
              type="text"
              value={form.pid}
              onChange={(e) => setField('pid', e.target.value)}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* SALES */}
      <section className="bg-white rounded-xl border overflow-hidden">
        <div className="bg-[#1F4E79] px-5 py-3">
          <h2 className="text-white font-semibold text-sm tracking-wide">SALES</h2>
        </div>
        <div className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Sales Incentives</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600 w-48">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SALES_AMOUNT_FIELDS.map(field => (
                <tr key={field.key} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5 text-gray-800">{field.label}</td>
                  <td className="px-5 py-2.5">
                    <input
                      type="number"
                      step="0.01"
                      value={form[field.key]}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td className="px-5 py-3 text-sm font-semibold text-gray-700">Sales Incentives Total</td>
                <td className="px-5 py-3 text-right font-mono font-semibold text-gray-800">{fmt(salesIncentiveTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t space-y-4">
          {SALES_TEXT_FIELDS.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              {field.rows > 1 ? (
                <textarea
                  value={form[field.key]}
                  onChange={(e) => setField(field.key, e.target.value)}
                  rows={field.rows}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <input
                  type="text"
                  value={form[field.key]}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes / Information</label>
            <textarea
              value={form.sales_notes}
              onChange={(e) => setField('sales_notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* CONSTRUCTION */}
      <section className="bg-white rounded-xl border overflow-hidden">
        <div className="bg-[#1F4E79] px-5 py-3">
          <h2 className="text-white font-semibold text-sm tracking-wide">CONSTRUCTION</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Erosion</label>
            <textarea
              value={form.erosion}
              onChange={(e) => setField('erosion', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City Requirements</label>
            <textarea
              value={form.city_requirements}
              onChange={(e) => setField('city_requirements', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes / Information</label>
            <textarea
              value={form.construction_notes}
              onChange={(e) => setField('construction_notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#153452] transition disabled:opacity-50"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Outline'}
        </button>
      </div>
    </form>
  );
}
