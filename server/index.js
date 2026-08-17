require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { Pool } = require('pg')

const app = express()
const PORT = process.env.PORT || 3001

// SSL только если явно указано (для managed DB типа Heroku, Supabase)
const useSSL = process.env.DATABASE_SSL === 'true'

// Настройка PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
})

// Middleware
app.use(cors())
app.use(express.json())

// Импорт роутов
const pricingRoutes = require('./routes/pricing')(pool)
const clientsRoutes = require('./routes/clients')(pool)
const ordersRoutes = require('./routes/orders')(pool)
const authRoutes = require('./routes/auth')(pool)
const usersRoutes = require('./routes/users')(pool)

app.use('/api/pricing', pricingRoutes)
app.use('/api/clients', clientsRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// В production раздаём статические файлы фронтенда
if (process.env.NODE_ENV === 'production') {
  // Статические файлы из dist
  app.use(express.static(path.join(__dirname, '..', 'dist')))
  
  // Все остальные запросы отправляем на index.html (для React Router)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'))
  })
}

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 API сервер запущен на порту ${PORT}`)
  console.log(`📁 Режим: ${process.env.NODE_ENV || 'development'}`)
})
