const express = require('express')
const bcrypt = require('bcryptjs')
const { authMiddleware, adminMiddleware, permissionMiddleware } = require('../middleware/auth')

module.exports = (pool) => {
  const router = express.Router()

  // Все роуты требуют авторизации
  router.use(authMiddleware)

  // GET /api/users - Получить список пользователей
  router.get('/', permissionMiddleware('manageUsers'), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, username, full_name, role, permissions, is_active, created_at, updated_at 
         FROM users ORDER BY created_at DESC`
      )
      const users = result.rows.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        permissions: user.permissions,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }))
      res.json(users)
    } catch (err) {
      console.error('Get users error:', err)
      res.status(500).json({ error: 'Ошибка получения списка пользователей' })
    }
  })

  // GET /api/users/:id - Получить пользователя по ID
  router.get('/:id', permissionMiddleware('manageUsers'), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, username, full_name, role, permissions, is_active, created_at, updated_at 
         FROM users WHERE id = $1`,
        [req.params.id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }
      const user = result.rows[0]
      res.json({
        id: user.id, username: user.username, fullName: user.full_name,
        role: user.role, permissions: user.permissions, isActive: user.is_active,
        createdAt: user.created_at, updatedAt: user.updated_at
      })
    } catch (err) {
      console.error('Get user error:', err)
      res.status(500).json({ error: 'Ошибка получения данных пользователя' })
    }
  })

  // Функция для получения прав по умолчанию
  const getDefaultPermissions = (role) => {
    if (role === 'admin') {
      return { viewDashboard: true, viewOrders: true, createOrders: true, editOrders: true,
        deleteOrders: true, viewClients: true, manageClients: true, viewReports: true,
        manageUsers: true, viewPricing: true, editPricing: true }
    } else if (role === 'manager') {
      return { viewDashboard: true, viewOrders: true, createOrders: true, editOrders: true,
        deleteOrders: true, viewClients: true, manageClients: true, viewReports: true,
        manageUsers: false, viewPricing: true, editPricing: false }
    }
    return { viewDashboard: true, viewOrders: true, createOrders: true, editOrders: false,
      deleteOrders: false, viewClients: true, manageClients: false, viewReports: false,
      manageUsers: false, viewPricing: true, editPricing: false }
  }

  // POST /api/users - Создать пользователя (только админ)
  router.post('/', adminMiddleware, async (req, res) => {
    try {
      const { username, password, fullName, role, permissions } = req.body
      if (!username || !password || !fullName) {
        return res.status(400).json({ error: 'Логин, пароль и ФИО обязательны' })
      }
      if (password.length < 4) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 4 символов' })
      }
      const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username])
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Пользователь с таким логином уже существует' })
      }
      const passwordHash = await bcrypt.hash(password, 10)
      const userPermissions = permissions || getDefaultPermissions(role || 'user')
      const result = await pool.query(
        `INSERT INTO users (username, password_hash, full_name, role, permissions)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, full_name, role, permissions, is_active, created_at`,
        [username, passwordHash, fullName, role || 'user', JSON.stringify(userPermissions)]
      )
      const user = result.rows[0]
      res.status(201).json({
        id: user.id, username: user.username, fullName: user.full_name, role: user.role,
        permissions: user.permissions, isActive: user.is_active, createdAt: user.created_at
      })
    } catch (err) {
      console.error('Create user error:', err)
      res.status(500).json({ error: 'Ошибка создания пользователя' })
    }
  })

  // PUT /api/users/:id - Обновить пользователя (только админ)
  router.put('/:id', adminMiddleware, async (req, res) => {
    try {
      const { username, password, fullName, role, permissions, isActive } = req.body
      const userId = req.params.id
      const existingUser = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
      if (existingUser.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }
      if (username && username !== existingUser.rows[0].username) {
        const check = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, userId])
        if (check.rows.length > 0) return res.status(400).json({ error: 'Логин уже занят' })
      }
      let params = [username || null, fullName || null, role || null,
        permissions ? JSON.stringify(permissions) : null, isActive !== undefined ? isActive : null]
      let q = `UPDATE users SET username = COALESCE($1, username), full_name = COALESCE($2, full_name),
        role = COALESCE($3, role), permissions = COALESCE($4, permissions), is_active = COALESCE($5, is_active), updated_at = NOW()`
      if (password && password.length >= 4) {
        const hash = await bcrypt.hash(password, 10)
        q += `, password_hash = $6`
        params.push(hash)
      }
      q += ` WHERE id = $${params.length + 1} RETURNING *`
      params.push(userId)
      const result = await pool.query(q, params)
      const user = result.rows[0]
      res.json({ id: user.id, username: user.username, fullName: user.full_name, role: user.role,
        permissions: user.permissions, isActive: user.is_active, createdAt: user.created_at, updatedAt: user.updated_at })
    } catch (err) {
      console.error('Update user error:', err)
      res.status(500).json({ error: 'Ошибка обновления пользователя' })
    }
  })

  // DELETE /api/users/:id - Деактивировать пользователя
  router.delete('/:id', adminMiddleware, async (req, res) => {
    try {
      if (req.user.id === req.params.id) return res.status(400).json({ error: 'Нельзя удалить себя' })
      const result = await pool.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id', [req.params.id])
      if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' })
      res.json({ success: true })
    } catch (err) {
      console.error('Delete user error:', err)
      res.status(500).json({ error: 'Ошибка удаления пользователя' })
    }
  })

  return router
}
