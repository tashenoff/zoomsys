const { displayNames } = require('./catalog-config.json')

async function renameDepartmentalSigns(pool) {
  // Only the existing 600×800 state-symbol product; no broad renaming of signage or order history.
  const result = await pool.query(
    `UPDATE state_symbols_pricing
     SET name=$1 || substring(name FROM char_length($2) + 1), updated_at=NOW()
     WHERE category='signs' AND name = ANY($3::text[])`,
    [displayNames.signs, 'Вывеска', [
      'Вывеска 600×800 мм, ПВХ, голубая пленка, плоттерная резка, герб 125 мм',
      'Вывеска 600×800 мм, ПВХ, накладные буквы акрил золото, герб 125 мм'
    ]]
  )
  return result.rowCount
}

module.exports = renameDepartmentalSigns

if (require.main === module) {
  require('dotenv').config()
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false })
  renameDepartmentalSigns(pool).then(count => console.log({ renamed: count }))
    .catch(error => { console.error(error); process.exitCode = 1 }).finally(() => pool.end())
}
