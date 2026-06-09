#!/usr/bin/env node
'use strict';
const path = require('path');
require(path.resolve(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.resolve(__dirname, '..', '.env') });
const fs = require('fs');
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

  console.log(`Connecting to ${process.env.DB_HOST}/${process.env.DB_NAME} as ${process.env.DB_USER}...`);
  await client.connect();
  console.log('Connected.');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Deploying schema...');
  await client.query(schema);
  console.log('Schema deployed successfully!');

  await client.end();
}

main().catch(err => {
  console.error('Schema deployment failed:', err.message);
  process.exit(1);
});
