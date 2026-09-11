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
const items = pricingData.eventServices || []

async function ensureColumns() {
  await pool.query(`
    ALTER TABLE event_services_pricing
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт',
    ADD COLUMN IF NOT EXISTS price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS price_text TEXT,
    ADD COLUMN IF NOT EXISTS print_options JSONB,
    ADD COLUMN IF NOT EXISTS min_hours NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT
  `)
}

async function upsert(item, sortOrder) {
  const existing = await pool.query(`SELECT id FROM event_services_pricing WHERE name=$1 ORDER BY id LIMIT 1`, [item.name])
  const numeric = typeof item.price === 'number'
  const params = [item.name, item.category || 'rent', item.unit || 'шт', numeric ? item.price : null,
    !numeric ? item.price : (item.priceText || null),
    item.printOptions ? JSON.stringify(item.printOptions) : null,
    item.minHours || null, item.description || null, item.notes || null, sortOrder]
  if (existing.rows[0]) {
    await pool.query(`UPDATE event_services_pricing SET name=$1, category=$2, unit=$3, price=$4, price_text=$5, print_options=$6, min_hours=$7, description=$8, notes=$9, sort_order=$10, is_active=true, updated_at=NOW() WHERE id=$11`, [...params, existing.rows[0].id])
    return 'updated'
  }
  await pool.query(`INSERT INTO event_services_pricing (name, category, unit, price, price_text, print_options, min_hours, description, notes, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, params)
  return 'inserted'
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')
  await ensureColumns()
  const stats = { inserted: 0, updated: 0 }
  for (let i = 0; i < items.length; i++) stats[await upsert(items[i], i)]++
  const after = await pool.query(`SELECT category, COUNT(*)::int AS n FROM event_services_pricing WHERE is_active=true GROUP BY category ORDER BY category`)
  console.log(JSON.stringify({ stats, groups: after.rows }, null, 2))
}

main().catch((err) => { console.error(err.message); process.exitCode = 1 }).finally(async () => { await pool.end() })