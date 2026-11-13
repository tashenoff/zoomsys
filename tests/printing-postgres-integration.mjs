import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createRequire } from 'node:module'
import { calculateSheetQuote } from '../src/lib/sheetPricing.mjs'
const require = createRequire(import.meta.url)
const { Client, Pool } = require('pg')
const ordersRouter = require('../server/routes/orders.js')
const enabled = process.env.PRINTING_QA_POSTGRES === '1'

// Opt-in only: never loads dotenv or DATABASE_URL. Requires a dedicated localhost
// PostgreSQL engine whose data_directory identity is explicitly verified before writes.
// Provision database printing_qa owned by printing_qa in an ISOLATED cluster first.
// PRINTING_QA_POSTGRES=1 PRINTING_QA_PG_DATA_DIRECTORY=<absolute isolated data dir>
// PRINTING_QA_PG_PORT=55473 node --test tests/printing-postgres-integration.mjs
// For Docker set PRINTING_QA_PG_SERVER_ADDRESS to the verified container IP.
// Optional PRINTING_QA_PG_PASSWORD is for that synthetic test account only.
// Money totals and JSONB snapshots must retain their exact calculator values.
// Averaged unit price is stored separately with the schema's two-decimal precision.
test('isolated real PostgreSQL: sheet order snapshots, amounts, validation and rollback', { skip: !enabled }, async () => {
  const expectedDataDirectory = process.env.PRINTING_QA_PG_DATA_DIRECTORY
  assert.ok(expectedDataDirectory, 'Explicit isolated data_directory identity is required')
  const port = Number(process.env.PRINTING_QA_PG_PORT || 55473)
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535 && port !== 5432, 'Use a dedicated non-default local port')
  const client = new Client({ host: '127.0.0.1', port, user: 'printing_qa', database: 'printing_qa', password: process.env.PRINTING_QA_PG_PASSWORD || 'printing-qa-local-only', ssl: false, connectionTimeoutMillis: 3000 })
  let schemaCreated = false
  let pool
  const schema = `printing_qa_${process.pid}_${Date.now()}`
  try {
    await client.connect()
    const identity = (await client.query("SELECT current_database() AS database, current_user AS username, host(inet_server_addr()) AS address, inet_server_port() AS port, current_setting('data_directory') AS data_directory")).rows[0]
    assert.equal(identity.database, 'printing_qa')
    assert.equal(identity.username, 'printing_qa')
    assert.equal(identity.address, process.env.PRINTING_QA_PG_SERVER_ADDRESS || '127.0.0.1')
    assert.equal(identity.port, port)
    const normalized = value => value.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase()
    assert.equal(normalized(identity.data_directory), normalized(expectedDataDirectory), 'Wrong cluster: refusing all writes')
    assert.match(normalized(expectedDataDirectory), /printing[-_]pg[-_]isolated/, 'Expected explicitly isolated QA data directory')
    const existing = await client.query("SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")
    assert.equal(existing.rows.length, 0, 'Dedicated empty QA database required; refusing to write into existing application data')
    console.log(`Verified isolated PostgreSQL: ${identity.address}:${identity.port}/${identity.database}`)
    await client.query(`CREATE SCHEMA ${schema}`); schemaCreated = true
    await client.query(`SET search_path TO ${schema}`)
    pool = new Pool({ host: '127.0.0.1', port, user: 'printing_qa', database: 'printing_qa', password: process.env.PRINTING_QA_PG_PASSWORD || 'printing-qa-local-only', ssl: false, options: `-c search_path=${schema}`, connectionTimeoutMillis: 3000 })
    const migration = fs.readFileSync(new URL('../server/migrate.js', import.meta.url), 'utf8')
    for (const table of ['clients', 'orders', 'order_items']) {
      // Match the full migration template rather than terminate on NUMERIC(...) etc.
      const start = migration.indexOf('CREATE TABLE IF NOT EXISTS ' + table + ' (')
      assert.ok(start >= 0, `Migration table missing: ${table}`)
      const end = migration.indexOf('`)', start)
      assert.ok(end > start)
      await client.query(migration.slice(start, end))
    }
    const syntheticClient = (await client.query("INSERT INTO clients (name) VALUES ('Synthetic printing QA only') RETURNING id")).rows[0].id
    const router = ordersRouter(pool)
    async function route(method, routePath, input) {
      const handler = router.stack.find(layer => layer.route?.path === routePath && layer.route.methods[method]).route.stack[0].handle
      const response = { statusCode: 200, status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } }
      await handler(input, response)
      return response
    }
    const makeQuote = kind => calculateSheetQuote({ kind, quantity: 13, width: 90, height: 60, sheetFormat: 'A3', pages: ['hangers','booklets'].includes(kind) ? 2 : 3, colorType: '4+4', paper: { id: 'synthetic', name: 'QA paper', density: 120, rate: 2 }, printRate: 4.25, urgentSurcharge: 30, isUrgent: true, discount: 10, operations: kind === 'hangers' ? [{ id: 'graphtec', kind: 'graphtec', name: 'Graphtec', rate: 8, unit: 'sheet' }] : [{ id: 'cut', name: 'Cutting', unit: 'sheet', rate: 1 }] })
    const bodyFor = (kind, quote) => ({ client_id: syntheticClient, category: kind === 'badges' ? 'badges' : 'printing', total_amount: quote.total, items: [{ product_name: `QA ${kind}`, quantity: quote.quantity, unit_price: quote.total / quote.quantity, total_price: quote.total, specifications: quote }] })
    for (const kind of ['badges', 'flyers', 'booklets', 'custom', 'hangers']) {
      const quote = makeQuote(kind)
      const created = await route('post', '/', { body: bodyFor(kind, quote) })
      assert.equal(created.statusCode, 200, `${kind}: ${JSON.stringify(created.body)}`)
      const read = await route('get', '/:id', { params: { id: created.body.id } })
      assert.equal(read.statusCode, 200)
      assert.equal(Number(read.body.total_amount), quote.total)
      assert.equal(read.body.items.length, 1)
      assert.equal(read.body.items[0].quantity, quote.quantity)
      assert.equal(Number(read.body.items[0].total_price), quote.total)
      assert.equal(Number(read.body.items[0].unit_price), Number((quote.total / quote.quantity).toFixed(2)))
      assert.deepEqual(read.body.items[0].specifications, quote)
      console.log(`PASS actual INSERT/GET/JSONB readback: ${kind}`)
    }
    const before = (await client.query('SELECT COUNT(*)::int AS count FROM orders')).rows[0].count
    for (const mutate of [body => { body.total_amount = -1 }, body => { body.items[0].quantity = 0 }, body => { body.items[0].specifications.sheetCalculation.sheets++ }]) {
      const body = bodyFor('badges', makeQuote('badges')); mutate(body)
      assert.equal((await route('post', '/', { body })).statusCode, 400)
    }
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM orders')).rows[0].count, before)
    const manualSnapshot = { productType: 'badges', pricingMode: 'manual', manualBatchTotal: 100, baseTotal: 100, unitPrice: 10 }
    const manual = await route('post', '/', { body: { client_id: syntheticClient, category: 'badges', total_amount: 100, items: [{ product_name: 'QA manual badges', quantity: 10, unit_price: 10, total_price: 100, specifications: manualSnapshot }] } })
    assert.equal(manual.statusCode, 200)
    const manualRead = await route('get', '/:id', { params: { id: manual.body.id } })
    assert.deepEqual(manualRead.body.items[0].specifications, manualSnapshot)
    assert.equal(manualRead.body.items[0].quantity, 10)
    // Force a genuine SQL error after parent insertion: INTEGER rejects fractional
    // service quantities. A correct route must roll back the parent as well.
    const beforeFailure = (await client.query('SELECT COUNT(*)::int AS count FROM orders')).rows[0].count
    const failed = await route('post', '/', { body: { category: 'cnc-laser', total_amount: 150, items: [{ product_name: 'QA fractional CNC', quantity: 1.5, unit_price: 100, total_price: 150, specifications: {} }] } })
    assert.equal(failed.statusCode, 500, 'Current INTEGER schema should reject fractional service quantity')
    assert.equal((await client.query('SELECT COUNT(*)::int AS count FROM orders')).rows[0].count, beforeFailure, 'Failed item INSERT left orphan parent order')
    // Delete an earlier order, then ensure subsequent number does not collide.
    await route('delete', '/:id', { params: { id: manual.body.id - 1 } })
    const next = await route('post', '/', { body: bodyFor('badges', makeQuote('badges')) })
    assert.equal(next.statusCode, 200, 'Order numbering collided after deletion')
    await client.query("INSERT INTO orders(order_number,category,total_amount) VALUES ('CUSTOM-HISTORICAL-QA','badges',0)")
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => route('post', '/', { body: bodyFor('flyers', makeQuote('flyers')) })))
    assert.ok(concurrent.every(response => response.statusCode === 200), 'Concurrent order create failed')
    assert.equal(new Set(concurrent.map(response => response.body.order_number)).size, 4, 'Concurrent order number collision')
    await pool.end(); pool = null
    await client.query('SET search_path TO public')
    await client.query(`DROP SCHEMA ${schema} CASCADE`); schemaCreated = false
    assert.equal((await client.query('SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1) AS exists', [schema])).rows[0].exists, false)
    assert.equal((await client.query("SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")).rows.length, 0)
    console.log('PASS invalid payloads, manual badges, failed-insert rollback, numbering after deletion/concurrent creation, and isolated schema cleanup')
  } finally {
    if (pool) await pool.end()
    if (schemaCreated) await client.query(`DROP SCHEMA ${schema} CASCADE`)
    await client.end()
  }
})


