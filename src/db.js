const crypto = require('crypto');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Maps the app's collection names (unchanged since the JSON-file days) to MySQL
// tables and column names, so routes/views never had to know storage changed.
const TABLES = {
  blogPosts: {
    table: 'blog_posts',
    columns: {
      id: 'id',
      slug: 'slug',
      title: 'title',
      category: 'category',
      excerpt: 'excerpt',
      author: 'author',
      date: 'date',
      readTime: 'read_time',
      tags: 'tags',
      content: 'content',
      image: 'image',
    },
    jsonFields: ['tags'],
  },
  portfolio: {
    table: 'portfolio',
    columns: {
      id: 'id',
      name: 'name',
      desc: 'description',
      tags: 'tags',
      tag: 'tag',
      image: 'image',
      gallery: 'gallery',
    },
    jsonFields: ['tags', 'gallery'],
  },
  staff: {
    table: 'staff',
    columns: {
      id: 'id',
      name: 'name',
      role: 'role',
      email: 'email',
      phone: 'phone',
      linkedin: 'linkedin',
      image: 'image',
    },
    jsonFields: [],
  },
  submissions: {
    table: 'submissions',
    columns: {
      id: 'id',
      name: 'name',
      email: 'email',
      topic: 'topic',
      subject: 'subject',
      message: 'message',
      date: 'date',
      status: 'status',
    },
    jsonFields: [],
  },
  settings: {
    table: 'settings',
    columns: {
      id: 'id',
      notifyEmails: 'notify_emails',
      contactEmail: 'contact_email',
      contactPhone: 'contact_phone',
      contactLocation: 'contact_location',
    },
    jsonFields: ['notifyEmails'],
  },
};

function config(collection) {
  const cfg = TABLES[collection];
  if (!cfg) throw new Error(`Unknown collection: ${collection}`);
  return cfg;
}

// JS object (camelCase) -> DB row (snake_case), serializing JSON columns.
function toRow(cfg, obj) {
  const row = {};
  for (const [jsKey, dbCol] of Object.entries(cfg.columns)) {
    if (!(jsKey in obj)) continue;
    let value = obj[jsKey];
    if (cfg.jsonFields.includes(jsKey)) value = JSON.stringify(value ?? []);
    row[dbCol] = value === undefined ? null : value;
  }
  return row;
}

// DB row (snake_case) -> JS object (camelCase), parsing JSON columns.
function fromRow(cfg, row) {
  if (!row) return null;
  const obj = {};
  for (const [jsKey, dbCol] of Object.entries(cfg.columns)) {
    let value = row[dbCol];
    if (cfg.jsonFields.includes(jsKey) && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        value = [];
      }
    }
    obj[jsKey] = value;
  }
  return obj;
}

async function getAll(collection) {
  const cfg = config(collection);
  const [rows] = await pool.query(`SELECT * FROM \`${cfg.table}\` ORDER BY created_at ASC`);
  return rows.map((row) => fromRow(cfg, row));
}

async function getById(collection, id) {
  const cfg = config(collection);
  const [rows] = await pool.query(`SELECT * FROM \`${cfg.table}\` WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? fromRow(cfg, rows[0]) : null;
}

async function insert(collection, item) {
  const cfg = config(collection);
  const id = item.id || crypto.randomUUID();
  const row = toRow(cfg, { ...item, id });
  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => row[c]);
  await pool.query(
    `INSERT INTO \`${cfg.table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
    values
  );
  return getById(collection, id);
}

async function update(collection, id, patch) {
  const cfg = config(collection);
  const row = toRow(cfg, patch);
  const columns = Object.keys(row);
  if (!columns.length) return getById(collection, id);
  const setClause = columns.map((c) => `\`${c}\` = ?`).join(', ');
  const values = columns.map((c) => row[c]);
  await pool.query(`UPDATE \`${cfg.table}\` SET ${setClause} WHERE id = ?`, [...values, id]);
  return getById(collection, id);
}

async function remove(collection, id) {
  const cfg = config(collection);
  const [result] = await pool.query(`DELETE FROM \`${cfg.table}\` WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

// Verifies the app can actually reach MySQL — called once at boot.
async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

module.exports = { pool, getAll, getById, insert, update, remove, testConnection };
