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
const keys = ['uvDarkSurface', 'uvPartialVarnish', 'uvTemplate', 'uvMakeready']
const operations = keys.map((key) => pricingData.additionalOperations?.[key]).filter(Boolean)

async function upsertOperation(item, sortOrder) {
  const existing = await pool.query(
    `SELECT id FROM additional_operations WHERE name=$1 ORDER BY id LIMIT 1`,
    [item.name]
  )

  const params = [
    item.name,
    item.type || null,
    JSON.stringify(item.applicableTo || ['uv-printing']),
    item.options ? JSON.stringify(item.options) : null,
    item.price || null,
    item.prices ? JSON.stringify(item.prices) : null,
    item.unit || null,
    item.description || null,
    item.defaultQuantity || null,
    sortOrder
  ]

  if (existing.rows[0]) {
    await pool.query(
      `UPDATE additional_operations
       SET name=$1, operation_type=$2, applicable_to=$3, options=$4,
           price=$5, prices=$6, unit=$7, description=$8, default_quantity=$9,
           sort_order=$10, is_active=true, updated_at=NOW()
       WHERE id=$11`,
      [...params, existing.rows[0].id]
    )
    return 'updated'
  }

  await pool.query(
    `INSERT INTO additional_operations
     (name, operation_type, applicable_to, options, price, prices, unit, description, default_quantity, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    params
  )
  return 'inserted'
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')

  await pool.query(`ALTER TABLE additional_operations ADD COLUMN IF NOT EXISTS prices JSONB`)

  const before = await pool.query(
    `SELECT COUNT(*)::int AS n FROM additional_operations WHERE is_active=true AND applicable_to::text LIKE '%uv-printing%'`
  )

  const stats = { inserted: 0, updated: 0 }
  for (let i = 0; i < operations.length; i++) {
    stats[await upsertOperation(operations[i], 2000 + i)]++
  }

  const after = await pool.query(
    `SELECT id, name, operation_type, price, unit, options FROM additional_operations
     WHERE is_active=true AND applicable_to::text LIKE '%uv-printing%'
     ORDER BY sort_order, name`
  )

  console.log(JSON.stringify({ before: before.rows[0], stats, after: after.rows }, null, 2))
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1 })
  .finally(async () => { await pool.end() })
