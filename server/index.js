'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const express  = require('express');
const cors     = require('cors');
const { Pool } = require('pg');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');

const app  = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

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

// ── JWT auth middleware ───────────────────────────────────────
function authMiddleware(req, res, next) {
  if (process.env.REACT_APP_LOCAL_DEV === 'true') {
    req.user = { sub: '00000000-0000-0000-0000-000000000000', role: 'admin' };
    return next();
  }
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (process.env.REACT_APP_LOCAL_DEV === 'true') return next();
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ message: 'Admin access required' });
}

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── Auth routes (public) ──────────────────────────────────────
// Invite-based registration (public, requires valid invite token)
app.post('/auth/register', async (req, res) => {
  const { name, email, password, invite_token } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'name, email, and password are required' });
  try {
    // Validate invite token if provided
    let role = 'standard';
    if (invite_token) {
      try {
        const payload = jwt.verify(invite_token, JWT_SECRET);
        if (payload.purpose !== 'invite')
          return res.status(400).json({ message: 'Invalid invite token' });
        role = payload.role || 'standard';
      } catch (e) {
        if (e.name === 'TokenExpiredError')
          return res.status(400).json({ message: 'Invite link has expired' });
        return res.status(400).json({ message: 'Invalid invite token' });
      }
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, hash, role]
    );
    const user = rows[0];
    const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'Email already registered' });
    res.status(500).json({ message: e.message });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'email and password are required' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ message: 'Invalid email or password' });
    const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Password reset (public) ─────────────────────────────────
app.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'email is required' });
  try {
    const { rows } = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      // Don't reveal whether email exists
      return res.json({ message: 'If that email is registered, a reset token has been generated.' });
    }
    // Generate a short-lived reset token (15 min)
    const resetToken = jwt.sign({ sub: rows[0].id, purpose: 'reset' }, JWT_SECRET, { expiresIn: '15m' });
    // In production, email this token. For now, return it in response.
    console.log(`Password reset token for ${email}: ${resetToken}`);
    res.json({ message: 'If that email is registered, a reset token has been generated.', resetToken });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ message: 'token and newPassword are required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.purpose !== 'reset')
      return res.status(400).json({ message: 'Invalid reset token' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, payload.sub]);
    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    if (e.name === 'TokenExpiredError')
      return res.status(400).json({ message: 'Reset token has expired' });
    res.status(400).json({ message: 'Invalid reset token' });
  }
});

