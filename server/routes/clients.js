const express = require('express')

module.exports = (pool) => {
  const router = express.Router()

  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM clients WHERE is_active=true ORDER BY name')
      res.json(result.rows)
    } catch (e) { console.error('[clients.get]', e); res.status(500).json({ error: 'Ошибка загрузки клиентов' }) }
  })

  router.get('/:id', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM clients WHERE id=$1', [req.params.id])
      if (result.rows.length === 0) return res.status(404).json({ error: 'Клиент не найден' })
      res.json(result.rows[0])
    } catch (e) { res.status(500).json({ error: 'Ошибка' }) }
  })

  router.post('/', async (req, res) => {
    try {
      const { name, phone, email, company, notes } = req.body
      const result = await pool.query(
        'INSERT INTO clients (name,phone,email,company,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [name, phone, email, company, notes])
      res.json(result.rows[0])
    } catch (e) { res.status(500).json({ error: 'Ошибка добавления клиента' }) }
  })

  router.put('/:id', async (req, res) => {
    try {
      const { name, phone, email, company, notes } = req.body
      const result = await pool.query(
        'UPDATE clients SET name=$1,phone=$2,email=$3,company=$4,notes=$5,updated_at=NOW() WHERE id=$6 RETURNING *',
        [name, phone, email, company, notes, req.params.id])
      res.json(result.rows[0])
    } catch (e) { res.status(500).json({ error: 'Ошибка обновления клиента' }) }
  })

  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('UPDATE clients SET is_active=false,updated_at=NOW() WHERE id=$1', [req.params.id])
      res.json({ success: true })
    } catch (e) { res.status(500).json({ error: 'Ошибка удаления клиента' }) }
  })

  return router
}
