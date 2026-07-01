-- ============================================================
-- MELINA COMMUNITY — RDS PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Projects ─────────────────────────────────────────────────
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  created_by    VARCHAR(255),  -- Cognito sub
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO projects (name, description) VALUES
  ('Melina', 'Melina master-planned community');

-- ── Builders ─────────────────────────────────────────────────
CREATE TABLE builders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  contact_name  VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Lot Contracts (one per builder × lot-size combination) ───
CREATE TABLE lot_contracts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE,
  lot_size_label  VARCHAR(50)  NOT NULL,   -- e.g. "60s", "50s", "45s"
  ff_width        NUMERIC(8,2) NOT NULL,   -- front footage width
  ff_price        NUMERIC(12,2) NOT NULL,  -- $ per front foot
  total_qty       INTEGER      NOT NULL,
  escalator_rate  NUMERIC(6,4) NOT NULL DEFAULT 0,  -- annual decimal e.g. 0.06
  escalator_start DATE         NOT NULL DEFAULT '2027-01-01',
  em_pct          NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id, lot_size_label)
);

-- ── Takedown Tranches ────────────────────────────────────────
CREATE TABLE tranches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id     UUID REFERENCES lot_contracts(id) ON DELETE CASCADE,
  tranche_number  INTEGER      NOT NULL,
  scheduled_date  DATE         NOT NULL,
  lot_count       INTEGER      NOT NULL,
  additional_escalator_rate NUMERIC(6,4) NOT NULL DEFAULT 0,  -- per-takedown extra annual decimal
  -- calculated fields (stored for reporting speed, recomputed on save)
  base_lot_price  NUMERIC(12,2),
  months_escalated INTEGER,
  adj_lot_price   NUMERIC(12,2),
  projected_revenue NUMERIC(14,2),
  projected_em      NUMERIC(14,2),
  escalator_lift    NUMERIC(14,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, tranche_number)
);

