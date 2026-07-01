'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const express  = require('express');
const cors     = require('cors');
const { Pool } = require('pg');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app  = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const S3_BUCKET = process.env.S3_DOCUMENTS_BUCKET || 'acres-documents';
const s3 = new S3Client({ region: process.env.S3_REGION || process.env.APP_REGION || 'us-east-1' });

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

// Run migrations on startup
(async () => {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS module_permissions JSONB DEFAULT '{"dashboard":true,"builder_manager":true,"cash_flow":true,"payments":true,"pnl":true,"documents":true}'::jsonb
    `);
    await pool.query(`
      UPDATE users SET module_permissions = '{"dashboard":true,"builder_manager":true,"cash_flow":true,"payments":true,"pnl":true,"documents":true}'::jsonb WHERE module_permissions IS NULL
    `);
    console.log('Migration: module_permissions column added/updated');
  } catch (e) {
    if (e.code !== '42701') { // Ignore if column already exists
      console.error('Migration error:', e.message);
    }
  }

  // Create earnest_money_revenue table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS earnest_money_revenue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id UUID NOT NULL REFERENCES lot_contracts(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        received_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Migration: earnest_money_revenue table created');
  } catch (e) {
    console.error('Migration error (earnest_money_revenue):', e.message);
  }

  // Create tranche_earnest_credits table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tranche_earnest_credits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tranche_id UUID NOT NULL REFERENCES tranches(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Migration: tranche_earnest_credits table created');
  } catch (e) {
    console.error('Migration error (tranche_earnest_credits):', e.message);
  }

  // Add per-takedown additional escalator rate column
  try {
    await pool.query(`
      ALTER TABLE tranches
      ADD COLUMN IF NOT EXISTS additional_escalator_rate NUMERIC(6,4) NOT NULL DEFAULT 0
    `);
    console.log('Migration: tranches.additional_escalator_rate column added/updated');
  } catch (e) {
    if (e.code !== '42701') {
      console.error('Migration error (additional_escalator_rate):', e.message);
    }
  }
})();

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
    const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
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
    const { rows } = await pool.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)', [email]);
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
  const effectiveRate = parseFloat(contract.escalator_rate) + parseFloat(tranche.additional_escalator_rate || 0);
  const { months, adjPrice } = calcEscalation(
    baseLotPrice,
    effectiveRate,
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
       additional_escalator_rate = $7
     WHERE id = $8`,
    [baseLotPrice, months, adjPrice, revenue, em, lift, tranche.additional_escalator_rate || 0, tranche.id]
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

app.put('/api/projects/:id', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  try {
    const { rows } = await pool.query(
      `UPDATE projects SET name = $1, description = $2 WHERE id = $3 RETURNING *`,
      [name, description || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Community not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Duplicate a community (copies builders + contracts + tranches only)
app.post('/api/projects/:id/duplicate', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get original project
    const { rows: [original] } = await client.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
    if (!original) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Community not found' }); }

    // Create new project with " (Copy)" appended
    const newName = req.body.name || (original.name + ' (Copy)');
    const { rows: [newProject] } = await client.query(
      `INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *`,
      [newName, original.description]
    );

    // Copy builders (map old IDs to new IDs)
    const { rows: oldBuilders } = await client.query(
      'SELECT * FROM builders WHERE project_id=$1 ORDER BY name', [req.params.id]
    );
    const builderMap = {}; // old_id -> new_id
    for (const b of oldBuilders) {
      const { rows: [newBuilder] } = await client.query(
        `INSERT INTO builders (project_id, name, contact_name, contact_email, contact_phone, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [newProject.id, b.name, b.contact_name, b.contact_email, b.contact_phone, b.notes]
      );
      builderMap[b.id] = newBuilder.id;
    }

    // Copy contracts (using new builder IDs)
    const { rows: oldContracts } = await client.query(
      'SELECT * FROM lot_contracts WHERE project_id=$1', [req.params.id]
    );
    for (const c of oldContracts) {
      const newBuilderId = builderMap[c.builder_id];
      if (!newBuilderId) continue; // skip if builder wasn't copied

      const { rows: [newContract] } = await client.query(
        `INSERT INTO lot_contracts
           (project_id, builder_id, lot_size_label, ff_width, ff_price, total_qty,
            escalator_rate, escalator_start, em_pct, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [newProject.id, newBuilderId, c.lot_size_label, c.ff_width, c.ff_price,
         c.total_qty, c.escalator_rate, c.escalator_start, c.em_pct, c.notes]
      );

      // Copy tranches for this contract
      const { rows: oldTranches } = await client.query(
        'SELECT * FROM tranches WHERE contract_id=$1 ORDER BY tranche_number', [c.id]
      );
      for (const t of oldTranches) {
        const { rows: [newTranche] } = await client.query(
          `INSERT INTO tranches (contract_id, tranche_number, scheduled_date, lot_count, additional_escalator_rate, notes)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [newContract.id, t.tranche_number, t.scheduled_date, t.lot_count, t.additional_escalator_rate || 0, t.notes]
        );
        await recalcTranche(newTranche, newContract);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(newProject);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: e.message });
  } finally {
    client.release();
  }
});

// Delete a community (and all related data via CASCADE)
// This uses CASCADE deletes in the database schema
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM projects WHERE id=$1 RETURNING *', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Community not found' });
    res.json({ success: true });
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
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'A contract for this builder and lot size already exists.' });
    res.status(500).json({ message: e.message });
  }
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

// Duplicate a contract (with all its tranches)
app.post('/api/contracts/:id/duplicate', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Get original contract
    const { rows: [original] } = await client.query('SELECT * FROM lot_contracts WHERE id=$1', [req.params.id]);
    if (!original) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Contract not found' }); }

    // Create duplicate contract with " (Copy)" appended to lot_size_label
    const { rows: [newContract] } = await client.query(
      `INSERT INTO lot_contracts
         (project_id, builder_id, lot_size_label, ff_width, ff_price, total_qty,
          escalator_rate, escalator_start, em_pct, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [original.project_id, original.builder_id, original.lot_size_label + ' (Copy)',
       original.ff_width, original.ff_price, original.total_qty,
       original.escalator_rate, original.escalator_start, original.em_pct, original.notes]
    );

    // Duplicate all tranches
    const { rows: tranches } = await client.query(
      'SELECT * FROM tranches WHERE contract_id=$1 ORDER BY tranche_number', [req.params.id]
    );
    for (const t of tranches) {
      const { rows: [newTranche] } = await client.query(
        `INSERT INTO tranches (contract_id, tranche_number, scheduled_date, lot_count, additional_escalator_rate, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [newContract.id, t.tranche_number, t.scheduled_date, t.lot_count, t.additional_escalator_rate || 0, t.notes]
      );
      await recalcTranche(newTranche, newContract);
    }

    await client.query('COMMIT');
    res.status(201).json(newContract);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ message: 'Duplicate contract already exists. Edit the copy label first.' });
    res.status(500).json({ message: e.message });
  } finally {
    client.release();
  }
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
  const { scheduled_date, lot_count, additional_escalator_rate, notes } = req.body;
  try {
    // Get next tranche number
    const { rows: [{ max_num }] } = await pool.query(
      'SELECT COALESCE(MAX(tranche_number),0) as max_num FROM tranches WHERE contract_id=$1',
      [req.params.contractId]
    );
    const trancheNum = parseInt(max_num, 10) + 1;

    const { rows } = await pool.query(
      `INSERT INTO tranches (contract_id, tranche_number, scheduled_date, lot_count, additional_escalator_rate, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.contractId, trancheNum, scheduled_date, lot_count, additional_escalator_rate || 0, notes]
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
  const { scheduled_date, lot_count, additional_escalator_rate, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tranches SET scheduled_date=$1, lot_count=$2, additional_escalator_rate=$3, notes=$4 WHERE id=$5 RETURNING *`,
      [scheduled_date, lot_count, additional_escalator_rate || 0, notes, req.params.id]
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

// Duplicate a single tranche
app.post('/api/tranches/:id/duplicate', async (req, res) => {
  try {
    // Get original tranche
    const { rows: [original] } = await pool.query('SELECT * FROM tranches WHERE id=$1', [req.params.id]);
    if (!original) return res.status(404).json({ message: 'Tranche not found' });

    // Get next tranche number for this contract
    const { rows: [{ max_num }] } = await pool.query(
      'SELECT COALESCE(MAX(tranche_number),0) as max_num FROM tranches WHERE contract_id=$1',
      [original.contract_id]
    );
    const trancheNum = parseInt(max_num, 10) + 1;

    const { rows } = await pool.query(
      `INSERT INTO tranches (contract_id, tranche_number, scheduled_date, lot_count, additional_escalator_rate, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [original.contract_id, trancheNum, original.scheduled_date, original.lot_count, original.additional_escalator_rate || 0, original.notes]
    );
    const tranche = rows[0];
    const { rows: [contract] } = await pool.query('SELECT * FROM lot_contracts WHERE id=$1', [original.contract_id]);
    await recalcTranche(tranche, contract);
    const { rows: [updated] } = await pool.query('SELECT * FROM tranches WHERE id=$1', [tranche.id]);
    res.status(201).json(updated);
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

// ── Routes: Earnest Money Revenue ──────────────────────────────
app.get('/api/contracts/:contractId/earnest-money', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM earnest_money_revenue WHERE contract_id = $1 ORDER BY received_date DESC',
      [req.params.contractId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/contracts/:contractId/earnest-money', async (req, res) => {
  const { amount, received_date, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO earnest_money_revenue (contract_id, amount, received_date, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.contractId, amount, received_date, notes]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/api/earnest-money/:id', async (req, res) => {
  const { amount, received_date, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE earnest_money_revenue SET amount = COALESCE($1, amount), received_date = COALESCE($2, received_date), notes = COALESCE($3, notes)
       WHERE id = $4 RETURNING *`,
      [amount, received_date, notes, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/earnest-money/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM earnest_money_revenue WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Routes: Tranche Earnest Credits ──────────────────────────────
app.get('/api/tranches/:trancheId/earnest-credits', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tranche_earnest_credits WHERE tranche_id = $1 ORDER BY created_at',
      [req.params.trancheId]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/tranches/:trancheId/earnest-credits', async (req, res) => {
  const { amount } = req.body;
  try {
    // Get contract_id from tranche
    const { rows: [tranche] } = await pool.query('SELECT contract_id FROM tranches WHERE id = $1', [req.params.trancheId]);
    if (!tranche) return res.status(404).json({ message: 'Tranche not found' });

    // Calculate total earnest money for the contract
    const { rows: [totalEM] } = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM earnest_money_revenue WHERE contract_id = $1',
      [tranche.contract_id]
    );

    // Calculate total credits already assigned to this tranche
    const { rows: [currentCredits] } = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM tranche_earnest_credits WHERE tranche_id = $1',
      [req.params.trancheId]
    );

    // Calculate total credits assigned to all tranches for this contract
    const { rows: [allCredits] } = await pool.query(
      `SELECT COALESCE(SUM(tec.amount), 0) as total
       FROM tranche_earnest_credits tec
       JOIN tranches t ON tec.tranche_id = t.id
       WHERE t.contract_id = $1`,
      [tranche.contract_id]
    );

    const newTotal = parseFloat(allCredits.total) + parseFloat(amount) - parseFloat(currentCredits.total);
    if (newTotal > parseFloat(totalEM.total)) {
      return res.status(400).json({ message: `Cannot exceed total earnest money of ${totalEM.total}` });
    }

    const { rows } = await pool.query(
      `INSERT INTO tranche_earnest_credits (tranche_id, amount) VALUES ($1, $2) RETURNING *`,
      [req.params.trancheId, amount]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/api/earnest-credits/:id', async (req, res) => {
  const { amount } = req.body;
  try {
    // Get tranche_id and contract_id
    const { rows: [credit] } = await pool.query(
      `SELECT tec.tranche_id, t.contract_id
       FROM tranche_earnest_credits tec
       JOIN tranches t ON tec.tranche_id = t.id
       WHERE tec.id = $1`,
      [req.params.id]
    );
    if (!credit) return res.status(404).json({ message: 'Credit not found' });

    // Calculate total earnest money for the contract
    const { rows: [totalEM] } = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM earnest_money_revenue WHERE contract_id = $1',
      [credit.contract_id]
    );

    // Calculate total credits assigned to all tranches for this contract (excluding this one)
    const { rows: [allCredits] } = await pool.query(
      `SELECT COALESCE(SUM(tec.amount), 0) as total
       FROM tranche_earnest_credits tec
       JOIN tranches t ON tec.tranche_id = t.id
       WHERE t.contract_id = $1 AND tec.id != $2`,
      [credit.contract_id, req.params.id]
    );

    const newTotal = parseFloat(allCredits.total) + parseFloat(amount);
    if (newTotal > parseFloat(totalEM.total)) {
      return res.status(400).json({ message: `Cannot exceed total earnest money of ${totalEM.total}` });
    }

    const { rows } = await pool.query(
      'UPDATE tranche_earnest_credits SET amount = $1 WHERE id = $2 RETURNING *',
      [amount, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/earnest-credits/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tranche_earnest_credits WHERE id = $1', [req.params.id]);
    res.json({ success: true });
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
    // Use string-based rounding to avoid floating point precision issues
    const roundTo2 = (val) => {
      const num = parseFloat(val || 0);
      const rounded = Math.round(num * 100) / 100;
      return parseFloat(rounded.toFixed(2));
    };
    const { rows } = await pool.query(
      `INSERT INTO receivables (contract_id, tranche_id, payment_type, amount_expected, amount_received, due_date, received_date, status, reference_num, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [contract_id, tranche_id || null, payment_type, roundTo2(amount_expected), roundTo2(amount_received), due_date, received_date || null, status || 'pending', reference_num || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put('/api/payments/:id', async (req, res) => {
  const { amount_expected, amount_received, due_date, received_date, status, reference_num, notes, tranche_id } = req.body;
  try {
    // Use string-based rounding to avoid floating point precision issues
    const roundTo2 = (val) => {
      const num = parseFloat(val || 0);
      const rounded = Math.round(num * 100) / 100;
      return parseFloat(rounded.toFixed(2));
    };
    const { rows } = await pool.query(
      `UPDATE receivables
       SET amount_expected=$1, amount_received=$2, due_date=$3, received_date=$4, status=$5, reference_num=$6, notes=$7, tranche_id=$8
       WHERE id=$9 RETURNING *`,
      [roundTo2(amount_expected), roundTo2(amount_received), due_date, received_date || null, status, reference_num || null, notes || null, tranche_id || null, req.params.id]
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
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.module_permissions,
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
  const { name, email, role, module_permissions } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), module_permissions = COALESCE($4, module_permissions)
       WHERE id = $5 RETURNING id, name, email, role, created_at, module_permissions`,
      [name, email, role, module_permissions ? JSON.stringify(module_permissions) : null, req.params.id]
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

// ── Routes: Documents (S3) ──────────────────────────────────────
// Get presigned upload URL
app.post('/api/projects/:id/documents/upload-url', authMiddleware, async (req, res) => {
  const { filename, content_type } = req.body;
  if (!filename) return res.status(400).json({ message: 'filename is required' });
  try {
    // Get project name for folder path
    const { rows } = await pool.query('SELECT name FROM projects WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Project not found' });
    const folderName = rows[0].name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
    const key = `${folderName}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: content_type || 'application/octet-stream',
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    res.json({ uploadUrl, key });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Register document in database after successful upload
app.post('/api/projects/:id/documents/register', authMiddleware, async (req, res) => {
  const { key, name, size, content_type } = req.body;
  if (!key || !name) return res.status(400).json({ message: 'key and name are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO documents (project_id, key, name, size, content_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id, key) DO UPDATE
       SET name = EXCLUDED.name, size = EXCLUDED.size, content_type = EXCLUDED.content_type
       RETURNING *`,
      [req.params.id, key, name, size, content_type, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// List documents for a project
app.get('/api/projects/:id/documents', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, key, name, size, content_type, uploaded_at
       FROM documents
       WHERE project_id = $1
       ORDER BY uploaded_at DESC`,
      [req.params.id]
    );
    const files = rows.map(doc => ({
      key: doc.key,
      name: doc.name,
      size: doc.size,
      lastModified: doc.uploaded_at,
    }));
    res.json(files);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Get presigned download URL
app.post('/api/projects/:id/documents/download-url', authMiddleware, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ message: 'key is required' });
  try {
    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ downloadUrl });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Delete document
app.delete('/api/projects/:id/documents', authMiddleware, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ message: 'key is required' });
  try {
    // Delete from S3
    const command = new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key });
    await s3.send(command);
    // Delete from database
    await pool.query('DELETE FROM documents WHERE project_id = $1 AND key = $2', [req.params.id, key]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`ACREs API listening on port ${PORT}`));
}

// Export for Lambda
const serverless = require('serverless-http');
module.exports.handler = serverless(app);
