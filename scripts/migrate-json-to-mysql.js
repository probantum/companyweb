// One-time migration: loads the old src/data/db.json (the JSON-file store this app
// used before moving to MySQL) and inserts every record into the MySQL tables
// created by sql/schema.sql. Safe to run once against a freshly-created database.
//
// Usage: node scripts/migrate-json-to-mysql.js

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../src/db');

const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'db.json');

async function migrateCollection(name, records) {
  let count = 0;
  for (const record of records) {
    await db.insert(name, record);
    count += 1;
  }
  console.log(`  ${name}: inserted ${count}`);
}

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.log(`No ${DATA_PATH} found — nothing to migrate.`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  console.log('Migrating src/data/db.json into MySQL...');
  await migrateCollection('blogPosts', data.blogPosts || []);
  await migrateCollection('portfolio', data.portfolio || []);
  await migrateCollection('staff', data.staff || []);
  await migrateCollection('submissions', data.submissions || []);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
