require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const useSSL = process.env.DATABASE_SSL === 'true'
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: useSSL ? { rejectUnauthorized: false } : false })
const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'))

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS design_services_pricing (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, work TEXT, price NUMERIC(12,2), price_text TEXT,
    description TEXT, notes TEXT, is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
  await pool.query(`ALTER TABLE design_services_pricing ADD COLUMN IF NOT EXISTS work TEXT, ADD COLUMN IF NOT EXISTS price_text TEXT`)
  await pool.query(`ALTER TABLE additional_operations ADD COLUMN IF NOT EXISTS prices JSONB`)
}

async function upsertBusinessCard(item) {
  const q = await pool.query(`SELECT id FROM business_cards_pricing WHERE name=$1 AND color_type=$2 ORDER BY id LIMIT 1`, [item.name, item.colorType || '4+0'])
  if (q.rows[0]) {
    await pool.query(`UPDATE business_cards_pricing SET prices=$1, updated_at=NOW() WHERE id=$2`, [JSON.stringify(item.prices), q.rows[0].id])
    return 'updated'
  }
  await pool.query(`INSERT INTO business_cards_pricing (name,color_type,prices,sort_order) VALUES ($1,$2,$3,0)`, [item.name, item.colorType || '4+0', JSON.stringify(item.prices)])
  return 'inserted'
}

async function upsertPrinting(item) {
  const q = await pool.query(`SELECT id FROM printing_pricing WHERE name=$1 ORDER BY id LIMIT 1`, [item.name])
  if (q.rows[0]) return 'updated'
  await pool.query(`INSERT INTO printing_pricing (category,name,color_type,prices,sort_order) VALUES ($1,$2,$3,$4,0)`,
    [item.category, item.name, item.colorType ? item.colorType : null, JSON.stringify(item.prices)])
  return 'inserted'
}

async function upsertAdditionalService(item) {
  const q = await pool.query(`SELECT id FROM additional_services WHERE name=$1 ORDER BY id LIMIT 1`, [item.name])
  const isNumeric = typeof item.price === 'number'
  const params = [item.name, isNumeric ? item.price : null, isNumeric ? null : item.price, item.unit || null, JSON.stringify(item.applicableTo || []), item.description || null]
  if (q.rows[0]) {
    await pool.query(`UPDATE additional_services SET price=$2, price_text=$3, unit=$4, applicable_to=$5, description=$6, is_active=true, updated_at=NOW() WHERE id=$1`, [q.rows[0].id, ...params.slice(1)])
    return 'updated'
  }
  await pool.query(`INSERT INTO additional_services (name,price,price_text,unit,applicable_to,description,sort_order) VALUES ($1,$2,$3,$4,$5,$6,9000)`, params)
  return 'inserted'
}

async function upsertOperation(item) {
  const q = await pool.query(`SELECT id FROM additional_operations WHERE name=$1 ORDER BY id LIMIT 1`, [item.name])
  const params = [item.name, item.type || null, JSON.stringify(item.applicableTo || []),
    item.options ? JSON.stringify(item.options) : null, item.price || null,
    item.prices ? JSON.stringify(item.prices) : null, item.unit || null, item.description || null, 6000]
  if (q.rows[0]) {
    await pool.query(`UPDATE additional_operations SET operation_type=$2, applicable_to=$3, options=$4, price=$5, prices=$6, unit=$7, description=$8, sort_order=$9, is_active=true, updated_at=NOW() WHERE id=$1`, [q.rows[0].id, ...params.slice(1)])
    return 'updated'
  }
  await pool.query(`INSERT INTO additional_operations (name,operation_type,applicable_to,options,price,prices,unit,description,default_quantity,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,null,$9)`, params)
  return 'inserted'
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL')
  await ensureSchema()
  const st = { design:{i:0,u:0}, bc:{i:0,u:0}, printing:{i:0,u:0}, ops:{i:0,u:0} }

  const badge = d.businessCards.find(b => b.name && b.name.startsWith('Бейджи'))
  if (badge) { const r=await upsertBusinessCard(badge); st.bc[r==='u'?'u':'i']++ }
  for (const pp of d.printing) { if (pp.category==='folders' || pp.category==='paper-bags') { const r=await upsertPrinting(pp); st.printing[r==='u'?'u':'i']++ } }
  for (const k of ['folderPocket','badgeCorner','badgeLanyard']) { const op=d.additionalOperations[k]; if (op) { const r=await upsertOperation(op); st.ops[r==='u'?'u':'i']++ } }
  for (const sv of d.additionalServices) { if (sv.applicableTo && sv.applicableTo.length) { await upsertAdditionalService(sv) } }

  const cnt = await pool.query(`SELECT (SELECT COUNT(*)::int FROM printing_pricing WHERE is_active=true AND category IN ('folders','paper-bags')) print_new, (SELECT COUNT(*)::int FROM business_cards_pricing WHERE is_active=true AND name LIKE 'Бейджи%') badges, (SELECT COUNT(*)::int FROM additional_operations WHERE is_active=true AND applicable_to::text LIKE '%badges%') badge_ops`)
  console.log(JSON.stringify({stats:st, counts: cnt.rows[0]}, null, 2))
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>{ pool.end() })