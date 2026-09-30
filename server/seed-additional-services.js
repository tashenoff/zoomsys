require('dotenv').config()
const { Pool } = require('pg')

const useSSL = process.env.DATABASE_SSL === 'true'
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
})

// Единый каталог дополнительных услуг (source of truth для раздела «Дополнительные услуги»).
// Каждая запись доступна и как самостоятельная продажа (standalone-раздел), и как опция
// к изделиям из applicableTo. Ничего не удаляется: апсёрт по имени.
const SERVICES = [
  // --- Дизайн (уже существующие строки; здесь только закрепляем категорию) ---
  { name: 'Разработка дизайна визитки', price: 3500, price_text: null, unit: 'тг', category: 'Дизайн', applicableTo: ['business-cards', 'badges', 'discount-cards'] },
  { name: 'Разработка дизайна флаера (1 сторона)', price: null, price_text: 'от 5000 до 6000', unit: 'тг', category: 'Дизайн', applicableTo: ['flyers'] },
  { name: 'Разработка дизайна листовки/афиши', price: 5000, price_text: null, unit: 'тг', category: 'Дизайн', applicableTo: ['flyers'] },
  { name: 'Разработка буклета (концепт)', price: 15000, price_text: null, unit: 'тг', category: 'Дизайн', applicableTo: ['booklets'] },
  { name: 'Разработка диплома/сертификата', price: null, price_text: 'от 6000 до 8000', unit: 'тг', category: 'Дизайн', applicableTo: ['certificates'] },
  { name: 'Разработка макета для УФ-печати', price: 3000, price_text: null, unit: 'тг', category: 'Дизайн', applicableTo: ['uv-printing'] },
  { name: 'Разработка макета для широкоформатной печати', price: 5000, price_text: null, unit: 'тг', category: 'Дизайн', applicableTo: ['wide-format'] },
  { name: 'Разработка дизайна стенда', price: null, price_text: 'от 15000 до 20000', unit: 'тг', category: 'Дизайн', applicableTo: ['advertising-stands', 'stands'] },
  { name: 'Разработка дизайна вывески', price: null, price_text: 'от 15000 до 25000', unit: 'тг', category: 'Дизайн', applicableTo: ['signs'] },
  { name: 'Разработка дизайн-макета', price: 5000, price_text: null, unit: 'тг', category: 'Дизайн', applicableTo: ['all'] },

  // --- Новые самостоятельные услуги ---
  { name: 'Монтаж / демонтаж конструкции', price: null, price_text: 'по запросу', unit: 'м²', category: 'Монтаж', applicableTo: ['all'] },
  { name: 'Пришив бахромы', price: 350, price_text: null, unit: 'пог.м', category: 'Доработка', applicableTo: ['flags-products', 'textile'] }
]

async function ensureColumns() {
  await pool.query(`ALTER TABLE additional_services ADD COLUMN IF NOT EXISTS category TEXT`)
}

async function upsertService(item, sortOrder) {
  const existing = await pool.query(
    `SELECT id FROM additional_services WHERE name=$1 ORDER BY id LIMIT 1`,
    [item.name]
  )
  const params = [
    item.name,
    item.price ?? null,
    item.price_text || null,
    item.unit || 'тг',
    item.category || null,
    JSON.stringify(item.applicableTo || ['all']),
    sortOrder
  ]
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE additional_services SET name=$1, price=$2, price_text=$3, unit=$4, category=$5,
         applicable_to=$6, sort_order=$7, is_active=true, updated_at=NOW() WHERE id=$8`,
      [...params, existing.rows[0].id]
    )
    return 'updated'
  }
  await pool.query(
    `INSERT INTO additional_services (name, price, price_text, unit, category, applicable_to, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    params
  )
  return 'inserted'
}

async function main() {
  await ensureColumns()
  let ins = 0, upd = 0
  for (let i = 0; i < SERVICES.length; i++) {
    const r = await upsertService(SERVICES[i], i + 1)
    if (r === 'inserted') ins++; else upd++
  }
  console.log(`✅ additional_services: ${ins} inserted, ${upd} updated`)
  const rows = await pool.query('SELECT name, price, price_text, unit, category, applicable_to FROM additional_services WHERE is_active=true ORDER BY sort_order, name')
  console.log(`Rows: ${rows.rowCount}`)
  await pool.end()
}

main().catch((e) => { console.error('Seed error:', e.message); process.exit(1) })