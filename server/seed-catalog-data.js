const pricing = require('./pricing.json')
const renameSigns = require('./rename-departmental-signs')
const relocateCanvas = require('./relocate-canvas-operations')
const correctPrices = require('./apply-price-corrections')
const { configureGarmentProducts } = require('./garment-products')
const { disabledWideFormatGroups } = require('./catalog-config.json')

const json = value => value == null ? null : JSON.stringify(value)
const amount = value => typeof value === 'number' ? value : null
const priceText = value => typeof value === 'string' ? value : null

// SQL identifiers and natural keys are defined here, never accepted from CLI input.
// Existing rows are preserved, including disabled records and manager-edited prices.
function catalogRecords(data = pricing) {
  const records = []
  function add(group, table, keys, values, fill = []) {
    records.push({ group, table, keys, values, fill })
  }
  add('settings', 'pricing_settings', ['id'], { id: 1, urgent_surcharge: data.settings.urgentSurcharge })
  for (const [sort_order, it] of (data.businessCards || []).entries())
    add('businessCards', 'business_cards_pricing', ['name', 'color_type'], {
      name: it.name, color_type: it.colorType, prices: json(it.prices), sort_order })
  let printOrder = 0
  for (const it of data.printing || []) {
    const colors = it.colorTypes || [{ type: it.colorType ?? null, prices: it.prices }]
    for (const color of colors) add('printing', 'printing_pricing', it.category === 'notebooks' ? ['category', 'name'] : ['category', 'name', 'color_type'], {
      category: it.category, name: it.name, color_type: color.type, prices: json(color.prices),
      specification: json(it.specification), sort_order: printOrder++ }, ['specification'])
  }
  for (const [sort_order, it] of (data.uvPrinting || []).entries())
    add('uvPrinting', 'uv_printing_pricing', ['category', 'name'], { category: it.category, name: it.name,
      description: it.description ?? null, sides: json(it.sides), materials: json(it.materials), price_type: it.priceType ?? null, sort_order })
  for (const group of ['wideFormat', 'textile']) {
    const table = group === 'wideFormat' ? 'wide_format_pricing' : 'textile_pricing'
    for (const [sort_order, it] of (data[group] || []).entries()) {
      // Retain historic Phaeton records; do not introduce disabled equipment in a new DB.
      if (group === 'wideFormat' && disabledWideFormatGroups.includes(it.category)) continue
      const values = { name: it.name, price_per_sqm: it.pricePerSqm ?? null, category: it.category ?? null,
        unit: it.unit ?? 'м²', prices: json(it.prices), description: it.description ?? null, notes: it.notes ?? null, sort_order }
      if (group === 'wideFormat') Object.assign(values, { roll_width: it.rollWidth ?? null, waste_price: it.wastePrice ?? null,
        waste_margin: it.wasteMargin ?? 0.2, glue_allowed: !!it.glueAllowed, operations: json(it.operations) })
      add(group, table, ['name', 'category'], values, group === 'wideFormat' ? ['roll_width', 'waste_price', 'waste_margin'] : [])
    }
  }
  for (const [sort_order, it] of (data.flagsProducts || []).entries())
    add('flagsProducts', 'flags_products_pricing', ['name', 'category'], { name: it.name, category: it.category ?? null,
      unit: it.unit ?? 'шт', price: it.price ?? null, prices: json(it.prices), description: it.description ?? null, notes: it.notes ?? null, sort_order })
  for (const [sort_order, it] of (data.advertisingStands || []).entries())
    add('advertisingStands', 'advertising_stands_pricing', ['name'], { name: it.name, type: it.type ?? 'fixed', unit: it.unit ?? 'шт',
      price: it.price ?? null, prices: json(it.prices), description: it.description ?? null, notes: it.notes ?? null, sort_order })
  for (const [sort_order, it] of (data.cncLaser || []).entries())
    add('cncLaser', 'cnc_laser_pricing', ['name', 'category'], { name: it.name, category: it.category ?? null, unit: it.unit ?? 'пог.м',
      type: it.type ?? null, material: it.material ?? null, price: it.price ?? null, prices: json(it.prices),
      description: it.description ?? null, notes: it.notes ?? null, sort_order })
  for (const [sort_order, it] of (data.plotterCutting || []).entries())
    add('plotterCutting', 'plotter_cutting_pricing', ['material', 'operation'], { material: it.material, operation: it.operation,
      unit: it.unit ?? 'м²', price: amount(it.price), price_text: priceText(it.price), description: it.description ?? null, notes: it.notes ?? null, sort_order })
  for (const [sort_order, it] of (data.eventServices || []).entries())
    add('eventServices', 'event_services_pricing', ['name', 'category'], { name: it.name, category: it.category ?? 'rent', unit: it.unit ?? 'шт',
      price: amount(it.price), price_text: priceText(it.price) ?? it.price_text ?? null, print_options: json(it.printOptions),
      min_hours: it.minHours ?? null, description: it.description ?? null, notes: it.notes ?? null, sort_order })
  for (const [sort_order, it] of (data.designServices || []).entries())
    add('designServices', 'design_services_pricing', ['name', 'work'], { name: it.name, work: it.work ?? null,
      price: amount(it.price), price_text: priceText(it.price) ?? it.priceText ?? null, description: it.description ?? null, notes: it.notes ?? null, sort_order })
  for (const [sort_order, it] of (data.garmentPrinting || []).entries())
    add('garmentPrinting', 'garment_printing_pricing', ['name'], { name: it.name, type: it.type ?? null, unit: it.unit ?? 'кв.см',
      price_per_sqcm: it.pricePerSqCm, min_qty: it.minQty ?? null, min_amount: it.minAmount ?? null, note: it.note ?? null,
      product_options: json(it.productOptions), sort_order }, ['product_options'])
  for (const [sort_order, it] of (data.embroidery || []).entries())
    add('embroidery', 'embroidery_pricing', ['name'], { name: it.name, unit: it.unit ?? 'за 1000 стежков', price: it.price, note: it.note ?? null, sort_order })
  for (const [sort_order, it] of (data.stateSymbols || []).entries())
    add('stateSymbols', 'state_symbols_pricing', ['category', 'name', 'option'], {
      category: it.category, name: it.name, option: it.option ?? null, price: it.price, sort_order })
  for (const [sort_order, it] of (data.additionalServices || []).entries())
    add('additionalServices', 'additional_services', ['name'], { name: it.name, price: amount(it.price), price_text: priceText(it.price),
      unit: it.unit ?? null, category: it.category ?? null, description: it.description ?? null,
      applicable_to: json(it.applicableTo ?? ['all']), sort_order })
  for (const [sort_order, it] of Object.values(data.additionalOperations || {}).entries())
    add('additionalOperations', 'additional_operations', ['name'], { name: it.name, operation_type: it.type ?? null,
      applicable_to: json(it.applicableTo ?? ['all']), options: json(it.options), price: it.price ?? null, prices: json(it.prices),
      unit: it.unit ?? null, description: it.description ?? null, default_quantity: it.defaultQuantity ?? null,
      step_mode: !!it.stepMode, step_unit: it.stepUnit ?? null, sort_order })
  for (const [sort_order, it] of (data.reorderOptions || []).entries())
    add('reorderOptions', 'reorder_options', ['name'], { name: it.name ?? it.label, discount_percent: it.discountPercent ?? 0, sort_order })
  return records
}

