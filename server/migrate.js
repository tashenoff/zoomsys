require('dotenv').config()
const { Pool } = require('pg')

// SSL только если явно указано (для managed DB типа Heroku, Supabase)
const useSSL = process.env.DATABASE_SSL === 'true'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
})

async function migrate() {
  console.log('🔄 Начинаем миграцию базы данных...')
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS pricing_settings (
      id INTEGER PRIMARY KEY DEFAULT 1, urgent_surcharge NUMERIC(5,2) DEFAULT 30,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ pricing_settings')

    await pool.query(`CREATE TABLE IF NOT EXISTS business_cards_pricing (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, color_type TEXT NOT NULL,
      prices JSONB NOT NULL, is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ business_cards_pricing')

    await pool.query(`CREATE TABLE IF NOT EXISTS printing_pricing (
      id SERIAL PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL, color_type TEXT,
      prices JSONB NOT NULL, is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ printing_pricing')

    await pool.query(`CREATE TABLE IF NOT EXISTS uv_printing_pricing (
      id SERIAL PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
      sides JSONB, materials JSONB, price_type TEXT, is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ uv_printing_pricing')

    await pool.query(`CREATE TABLE IF NOT EXISTS wide_format_pricing (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, price_per_sqm NUMERIC(10,2) NOT NULL,
      is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ wide_format_pricing')

    await pool.query(`CREATE TABLE IF NOT EXISTS state_symbols_pricing (
      id SERIAL PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL, option TEXT,
      price NUMERIC(12,2), is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ state_symbols_pricing')

    await pool.query(`CREATE TABLE IF NOT EXISTS additional_services (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, price NUMERIC(10,2), unit TEXT, description TEXT,
      applicable_to JSONB DEFAULT '["all"]',
      is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ additional_services')

    await pool.query(`CREATE TABLE IF NOT EXISTS additional_operations (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, operation_type TEXT,
      applicable_to JSONB DEFAULT '["all"]', options JSONB, 
      price NUMERIC(10,2), unit TEXT, description TEXT, default_quantity INTEGER,
      is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ additional_operations')

    await pool.query(`CREATE TABLE IF NOT EXISTS reorder_options (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, discount_percent NUMERIC(5,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ reorder_options')

    await pool.query(`CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, company TEXT, notes TEXT,
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ clients')

    await pool.query(`CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY, order_number TEXT UNIQUE NOT NULL, client_id INTEGER REFERENCES clients(id),
      category TEXT, status TEXT DEFAULT 'draft', payment_status TEXT DEFAULT 'not_paid',
      total_amount NUMERIC(12,2), notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ orders')

    await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL, color_type TEXT, quantity INTEGER NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL, total_price NUMERIC(12,2) NOT NULL,
      specifications JSONB, created_at TIMESTAMP DEFAULT NOW())`)
    console.log('✅ order_items')

    console.log('\n✨ Миграция завершена!')
  } catch (error) {
    console.error('❌ Ошибка:', error)
    process.exit(1)
  } finally { await pool.end() }
}

migrate()