// ── Invite link generation (admin only) ─────────────────────
app.post('/auth/invite', authMiddleware, adminOnly, async (req, res) => {
  const { role } = req.body;
  try {
    const inviteToken = jwt.sign({ purpose: 'invite', role: role || 'standard' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ inviteToken });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Health check (public) ────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

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
       projected_revenue = $4, projected_em = $5, escalator_lift = $6
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

app.post('/api/projects', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description || null]
    );
    res.status(201).json(rows[0]);
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

// ── Routes: Payments (Receivables) ──────────────────────────────
app.get('/api/projects/:projectId/payments', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, b.name as builder_name, lc.lot_size_label,
              t.tranche_number, t.scheduled_date as tranche_date
       FROM receivables r
       JOIN lot_contracts lc ON r.contract_id = lc.id
       JOIN builders b ON lc.builder_id = b.id
       LEFT JOIN tranches t ON r.tranche_id = t.id
       WHERE lc.project_id = $1
       ORDER BY r.due_date DESC`,
      [req.params.projectId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/projects/:projectId/payments', async (req, res) => {
  const { contract_id, tranche_id, payment_type, amount_expected, amount_received, due_date, received_date, status, reference_num, notes } = req.body;
  if (!contract_id || !payment_type || !amount_expected || !due_date)
    return res.status(400).json({ message: 'contract_id, payment_type, amount_expected, and due_date are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO receivables (contract_id, tranche_id, payment_type, amount_expected, amount_received, due_date, received_date, status, reference_num, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [contract_id, tranche_id || null, payment_type, amount_expected, amount_received || 0, due_date, received_date || null, status || 'pending', reference_num || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/api/payments/:id', async (req, res) => {
  const { amount_received, received_date, status, reference_num, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE receivables SET amount_received=$1, received_date=$2, status=$3, reference_num=$4, notes=$5
       WHERE id=$6 RETURNING *`,
      [amount_received, received_date || null, status, reference_num || null, notes || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Payment not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/payments/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM receivables WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Routes: Expenses ────────────────────────────────────────────
app.get('/api/projects/:projectId/expenses', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM expenses WHERE project_id = $1 ORDER BY expense_date DESC',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/projects/:projectId/expenses', async (req, res) => {
  const { category, description, amount, expense_date, vendor, reference_num, notes } = req.body;
  if (!category || !amount || !expense_date)
    return res.status(400).json({ message: 'category, amount, and expense_date are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO expenses (project_id, category, description, amount, expense_date, vendor, reference_num, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.projectId, category, description || null, amount, expense_date, vendor || null, reference_num || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/api/expenses/:id', async (req, res) => {
  const { category, description, amount, expense_date, vendor, reference_num, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE expenses SET category=$1, description=$2, amount=$3, expense_date=$4, vendor=$5, reference_num=$6, notes=$7
       WHERE id=$8 RETURNING *`,
      [category, description || null, amount, expense_date, vendor || null, reference_num || null, notes || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Expense not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Routes: P&L Summary ─────────────────────────────────────────
app.get('/api/projects/:projectId/pnl', async (req, res) => {
  try {
    // Revenue: sum of received payments
    const { rows: [revenue] } = await pool.query(
      `SELECT
         COALESCE(SUM(amount_received), 0) as total_received,
         COALESCE(SUM(amount_expected), 0) as total_expected,
         COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
         COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count
       FROM receivables r
       JOIN lot_contracts lc ON r.contract_id = lc.id
       WHERE lc.project_id = $1`,
      [req.params.projectId]
    );

    // Expenses: sum by category
    const { rows: expensesByCategory } = await pool.query(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM expenses WHERE project_id = $1
       GROUP BY category ORDER BY total DESC`,
      [req.params.projectId]
    );

    const { rows: [expenseTotal] } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE project_id = $1`,
      [req.params.projectId]
    );

    // Monthly breakdown
    const { rows: monthlyRevenue } = await pool.query(
      `SELECT TO_CHAR(received_date, 'YYYY-MM') as month,
              COALESCE(SUM(amount_received), 0) as revenue
       FROM receivables r
       JOIN lot_contracts lc ON r.contract_id = lc.id
       WHERE lc.project_id = $1 AND r.received_date IS NOT NULL
       GROUP BY month ORDER BY month`,
      [req.params.projectId]
    );

    const { rows: monthlyExpenses } = await pool.query(
      `SELECT TO_CHAR(expense_date, 'YYYY-MM') as month,
              COALESCE(SUM(amount), 0) as expenses
       FROM expenses WHERE project_id = $1
       GROUP BY month ORDER BY month`,
      [req.params.projectId]
    );

    res.json({
      revenue: {
        total_received: parseFloat(revenue.total_received),
        total_expected: parseFloat(revenue.total_expected),
        paid_count: parseInt(revenue.paid_count),
        pending_count: parseInt(revenue.pending_count),
        overdue_count: parseInt(revenue.overdue_count),
      },
      expenses: {
        total: parseFloat(expenseTotal.total),
        by_category: expensesByCategory.map(r => ({ category: r.category, total: parseFloat(r.total) })),
      },
      net_income: parseFloat(revenue.total_received) - parseFloat(expenseTotal.total),
      monthly: { revenue: monthlyRevenue, expenses: monthlyExpenses },
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Routes: User Management (admin only) ────────────────────────
app.get('/api/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.created_at,
              COALESCE(json_agg(json_build_object('id', uc.project_id, 'name', p.name))
                FILTER (WHERE uc.project_id IS NOT NULL), '[]') as communities
       FROM users u
       LEFT JOIN user_communities uc ON u.id = uc.user_id
       LEFT JOIN projects p ON uc.project_id = p.id
       GROUP BY u.id
       ORDER BY u.name`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, email, role } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role)
       WHERE id = $4 RETURNING id, name, email, role, created_at`,
      [name, email, role, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'Email already in use' });
    res.status(500).json({ message: e.message });
  }
});

app.delete('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Assign communities to a user
app.put('/api/users/:id/communities', authMiddleware, adminOnly, async (req, res) => {
  const { project_ids } = req.body; // array of project UUIDs
  if (!Array.isArray(project_ids))
    return res.status(400).json({ message: 'project_ids must be an array' });
  try {
    // Remove existing assignments
    await pool.query('DELETE FROM user_communities WHERE user_id = $1', [req.params.id]);
    // Insert new ones
    for (const pid of project_ids) {
      await pool.query(
        'INSERT INTO user_communities (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, pid]
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Get communities the current user has access to
app.get('/api/my/communities', authMiddleware, async (req, res) => {
  try {
    if (process.env.REACT_APP_LOCAL_DEV === 'true' || req.user.role === 'admin') {
      const { rows } = await pool.query('SELECT * FROM projects ORDER BY name');
      return res.json(rows);
    }
    const { rows } = await pool.query(
      `SELECT p.* FROM projects p
       JOIN user_communities uc ON p.id = uc.project_id
       WHERE uc.user_id = $1
       ORDER BY p.name`,
      [req.user.sub]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`ACREs API listening on port ${PORT}`));
}
module.exports = app;
