// Transaction + advisory lock make repeated/concurrent imports safe without
// imposing uniqueness on unrelated legacy printing rows.
async function seedMultipage(pool, items) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(20260850)")
    for (const item of items.filter(p => p.category === 'notebooks')) {
      const existing = await client.query('SELECT id FROM printing_pricing WHERE category=$1 AND name=$2 ORDER BY id', [item.category, item.name])
      if (existing.rows.length) {
        // Keep prices edited by an administrator; fill only missing metadata.
        await client.query('UPDATE printing_pricing SET specification=COALESCE(specification,$1::jsonb),updated_at=NOW() WHERE id=ANY($2::int[])', [JSON.stringify(item.specification), existing.rows.map(r => r.id)])
      } else {
        await client.query('INSERT INTO printing_pricing (category,name,color_type,prices,specification,sort_order) VALUES ($1,$2,$3,$4,$5,$6)', [item.category,item.name,null,JSON.stringify(item.prices),JSON.stringify(item.specification),0])
      }
    }
    await client.query('COMMIT')
  } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
}
module.exports = seedMultipage
