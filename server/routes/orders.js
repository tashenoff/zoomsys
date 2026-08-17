const express = require('express')

module.exports = (pool) => {
  const router = express.Router()

  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT o.*, c.name as client_name, c.phone as client_phone
        FROM orders o LEFT JOIN clients c ON o.client_id = c.id
        ORDER BY o.created_at DESC
      `)
      res.json(result.rows)
    } catch (e) { res.status(500).json({ error: 'Ошибка загрузки заказов' }) }
  })

  router.get('/:id', async (req, res) => {
    try {
      const order = await pool.query(`
        SELECT o.*, c.name as client_name, c.phone as client_phone, c.email as client_email
        FROM orders o LEFT JOIN clients c ON o.client_id = c.id WHERE o.id = $1
      `, [req.params.id])
      if (order.rows.length === 0) return res.status(404).json({ error: 'Заказ не найден' })
      
      const items = await pool.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at', [req.params.id])
      res.json({ ...order.rows[0], items: items.rows })
    } catch (e) { res.status(500).json({ error: 'Ошибка загрузки заказа' }) }
  })

  router.post('/', async (req, res) => {
    try {
      const { client_id, category, status, payment_status, total_amount, notes, items } = req.body
      
      const count = await pool.query('SELECT COUNT(*) FROM orders')
      const orderNumber = `ORD-${String(parseInt(count.rows[0].count) + 1).padStart(5, '0')}`
      
      const order = await pool.query(`
        INSERT INTO orders (order_number,client_id,category,status,payment_status,total_amount,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [orderNumber, client_id, category, status || 'draft', payment_status || 'not_paid', total_amount, notes])
      
      if (items && items.length > 0) {
        for (const item of items) {
          await pool.query(`
            INSERT INTO order_items (order_id,product_name,color_type,quantity,unit_price,total_price,specifications)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [order.rows[0].id, item.product_name, item.color_type, item.quantity, item.unit_price, item.total_price, JSON.stringify(item.specifications || {})])
        }
      }
      
      res.json(order.rows[0])
    } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка создания заказа' }) }
  })

  router.put('/:id', async (req, res) => {
    try {
      const { status, payment_status, notes } = req.body
      const result = await pool.query(`
        UPDATE orders SET status=COALESCE($1,status), payment_status=COALESCE($2,payment_status), 
        notes=COALESCE($3,notes), updated_at=NOW() WHERE id=$4 RETURNING *
      `, [status, payment_status, notes, req.params.id])
      res.json(result.rows[0])
    } catch (e) { res.status(500).json({ error: 'Ошибка обновления заказа' }) }
  })

  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM order_items WHERE order_id=$1', [req.params.id])
      await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id])
      res.json({ success: true })
    } catch (e) { res.status(500).json({ error: 'Ошибка удаления заказа' }) }
  })

  return router
}
