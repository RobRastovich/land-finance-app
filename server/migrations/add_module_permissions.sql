-- Add module_permissions column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS module_permissions JSONB DEFAULT '{"dashboard":true,"builder_manager":true,"cash_flow":true,"payments":true,"pnl":true,"documents":true,"program_outline":true}'::jsonb;

-- Update existing users to have full permissions
UPDATE users SET module_permissions = '{"dashboard":true,"builder_manager":true,"cash_flow":true,"payments":true,"pnl":true,"documents":true,"program_outline":true}'::jsonb WHERE module_permissions IS NULL;

UPDATE users SET module_permissions = COALESCE(module_permissions, '{}'::jsonb) || '{"program_outline":true}'::jsonb
WHERE NOT (COALESCE(module_permissions, '{}'::jsonb) ? 'program_outline');
