const express = require('express')

module.exports = (pool) => {
  const router = express.Router()

  // Получить все прайсы
  router.get('/', async (req, res) => {
    try {
      const [bc, printing, uv, wide, state, services, operations, settings, reorder] = await Promise.all([
        pool.query('SELECT * FROM business_cards_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM printing_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM uv_printing_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM wide_format_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM state_symbols_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM additional_services WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM additional_operations WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM pricing_settings LIMIT 1'),
        pool.query('SELECT * FROM reorder_options WHERE is_active=true ORDER BY sort_order')
      ])
      res.json({
        settings: settings.rows[0] || { urgent_surcharge: 30 },
        businessCards: bc.rows, printing: printing.rows, uvPrinting: uv.rows,
        wideFormat: wide.rows, stateSymbols: state.rows, additionalServices: services.rows,
        additionalOperations: operations.rows, reorderOptions: reorder.rows
      })
    } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка загрузки' }) }
  })

  // BUSINESS CARDS CRUD
  router.get('/business-cards', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM business_cards_pricing WHERE is_active=true ORDER BY sort_order,name')).rows) }
    catch (e) { res.status(500).json({ error: 'Ошибка' }) }
  })
  router.post('/business-cards', async (req, res) => {
    const { name, color_type, prices, sort_order } = req.body
    try { res.json((await pool.query('INSERT INTO business_cards_pricing (name,color_type,prices,sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, color_type, JSON.stringify(prices), sort_order||0])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/business-cards/:id', async (req, res) => {
    const { name, color_type, prices, is_active, sort_order } = req.body
    try { res.json((await pool.query('UPDATE business_cards_pricing SET name=$1,color_type=$2,prices=$3,is_active=$4,sort_order=$5,updated_at=NOW() WHERE id=$6 RETURNING *',
      [name, color_type, JSON.stringify(prices), is_active!==false, sort_order||0, req.params.id])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/business-cards/:id', async (req, res) => {
    try { await pool.query('UPDATE business_cards_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })

  // PRINTING CRUD
  router.get('/printing', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM printing_pricing WHERE is_active=true ORDER BY sort_order,name')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/printing', async (req, res) => {
    const { category, name, color_type, prices, sort_order } = req.body
    try { res.json((await pool.query('INSERT INTO printing_pricing (category,name,color_type,prices,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [category, name, color_type, JSON.stringify(prices), sort_order||0])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/printing/:id', async (req, res) => {
    const { category, name, color_type, prices, is_active, sort_order } = req.body
    try { res.json((await pool.query('UPDATE printing_pricing SET category=$1,name=$2,color_type=$3,prices=$4,is_active=$5,sort_order=$6,updated_at=NOW() WHERE id=$7 RETURNING *',
      [category, name, color_type, JSON.stringify(prices), is_active!==false, sort_order||0, req.params.id])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/printing/:id', async (req, res) => {
    try { await pool.query('UPDATE printing_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })

  // WIDE FORMAT CRUD
  router.get('/wide-format', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM wide_format_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/wide-format', async (req, res) => {
    const { name, price_per_sqm, sort_order } = req.body
    try { res.json((await pool.query('INSERT INTO wide_format_pricing (name,price_per_sqm,sort_order) VALUES ($1,$2,$3) RETURNING *',
      [name, price_per_sqm, sort_order||0])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/wide-format/:id', async (req, res) => {
    const { name, price_per_sqm, is_active, sort_order } = req.body
    try { res.json((await pool.query('UPDATE wide_format_pricing SET name=$1,price_per_sqm=$2,is_active=$3,sort_order=$4,updated_at=NOW() WHERE id=$5 RETURNING *',
      [name, price_per_sqm, is_active!==false, sort_order||0, req.params.id])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/wide-format/:id', async (req, res) => {
    try { await pool.query('UPDATE wide_format_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })

  // UV PRINTING CRUD
  router.get('/uv-printing', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM uv_printing_pricing WHERE is_active=true ORDER BY sort_order,name')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/uv-printing', async (req, res) => {
    const { category, name, description, sides, materials, price_type, sort_order } = req.body
    try { res.json((await pool.query('INSERT INTO uv_printing_pricing (category,name,description,sides,materials,price_type,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [category, name, description, JSON.stringify(sides), JSON.stringify(materials), price_type, sort_order||0])).rows[0]) } catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/uv-printing/:id', async (req, res) => {
    const { category, name, description, sides, materials, price_type, is_active, sort_order } = req.body
    try { res.json((await pool.query('UPDATE uv_printing_pricing SET category=$1,name=$2,description=$3,sides=$4,materials=$5,price_type=$6,is_active=$7,sort_order=$8,updated_at=NOW() WHERE id=$9 RETURNING *',
      [category, name, description, JSON.stringify(sides), JSON.stringify(materials), price_type, is_active!==false, sort_order||0, req.params.id])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/uv-printing/:id', async (req, res) => {
    try { await pool.query('UPDATE uv_printing_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })

  // STATE SYMBOLS CRUD
  router.get('/state-symbols', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM state_symbols_pricing WHERE is_active=true ORDER BY sort_order,name')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/state-symbols', async (req, res) => {
    const { category, name, option, price, sort_order } = req.body
    try { res.json((await pool.query('INSERT INTO state_symbols_pricing (category,name,option,price,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [category, name, option, price, sort_order||0])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/state-symbols/:id', async (req, res) => {
    const { category, name, option, price, is_active, sort_order } = req.body
    try { res.json((await pool.query('UPDATE state_symbols_pricing SET category=$1,name=$2,option=$3,price=$4,is_active=$5,sort_order=$6,updated_at=NOW() WHERE id=$7 RETURNING *',
      [category, name, option, price, is_active!==false, sort_order||0, req.params.id])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/state-symbols/:id', async (req, res) => {
    try { await pool.query('UPDATE state_symbols_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })

  // Доп.роуты в отдельном файле
  require('./pricing-extra')(router, pool)
  return router
}
