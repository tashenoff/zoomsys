require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function reset() {
  console.log('🗑️ Очищаем таблицы...')
  try {
    await pool.query(`
      TRUNCATE 
        business_cards_pricing, 
        printing_pricing, 
        uv_printing_pricing, 
        wide_format_pricing, 
        additional_services, 
        additional_operations,
        reorder_options, 
        pricing_settings,
        order_items,
        orders,
        clients
      RESTART IDENTITY CASCADE
    `)
    console.log('✅ Таблицы очищены!')
  } catch (e) {
    console.error('❌ Ошибка:', e.message)
  } finally {
    await pool.end()
  }
}

reset()
