require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const useSSL = process.env.DATABASE_SSL === 'true'
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
})

const pricingData = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'))
const items = pricingData.flagsProducts || []

async function ensureColumns() {
  await pool.query(`
    ALTER TABLE flags_products_pricing
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт',
    ADD COLUMN IF NOT EXISTS price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS prices JSONB,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT
  `)
}

async function upsert(item, sortOrder) {
  const existing = await pool.query(
    `SELECT id FROM flags_products_pricing WHERE name=$1 ORDER BY id LIMIT 1`,
    [item.name]
  )
  const params = [item.name, item.category || null, item.unit || 'шт', item.price ?? null,
    item.prices ? JSON.stringify(item.prices) : null, item.description || null, item.notes || null, sortOrder]
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE flags_products_pricing SET name=$1, category=$2, unit=$3, price=$4, prices=$5,
           description=$6, notes=$7, sort_order=$8, is_active=true, updated_at=NOW() WHERE id=$9`,
      [...params, existing.rows[0].id]
    )
    return 'updated'
  }
  await pool.query(
    `INSERT INTO flags_products_pricing (name, category, unit, price, prices, description, notes, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    params
  )
  return 'inserted'
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')
  await ensureColumns()
  const stats = { inserted: 0, updated: 0 }
  for (let i = 0; i < items.length; i++) stats[await upsert(items[i], i)]++
  const after = await pool.query(`SELECT COUNT(*)::int AS n FROM flags_products_pricing WHERE is_active=true`)
  console.log(JSON.stringify({ stats, active: after.rows[0] }, null, 2))
}

main().catch((err) => { console.error(err.message); process.exitCode = 1 }).finally(async () => { await pool.end() })