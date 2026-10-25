async function runSeed(groups = null) {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--plan')) throw Error('Допустимый параметр сида: --plan (план без подключения к БД)')
  if (args.includes('--plan')) {
    const { catalogRecords } = require('./seed-catalog-data')
    const records = catalogRecords().filter(record => !groups || groups.includes(record.group))
    const byGroup = records.reduce((result, record) => { result[record.group] = (result[record.group] || 0) + 1; return result }, {})
    console.log(JSON.stringify({ mode: 'offline-plan', databaseConnected: false, source: 'server/pricing.json',
      candidates: records.length, groups: byGroup, policy: 'Insert missing records; preserve existing IDs, custom prices and disabled rows. Apply guarded corrections and existing-record binding migrations.' }, null, 2))
    return
  }
  require('dotenv').config()
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL не задан. Укажите целевую БД явно перед запуском сида.')
  const { Pool } = require('pg')
  const { seedCatalog } = require('./seed-catalog-data')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false })
  try { console.log(JSON.stringify(await seedCatalog(pool, { groups }), null, 2)) }
  finally { await pool.end() }
}
module.exports = runSeed
