import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';
import { fmtCurrency, fmtDate, calcTranche } from '../utils/calculations';
import { Calendar, DollarSign, Building2, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { parseISO, isWithinInterval, addDays, format, isPast, isToday } from 'date-fns';

const WINDOWS = [
  { label: '30 Days',  days: 30  },
  { label: '60 Days',  days: 60  },
  { label: '90 Days',  days: 90  },
  { label: '180 Days', days: 180 },
];

function KPICard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:  { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-100' },
    green: { bg: 'bg-green-50',  icon: 'text-green-600',  border: 'border-green-100' },
    amber: { bg: 'bg-amber-50',  icon: 'text-amber-600',  border: 'border-amber-100' },
    navy:  { bg: 'bg-indigo-50', icon: 'text-indigo-700', border: 'border-indigo-100' },
  };
  const c = colors[color];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5 flex items-start gap-4`}>
      <div className={`p-2 rounded-lg bg-white shadow-sm ${c.icon}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold text-gray-800 mt-0.5">{value}</div>
        {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function UpcomingRow({ tranche, contract, builder, urgency }) {
  const calc = calcTranche(contract, tranche);
  const urgencyStyles = {
    overdue:  'border-l-4 border-red-500  bg-red-50',
    today:    'border-l-4 border-amber-500 bg-amber-50',
    week:     'border-l-4 border-yellow-400 bg-yellow-50',
    upcoming: 'border-l-4 border-blue-400  bg-white',
  };
  return (
    <div className={`rounded-lg p-4 mb-2 flex flex-wrap items-center gap-4 ${urgencyStyles[urgency]}`}>
      <div className="flex items-center gap-2 min-w-[140px]">
        <Building2 size={15} className="text-gray-400" />
        <div>
          <div className="font-semibold text-sm text-gray-800">{builder.name}</div>
          <div className="text-xs text-gray-500">{contract.lot_size_label}</div>
        </div>
      </div>
      <div className="min-w-[120px]">
        <div className="text-xs text-gray-500">Takedown Date</div>
        <div className={`text-sm font-medium ${urgency === 'overdue' ? 'text-red-700' : 'text-gray-800'}`}>
          {fmtDate(tranche.scheduled_date)}
        </div>
      </div>
      <div className="min-w-[80px]">
        <div className="text-xs text-gray-500">Lots</div>
        <div className="text-sm font-medium text-gray-800">{tranche.lot_count}</div>
      </div>
      <div className="min-w-[130px]">
        <div className="text-xs text-gray-500">Expected Revenue</div>
        <div className="text-sm font-semibold text-green-700">{fmtCurrency(calc.projected_revenue)}</div>
      </div>
      <div className="min-w-[120px]">
        <div className="text-xs text-gray-500">Earnest Money</div>
        <div className="text-sm font-medium text-blue-700">{fmtCurrency(calc.projected_em)}</div>
      </div>
      {urgency === 'overdue' && (
        <div className="ml-auto flex items-center gap-1 text-red-600 text-xs font-semibold">
          <AlertCircle size={14} /> OVERDUE
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { contracts, builders, projectId } = useApp();
  const [window, setWindow] = useState(90);
  const [allTranches, setAllTranches] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingTranches, setLoadingTranches] = useState(false);

  // Load all tranches for all contracts
  useEffect(() => {
    if (!contracts.length) return;
    setLoadingTranches(true);
    Promise.all([
      Promise.all(contracts.map(c => api.getTranches(c.id).then(t => t.map(tr => ({ ...tr, contract_id: c.id }))))),
      api.getPayments(projectId)
    ])
      .then(([trancheResults, paymentResults]) => {
        setAllTranches(trancheResults.flat());
        setPayments(paymentResults);
      })
      .finally(() => setLoadingTranches(false));
  }, [contracts, projectId]);

  const today = new Date();
  const windowEnd = addDays(today, window);

  // Build contract/builder lookup maps
  const contractMap = Object.fromEntries(contracts.map(c => [c.id, c]));
  const builderMap  = Object.fromEntries(builders.map(b => [b.id, b]));

  // Calculate total payments per tranche
  const tranchePaymentTotals = payments.reduce((acc, p) => {
    if (p.tranche_id) {
      acc[p.tranche_id] = (acc[p.tranche_id] || 0) + parseFloat(p.amount_received || 0);
    }
    return acc;
  }, {});

  // Check if a tranche is fully paid
  const isTrancheFullyPaid = (tranche) => {
    const contract = contractMap[tranche.contract_id];
    if (!contract) return false;
    const calc = calcTranche(contract, tranche);
    const totalPaid = tranchePaymentTotals[tranche.id] || 0;
    return totalPaid >= calc.projected_revenue;
  };

  // Upcoming tranches in window (excluding fully paid)
  const upcoming = allTranches
    .filter(tr => {
      if (isTrancheFullyPaid(tr)) return false;
      const d = parseISO(tr.scheduled_date);
      return isWithinInterval(d, { start: addDays(today, -1), end: windowEnd });
    })
    .sort((a, b) => parseISO(a.scheduled_date) - parseISO(b.scheduled_date));

  const overdue = allTranches
    .filter(tr => {
      if (isTrancheFullyPaid(tr)) return false;
      return isPast(parseISO(tr.scheduled_date)) && !isToday(parseISO(tr.scheduled_date));
    })
    .sort((a, b) => parseISO(a.scheduled_date) - parseISO(b.scheduled_date));

  function getUrgency(dateStr) {
    const d = parseISO(dateStr);
    if (isPast(d) && !isToday(d)) return 'overdue';
    if (isToday(d)) return 'today';
    if (isWithinInterval(d, { start: today, end: addDays(today, 7) })) return 'week';
    return 'upcoming';
  }

  // Monthly bar chart data
  const monthlyData = (() => {
    const map = {};
    allTranches.forEach(tr => {
      const contract = contractMap[tr.contract_id];
      if (!contract) return;
      const calc = calcTranche(contract, tr);
      const key = format(parseISO(tr.scheduled_date), 'MMM yy');
      map[key] = (map[key] || 0) + calc.projected_revenue;
    });
    return Object.entries(map)
      .sort(([a], [b]) => new Date('01 ' + a) - new Date('01 ' + b))
      .map(([month, revenue]) => ({ month, revenue }));
  })();

  // KPIs
  const totalProjectedRevenue = allTranches.reduce((sum, tr) => {
    const c = contractMap[tr.contract_id];
    return c ? sum + calcTranche(c, tr).projected_revenue : sum;
  }, 0);

  const totalLots = contracts.reduce((sum, c) => sum + parseInt(c.total_qty, 10), 0);
  const totalBuilders = builders.length;

  const windowRevenue = upcoming.reduce((sum, tr) => {
    const c = contractMap[tr.contract_id];
    return c ? sum + calcTranche(c, tr).projected_revenue : sum;
  }, 0);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={DollarSign}  label="Total Project Revenue"  value={fmtCurrency(totalProjectedRevenue)} sub="All tranches, escalated" color="navy"  />
        <KPICard icon={Building2}   label="Active Builders"         value={totalBuilders}                      sub={`${contracts.length} contracts`}        color="blue"  />
        <KPICard icon={TrendingUp}  label="Total Lots"              value={totalLots}                          sub="Across all lot sizes"                    color="green" />
        <KPICard icon={Clock}       label={`Revenue Next ${window}d`} value={fmtCurrency(windowRevenue)}      sub={`${upcoming.length} takedowns`}          color="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue timeline chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Projected Revenue by Month</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} width={58} />
              <Tooltip formatter={v => [fmtCurrency(v), 'Revenue']} />
              <Bar dataKey="revenue" radius={[4,4,0,0]}>
                {monthlyData.map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? '#2E75B6' : '#1F4E79'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Builder summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Builder Summary</h2>
          <div className="space-y-3">
            {builders.map(b => {
              const bContracts = contracts.filter(c => c.builder_id === b.id);
              const lots = bContracts.reduce((s, c) => s + parseInt(c.total_qty, 10), 0);
              const rev = bContracts.reduce((s, c) => {
                const cTranches = allTranches.filter(t => t.contract_id === c.id);
                return s + cTranches.reduce((ss, tr) => ss + calcTranche(c, tr).projected_revenue, 0);
              }, 0);
              return (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{b.name}</div>
                    <div className="text-xs text-gray-500">{lots} lots · {bContracts.length} contract{bContracts.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-sm font-semibold text-green-700">{fmtCurrency(rev)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upcoming payments */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" /> Upcoming Takedowns
          </h2>
          <div className="flex gap-1">
            {WINDOWS.map(w => (
              <button
                key={w.days}
                onClick={() => setWindow(w.days)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition
                  ${window === w.days
                    ? 'bg-[#1F4E79] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {overdue.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              <AlertCircle size={12} /> Overdue ({overdue.length})
            </div>
            {overdue.map(tr => {
              const contract = contractMap[tr.contract_id];
              const builder  = contract ? builderMap[contractMap[tr.contract_id].builder_id] : null;
              if (!contract || !builder) return null;
              return <UpcomingRow key={tr.id} tranche={tr} contract={contract} builder={builder} urgency="overdue" />;
            })}
          </div>
        )}

        {upcoming.length === 0 && !loadingTranches ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No takedowns scheduled in the next {window} days.
          </div>
        ) : (
          upcoming.map(tr => {
            const contract = contractMap[tr.contract_id];
            const builder  = contract ? builderMap[contract.builder_id] : null;
            if (!contract || !builder) return null;
            return (
              <UpcomingRow
                key={tr.id}
                tranche={tr}
                contract={contract}
                builder={builder}
                urgency={getUrgency(tr.scheduled_date)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
