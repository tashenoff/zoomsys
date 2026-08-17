module.exports = (router, pool) => {
  // SERVICES CRUD
  router.get('/services', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM additional_services WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/services', async (req, res) => {
    const { name, price, unit, description, sort_order } = req.body
    try { res.json((await pool.query('INSERT INTO additional_services (name,price,unit,description,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, price, unit, description, sort_order||0])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/services/:id', async (req, res) => {
    const { name, price, unit, description, is_active, sort_order } = req.body
    try { res.json((await pool.query('UPDATE additional_services SET name=$1,price=$2,unit=$3,description=$4,is_active=$5,sort_order=$6,updated_at=NOW() WHERE id=$7 RETURNING *',
      [name, price, unit, description, is_active!==false, sort_order||0, req.params.id])).rows[0]) } catch(e) { res.status(500).json({error:'Ошибка'}) }
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
    const { name, operation_type, applicable_to, options, price, unit, description, default_quantity, sort_order } = req.body
    try { 
      res.json((await pool.query(
        `INSERT INTO additional_operations (name, operation_type, applicable_to, options, price, unit, description, default_quantity, sort_order) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [name, operation_type, JSON.stringify(applicable_to || ['all']), options ? JSON.stringify(options) : null, 
         price, unit, description, default_quantity, sort_order||0]
      )).rows[0]) 
    } catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/operations/:id', async (req, res) => {
    const { name, operation_type, applicable_to, options, price, unit, description, default_quantity, is_active, sort_order } = req.body
    try { 
      res.json((await pool.query(
        `UPDATE additional_operations SET name=$1, operation_type=$2, applicable_to=$3, options=$4, 
         price=$5, unit=$6, description=$7, default_quantity=$8, is_active=$9, sort_order=$10, updated_at=NOW() 
         WHERE id=$11 RETURNING *`,
        [name, operation_type, JSON.stringify(applicable_to || ['all']), options ? JSON.stringify(options) : null,
         price, unit, description, default_quantity, is_active!==false, sort_order||0, req.params.id]
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
