require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function addColumns() {
  console.log('🔧 Добавляем недостающие колонки в additional_operations...')
  try {
    // Добавляем колонки если их нет
    await pool.query(`
      ALTER TABLE additional_operations 
      ADD COLUMN IF NOT EXISTS price NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS unit TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS default_quantity INTEGER
    `)
    console.log('✅ Колонки добавлены!')
  } catch (e) {
    console.error('❌ Ошибка:', e.message)
  } finally {
    await pool.end()
  }
}

addColumns()
