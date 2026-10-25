import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import { getCanvasOperationKey, getStateSymbolName, isCanvasMaterial } from '../src/lib/catalog.mjs'
const require = createRequire(import.meta.url)
const { parse } = require('@babel/parser')
const { catalogRecords, seedCatalog } = require('../server/seed-catalog-data')
const source = require('../server/pricing.json')
const corrections = require('../server/price-corrections-2026.json').updates
const jsonColumns = new Set(['prices','specification','sides','materials','operations','print_options','product_options','options','applicable_to'])
const decode = (column, value) => jsonColumns.has(column) && typeof value === 'string' ? JSON.parse(value) : value
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// Executes the actual seed/API functions. The database boundary is deliberately in memory;
// no credentials, real database or user orders are accessed by this test.
function database() {
  let tables = {}; let backup; let nextId = 100
  const calls = []; let released = 0
  const db = { calls, get tables() { return tables }, get released() { return released }, failOn: null,
    async connect() { return { query: db.query, release() { released++ } } },
    async query(sql, args = []) {
      calls.push(sql)
      if (db.failOn && sql.includes(db.failOn)) throw Error('injected seed failure')
      if (sql === 'BEGIN') { backup = structuredClone(tables); return { rows: [] } }
      if (sql === 'ROLLBACK') { tables = backup; return { rows: [] } }
      if (sql === 'COMMIT' || sql.startsWith('ALTER') || sql.startsWith('SELECT pg_advisory')) return { rows: [] }
      const table = sql.match(/(?:FROM|INTO|UPDATE) (\w+)/)?.[1]
      const rows = tables[table] ||= []
      if (sql.startsWith('INSERT')) {
        const columns = sql.match(/\(([^)]+)\) VALUES/)[1].split(',').map(s => s.trim())
        rows.push({ id: nextId++, is_active: true, ...Object.fromEntries(columns.map((key, i) => [key, decode(key, args[i])])) })
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes('IS NOT DISTINCT FROM')) {
        const keys = [...sql.matchAll(/(\w+) IS NOT DISTINCT FROM \$(\d+)/g)]
        return { rows: rows.filter(row => keys.every(([, key, index]) => same(row[key], args[Number(index) - 1]))) }
      }
      if (sql.startsWith('SELECT id, name, applicable_to')) return { rows: rows.filter(row => args[0].includes(row.name)) }
      if (sql.startsWith('SELECT id, operations')) return { rows: rows.filter(row => row.name.trim().toLowerCase() === 'холст' && ['mimaki','roland'].includes(row.category)) }
      if (sql.startsWith('SELECT *')) return { rows: rows.filter(row => !sql.includes('is_active=true') || row.is_active) }
      if (sql.startsWith('UPDATE')) {
        let matches = [], change
        if (sql.includes('substring(name')) {
          matches = rows.filter(row => row.category === 'signs' && args[2].includes(row.name))
          change = row => { row.name = args[0] + row.name.slice(args[1].length) }
        } else if (sql.includes('product_options IS NULL') && sql.includes('name=$2')) {
          matches = rows.filter(row => row.name === args[1] && row.type === args[2] && row.product_options == null)
          change = row => { row.product_options = JSON.parse(args[0]) }
        } else if (sql.includes('id=ANY')) {
          const column = sql.match(/SET (\w+)=/)[1]
          matches = rows.filter(row => args[1].includes(row.id) && row[column] == null)
          change = row => { row[column] = decode(column, args[0]) }
        } else if (sql.includes('prices=$1') || sql.includes('roll_width=$1')) {
          const column = sql.includes('roll_width=$1') ? 'roll_width' : 'prices'
          const key = table === 'business_cards_pricing' ? 'color_type' : table === 'wide_format_pricing' ? 'category' : null
          matches = rows.filter(row => row.name === args[1] && (!key || row[key] === args[2]) && same(row[column], decode(column, args.at(-1))))
          change = row => { row[column] = decode(column, args[0]) }
        } else if (sql.includes('WHERE id=$2')) {
          const column = sql.match(/SET (\w+)=/)[1]
          matches = rows.filter(row => row.id === args[1]); change = row => { row[column] = decode(column, args[0]) }
        } else throw Error('Unexpected update: ' + sql)
        matches.forEach(change)
        return { rows: matches.map(row => ({ id: row.id })), rowCount: matches.length }
      }
      throw Error('Unexpected query: ' + sql)
    } }
  return db
}

test('full catalog seed creates every supported source record once; reruns preserve IDs, tariffs and disabled rows', async () => {
  const db = database()
  const first = await seedCatalog(db)
  assert.equal(first.inserted, catalogRecords().length)
  assert.equal(db.tables.wide_format_pricing.some(row => row.category === 'phaeton'), false)
  const card = db.tables.business_cards_pricing[0]; card.prices['50to99'] = 999; card.is_active = false
  const mug = db.tables.garment_printing_pricing.find(row => row.type === 'sublimation'); mug.price_per_sqcm = 42
  db.tables.printing_pricing.find(row => row.category === 'notebooks').color_type = 'legacy'
  const before = structuredClone(db.tables)
  const second = await seedCatalog(db)
  assert.equal(second.inserted, 0); assert.equal(second.preserved, catalogRecords().length)
  assert.deepEqual(db.tables, before)
  assert.equal(db.calls.filter(sql => sql === 'BEGIN').length, 2)
  assert.equal(db.calls.filter(sql => sql === 'COMMIT').length, 2)
  assert.equal(db.released, 2)
})