async function insertMissing(client, record) {
  const { table, keys, values, fill } = record
  const where = keys.map((key, index) => `${key} IS NOT DISTINCT FROM $${index + 1}`).join(' AND ')
  const existing = await client.query(`SELECT id FROM ${table} WHERE ${where} ORDER BY id FOR UPDATE`, keys.map(key => values[key]))
  if (existing.rows.length) {
    for (const column of fill) if (values[column] != null) await client.query(
      `UPDATE ${table} SET ${column}=$1${['specification', 'product_options'].includes(column) ? '::jsonb' : ''}, updated_at=NOW() WHERE id=ANY($2::int[]) AND ${column} IS NULL`,
      [values[column], existing.rows.map(row => row.id)])
    return 'preserved'
  }
  const columns = Object.keys(values)
  await client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(values))
  return 'inserted'
}

async function seedCatalog(pool, { groups = null, data = pricing } = {}) {
  const records = catalogRecords(data).filter(record => !groups || groups.includes(record.group))
  const client = await pool.connect()
  const stats = { inserted: 0, preserved: 0, groups: {} }
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('zoomsys:catalog-seed'))")
    // Obtain migration locks before any row/DDL locks; standalone migrations use these too.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('zoomsys:canvas-operations'))")
    await client.query("SELECT pg_advisory_xact_lock(hashtext('zoomsys:price-corrections-2026'))")
    if (records.some(record => record.group === 'printing')) await client.query('SELECT pg_advisory_xact_lock(20260850)')
    // Run `npm run migrate` first. These columns also support an existing pre-update schema.
    await client.query('ALTER TABLE garment_printing_pricing ADD COLUMN IF NOT EXISTS product_options JSONB')
    await client.query('ALTER TABLE printing_pricing ADD COLUMN IF NOT EXISTS specification JSONB')
    await client.query('ALTER TABLE additional_operations ADD COLUMN IF NOT EXISTS step_mode BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS step_unit TEXT')
    await client.query(`ALTER TABLE wide_format_pricing ADD COLUMN IF NOT EXISTS roll_width NUMERIC,
      ADD COLUMN IF NOT EXISTS waste_price NUMERIC, ADD COLUMN IF NOT EXISTS waste_margin NUMERIC DEFAULT 0.2,
      ADD COLUMN IF NOT EXISTS glue_allowed BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS operations JSONB`)
    // Rename before matching source names, so old sign IDs are reused instead of duplicated.
    stats.signsRenamed = records.some(record => record.group === 'stateSymbols') ? await renameSigns(client) : 0
    stats.priceCorrections = await correctPrices(client, { transaction: false, tables: [...new Set(records.map(record => record.table))] })
    for (const record of records) {
      const result = await insertMissing(client, record)
      stats[result]++
      const group = stats.groups[record.group] ||= { inserted: 0, preserved: 0 }
      group[result]++
    }
    stats.garmentOptions = records.some(record => record.group === 'garmentPrinting') ? await configureGarmentProducts(client) : 0
    stats.canvas = records.some(record => ['wideFormat', 'additionalOperations'].includes(record.group))
      ? await relocateCanvas(client, { transaction: false }) : { operations: 0, materials: 0 }
    await client.query('COMMIT')
    return stats
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

module.exports = { catalogRecords, insertMissing, seedCatalog }
