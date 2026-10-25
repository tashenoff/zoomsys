const corrections = require('./price-corrections-2026.json').updates

// Only replace the known legacy values. Preserve any price a manager has since edited.
async function applyPriceCorrections(pool, { transaction = true, tables = null } = {}) {
  const client = transaction ? await pool.connect() : pool
  const result = { updated: 0, unchanged: [] }
  try {
    if (transaction) await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('zoomsys:price-corrections-2026'))")
    for (const change of corrections) {
      if (tables && !tables.includes(change.table)) continue
      let response
      if (change.table === 'business_cards_pricing') response = await client.query(
        `UPDATE business_cards_pricing SET prices=$1, updated_at=NOW() WHERE name=$2 AND color_type=$3 AND prices=$4::jsonb RETURNING id`,
        [JSON.stringify(change.after), change.name, change.colorType, JSON.stringify(change.before)])
      else if (change.table === 'additional_operations') response = await client.query(
        `UPDATE additional_operations SET prices=$1, updated_at=NOW() WHERE name=$2 AND prices=$3::jsonb RETURNING id`,
        [JSON.stringify(change.after), change.name, JSON.stringify(change.before)])
      else response = await client.query(
        `UPDATE wide_format_pricing SET roll_width=$1, updated_at=NOW() WHERE name=$2 AND category=$3 AND roll_width=$4 RETURNING id`,
        [change.after, change.name, change.category, change.before])
      result.updated += response.rowCount
      if (!response.rowCount) result.unchanged.push(change.name)
    }
    if (transaction) await client.query('COMMIT')
    return result
  } catch (error) { if (transaction) await client.query('ROLLBACK'); throw error }
  finally { if (transaction) client.release() }
}
module.exports = applyPriceCorrections
if (require.main === module) {
  require('dotenv').config()
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL не задан')
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false })
  applyPriceCorrections(pool).then(console.log).catch(error => { console.error(error); process.exitCode = 1 }).finally(() => pool.end())
}
