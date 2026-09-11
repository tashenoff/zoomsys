require('dotenv').config()
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false })
const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'))

async function ensure() {
  await pool.query(`CREATE TABLE IF NOT EXISTS garment_printing_pricing (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, type TEXT, unit TEXT DEFAULT 'кв.см',
    price_per_sqcm NUMERIC(10,2), min_qty INTEGER, min_amount NUMERIC(12,2), note TEXT,
    is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
  await pool.query(`CREATE TABLE IF NOT EXISTS embroidery_pricing (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, unit TEXT DEFAULT 'за 1000 стежков',
    price NUMERIC(12,2) NOT NULL, note TEXT, is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
  await pool.query(`ALTER TABLE additional_operations ADD COLUMN IF NOT EXISTS prices JSONB`)
}

async function upsertGarment(it, i) {
  const q = await pool.query(`SELECT id FROM garment_printing_pricing WHERE name=$1 ORDER BY id LIMIT 1`, [it.name])
  const vals = [it.type||null, it.unit||'кв.см', it.pricePerSqCm, it.minQty||null, it.minAmount||null, it.note||null, i]
  if (q.rows[0]) {
    await pool.query(`UPDATE garment_printing_pricing SET type=$1,unit=$2,price_per_sqcm=$3,min_qty=$4,min_amount=$5,note=$6,sort_order=$7,is_active=true,updated_at=NOW() WHERE id=$8`, [...vals, q.rows[0].id]); return 'u'
  }
  await pool.query(`INSERT INTO garment_printing_pricing (name,type,unit,price_per_sqcm,min_qty,min_amount,note,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [it.name,...vals]); return 'i'
}
async function upsertEmb(it, i) {
  const q = await pool.query(`SELECT id FROM embroidery_pricing WHERE name=$1 ORDER BY id LIMIT 1`, [it.name])
  const vals = [it.unit||'за 1000 стежков', it.price, it.note||null, i]
  if (q.rows[0]) {
    await pool.query(`UPDATE embroidery_pricing SET unit=$1,price=$2,note=$3,sort_order=$4,is_active=true,updated_at=NOW() WHERE id=$5`, [...vals, q.rows[0].id]); return 'u'
  }
  await pool.query(`INSERT INTO embroidery_pricing (name,unit,price,note,sort_order) VALUES ($1,$2,$3,$4,$5)`, [it.name,...vals]); return 'i'
}
async function upsertOp(it, n) {
  const q = await pool.query(`SELECT id FROM additional_operations WHERE name=$1 ORDER BY id LIMIT 1`, [it.name])
  const params = [it.name, it.type||null, JSON.stringify(it.applicableTo||[]), null, it.price||null, it.prices?JSON.stringify(it.prices):null, it.unit||null, it.description||null, n]
  if (q.rows[0]) {
    await pool.query(`UPDATE additional_operations SET operation_type=$2,applicable_to=$3,options=$4,price=$5,prices=$6,unit=$7,description=$8,sort_order=$9,is_active=true,updated_at=NOW() WHERE id=$1`, [q.rows[0].id,...params.slice(1)]); return 'u'
  }
  await pool.query(`INSERT INTO additional_operations (name,operation_type,applicable_to,options,price,prices,unit,description,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, params); return 'i'
}

async function main() {
  await ensure()
  const st={g:{i:0,u:0},e:{i:0,u:0},o:{i:0,u:0}}
  for(const it of d.garmentPrinting){ const r=await upsertGarment(it,0); st.g[r]++ }
  for(const it of d.embroidery){ const r=await upsertEmb(it,0); st.e[r]++ }
  for(const k of ['garmentFile','embFile','embMetalThread']){ const op=d.additionalOperations[k]; if(op){ const r=await upsertOp(op,9000); st.o[r]++ } }
  const cnt = await pool.query(`SELECT (SELECT COUNT(*)::int FROM garment_printing_pricing WHERE is_active=true) g, (SELECT COUNT(*)::int FROM embroidery_pricing WHERE is_active=true) e, (SELECT COUNT(*)::int FROM additional_operations WHERE is_active=true AND (applicable_to::text LIKE '%garment-printing%' OR applicable_to::text LIKE '%embroidery%')) o`)
  console.log(JSON.stringify({st, counts:cnt.rows[0]},null,2))
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>pool.end())