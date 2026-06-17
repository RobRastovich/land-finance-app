import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';
import { calcTranche, fmtCurrency } from '../utils/calculations';
import { format, parseISO } from 'date-fns';
import { Download, TrendingUp, DollarSign, BarChart2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function CashFlow() {
  const { contracts, builders } = useApp();
  const [allTranches, setAllTranches] = useState([]);
  const [earnestMoney, setEarnestMoney] = useState([]);
  const [trancheCredits, setTrancheCredits] = useState({});
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('revenue'); // 'revenue' | 'em' | 'both'

  useEffect(() => {
    if (!contracts.length) return;
    setLoading(true);
    Promise.all([
      Promise.all(contracts.map(c =>
        api.getTranches(c.id).then(ts => ts.map(t => ({ ...t, contract_id: c.id })))
      )),
      Promise.all(contracts.map(c => api.getEarnestMoney(c.id).then(em => em.map(e => ({ ...e, contract_id: c.id })))))
    ])
      .then(([tranchesData, emData]) => {
        setAllTranches(tranchesData.flat());
        setEarnestMoney(emData.flat());
        // Fetch tranche credits
        const creditsByTranche = {};
        const creditPromises = tranchesData.flat().map(t =>
          api.getTrancheEarnestCredits(t.id).then(credits => ({ trancheId: t.id, credits }))
        );
        Promise.all(creditPromises).then(results => {
          results.forEach(({ trancheId, credits }) => {
            creditsByTranche[trancheId] = credits;
          });
          setTrancheCredits(creditsByTranche);
        });
      })
      .finally(() => setLoading(false));
  }, [contracts]);

  const contractMap = useMemo(() => Object.fromEntries(contracts.map(c => [c.id, c])), [contracts]);
  const builderMap  = useMemo(() => Object.fromEntries(builders.map(b => [b.id, b])), [builders]);

  // Unique sorted months across all tranches and earnest money
  const months = useMemo(() => {
    const set = new Set([
      ...allTranches.map(t => format(parseISO(t.scheduled_date), 'yyyy-MM')),
      ...earnestMoney.map(em => em.received_date ? format(parseISO(em.received_date), 'yyyy-MM') : null)
    ].filter(Boolean));
    return Array.from(set).sort();
  }, [allTranches, earnestMoney]);

  // Row data: one row per contract, columns per month
  const rows = useMemo(() => {
    return contracts.map(c => {
      const builder = builderMap[c.builder_id];
      const cTranches = allTranches.filter(t => t.contract_id === c.id);
      const cEarnestMoney = earnestMoney.filter(em => em.contract_id === c.id);
      const byMonth = {};

      // Add tranche revenue and credits
      cTranches.forEach(t => {
        const mo = format(parseISO(t.scheduled_date), 'yyyy-MM');
        const calc = calcTranche(c, t);
        const credits = trancheCredits[t.id] || [];
        const totalCredit = credits.reduce((sum, cr) => sum + parseFloat(cr.amount), 0);
        if (!byMonth[mo]) byMonth[mo] = { revenue: 0, em: 0, lots: 0 };
        byMonth[mo].revenue += calc.projected_revenue - totalCredit;
        // Don't add tranche credits to EM here - they're just applications of EM entries
        // EM is counted from the actual earnest_money table entries below
        byMonth[mo].lots    += parseInt(t.lot_count, 10);
      });

      // Add earnest money entries
      cEarnestMoney.forEach(em => {
        if (!em.received_date) return;
        const mo = format(parseISO(em.received_date), 'yyyy-MM');
        if (!byMonth[mo]) byMonth[mo] = { revenue: 0, em: 0, lots: 0 };
        byMonth[mo].revenue += parseFloat(em.amount);
        byMonth[mo].em      += parseFloat(em.amount);
      });

      const totalRev = Object.values(byMonth).reduce((s, v) => s + v.revenue, 0);
      const totalEM  = Object.values(byMonth).reduce((s, v) => s + v.em, 0);
      const totalLots = cTranches.reduce((s, t) => s + parseInt(t.lot_count, 10), 0);
      return { contract: c, builder, byMonth, totalRev, totalEM, totalLots };
    });
  }, [contracts, allTranches, builderMap, earnestMoney, trancheCredits]);

  // Column totals
  const colTotals = useMemo(() => {
    const t = {};
    months.forEach(m => {
      t[m] = rows.reduce((s, r) => ({
        revenue: s.revenue + (r.byMonth[m]?.revenue || 0),
        em:      s.em      + (r.byMonth[m]?.em      || 0),
        lots:    s.lots    + (r.byMonth[m]?.lots     || 0),
      }), { revenue: 0, em: 0, lots: 0 });
    });
    return t;
  }, [rows, months]);

  const grandTotals = useMemo(() => ({
    revenue: rows.reduce((s, r) => s + r.totalRev, 0),
    em:      rows.reduce((s, r) => s + r.totalEM, 0),
    lots:    rows.reduce((s, r) => s + r.totalLots, 0),
  }), [rows]);

  function exportToExcel() {
    const wb = XLSX.utils.book_new();

    // ── Summary sheet ──────────────────────────────────────
    const summaryData = [
      ['MELINA COMMUNITY — CASH FLOW REPORT'],
      ['Generated:', new Date().toLocaleDateString()],
      [],
      ['Builder', 'Lot Size', 'FF Width', '$/FF', 'Lot Price', 'Qty', 'Escal. Rate', 'EM %',
       ...months.map(m => format(parseISO(m + '-01'), 'MMM yyyy') + '\nRevenue'),
       'Total Revenue',
       ...months.map(m => format(parseISO(m + '-01'), 'MMM yyyy') + '\nEarnest $'),
       'Total EM'],
    ];

    rows.forEach(({ contract: c, builder, byMonth, totalRev, totalEM, totalLots }) => {
      const lotPrice = parseFloat(c.ff_width) * parseFloat(c.ff_price);
      summaryData.push([
        builder?.name || '',
        c.lot_size_label,
        parseFloat(c.ff_width),
        parseFloat(c.ff_price),
        lotPrice,
        c.total_qty,
        parseFloat(c.escalator_rate),
        parseFloat(c.em_pct),
        ...months.map(m => byMonth[m]?.revenue || 0),
        totalRev,
        ...months.map(m => byMonth[m]?.em || 0),
        totalEM,
      ]);
    });

    summaryData.push([
      'TOTALS', '', '', '', '', grandTotals.lots, '', '',
      ...months.map(m => colTotals[m]?.revenue || 0),
      grandTotals.revenue,
      ...months.map(m => colTotals[m]?.em || 0),
      grandTotals.em,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 6 }, { wch: 10 }, { wch: 8 },
      ...months.map(() => ({ wch: 15 })), { wch: 15 }, ...months.map(() => ({ wch: 15 })), { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow');

    // ── Tranche detail sheet ───────────────────────────────
    const detailData = [
      ['Builder', 'Lot Size', 'Tranche #', 'Takedown Date', 'Lots', 'Base $/Lot', 'Months Escal.',
       'Adj $/Lot', 'Revenue', 'Earnest Money', 'Escalator Lift'],
    ];
    allTranches
      .slice()
      .sort((a, b) => parseISO(a.scheduled_date) - parseISO(b.scheduled_date))
      .forEach(t => {
        const c = contractMap[t.contract_id];
        if (!c) return;
        const b = builderMap[c.builder_id];
        const calc = calcTranche(c, t);
        detailData.push([
          b?.name || '', c.lot_size_label, t.tranche_number, t.scheduled_date,
          t.lot_count, calc.base_lot_price, calc.months_escalated,
          calc.adj_lot_price, calc.projected_revenue, calc.projected_em, calc.escalator_lift,
        ]);
      });
    const ws2 = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Tranche Detail');

    XLSX.writeFile(wb, `Melina_CashFlow_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }

  const fmtMonth = m => format(parseISO(m + '-01'), 'MMM\nyy');

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[['revenue','Revenue'],['em','Earnest Money'],['both','Both']].map(([v,l]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${view === v ? 'bg-[#1F4E79] text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 text-white text-sm hover:bg-green-800 transition"
        >
          <Download size={15} /> Export to Excel
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: DollarSign,  label: 'Total Escalated Revenue', value: fmtCurrency(grandTotals.revenue), color: 'text-green-700' },
          { icon: TrendingUp,  label: 'Total Earnest Money',     value: fmtCurrency(grandTotals.em),      color: 'text-blue-700'  },
          { icon: BarChart2,   label: 'Total Lots',              value: grandTotals.lots,                  color: 'text-gray-800'  },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <Icon size={20} className="text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">{label}</div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Cash flow grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[#1F4E79] text-white px-4 py-3 text-left font-semibold min-w-[160px]">Builder</th>
                <th className="bg-[#1F4E79] text-white px-3 py-3 text-left font-semibold min-w-[80px]">Lot Size</th>
                <th className="bg-[#1F4E79] text-white px-3 py-3 text-right font-semibold">Qty</th>
                {months.map(m => (
                  <th key={m} className="bg-[#1F4E79] text-white px-3 py-3 text-right font-semibold min-w-[110px] whitespace-pre-line">
                    {fmtMonth(m)}
                  </th>
                ))}
                <th className="bg-[#153452] text-white px-3 py-3 text-right font-semibold min-w-[130px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={months.length + 4} className="text-center py-10 text-gray-400">Loading…</td></tr>
              ) : (
                rows.map(({ contract: c, builder, byMonth, totalRev, totalEM, totalLots }, i) => {
                  const bg = i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30';
                  return (
                    <tr key={c.id} className={`${bg} hover:bg-blue-50 transition`}>
                      <td className={`sticky left-0 z-10 ${bg} px-4 py-2.5 font-semibold text-gray-800`}>{builder?.name}</td>
                      <td className="px-3 py-2.5 text-gray-600">
                        <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-medium">{c.lot_size_label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{totalLots}</td>
                      {months.map(m => {
                        const v = byMonth[m];
                        const showRev = view === 'revenue' || view === 'both';
                        const showEM  = view === 'em'      || view === 'both';
                        return (
                          <td key={m} className="px-3 py-2.5 text-right align-top">
                            {v ? (
                              <div className="space-y-0.5">
                                {showRev && <div className="text-green-700 font-semibold">{fmtCurrency(v.revenue)}</div>}
                                {showEM  && <div className="text-blue-600">{fmtCurrency(v.em)}</div>}
                                {view === 'both' && <div className="text-gray-400 text-[10px]">{v.lots} lots</div>}
                              </div>
                            ) : <span className="text-gray-200">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right bg-blue-50 font-bold">
                        {(view === 'revenue' || view === 'both') && <div className="text-green-700">{fmtCurrency(totalRev)}</div>}
                        {(view === 'em'      || view === 'both') && <div className="text-blue-600">{fmtCurrency(totalEM)}</div>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#1F4E79] text-white font-bold">
                <td className="sticky left-0 z-10 bg-[#1F4E79] px-4 py-3" colSpan={2}>PROJECT TOTALS</td>
                <td className="px-3 py-3 text-right">{grandTotals.lots}</td>
                {months.map(m => {
                  const v = colTotals[m];
                  const showRev = view === 'revenue' || view === 'both';
                  const showEM  = view === 'em'      || view === 'both';
                  return (
                    <td key={m} className="px-3 py-3 text-right">
                      {showRev && <div>{fmtCurrency(v?.revenue || 0)}</div>}
                      {showEM  && <div className="text-blue-200 text-[10px]">{fmtCurrency(v?.em || 0)}</div>}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right bg-[#153452]">
                  {(view === 'revenue' || view === 'both') && <div>{fmtCurrency(grandTotals.revenue)}</div>}
                  {(view === 'em'      || view === 'both') && <div className="text-blue-200 text-[10px]">{fmtCurrency(grandTotals.em)}</div>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
