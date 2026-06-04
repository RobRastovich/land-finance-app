'use strict';
const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// ── In-memory data store ─────────────────────────────────────
const PROJ_ID = 'melina-project-001';

let data = {
  projects: [
    { id: PROJ_ID, name: 'Melina', description: 'Melina master-planned community' }
  ],
  builders: [],
  contracts: [],
  tranches: [],
};

// ── Seed data ────────────────────────────────────────────────
function seed() {
  const h  = uuidv4(), dw = uuidv4(), p  = uuidv4(), n  = uuidv4(), c  = uuidv4();

  data.builders = [
    { id: h,  project_id: PROJ_ID, name: 'Highland',      contact_name: '', contact_email: '', notes: '' },
    { id: dw, project_id: PROJ_ID, name: 'David Weekley', contact_name: '', contact_email: '', notes: '' },
    { id: p,  project_id: PROJ_ID, name: 'Perry',         contact_name: '', contact_email: '', notes: '' },
    { id: n,  project_id: PROJ_ID, name: 'Newmark',       contact_name: '', contact_email: '', notes: '' },
    { id: c,  project_id: PROJ_ID, name: 'Chesmar',       contact_name: '', contact_email: '', notes: '' },
  ];

  const contracts = [
    { builder_id: h,  lot_size_label: '60s',          ff_width: 60,    ff_price: 2600, total_qty: 51, escalator_rate: 0.0957, escalator_start: '2027-01-01', em_pct: 0,    notes: '' },
    { builder_id: dw, lot_size_label: '60s',          ff_width: 60,    ff_price: 2500, total_qty: 51, escalator_rate: 0.06,   escalator_start: '2027-01-01', em_pct: 0.10, notes: '' },
    { builder_id: p,  lot_size_label: '60s',          ff_width: 60,    ff_price: 2500, total_qty: 51, escalator_rate: 0.08,   escalator_start: '2027-01-01', em_pct: 0.10, notes: '' },
    { builder_id: h,  lot_size_label: '50s',          ff_width: 51.25, ff_price: 2600, total_qty: 69, escalator_rate: 0.0957, escalator_start: '2027-01-01', em_pct: 0,    notes: '' },
    { builder_id: dw, lot_size_label: '50s',          ff_width: 50,    ff_price: 2500, total_qty: 69, escalator_rate: 0.06,   escalator_start: '2027-01-01', em_pct: 0.10, notes: '' },
    { builder_id: n,  lot_size_label: '50s - T1',     ff_width: 51.25, ff_price: 2450, total_qty: 40, escalator_rate: 0,      escalator_start: '2027-01-01', em_pct: 0.10, notes: 'First 40 lots' },
    { builder_id: n,  lot_size_label: '50s - T2',     ff_width: 51.25, ff_price: 2550, total_qty: 29, escalator_rate: 0,      escalator_start: '2027-01-01', em_pct: 0.10, notes: 'Next 29 lots after 18mo' },
    { builder_id: p,  lot_size_label: '50s',          ff_width: 50,    ff_price: 2460, total_qty: 69, escalator_rate: 0,      escalator_start: '2027-01-01', em_pct: 0.10, notes: '' },
    { builder_id: n,  lot_size_label: '45s - T1',     ff_width: 45,    ff_price: 2350, total_qty: 40, escalator_rate: 0,      escalator_start: '2027-01-01', em_pct: 0.10, notes: 'First 40 lots' },
    { builder_id: n,  lot_size_label: '45s - T2',     ff_width: 45,    ff_price: 2450, total_qty: 27, escalator_rate: 0,      escalator_start: '2027-01-01', em_pct: 0.10, notes: 'Next 27 lots after 18mo' },
    { builder_id: c,  lot_size_label: '45s',          ff_width: 45,    ff_price: 2400, total_qty: 67, escalator_rate: 0,      escalator_start: '2027-01-01', em_pct: 0.10, notes: '' },
  ];

  const trancheMap = {
    // Highland 60s
    0: [{ date: '2027-01-15', lots: 51 }],
    // DW 60s
    1: [{ date: '2027-01-01', lots: 15 }, { date: '2027-07-01', lots: 15 }, { date: '2028-04-01', lots: 21 }],
    // Perry 60s
    2: [{ date: '2027-01-01', lots: 12 }, { date: '2027-07-01', lots: 9 }, { date: '2028-01-01', lots: 9 }, { date: '2028-07-01', lots: 9 }, { date: '2029-01-01', lots: 12 }],
    // Highland 50s
    3: [{ date: '2027-01-15', lots: 69 }],
    // DW 50s
    4: [{ date: '2027-01-01', lots: 15 }, { date: '2027-07-01', lots: 15 }, { date: '2028-04-01', lots: 34 }],
    // Newmark 50s T1
    5: [{ date: '2027-01-01', lots: 40 }],
    // Newmark 50s T2
    6: [{ date: '2028-07-01', lots: 29 }],
    // Perry 50s
    7: [{ date: '2027-01-01', lots: 10 }, { date: '2027-04-01', lots: 8 }, { date: '2027-07-01', lots: 8 },
        { date: '2027-10-01', lots: 8 }, { date: '2028-01-01', lots: 8 }, { date: '2028-04-01', lots: 8 },
        { date: '2028-07-01', lots: 8 }, { date: '2028-10-01', lots: 8 }, { date: '2029-01-01', lots: 3 }],
    // Newmark 45s T1
    8: [{ date: '2027-01-01', lots: 40 }],
    // Newmark 45s T2
    9: [{ date: '2028-07-01', lots: 27 }],
    // Chesmar 45s
    10: [{ date: '2027-01-01', lots: 17 }, { date: '2027-04-01', lots: 17 }, { date: '2027-07-01', lots: 17 }, { date: '2027-10-01', lots: 16 }],
  };

  data.contracts = contracts.map((c, i) => {
    const id = uuidv4();
    const lotPrice = c.ff_width * c.ff_price;

    (trancheMap[i] || []).forEach((t, j) => {
      const start  = new Date(c.escalator_start);
      const td     = new Date(t.date);
      const months = Math.max(0, (td.getFullYear() - start.getFullYear()) * 12 + td.getMonth() - start.getMonth());
      const adj    = lotPrice * (1 + (c.escalator_rate / 12) * months);
      const rev    = adj * t.lots;
      const em     = rev * c.em_pct;
      data.tranches.push({
        id: uuidv4(),
        contract_id: id,
        tranche_number: j + 1,
        scheduled_date: t.date,
        lot_count: t.lots,
        base_lot_price: lotPrice,
        months_escalated: months,
        adj_lot_price: adj,
        projected_revenue: rev,
        projected_em: em,
        escalator_lift: (adj - lotPrice) * t.lots,
        notes: '',
      });
    });

    return { id, project_id: PROJ_ID, ...c };
  });
}