test('existing sign and canvas IDs are reused, missing roll metadata is filled and manager tariffs remain intact', async () => {
  const db = database(); await seedCatalog(db)
  const signs = db.tables.state_symbols_pricing.filter(row => row.category === 'signs')
  signs.forEach(row => { row.name = row.name.replace('Ведомственная табличка', 'Вывеска'); row.price = 123456 })
  const canvas = db.tables.additional_operations.find(row => row.name === 'Натяжка холста')
  canvas.price = 4321; canvas.applicable_to = ['advertising-stands']
  const vinyl = db.tables.wide_format_pricing.find(row => row.category === 'roland' && row.name.startsWith('Винил 4 прохода'))
  vinyl.roll_width = null; vinyl.prices.upTo50 = 6789
  const existingIds = { signs: signs.map(row => row.id), canvas: canvas.id, vinyl: vinyl.id }
  const result = await seedCatalog(db)
  assert.equal(result.inserted, 0); assert.equal(result.signsRenamed, 2)
  assert.ok(signs.every(row => row.name.startsWith('Ведомственная табличка') && row.price === 123456))
  assert.deepEqual(signs.map(row => row.id), existingIds.signs)
  assert.deepEqual(canvas.applicable_to, ['wide-format']); assert.equal(canvas.price, 4321); assert.equal(canvas.id, existingIds.canvas)
  assert.equal(vinyl.roll_width, 1.2); assert.equal(vinyl.prices.upTo50, 6789); assert.equal(vinyl.id, existingIds.vinyl)
})

test('known old PDF tariffs are corrected once, custom rates are preserved; all seed writes roll back on failure', async () => {
  const db = database(); await seedCatalog(db)
  const correction = corrections.find(change => change.table === 'business_cards_pricing')
  const card = db.tables.business_cards_pricing.find(row => row.name === correction.name && row.color_type === correction.colorType)
  card.prices = structuredClone(correction.before)
  assert.equal((await seedCatalog(db)).priceCorrections.updated, 1)
  assert.deepEqual(card.prices, correction.after)
  const before = structuredClone(db.tables)
  db.failOn = 'INSERT INTO textile_pricing'
  db.tables.textile_pricing = []
  const baseline = structuredClone(db.tables)
  await assert.rejects(seedCatalog(db), /injected seed failure/)
  assert.deepEqual(db.tables, baseline)
  assert.equal(db.calls.at(-1), 'ROLLBACK')
  assert.ok(before.textile_pricing.length > 0)
})

test('real price API and provider consume seeded numeric IDs, mug variants, tariffs, roll metadata and canvas bindings', async () => {
  assert.deepEqual(require('../src/data/pricing.json'), source)
  const db = database(); await seedCatalog(db)
  const router = require('../server/routes/pricing.js')(db)
  const get = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.get).route.stack[0].handle
  let data
  await get({}, { json(value) { data = value }, status(code) { throw Error('API status ' + code) } })
  const provider = fs.readFileSync(new URL('../src/hooks/usePricing.jsx', import.meta.url), 'utf8')
  const tree = parse(provider, { sourceType: 'module', plugins: ['jsx'] }); let expression
  function walk(value) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) return value.forEach(walk)
    if (value.type === 'VariableDeclarator' && value.id.name === 'formattedData') expression = value.init
    Object.values(value).forEach(walk)
  }
  walk(tree)
  const formatted = vm.runInNewContext('(' + provider.slice(expression.start, expression.end) + ')', { data, getStateSymbolName })
  const mug = formatted.garmentPrinting.find(row => row.type === 'sublimation')
  assert.equal(mug.pricePerSqCm, 20)
  assert.deepEqual(Array.from(mug.productOptions.find(row => row.id === 'mugs').variants, row => row.name), ['Кружка белая','Кружка перламутровая'])
  const vinyl = formatted.wideFormat.find(row => row.category === 'roland' && row.name.startsWith('Винил 4 прохода'))
  assert.equal(vinyl.rollWidth, 1.2); assert.equal(vinyl.wasteMargin, 0.2); assert.equal(vinyl.prices.upTo50, 4500)
  const canvasOps = Object.values(formatted.additionalOperations).filter(getCanvasOperationKey)
  assert.equal(canvasOps.length, 2)
  assert.ok(canvasOps.every(row => /^\d+$/.test(row.id) && row.applicableTo.includes('wide-format') && !row.applicableTo.includes('advertising-stands')))
  assert.equal(formatted.wideFormat.filter(isCanvasMaterial).length, 2)
  for (const material of formatted.wideFormat.filter(isCanvasMaterial)) {
    assert.ok(material.operations.includes('canvasStretch')); assert.ok(material.operations.includes('subframe'))
  }
  const stitch = Object.values(formatted.additionalOperations).find(row => row.name === 'Прошивка флага')
  assert.equal(stitch.prices.upTo500, 750); assert.equal(stitch.prices.over500, 'договорная')
  assert.deepEqual(data.businessCards.find(row => /бейдж/i.test(row.name)).prices, {})
  assert.ok(formatted.stateSymbols.filter(row => row.category === 'signs').every(row => row.name.startsWith('Ведомственная табличка')))
})
