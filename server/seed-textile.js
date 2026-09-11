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
const textileItems = pricingData.textile || []
const textileOpKeys = ['flagStitching', 'flagCutting', 'cordLacing', 'fringe', 'textileEyelets', 'clampTape']
const textileOperations = textileOpKeys.map((key) => pricingData.additionalOperations?.[key]).filter(Boolean)

async function ensureColumns() {
  await pool.query(`
    ALTER TABLE textile_pricing
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'м²',
    ADD COLUMN IF NOT EXISTS prices JSONB,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT
  `)
  await pool.query(`ALTER TABLE additional_operations ADD COLUMN IF NOT EXISTS prices JSONB`)
}

async function upsertTextile(item, sortOrder) {
  const existing = await pool.query(
    `SELECT id FROM textile_pricing WHERE name=$1 ORDER BY id LIMIT 1`,
    [item.name]
  )
  const params = [item.name, item.pricePerSqm, item.category || null, item.unit || 'м²',
    item.prices ? JSON.stringify(item.prices) : null, item.description || null, item.notes || null, sortOrder]
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE textile_pricing SET name=$1, price_per_sqm=$2, category=$3, unit=$4, prices=$5,
           description=$6, notes=$7, sort_order=$8, is_active=true, updated_at=NOW() WHERE id=$9`,
      [...params, existing.rows[0].id]
    )
    return 'updated'
  }
  await pool.query(
    `INSERT INTO textile_pricing (name, price_per_sqm, category, unit, prices, description, notes, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    params
  )
  return 'inserted'
}

async function upsertOperation(item, sortOrder) {
  const existing = await pool.query(
    `SELECT id FROM additional_operations WHERE name=$1 ORDER BY id LIMIT 1`,
    [item.name]
  )
  const params = [item.name, item.type || null, JSON.stringify(item.applicableTo || ['textile']),
    item.options ? JSON.stringify(item.options) : null, item.price || null,
    item.prices ? JSON.stringify(item.prices) : null, item.unit || null, item.description || null,
    item.defaultQuantity || null, sortOrder]
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE additional_operations SET name=$1, operation_type=$2, applicable_to=$3, options=$4,
           price=$5, prices=$6, unit=$7, description=$8, default_quantity=$9, sort_order=$10, is_active=true, updated_at=NOW() WHERE id=$11`,
      [...params, existing.rows[0].id]
    )
    return 'updated'
  }
  await pool.query(
    `INSERT INTO additional_operations (name, operation_type, applicable_to, options, price, prices, unit, description, default_quantity, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    params
  )
  return 'inserted'
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')
  await ensureColumns()
  const stats = { inserted: 0, updated: 0 }
  for (let i = 0; i < textileItems.length; i++) stats[await upsertTextile(textileItems[i], i)]++
  const opStats = { inserted: 0, updated: 0 }
  for (let i = 0; i < textileOperations.length; i++) opStats[await upsertOperation(textileOperations[i], 3000 + i)]++

  const after = await pool.query(`SELECT COUNT(*)::int AS n FROM textile_pricing WHERE is_active=true`)
  const ops = await pool.query(`SELECT COUNT(*)::int AS n FROM additional_operations WHERE is_active=true AND applicable_to::text LIKE '%textile%'`)
  console.log(JSON.stringify({ textile: stats, operations: opStats, textileActive: after.rows[0], textileOpsActive: ops.rows[0] }, null, 2))
}

main().catch((err) => { console.error(err.message); process.exitCode = 1 }).finally(async () => { await pool.end() })
