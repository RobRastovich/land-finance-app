CREATE TABLE IF NOT EXISTS program_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

  -- Land
  lot_cost NUMERIC(14,2),
  lot_closing NUMERIC(14,2),
  lot_marketing_fee NUMERIC(14,2),
  lot_amenity_fee NUMERIC(14,2),
  other_development_fee NUMERIC(14,2),
  lot_interest NUMERIC(14,2),
  land_bank_interest NUMERIC(14,2),
  area_cost_geotech NUMERIC(14,2),
  other_development_costs NUMERIC(14,2),
  hoa_dues NUMERIC(14,2),
  land_notes TEXT,
  pid TEXT,

  -- Sales
  hhl_incentive NUMERIC(14,2),
  incentive NUMERIC(14,2),
  plan_line_up TEXT,
  specifications TEXT,
  asp TEXT,
  target_margin TEXT,
  ideal_starting_price TEXT,
  builders_competition_graph TEXT,
  sales_notes TEXT,

  -- Construction
  erosion TEXT,
  city_requirements TEXT,
  construction_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_outlines_project_id ON program_outlines(project_id);
