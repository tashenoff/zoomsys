require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
})

async function run() {
  const broken = await pool.query(`
    SELECT id, category, name, option, price, is_active
    FROM state_symbols_pricing
    WHERE name ILIKE '%3000%' OR name ILIKE '%3 000%'
       OR category NOT IN ('coat-of-arms','flags-rk','flagpoles','signs','stands','president-portrait')
       OR is_active = false
    ORDER BY id
  `)
  console.log('found', broken.rows.length)
  console.log(JSON.stringify(broken.rows, null, 2))

  await pool.query(`
    UPDATE state_symbols_pricing
    SET category = 'coat-of-arms', is_active = true, updated_at = NOW()
    WHERE name ILIKE '%Герб%' AND (
      category NOT IN ('coat-of-arms','flags-rk','flagpoles','signs','stands','president-portrait')
      OR is_active = false
    )
  `)

  const after = await pool.query(`
    SELECT id, category, name, option, price, is_active
    FROM state_symbols_pricing
    WHERE name ILIKE '%Герб РК, диаметр 3%'
    ORDER BY id
  `)
  console.log('after', JSON.stringify(after.rows, null, 2))
  await pool.end()
}

run().catch((e) => { console.error(e); process.exit(1) })
