const { canvasOperations } = require('./catalog-config.json')

// Relocate existing catalog records only. Never seed rates or rewrite order snapshots.
async function relocateCanvasOperations(pool, { transaction = true } = {}) {
  const client = transaction ? await pool.connect() : pool
  const stats = { operations: 0, materials: 0 }
  try {
    if (transaction) await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('zoomsys:canvas-operations'))")
    await client.query('ALTER TABLE wide_format_pricing ADD COLUMN IF NOT EXISTS operations JSONB')
    const operations = await client.query(
      'SELECT id, name, applicable_to FROM additional_operations WHERE name = ANY($1::text[]) FOR UPDATE',
      [canvasOperations.map(operation => operation.name)]
    )
    for (const operation of operations.rows) {
      const current = operation.applicable_to || []
      const next = [...new Set([...current.filter(category => category !== 'advertising-stands'), 'wide-format'])]
      if (JSON.stringify(current) !== JSON.stringify(next)) {
        await client.query('UPDATE additional_operations SET applicable_to=$1, updated_at=NOW() WHERE id=$2',
          [JSON.stringify(next), operation.id])
        stats.operations++
      }
    }
    const keys = canvasOperations.filter(config => operations.rows.some(operation => operation.name === config.name))
      .map(operation => operation.id)
    if (keys.length) {
      const materials = await client.query(
        "SELECT id, operations FROM wide_format_pricing WHERE lower(btrim(name))='холст' AND category IN ('mimaki','roland') FOR UPDATE"
      )
      for (const material of materials.rows) {
        // null means the legacy unrestricted operation list; keep that behavior.
        if (!Array.isArray(material.operations)) continue
        const next = [...material.operations]
        for (const key of keys) {
          const ids = operations.rows.filter(operation => operation.name === canvasOperations.find(config => config.id === key).name)
            .map(operation => String(operation.id))
          if (!next.some(id => String(id) === key || ids.includes(String(id)))) next.push(key)
        }
        if (JSON.stringify(next) !== JSON.stringify(material.operations)) {
          await client.query('UPDATE wide_format_pricing SET operations=$1, updated_at=NOW() WHERE id=$2',
            [JSON.stringify(next), material.id])
          stats.materials++
        }
      }
    }
    if (transaction) await client.query('COMMIT')
    return stats
  } catch (error) {
    if (transaction) await client.query('ROLLBACK')
    throw error
  } finally {
    if (transaction) client.release()
  }
}

module.exports = relocateCanvasOperations

if (require.main === module) {
  require('dotenv').config()
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан')
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false })
  relocateCanvasOperations(pool).then(result => console.log(result))
    .catch(error => { console.error(error); process.exitCode = 1 }).finally(() => pool.end())
}
