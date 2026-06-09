#!/usr/bin/env node
'use strict';
const path = require('path');
require(path.resolve(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.resolve(__dirname, '..', '.env') });
const { Client } = require(path.resolve(__dirname, '..', 'server', 'node_modules', 'pg'));

async function main() {
  const client = new Client({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'land-finance-app',
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected. Running migration...');

  // Add role column to users
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'standard'`);
  console.log('Added role column to users table.');

  // Create user_communities junction table
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_communities (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, project_id)
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS idx_user_communities_user ON user_communities(user_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_user_communities_project ON user_communities(project_id)');
  console.log('Created user_communities table.');

  // Make all existing users admin
  const { rowCount } = await client.query("UPDATE users SET role = 'admin' WHERE role = 'standard'");
  console.log(`Made ${rowCount} existing user(s) admin.`);

  // Grant existing admins access to all communities
  await client.query(`
    INSERT INTO user_communities (user_id, project_id)
    SELECT u.id, p.id FROM users u CROSS JOIN projects p
    WHERE u.role = 'admin'
    ON CONFLICT DO NOTHING
  `);
  console.log('Granted admins access to all communities.');

  await client.end();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
