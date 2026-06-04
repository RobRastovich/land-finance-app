'use strict';
const express    = require('express');
const cors       = require('cors');
const { Pool }   = require('pg');
const jwt        = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── DB pool ───────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'melina',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('PG pool error:', err));

// ── Cognito JWT verification ──────────────────────────────────
const REGION      = process.env.AWS_REGION        || 'us-east-1';
const USER_POOL   = process.env.COGNITO_USER_POOL  || '';
const JWKS_URI    = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL}/.well-known/jwks.json`;

const jwks = jwksClient({ jwksUri: JWKS_URI, cache: true, rateLimit: true });

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function authMiddleware(req, res, next) {
  // In dev with no pool set, skip auth
  if (!USER_POOL) return next();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(authMiddleware);

// ── Escalation calculation helper ────────────────────────────
function calcEscalation(baseLotPrice, annualRate, escalatorStart, takedownDate) {
  const start = new Date(escalatorStart);
  const td    = new Date(takedownDate);
  const months = Math.max(
    0,
    (td.getFullYear() - start.getFullYear()) * 12 + (td.getMonth() - start.getMonth())
  );
  const adjPrice = baseLotPrice * (1 + (annualRate / 12) * months);
  return { months, adjPrice };
}

async function recalcTranche(tranche, contract) {
  const baseLotPrice = parseFloat(contract.ff_width) * parseFloat(contract.ff_price);
  const { months, adjPrice } = calcEscalation(
    baseLotPrice,
    parseFloat(contract.escalator_rate),
    contract.escalator_start,
    tranche.scheduled_date
  );
  const lots    = parseInt(tranche.lot_count, 10);
  const revenue = adjPrice * lots;
  const em      = revenue * parseFloat(contract.em_pct);
  const lift    = (adjPrice - baseLotPrice) * lots;

  await pool.query(
    `UPDATE tranches SET
       base_lot_price = $1, months_escalated = $2, adj_lot_price = $3,
       projected_revenue = $4, projected_em = $5, escalator_lift = $6,
       tranche_number = (SELECT COUNT(*) FROM tranches t2
                        WHERE t2.contract_id = tranches.contract_id
                          AND t2.scheduled_date <= tranches.scheduled_date
                          AND t2.id <= tranches.id)
     WHERE id = $7`,
    [baseLotPrice, months, adjPrice, revenue, em, lift, tranche.id]
  );
}

// ── Routes: Projects ─────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM projects ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Routes: Builders ─────────────────────────────────────────
app.get('/api/projects/:projectId/builders', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM builders WHERE project_id = $1 ORDER BY name',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/projects/:projectId/builders', async (req, res) => {
  const { name, contact_name, contact_email, contact_phone, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO builders (project_id, name, contact_name, contact_email, contact_phone, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.projectId, name, contact_name, contact_email, contact_phone, notes]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/api/builders/:id', async (req, res) => {
  const { name, contact_name, contact_email, contact_phone, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE builders SET name=$1, contact_name=$2, contact_email=$3, contact_phone=$4, notes=$5
       WHERE id=$6 RETURNING *`,
      [name, contact_name, contact_email, contact_phone, notes, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/builders/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM builders WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Routes: Contracts ─────────────────────────────────────────
app.get('/api/projects/:projectId/contracts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT lc.*, b.name as builder_name
       FROM lot_contracts lc
       JOIN builders b ON lc.builder_id = b.id
       WHERE lc.project_id = $1
       ORDER BY b.name, lc.lot_size_label`,
      [req.params.projectId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/projects/:projectId/contracts', async (req, res) => {
  const { builder_id, lot_size_label, ff_width, ff_price, total_qty,
          escalator_rate, escalator_start, em_pct, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO lot_contracts
         (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,
          escalator_rate,escalator_start,em_pct,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.projectId, builder_id, lot_size_label, ff_width, ff_price,
       total_qty, escalator_rate, escalator_start || '2027-01-01', em_pct, notes]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/api/contracts/:id', async (req, res) => {
  const { builder_id, lot_size_label, ff_width, ff_price, total_qty,
          escalator_rate, escalator_start, em_pct, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE lot_contracts SET
         builder_id=$1, lot_size_label=$2, ff_width=$3, ff_price=$4, total_qty=$5,
         escalator_rate=$6, escalator_start=$7, em_pct=$8, notes=$9
       WHERE id=$10 RETURNING *`,
      [builder_id, lot_size_label, ff_width, ff_price, total_qty,
       escalator_rate, escalator_start, em_pct, notes, req.params.id]
    );
    // Recalc all tranches for this contract
    const contract = rows[0];
    const { rows: tranches } = await pool.query('SELECT * FROM tranches WHERE contract_id=$1', [contract.id]);
    await Promise.all(tranches.map(t => recalcTranche(t, contract)));
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/contracts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM lot_contracts WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Routes: Tranches ─────────────────────────────────────────
app.get('/api/contracts/:contractId/tranches', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tranches WHERE contract_id=$1 ORDER BY scheduled_date, tranche_number',
      [req.params.contractId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/contracts/:contractId/tranches', async (req, res) => {
  const { scheduled_date, lot_count, notes } = req.body;
  try {
    // Get next tranche number
    const { rows: [{ max_num }] } = await pool.query(
      'SELECT COALESCE(MAX(tranche_number),0) as max_num FROM tranches WHERE contract_id=$1',
      [req.params.contractId]
    );
    const trancheNum = parseInt(max_num, 10) + 1;

    const { rows } = await pool.query(
      `INSERT INTO tranches (contract_id, tranche_number, scheduled_date, lot_count, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.contractId, trancheNum, scheduled_date, lot_count, notes]
    );
    const tranche = rows[0];
    // Get contract for recalc
    const { rows: [contract] } = await pool.query('SELECT * FROM lot_contracts WHERE id=$1', [req.params.contractId]);
    await recalcTranche(tranche, contract);
    const { rows: [updated] } = await pool.query('SELECT * FROM tranches WHERE id=$1', [tranche.id]);
    res.status(201).json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/api/tranches/:id', async (req, res) => {
  const { scheduled_date, lot_count, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tranches SET scheduled_date=$1, lot_count=$2, notes=$3 WHERE id=$4 RETURNING *`,
      [scheduled_date, lot_count, notes, req.params.id]
    );
    const tranche = rows[0];
    const { rows: [contract] } = await pool.query('SELECT * FROM lot_contracts WHERE id=$1', [tranche.contract_id]);
    await recalcTranche(tranche, contract);
    const { rows: [updated] } = await pool.query('SELECT * FROM tranches WHERE id=$1', [tranche.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/tranches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tranches WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Routes: Dashboard ─────────────────────────────────────────
app.get('/api/projects/:projectId/dashboard', async (req, res) => {
  const days = parseInt(req.query.days || '90');
  try {
    const { rows } = await pool.query(
      `SELECT t.*, lc.lot_size_label, lc.em_pct, lc.escalator_rate,
              b.name as builder_name
       FROM tranches t
       JOIN lot_contracts lc ON t.contract_id = lc.id
       JOIN builders b ON lc.builder_id = b.id
       WHERE lc.project_id = $1
         AND t.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day' * $2
       ORDER BY t.scheduled_date`,
      [req.params.projectId, days]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Health check ─────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

app.listen(PORT, () => console.log(`Melina API listening on port ${PORT}`));
module.exports = app;
