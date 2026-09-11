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
const items = pricingData.stateSymbols.filter(i => i.category === 'flagpoles')

async function upsert(item, sortOrder) {
  const existing = await pool.query(
    `SELECT id FROM state_symbols_pricing WHERE category='flagpoles' AND name=$1 ORDER BY id LIMIT 1`,
    [item.name]
  )
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE state_symbols_pricing SET name=$1, option=$2, price=$3, sort_order=$4, is_active=true, updated_at=NOW() WHERE id=$5`,
      [item.name, item.option || null, item.price, sortOrder, existing.rows[0].id]
    )
    return 'updated'
  }
  await pool.query(
    `INSERT INTO state_symbols_pricing (category, name, option, price, sort_order) VALUES ('flagpoles', $1, $2, $3, $4)`,
    [item.name, item.option || null, item.price, sortOrder]
  )
  return 'inserted'
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')
  const stats = { inserted: 0, updated: 0 }
  for (let i = 0; i < items.length; i++) stats[await upsert(items[i], i)]++
  const rows = await pool.query(
    `SELECT name, option, price FROM state_symbols_pricing WHERE category='flagpoles' AND is_active=true ORDER BY sort_order`
  )
  console.log(JSON.stringify({ stats, rows: rows.rows }, null, 2))
}
main().catch((err) => { console.error(err.message); process.exitCode = 1 }).finally(async () => { await pool.end() })