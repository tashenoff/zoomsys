require('dotenv').config()
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

// SSL только если явно указано (для managed DB типа Heroku, Supabase)
const useSSL = process.env.DATABASE_SSL === 'true'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
})

async function migrate() {
  console.log('🚀 Запуск миграции для таблицы users...')
  
  try {
    // Создаём таблицу users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        permissions JSONB DEFAULT '{"viewDashboard": true, "viewOrders": true, "createOrders": true, "editOrders": false, "deleteOrders": false, "viewClients": true, "manageClients": false, "viewReports": false, "manageUsers": false, "viewPricing": true, "editPricing": false}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    console.log('✅ Таблица users создана')

    // Создаём индекс
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)')
    console.log('✅ Индекс idx_users_username создан')

    // Проверяем, есть ли уже админ
    const existingAdmin = await pool.query("SELECT id FROM users WHERE username = 'admin'")
    
    if (existingAdmin.rows.length === 0) {
      // Хешируем пароль admin
      const passwordHash = await bcrypt.hash('admin', 10)
      
      // Создаём администратора по умолчанию
      await pool.query(`
        INSERT INTO users (username, password_hash, full_name, role, permissions)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        'admin',
        passwordHash,
        'Администратор',
        'admin',
        JSON.stringify({
          viewDashboard: true,
          viewOrders: true,
          createOrders: true,
          editOrders: true,
          deleteOrders: true,
          viewClients: true,
          manageClients: true,
          viewReports: true,
          manageUsers: true,
          viewPricing: true,
          editPricing: true
        })
      ])
      console.log('✅ Администратор по умолчанию создан (admin/admin)')
    } else {
      console.log('ℹ️  Администратор уже существует')
    }

    console.log('🎉 Миграция успешно завершена!')
  } catch (err) {
    console.error('❌ Ошибка миграции:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
