function validateProductOptions(options) {
  if (options == null) return null
  if (!Array.isArray(options)) return 'Изделия должны быть списком'
  const ids = new Set()
  for (const option of options) {
    if (!option || typeof option.id !== 'string' || !option.id.trim() || ids.has(option.id)
      || typeof option.name !== 'string' || !option.name.trim()) return 'Укажите уникальные изделия и их названия'
    ids.add(option.id)
    if (option.variants != null) {
      if (!Array.isArray(option.variants)) return 'Варианты изделия должны быть списком'
      const variantIds = new Set()
      for (const variant of option.variants) {
        if (!variant || typeof variant.id !== 'string' || !variant.id.trim() || variantIds.has(variant.id)
          || typeof variant.name !== 'string' || !variant.name.trim()) return 'Укажите уникальные варианты и их названия'
        variantIds.add(variant.id)
      }
    }
  }
  return null
}

async function configureGarmentProducts(pool) {
  await pool.query('ALTER TABLE garment_printing_pricing ADD COLUMN IF NOT EXISTS product_options JSONB')
  const { garmentPrinting } = require('./pricing.json')
  let updated = 0
  for (const item of garmentPrinting.filter(item => item.productOptions?.length)) {
    const result = await pool.query(
      `UPDATE garment_printing_pricing SET product_options=$1, updated_at=NOW()
       WHERE name=$2 AND type=$3 AND product_options IS NULL`,
      [JSON.stringify(item.productOptions), item.name, item.type]
    )
    updated += result.rowCount
  }
  return updated
}

module.exports = { validateProductOptions, configureGarmentProducts }

if (require.main === module) {
  require('dotenv').config()
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false })
  configureGarmentProducts(pool).then(updated => console.log({ updated }))
    .catch(error => { console.error(error); process.exitCode = 1 }).finally(() => pool.end())
}
