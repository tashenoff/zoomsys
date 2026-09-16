require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const useSSL = process.env.DATABASE_SSL === 'true'
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: useSSL ? { rejectUnauthorized: false } : false })
const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'))

// Идемпотентный апсерт: вставляет операцию только если её нет по name,
// иначе обновляет поля из pricing.json. Ничего не удаляет и не дублирует.
async function upsertOperation(item, sortOrder) {
  const q = await pool.query(`SELECT id FROM additional_operations WHERE name=$1 ORDER BY id LIMIT 1`, [item.name])
  const params = [
    item.name,
    item.type || null,
    item.applicableTo ? JSON.stringify(item.applicableTo) : JSON.stringify(['all']),
    item.options ? JSON.stringify(item.options) : null,
    item.price || null,
    item.prices ? JSON.stringify(item.prices) : null,
    item.unit || null,
    item.description || null,
    item.defaultQuantity || null,
    sortOrder
  ]
  if (q.rows[0]) {
    await pool.query(
      `UPDATE additional_operations SET operation_type=$2, applicable_to=$3, options=$4, price=$5, prices=$6,
         unit=$7, description=$8, default_quantity=$9, sort_order=$10, is_active=true, updated_at=NOW() WHERE id=$1`,
      [q.rows[0].id, ...params.slice(1)]
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
  const ops = Object.entries(d.additionalOperations || {})
  const st = { inserted: 0, updated: 0 }
  for (let i = 0; i < ops.length; i++) {
    const [key, item] = ops[i]
    if (!item || !item.name) continue
    const r = await upsertOperation(item, 100 + i)
    st[r]++
  }
  const cnt = await pool.query(
    `SELECT applicable_to::text AS to_, COUNT(*)::int AS n FROM additional_operations
     WHERE is_active=true GROUP BY applicable_to::text ORDER BY to_`
  )
  console.log(JSON.stringify({ stats: st, total: ops.length, by_applicableTo: cnt.rows }, null, 2))
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) }).finally(() => pool.end())