const express = require('express')

module.exports = (pool) => {
  const router = express.Router()

  // Получить все прайсы
  router.get('/', async (req, res) => {
    try {
      const [bc, printing, uv, wide, textile, flagsProducts, advertisingStands, cncLaser, plotterCutting, eventServices, garment, embroidery, state, services, operations, settings, reorder] = await Promise.all([
        pool.query('SELECT * FROM business_cards_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM printing_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM uv_printing_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM wide_format_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM textile_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM flags_products_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM advertising_stands_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM cnc_laser_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM plotter_cutting_pricing WHERE is_active=true ORDER BY sort_order,material,operation'),
        pool.query('SELECT * FROM event_services_pricing WHERE is_active=true ORDER BY sort_order'),
        pool.query('SELECT * FROM garment_printing_pricing WHERE is_active=true ORDER BY sort_order'),
        pool.query('SELECT * FROM embroidery_pricing WHERE is_active=true ORDER BY sort_order'),
        pool.query('SELECT * FROM state_symbols_pricing WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM additional_services WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM additional_operations WHERE is_active=true ORDER BY sort_order,name'),
        pool.query('SELECT * FROM pricing_settings LIMIT 1'),
        pool.query('SELECT * FROM reorder_options WHERE is_active=true ORDER BY sort_order')
      ])
      res.json({
        settings: settings.rows[0] || { urgent_surcharge: 30 },
        businessCards: bc.rows, printing: printing.rows, uvPrinting: uv.rows,
        wideFormat: wide.rows, textile: textile.rows, flagsProducts: flagsProducts.rows, advertisingStands: advertisingStands.rows, cncLaser: cncLaser.rows, plotterCutting: plotterCutting.rows, eventServices: eventServices.rows, garmentPrinting: garment.rows, embroidery: embroidery.rows, stateSymbols: state.rows, additionalServices: services.rows,
        additionalOperations: operations.rows, reorderOptions: reorder.rows
      })
    } catch (e) { console.error('[pricing.get]', e); res.status(500).json({ error: 'Ошибка загрузки' }) }
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
    const { name, price_per_sqm, category, unit, prices, description, notes, sort_order } = req.body
    try { res.json((await pool.query(
      `INSERT INTO wide_format_pricing (name,price_per_sqm,category,unit,prices,description,notes,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, price_per_sqm, category, unit || 'м²', prices ? JSON.stringify(prices) : null, description, notes, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/wide-format/:id', async (req, res) => {
    const { name, price_per_sqm, category, unit, prices, description, notes, is_active, sort_order } = req.body
    try { res.json((await pool.query(
      `UPDATE wide_format_pricing SET name=$1,price_per_sqm=$2,category=$3,unit=$4,prices=$5,description=$6,notes=$7,is_active=$8,sort_order=$9,updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, price_per_sqm, category, unit || 'м²', prices ? JSON.stringify(prices) : null, description, notes, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
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


  // TEXTILE CRUD
  router.get('/textile', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM textile_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/textile', async (req, res) => {
    const { name, price_per_sqm, category, unit, prices, description, notes, sort_order } = req.body
    try { res.json((await pool.query(
      `INSERT INTO textile_pricing (name,price_per_sqm,category,unit,prices,description,notes,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, price_per_sqm, category, unit || 'м²', prices ? JSON.stringify(prices) : null, description, notes, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/textile/:id', async (req, res) => {
    const { name, price_per_sqm, category, unit, prices, description, notes, is_active, sort_order } = req.body
    try { res.json((await pool.query(
      `UPDATE textile_pricing SET name=$1,price_per_sqm=$2,category=$3,unit=$4,prices=$5,description=$6,notes=$7,is_active=$8,sort_order=$9,updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, price_per_sqm, category, unit || 'м²', prices ? JSON.stringify(prices) : null, description, notes, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/textile/:id', async (req, res) => {
    try { await pool.query('UPDATE textile_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })


  // FLAGS PRODUCTS CRUD
  router.get('/flags-products', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM flags_products_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/flags-products', async (req, res) => {
    const { name, category, unit, price, prices, description, notes, sort_order } = req.body
    try { res.json((await pool.query(
      `INSERT INTO flags_products_pricing (name,category,unit,price,prices,description,notes,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, category, unit || 'шт', price, prices ? JSON.stringify(prices) : null, description, notes, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/flags-products/:id', async (req, res) => {
    const { name, category, unit, price, prices, description, notes, is_active, sort_order } = req.body
    try { res.json((await pool.query(
      `UPDATE flags_products_pricing SET name=$1,category=$2,unit=$3,price=$4,prices=$5,description=$6,notes=$7,is_active=$8,sort_order=$9,updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, category, unit || 'шт', price, prices ? JSON.stringify(prices) : null, description, notes, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/flags-products/:id', async (req, res) => {
    try { await pool.query('UPDATE flags_products_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })


  // ADVERTISING STANDS CRUD
  router.get('/advertising-stands', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM advertising_stands_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/advertising-stands', async (req, res) => {
    const { name, type, unit, price, prices, description, notes, sort_order } = req.body
    try { res.json((await pool.query(
      `INSERT INTO advertising_stands_pricing (name,type,unit,price,prices,description,notes,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, type || 'fixed', unit || 'шт', price, prices ? JSON.stringify(prices) : null, description, notes, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/advertising-stands/:id', async (req, res) => {
    const { name, type, unit, price, prices, description, notes, is_active, sort_order } = req.body
    try { res.json((await pool.query(
      `UPDATE advertising_stands_pricing SET name=$1,type=$2,unit=$3,price=$4,prices=$5,description=$6,notes=$7,is_active=$8,sort_order=$9,updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, type || 'fixed', unit || 'шт', price, prices ? JSON.stringify(prices) : null, description, notes, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/advertising-stands/:id', async (req, res) => {
    try { await pool.query('UPDATE advertising_stands_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })


  // CNC/LASER CRUD
  router.get('/cnc-laser', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM cnc_laser_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/cnc-laser', async (req, res) => {
    const { name, category, unit, type, material, price, prices, description, notes, sort_order } = req.body
    try { res.json((await pool.query(
      `INSERT INTO cnc_laser_pricing (name,category,unit,type,material,price,prices,description,notes,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category, unit || 'пог.м', type, material, price,
       prices ? JSON.stringify(prices) : null, description, notes, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/cnc-laser/:id', async (req, res) => {
    const { name, category, unit, type, material, price, prices, description, notes, is_active, sort_order } = req.body
    try { res.json((await pool.query(
      `UPDATE cnc_laser_pricing SET name=$1,category=$2,unit=$3,type=$4,material=$5,price=$6,prices=$7,description=$8,notes=$9,is_active=$10,sort_order=$11,updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [name, category, unit || 'пог.м', type, material, price,
       prices ? JSON.stringify(prices) : null, description, notes, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/cnc-laser/:id', async (req, res) => {
    try { await pool.query('UPDATE cnc_laser_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })


  // PLOTTER CUTTING CRUD
  router.get('/plotter-cutting', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM plotter_cutting_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/plotter-cutting', async (req, res) => {
    const { material, operation, unit, price, price_text, description, notes, sort_order } = req.body
    try { res.json((await pool.query(
      `INSERT INTO plotter_cutting_pricing (material,operation,unit,price,price_text,description,notes,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [material, operation, unit || 'м²', price, price_text, description, notes, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/plotter-cutting/:id', async (req, res) => {
    const { material, operation, unit, price, price_text, description, notes, is_active, sort_order } = req.body
    try { res.json((await pool.query(
      `UPDATE plotter_cutting_pricing SET material=$1,operation=$2,unit=$3,price=$4,price_text=$5,description=$6,notes=$7,is_active=$8,sort_order=$9,updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [material, operation, unit || 'м²', price, price_text, description, notes, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/plotter-cutting/:id', async (req, res) => {
    try { await pool.query('UPDATE plotter_cutting_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })


  // EVENT SERVICES CRUD
  router.get('/event-services', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM event_services_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/event-services', async (req, res) => {
    const { name, category, unit, price, price_text, print_options, min_hours, description, notes, sort_order } = req.body
    try { res.json((await pool.query(
      `INSERT INTO event_services_pricing (name,category,unit,price,price_text,print_options,min_hours,description,notes,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category || 'rent', unit || 'шт', price, price_text,
       print_options ? JSON.stringify(print_options) : null, min_hours, description, notes, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/event-services/:id', async (req, res) => {
    const { name, category, unit, price, price_text, print_options, min_hours, description, notes, is_active, sort_order } = req.body
    try { res.json((await pool.query(
      `UPDATE event_services_pricing SET name=$1,category=$2,unit=$3,price=$4,price_text=$5,print_options=$6,min_hours=$7,description=$8,notes=$9,is_active=$10,sort_order=$11,updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [name, category || 'rent', unit || 'шт', price, price_text,
       print_options ? JSON.stringify(print_options) : null, min_hours, description, notes, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/event-services/:id', async (req, res) => {
    try { await pool.query('UPDATE event_services_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })


  // DESIGN SERVICES CRUD
  router.get('/design-services', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM design_services_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/design-services', async (req, res) => {
    const { name, work, price, price_text, description, notes, sort_order } = req.body
    try { res.json((await pool.query(
      `INSERT INTO design_services_pricing (name,work,price,price_text,description,notes,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, work, price, price_text, description, notes, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/design-services/:id', async (req, res) => {
    const { name, work, price, price_text, description, notes, is_active, sort_order } = req.body
    try { res.json((await pool.query(
      `UPDATE design_services_pricing SET name=$1,work=$2,price=$3,price_text=$4,description=$5,notes=$6,is_active=$7,sort_order=$8,updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, work, price, price_text, description, notes, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/design-services/:id', async (req, res) => {
    try { await pool.query('UPDATE design_services_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })


  // GARMENT PRINTING CRUD
  router.get('/garment-printing', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM garment_printing_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/garment-printing', async (req, res) => {
    const { name, type, unit, price_per_sqcm, min_qty, min_amount, note, sort_order } = req.body
    try { res.json((await pool.query(`INSERT INTO garment_printing_pricing (name,type,unit,price_per_sqcm,min_qty,min_amount,note,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [name, type, unit || 'кв.см', price_per_sqcm, min_qty, min_amount, note, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/garment-printing/:id', async (req, res) => {
    const { name, type, unit, price_per_sqcm, min_qty, min_amount, note, is_active, sort_order } = req.body
    try { res.json((await pool.query(`UPDATE garment_printing_pricing SET name=$1,type=$2,unit=$3,price_per_sqcm=$4,min_qty=$5,min_amount=$6,note=$7,is_active=$8,sort_order=$9,updated_at=NOW() WHERE id=$10 RETURNING *`, [name, type, unit || 'кв.см', price_per_sqcm, min_qty, min_amount, note, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/garment-printing/:id', async (req, res) => {
    try { await pool.query('UPDATE garment_printing_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  // EMBROIDERY CRUD
  router.get('/embroidery', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM embroidery_pricing WHERE is_active=true ORDER BY sort_order')).rows) }
    catch(e) { res.status(500).json({error:'Ошибка'}) }
  })
  router.post('/embroidery', async (req, res) => {
    const { name, unit, price, note, sort_order } = req.body
    try { res.json((await pool.query(`INSERT INTO embroidery_pricing (name,unit,price,note,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [name, unit || 'за 1000 стежков', price, note, sort_order||0])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.put('/embroidery/:id', async (req, res) => {
    const { name, unit, price, note, is_active, sort_order } = req.body
    try { res.json((await pool.query(`UPDATE embroidery_pricing SET name=$1,unit=$2,price=$3,note=$4,is_active=$5,sort_order=$6,updated_at=NOW() WHERE id=$7 RETURNING *`, [name, unit || 'за 1000 стежков', price, note, is_active!==false, sort_order||0, req.params.id])).rows[0]) }
    catch(e) { console.error(e); res.status(500).json({error:'Ошибка'}) }
  })
  router.delete('/embroidery/:id', async (req, res) => {
    try { await pool.query('UPDATE embroidery_pricing SET is_active=false WHERE id=$1', [req.params.id]); res.json({success:true}) }
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
