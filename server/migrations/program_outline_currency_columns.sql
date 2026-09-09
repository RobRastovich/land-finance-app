ALTER TABLE program_outlines
  ALTER COLUMN asp TYPE NUMERIC(14,2) USING NULLIF(regexp_replace(asp::text, '[^0-9.-]', '', 'g'), '')::numeric,
  ALTER COLUMN target_margin TYPE NUMERIC(14,2) USING NULLIF(regexp_replace(target_margin::text, '[^0-9.-]', '', 'g'), '')::numeric,
  ALTER COLUMN ideal_starting_price TYPE NUMERIC(14,2) USING NULLIF(regexp_replace(ideal_starting_price::text, '[^0-9.-]', '', 'g'), '')::numeric,
  ALTER COLUMN erosion TYPE NUMERIC(14,2) USING NULLIF(regexp_replace(erosion::text, '[^0-9.-]', '', 'g'), '')::numeric,
  ALTER COLUMN city_requirements TYPE NUMERIC(14,2) USING NULLIF(regexp_replace(city_requirements::text, '[^0-9.-]', '', 'g'), '')::numeric;
