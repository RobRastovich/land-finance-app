#!/usr/bin/env node
'use strict';
const path = require('path');
require(path.resolve(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.resolve(__dirname, '..', '.env') });
const fs = require('fs');
const { Client } = require(path.resolve(__dirname, '..', 'server', 'node_modules', 'pg'));

async function main() {
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('Usage: node run-migration.js <migration-file>');
    process.exit(1);
  }

  const client = new Client({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'land-finance-app',
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  console.log(`Connecting to ${process.env.DB_HOST}/${process.env.DB_NAME} as ${process.env.DB_USER}...`);
  await client.connect();
  console.log('Connected.');

  const migrationPath = path.join(__dirname, '..', 'server', 'migrations', migrationFile);
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const migration = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Running migration: ${migrationFile}...`);
  await client.query(migration);
  console.log('Migration completed successfully!');

  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
