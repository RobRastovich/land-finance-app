#!/usr/bin/env node
'use strict';
const path = require('path');
require(path.resolve(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.resolve(__dirname, '..', '.env') });
const { Client } = require(path.resolve(__dirname, '..', 'server', 'node_modules', 'pg'));

async function main() {
  const dbName = process.env.DB_NAME || 'land-finance-app';

  // Connect to default 'postgres' database to create the target DB
  const client = new Client({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres',
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  console.log(`Connecting to postgres database on ${process.env.DB_HOST}...`);
  await client.connect();

  // Check if DB already exists
  const { rows } = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
  );

  if (rows.length > 0) {
    console.log(`Database "${dbName}" already exists.`);
  } else {
    console.log(`Creating database "${dbName}"...`);
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created successfully!`);
  }

  await client.end();
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
