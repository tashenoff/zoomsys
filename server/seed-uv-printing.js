require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Внутренняя связь с PostgreSQL контейнера (zoomsys-db) — как во всех seed-скриптах репозитория.
const useSSL = process.env.DATABASE_SSL === 'true'
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
})

const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'))
const items = d.uvPrinting || []

// Идемпотентный апсерт по (category, name): разделённые позиции (карта/флешка/зажигалки) отдельными строками,
// существующие обновляются. Строки, которых нет в каталоге (старые объединённые), деактивируются — без дублей.
async function upsert(item, sortOrder) {
  const q = await pool.query(`SELECT id FROM uv_printing_pricing WHERE category=$1 AND name=$2 ORDER BY id LIMIT 1`, [item.category, item.name])
  if (q.rows[0]) {
    await pool.query(
      `UPDATE uv_printing_pricing SET description=$2, sides=$3, materials=$4, price_type=$5, sort_order=$6,
         is_active=true, updated_at=NOW() WHERE id=$1`,
      [q.rows[0].id, item.description || null,
        item.sides ? JSON.stringify(item.sides) : null,
        item.materials ? JSON.stringify(item.materials) : null,
        item.priceType || null, sortOrder]
    )
    return 'updated'
  }
  await pool.query(
    `INSERT INTO uv_printing_pricing (category, name, description, sides, materials, price_type, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [item.category, item.name, item.description || null,
      item.sides ? JSON.stringify(item.sides) : null,
      item.materials ? JSON.stringify(item.materials) : null,
      item.priceType || null, sortOrder]
  )
  return 'inserted'
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')
  const st = { inserted: 0, updated: 0 }
  const names = []
  for (let i = 0; i < items.length; i++) {
    names.push(items[i].name)
    st[await upsert(items[i], i)]++
  }
  const placeholders = names.map((_, i) => `$${i + 1}`).join(',')
  const deac = await pool.query(
    `UPDATE uv_printing_pricing SET is_active=false, updated_at=NOW() WHERE name NOT IN (${placeholders}) RETURNING id, category, name`,
    names
  )
  const after = await pool.query(
    `SELECT category, count(*)::int AS total, count(*) FILTER (WHERE is_active=true)::int AS active FROM uv_printing_pricing GROUP BY category ORDER BY category`
  )
  console.log(JSON.stringify({ stats: st, deactivated: deac.rows, groups: after.rows }, null, 2))
}

main().catch((err) => { console.error(err.message); process.exitCode = 1 }).finally(async () => { await pool.end() })