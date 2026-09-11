module.exports = (router, pool) => {
  // SERVICES CRUD
  router.get('/services', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM additional_services WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/services', async (req, res) => {
    const { name, price, price_text, unit, description, applicable_to, sort_order } = req.body
    try { res.json((await pool.query('INSERT INTO additional_services (name,price,price_text,unit,description,applicable_to,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [name, price, price_text, unit, description, JSON.stringify(applicable_to || ['all']), sort_order||0])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/services/:id', async (req, res) => {
    const { name, price, price_text, unit, description, applicable_to, is_active, sort_order } = req.body
    try { res.json((await pool.query('UPDATE additional_services SET name=$1,price=$2,price_text=$3,unit=$4,description=$5,applicable_to=$6,is_active=$7,sort_order=$8,updated_at=NOW() WHERE id=$9 RETURNING *',
      [name, price, price_text, unit, description, JSON.stringify(applicable_to || ['all']), is_active!==false, sort_order||0, req.params.id])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/services/:id', async (req, res) => {
    try { await pool.query('UPDATE additional_services SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })

  // OPERATIONS CRUD (ламинация, скругление углов и т.д.)
  router.get('/operations', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM additional_operations WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/operations', async (req, res) => {
    const { name, operation_type, applicable_to, options, price, prices, unit, description, default_quantity, sort_order } = req.body
    try {
      res.json((await pool.query(
        `INSERT INTO additional_operations (name, operation_type, applicable_to, options, price, prices, unit, description, default_quantity, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [name, operation_type, JSON.stringify(applicable_to || ['all']), options ? JSON.stringify(options) : null,
         price, prices ? JSON.stringify(prices) : null, unit, description, default_quantity, sort_order||0]
      )).rows[0]) 
    } catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/operations/:id', async (req, res) => {
    const { name, operation_type, applicable_to, options, price, prices, unit, description, default_quantity, is_active, sort_order } = req.body
    try {
      res.json((await pool.query(
        `UPDATE additional_operations SET name=$1, operation_type=$2, applicable_to=$3, options=$4,
         price=$5, prices=$6, unit=$7, description=$8, default_quantity=$9, is_active=$10, sort_order=$11, updated_at=NOW()
         WHERE id=$12 RETURNING *`,
        [name, operation_type, JSON.stringify(applicable_to || ['all']), options ? JSON.stringify(options) : null,
         price, prices ? JSON.stringify(prices) : null, unit, description, default_quantity, is_active!==false, sort_order||0, req.params.id]
      )).rows[0]) 
    } catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/operations/:id', async (req, res) => {
    try { await pool.query('UPDATE additional_operations SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })

  // SETTINGS
  router.get('/settings', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM pricing_settings LIMIT 1')).rows[0] || { urgent_surcharge: 30 }) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/settings', async (req, res) => {
    try { res.json((await pool.query('INSERT INTO pricing_settings (id,urgent_surcharge) VALUES (1,$1) ON CONFLICT (id) DO UPDATE SET urgent_surcharge=$1,updated_at=NOW() RETURNING *',
      [req.body.urgent_surcharge])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
}
