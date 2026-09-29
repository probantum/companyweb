// Quick sanity check for DB_* credentials before running the app or the migration.
// Usage: node scripts/test-db.js

require('dotenv').config();

const db = require('../src/db');

db.testConnection()
  .then(() => {
    console.log('Connected OK:', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME,
    });
  })
  .catch((err) => {
    console.error('Connection failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