seed();

// ── Helper: recalc a tranche ─────────────────────────────────
function recalcTranche(tranche) {
  const contract = data.contracts.find(c => c.id === tranche.contract_id);
  if (!contract) return;
  const base   = contract.ff_width * contract.ff_price;
  const start  = new Date(contract.escalator_start);
  const td     = new Date(tranche.scheduled_date);
  const months = Math.max(0, (td.getFullYear() - start.getFullYear()) * 12 + td.getMonth() - start.getMonth());
  const adj    = base * (1 + (contract.escalator_rate / 12) * months);
  const rev    = adj * tranche.lot_count;
  const em     = rev * contract.em_pct;
  tranche.base_lot_price    = base;
  tranche.months_escalated  = months;
  tranche.adj_lot_price     = adj;
  tranche.projected_revenue = rev;
  tranche.projected_em      = em;
  tranche.escalator_lift    = (adj - base) * tranche.lot_count;
}

// ── Routes ───────────────────────────────────────────────────

// Projects
app.get('/api/projects', (req, res) => res.json(data.projects));

// Builders
app.get('/api/projects/:pid/builders', (req, res) =>
  res.json(data.builders.filter(b => b.project_id === req.params.pid)));

app.post('/api/projects/:pid/builders', (req, res) => {
  const b = { id: uuidv4(), project_id: req.params.pid, ...req.body };
  data.builders.push(b);
  res.status(201).json(b);
});

app.put('/api/builders/:id', (req, res) => {
  const i = data.builders.findIndex(b => b.id === req.params.id);
  if (i === -1) return res.status(404).json({ message: 'Not found' });
  data.builders[i] = { ...data.builders[i], ...req.body };
  res.json(data.builders[i]);
});

