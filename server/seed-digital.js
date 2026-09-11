require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false })
const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'))

async function upsertPrinting(item) {
  // printing может не быть в БД если нет колонок — проверим базовые
  const q = await pool.query(`SELECT id FROM printing_pricing WHERE name=$1 ORDER BY id LIMIT 1`, [item.name])
  let rows = []
  if (item.colorTypes) {
    let n = 0
    for (const ct of item.colorTypes) {
      n++
      await pool.query(`INSERT INTO printing_pricing (category,name,color_type,prices,sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [item.category, item.name, ct.type, JSON.stringify(ct.prices), n])
    }
    rows.push(`colorTypes:${n}`)
  } else if (q.rows[0]) {
    await pool.query(`UPDATE printing_pricing SET category=$1, prices=$2, updated_at=NOW() WHERE id=$3`,
      [item.category, JSON.stringify(item.prices), q.rows[0].id])
    rows.push('updated')
  } else if (item.prices) {
    await pool.query(`INSERT INTO printing_pricing (category,name,color_type,prices,sort_order) VALUES ($1,$2,$3,$4,$5)`,
      [item.category, item.name, item.colorType || null, JSON.stringify(item.prices), 0])
    rows.push('inserted')
  }
  return rows
}

async function main() {
  const targets = d.printing.filter(p => p.category === 'digital-printing' || p.category === 'paper-density')
  const seen = new Set()
  let inserted = 0, skipped = 0
  for (const item of targets) {
    await upsertPrinting(item)
    inserted++
  }
  const cnt = await pool.query(`SELECT category, COUNT(*)::int AS n FROM printing_pricing WHERE is_active=true AND category IN ('digital-printing','paper-density') GROUP BY category`)
  console.log(JSON.stringify({ processed: inserted, groups: cnt.rows }, null, 2))
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(() => pool.end())