-- ── Receivables (actual payments logged) ────────────────────
CREATE TABLE receivables (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tranche_id      UUID REFERENCES tranches(id) ON DELETE SET NULL,
  contract_id     UUID REFERENCES lot_contracts(id) ON DELETE CASCADE,
  payment_type    VARCHAR(50) NOT NULL,  -- 'earnest_money' | 'lot_purchase'
  amount_expected NUMERIC(14,2) NOT NULL,
  amount_received NUMERIC(14,2) DEFAULT 0,
  due_date        DATE NOT NULL,
  received_date   DATE,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- 'pending' | 'partial' | 'paid' | 'overdue'
  reference_num   VARCHAR(100),
  notes           TEXT,
  created_by      VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Users (mirrors Cognito, for display/audit) ───────────────
CREATE TABLE app_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cognito_sub   VARCHAR(255) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  full_name     VARCHAR(255),
  role          VARCHAR(50) DEFAULT 'viewer',  -- 'admin' | 'editor' | 'viewer'
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_tranches_contract    ON tranches(contract_id);
CREATE INDEX idx_tranches_date        ON tranches(scheduled_date);
CREATE INDEX idx_receivables_due      ON receivables(due_date);
CREATE INDEX idx_receivables_status   ON receivables(status);
CREATE INDEX idx_receivables_tranche  ON receivables(tranche_id);
CREATE INDEX idx_contracts_builder    ON lot_contracts(builder_id);
CREATE INDEX idx_contracts_project    ON lot_contracts(project_id);

-- ── Auto-update updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_builders_updated     BEFORE UPDATE ON builders        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contracts_updated    BEFORE UPDATE ON lot_contracts    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tranches_updated     BEFORE UPDATE ON tranches         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_receivables_updated  BEFORE UPDATE ON receivables      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Seed: Melina builders ────────────────────────────────────
DO $$
DECLARE
  proj_id UUID;
  h_id UUID; dw_id UUID; perry_id UUID; newmark_id UUID; chesmar_id UUID;
  c60h UUID; c60dw UUID; c60p UUID;
  c50h UUID; c50dw UUID; c50n1 UUID; c50n2 UUID; c50p UUID;
  c45n1 UUID; c45n2 UUID; c45c UUID;
BEGIN
  SELECT id INTO proj_id FROM projects WHERE name = 'Melina' LIMIT 1;

  INSERT INTO builders (project_id, name) VALUES
    (proj_id, 'Highland')      RETURNING id INTO h_id;
  INSERT INTO builders (project_id, name) VALUES
    (proj_id, 'David Weekley') RETURNING id INTO dw_id;
  INSERT INTO builders (project_id, name) VALUES
    (proj_id, 'Perry')         RETURNING id INTO perry_id;
  INSERT INTO builders (project_id, name) VALUES
    (proj_id, 'Newmark')       RETURNING id INTO newmark_id;
  INSERT INTO builders (project_id, name) VALUES
    (proj_id, 'Chesmar')       RETURNING id INTO chesmar_id;

  -- Lot Contracts
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct)
    VALUES (proj_id,h_id,'60s',60,2600,51,0.0957,0) RETURNING id INTO c60h;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct)
    VALUES (proj_id,dw_id,'60s',60,2500,51,0.06,0.10) RETURNING id INTO c60dw;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct)
    VALUES (proj_id,perry_id,'60s',60,2500,51,0.08,0.10) RETURNING id INTO c60p;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct)
    VALUES (proj_id,h_id,'50s',51.25,2600,69,0.0957,0) RETURNING id INTO c50h;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct)
    VALUES (proj_id,dw_id,'50s',50,2500,69,0.06,0.10) RETURNING id INTO c50dw;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct,notes)
    VALUES (proj_id,newmark_id,'50s - T1',51.25,2450,40,0,0.10,'First 40 lots') RETURNING id INTO c50n1;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct,notes)
    VALUES (proj_id,newmark_id,'50s - T2',51.25,2550,29,0,0.10,'Next 29 lots after 18 months') RETURNING id INTO c50n2;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct)
    VALUES (proj_id,perry_id,'50s',50,2460,69,0,0.10) RETURNING id INTO c50p;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct,notes)
    VALUES (proj_id,newmark_id,'45s - T1',45,2350,40,0,0.10,'First 40 lots') RETURNING id INTO c45n1;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct,notes)
    VALUES (proj_id,newmark_id,'45s - T2',45,2450,27,0,0.10,'Next 27 lots after 18 months') RETURNING id INTO c45n2;
  INSERT INTO lot_contracts (project_id,builder_id,lot_size_label,ff_width,ff_price,total_qty,escalator_rate,em_pct)
    VALUES (proj_id,chesmar_id,'45s',45,2400,67,0,0.10) RETURNING id INTO c45c;

  -- Tranches
  INSERT INTO tranches (contract_id,tranche_number,scheduled_date,lot_count) VALUES
    (c60h,1,'2027-01-15',51),
    (c60dw,1,'2027-01-01',15),(c60dw,2,'2027-07-01',15),(c60dw,3,'2028-04-01',21),
    (c60p,1,'2027-01-01',12),(c60p,2,'2027-07-01',9),(c60p,3,'2028-01-01',9),(c60p,4,'2028-07-01',9),(c60p,5,'2029-01-01',12),
    (c50h,1,'2027-01-15',69),
    (c50dw,1,'2027-01-01',15),(c50dw,2,'2027-07-01',15),(c50dw,3,'2028-04-01',34),
    (c50n1,1,'2027-01-01',40),
    (c50n2,1,'2028-07-01',29),
    (c50p,1,'2027-01-01',10),(c50p,2,'2027-04-01',8),(c50p,3,'2027-07-01',8),
    (c50p,4,'2027-10-01',8),(c50p,5,'2028-01-01',8),(c50p,6,'2028-04-01',8),
    (c50p,7,'2028-07-01',8),(c50p,8,'2028-10-01',8),(c50p,9,'2029-01-01',3),
    (c45n1,1,'2027-01-01',40),
    (c45n2,1,'2028-07-01',27),
    (c45c,1,'2027-01-01',17),(c45c,2,'2027-04-01',17),(c45c,3,'2027-07-01',17),(c45c,4,'2027-10-01',16);
END $$;
