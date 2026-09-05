require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
})

async function run() {
  const pricingData = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'))
  const items = pricingData.stateSymbols || []
  await pool.query('DELETE FROM state_symbols_pricing')
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    await pool.query(
      'INSERT INTO state_symbols_pricing (category, name, option, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
      [item.category, item.name, item.option || null, item.price, i]
    )
  }
  console.log(`✅ Гос. символика: ${items.length} позиций`)
  await pool.end()
}

run().catch((e) => { console.error(e); process.exit(1) })