app.delete('/api/builders/:id', (req, res) => {
  // Cascade: delete contracts → tranches
  const contracts = data.contracts.filter(c => c.builder_id === req.params.id);
  contracts.forEach(c => {
    data.tranches  = data.tranches.filter(t => t.contract_id !== c.id);
  });
  data.contracts = data.contracts.filter(c => c.builder_id !== req.params.id);
  data.builders  = data.builders.filter(b => b.id !== req.params.id);
  res.json({ success: true });
});

// Contracts
app.get('/api/projects/:pid/contracts', (req, res) => {
  const contracts = data.contracts
    .filter(c => c.project_id === req.params.pid)
    .map(c => {
      const builder = data.builders.find(b => b.id === c.builder_id);
      return { ...c, builder_name: builder?.name || '' };
    });
  res.json(contracts);
});

app.post('/api/projects/:pid/contracts', (req, res) => {
  const c = { id: uuidv4(), project_id: req.params.pid, ...req.body };
  data.contracts.push(c);
  res.status(201).json(c);
});

app.put('/api/contracts/:id', (req, res) => {
  const i = data.contracts.findIndex(c => c.id === req.params.id);
  if (i === -1) return res.status(404).json({ message: 'Not found' });
  data.contracts[i] = { ...data.contracts[i], ...req.body };
  // Recalc all tranches for this contract
  data.tranches
    .filter(t => t.contract_id === req.params.id)
    .forEach(t => recalcTranche(t));
  res.json(data.contracts[i]);
});

app.delete('/api/contracts/:id', (req, res) => {
  data.tranches  = data.tranches.filter(t => t.contract_id !== req.params.id);
  data.contracts = data.contracts.filter(c => c.id !== req.params.id);
  res.json({ success: true });
});

// Tranches
app.get('/api/contracts/:cid/tranches', (req, res) => {
  const tranches = data.tranches
    .filter(t => t.contract_id === req.params.cid)
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
  res.json(tranches);
});

app.post('/api/contracts/:cid/tranches', (req, res) => {
  const existing = data.tranches.filter(t => t.contract_id === req.params.cid);
  const maxNum   = existing.reduce((m, t) => Math.max(m, t.tranche_number), 0);
  const t = {
    id: uuidv4(),
    contract_id: req.params.cid,
    tranche_number: maxNum + 1,
    lot_count: parseInt(req.body.lot_count, 10),
    scheduled_date: req.body.scheduled_date,
    notes: req.body.notes || '',
    base_lot_price: 0, months_escalated: 0, adj_lot_price: 0,
    projected_revenue: 0, projected_em: 0, escalator_lift: 0,
  };
  recalcTranche(t);
  data.tranches.push(t);
  res.status(201).json(t);
});

app.put('/api/tranches/:id', (req, res) => {
  const i = data.tranches.findIndex(t => t.id === req.params.id);
  if (i === -1) return res.status(404).json({ message: 'Not found' });
  data.tranches[i] = {
    ...data.tranches[i],
    scheduled_date: req.body.scheduled_date,
    lot_count: parseInt(req.body.lot_count, 10),
    notes: req.body.notes || '',
  };
  recalcTranche(data.tranches[i]);
  res.json(data.tranches[i]);
});

app.delete('/api/tranches/:id', (req, res) => {
  data.tranches = data.tranches.filter(t => t.id !== req.params.id);
  res.json({ success: true });
});

// Dashboard
app.get('/api/projects/:pid/dashboard', (req, res) => {
  const days = parseInt(req.query.days || '90');
  const now  = new Date();
  const end  = new Date(now); end.setDate(end.getDate() + days);
  const rows = data.tranches.filter(t => {
    const d = new Date(t.scheduled_date);
    return d >= now && d <= end;
  }).map(t => {
    const contract = data.contracts.find(c => c.id === t.contract_id);
    const builder  = contract ? data.builders.find(b => b.id === contract.builder_id) : null;
    return { ...t, builder_name: builder?.name || '', lot_size_label: contract?.lot_size_label || '' };
  }).sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
  res.json(rows);
});

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', mode: 'local-mock' }));

app.listen(PORT, () => {
  console.log(`\n✅ Melina Mock API running at http://localhost:${PORT}`);
  console.log(`   Mode: in-memory (no DB required)`);
  console.log(`   ${data.builders.length} builders, ${data.contracts.length} contracts, ${data.tranches.length} tranches loaded\n`);
});
