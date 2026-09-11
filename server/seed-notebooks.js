require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false })
const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'))

async function main() {
  let ins = 0, upd = 0
  for (const item of d.printing.filter(p => p.category === 'notebooks')) {
    const q = await pool.query(`SELECT id FROM printing_pricing WHERE name=$1 ORDER BY id LIMIT 1`, [item.name])
    if (q.rows[0]) {
      await pool.query(`UPDATE printing_pricing SET prices=$1, updated_at=NOW() WHERE id=$2`, [JSON.stringify(item.prices), q.rows[0].id])
      upd++
    } else {
      await pool.query(`INSERT INTO printing_pricing (category,name,color_type,prices,sort_order) VALUES ($1,$2,$3,$4,$5)`, [item.category, item.name, null, JSON.stringify(item.prices), 0])
      ins++
    }
  }
  console.log(JSON.stringify({ inserted: ins, updated: upd }))
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(() => pool.end())