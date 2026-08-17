const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { authMiddleware, JWT_SECRET } = require('../middleware/auth')

module.exports = (pool) => {
  const router = express.Router()

  // POST /api/auth/login - Вход в систему
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body

      if (!username || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' })
      }

      // Ищем пользователя
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1 AND is_active = true',
        [username]
      )

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Неверный логин или пароль' })
      }

      const user = result.rows[0]

      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.password_hash)
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Неверный логин или пароль' })
      }

      // Создаём JWT токен
      const tokenPayload = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        permissions: user.permissions
      }

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' })

      // Возвращаем токен и информацию о пользователе
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
          permissions: user.permissions
        }
      })
    } catch (err) {
      console.error('Login error:', err)
      res.status(500).json({ error: 'Ошибка сервера при авторизации' })
    }
  })

  // POST /api/auth/logout - Выход из системы (просто для фронтенда, токен удаляется на клиенте)
  router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Выход выполнен успешно' })
  })

  // GET /api/auth/verify - Проверка токена
  router.get('/verify', authMiddleware, (req, res) => {
    res.json({
      valid: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        fullName: req.user.fullName,
        role: req.user.role,
        permissions: req.user.permissions
      }
    })
  })

  // GET /api/auth/me - Получить текущего пользователя
  router.get('/me', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, username, full_name, role, permissions, created_at FROM users WHERE id = $1 AND is_active = true',
        [req.user.id]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }

      const user = result.rows[0]
      res.json({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        permissions: user.permissions,
        createdAt: user.created_at
      })
    } catch (err) {
      console.error('Get me error:', err)
      res.status(500).json({ error: 'Ошибка получения данных пользователя' })
    }
  })

  return router
}
