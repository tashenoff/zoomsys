import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import { calculateSheetQuote } from '../src/lib/sheetPricing.mjs'
const require = createRequire(import.meta.url)
const { transformSync } = require('esbuild')
const policy = require('../server/catalog-policy.js')
const makeQuote = (overrides = {}) => calculateSheetQuote({ kind: 'badges', quantity: 13, width: 90, height: 60, sheetFormat: 'A3', pages: 3, colorType: '4+4', paper: { id: 'live', name: 'Paper', density: 120, rate: 2 }, printRate: 3, urgentSurcharge: 30, isUrgent: true, discount: 10, operations: [{ id: 'cut', name: 'Cutting', unit: 'sheet', rate: 1 }], ...overrides })
const bodyFor = quote => ({ category: 'badges', total_amount: quote.total, items: [{ product_name: 'Badges', quantity: quote.quantity, unit_price: quote.total / quote.quantity, total_price: quote.total, specifications: quote }] })
function runtime(online = true, persist) {
  const calls = [], storage = new Map(), module = { exports: {} }
  let cursor = 0
  const states = [[], false, null, online]
  const react = { ...require('react'), useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }] }, useEffect() {}, useCallback(fn) { return fn } }
  const source = fs.readFileSync(new URL('../src/hooks/useOrders.jsx', import.meta.url), 'utf8')
  vm.runInNewContext(transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code, { module, exports: module.exports, structuredClone, console: { error() {}, warn() {} }, localStorage: { setItem(k,v) { storage.set(k,v) }, getItem(k) { return storage.get(k) } }, require(name) { if (name === 'react') return react; if (name.includes('jsx-runtime')) return require(name); return { default: { async createOrder(body) { calls.push(body); if (persist) return persist(body); return { id: 123, order_number: 'TEST', created_at: 'now' } } }, __esModule: true } } })
  return { calls, storage, exports: module.exports, provider: () => { cursor = 0; return module.exports.OrdersProvider({ children: null }).props.value } }
}
async function post(body) {
  const queries = []
  const router = require('../server/routes/orders.js')({ async connect() { return this }, release() {}, async query(sql, params) { queries.push({ sql, params }); return { rows: sql.includes('AS next_number') ? [{ next_number: '1' }] : [{ id: 123, ...body }] } } })
  const handler = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post).route.stack[0].handle
  const result = { status: 200 }
  await handler({ body }, { status(code) { result.status = code; return this }, json(value) { result.body = value; return this } })
  return { ...result, queries }
}

test('new online and offline orders reject invalid totals and quantities without writes', async () => {
  for (const online of [true, false]) {
    const app = runtime(online), context = app.provider()
    for (const total of [NaN, Infinity, -1, '', null, '10oops', true]) await assert.rejects(context.createOrder({ total, quantity: 10 }))
    for (const quantity of [0, -1, NaN, Infinity, 1.5, '', null, true]) await assert.rejects(context.createOrder({ total: 10, quantity }))
    await assert.rejects(context.createOrder({ total: 10, quantity: 1, servicesDetails: [{ byRequest: true }] }))
    assert.equal(app.calls.length, 0); assert.equal(app.storage.size, 0)
    const input = { total: 0, quantity: 1, sheetCalculation: { paper: { rate: 0 } } }
    const saved = await context.createOrder(input)
    input.sheetCalculation.paper.rate = 999
    assert.equal(saved.total, 0)
    assert.equal(saved.sheetCalculation.paper.rate, 0)
  }
})
test('sheet snapshot, odd-page impressions and live rates persist through actual create route', async () => {
  for (const rate of [0, 4.25]) {
    const quote = makeQuote({ printRate: rate }), body = bodyFor(quote), before = JSON.stringify(body)
    assert.equal(policy.validateCatalogOrder(body), null)
    const response = await post(body)
    assert.equal(response.status, 200)
    assert.equal(JSON.stringify(body), before)
    assert.deepEqual(JSON.parse(response.queries.find(q => q.sql.includes('INSERT INTO order_items')).params[6]), quote)
  }
})
test('malformed new order amounts and tampered snapshots are rejected before database work', async () => {
  for (const total of [NaN, Infinity, -1, '', null, '1oops', true]) {
    const body = bodyFor(makeQuote()); body.total_amount = total
    const response = await post(body); assert.equal(response.status, 400); assert.equal(response.queries.length, 0)
  }
  for (const mutate of [s => { s.sheetCalculation.sheets++ }, s => { s.sheetCalculation.paper.rate = null }, s => { s.sheetCalculation.operations[0].quantity++ }, s => { s.sheetCalculation.printing.total++ }, s => { s.sheetCalculation.width = Infinity }, s => { s.total++ }, s => { s.servicesDetails[0].byRequest = true }]) {
    const body = bodyFor(makeQuote()); mutate(body.items[0].specifications)
    const response = await post(body); assert.equal(response.status, 400); assert.equal(response.queries.length, 0)
  }
})
test('valid manual badges and ordinary orders remain supported', async () => {
  const manual = { category: 'badges', total_amount: 100, items: [{ product_name: 'Badge', quantity: 10, unit_price: 10, total_price: 100, specifications: { productType: 'badges', pricingMode: 'manual', manualBatchTotal: 100, baseTotal: 100, unitPrice: 10 } }] }
  assert.equal((await post(manual)).status, 200)
  const ordinary = structuredClone(manual); ordinary.category = 'business-cards'; ordinary.items[0].specifications = {}; ordinary.items[0].product_name = 'Card'
  assert.equal((await post(ordinary)).status, 200)
})
test('historical GET returns legacy snapshots untouched', async () => {
  const historical = { id: 9, total_amount: null, category: 'badges' }, legacyItem = { quantity: 0, specifications: { historical: true } }
  const router = require('../server/routes/orders.js')({ async query(sql) { return { rows: sql.includes('order_items') ? [legacyItem] : [historical] } } })
  const handler = router.stack.find(layer => layer.route?.path === '/:id' && layer.route.methods.get).route.stack[0].handle
  let output
  await handler({ params: { id: 9 } }, { json(data) { output = data }, status() { return this } })
  assert.deepEqual(output, { ...historical, items: [legacyItem] })
})

test('live pricing mapper preserves color, specification, zero tariffs and request text', async () => {
  const module = { exports: {} }, states = [], effects = [], cache = new Map()
  let cursor = 0
  const react = { ...require('react'), useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value }] }, useEffect(fn) { effects.push(fn) } }
  const data = { settings: { urgent_surcharge: 0 }, printing: [{ id: 8, category: 'flyers', color_type: '4+4', specification: '{"finish":"matte"}', prices: '{"A3":0}' }], additionalOperations: [{ id: 9, name: 'Free cut', price: 0, options: '[{"id":"x","price":0}]' }, { id: 10, price: null, price_text: 'By request', options: 'malformed' }] }
  const source = fs.readFileSync(new URL('../src/hooks/usePricing.jsx', import.meta.url), 'utf8')
  vm.runInNewContext(transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code, { module, exports: module.exports, console, localStorage: { setItem(k,v) { cache.set(k,v) }, getItem(k) { return cache.get(k) } }, require(name) { if (name === 'react') return react; if (name.includes('jsx-runtime')) return require(name); if (name.endsWith('catalog.mjs')) return { getStateSymbolName: x => x.name }; if (name.endsWith('pricing.json')) return {}; return { __esModule: true, default: { async getPricing() { return data } } } } })
  module.exports.PricingProvider({ children: null })
  effects[0]()
  await new Promise(resolve => setImmediate(resolve))
  const pricing = states[0]
  assert.equal(pricing.settings.urgentSurcharge, 0)
  assert.equal(pricing.printing[0].colorType, '4+4'); assert.equal(pricing.printing[0].color_type, '4+4')
  assert.equal(pricing.printing[0].specification.finish, 'matte')
  assert.equal(pricing.additionalOperations[9].price, 0); assert.equal(pricing.additionalOperations[9].options[0].price, 0)
  assert.equal(pricing.additionalOperations[10].priceText, 'By request'); assert.equal(pricing.additionalOperations[10].options.length, 0)
  assert.ok(cache.has('crm_pricing_cache'))
})

test('all sheet calculator product kinds persist with their exact engine snapshot', async () => {
  for (const kind of ['badges', 'flyers', 'booklets', 'custom', 'hangers']) {
    const quote = makeQuote({ kind, pages: ['hangers','booklets'].includes(kind) ? 2 : 3, operations: kind === 'hangers' ? [{ id: 'graphtec', kind: 'graphtec', name: 'Graphtec', rate: 8, unit: 'sheet' }] : [] })
    const body = bodyFor(quote); body.category = kind === 'badges' ? 'badges' : 'printing'
    const response = await post(body)
    assert.equal(response.status, 200, `${kind}: ${response.body?.error}`)
    assert.deepEqual(JSON.parse(response.queries.find(q => q.sql.includes('INSERT INTO order_items')).params[6]), quote)
  }
})


test('backend rejects inconsistent duplex pages, color and hanger templates', async () => {
  const hanger = makeQuote({ kind: 'hangers', pages: 2, operations: [{ id: 'graphtec', kind: 'graphtec', name: 'Graphtec', rate: 8, unit: 'sheet' }] })
  const mutations = [
    s => { s.sheetCalculation.pages = 1 },
    s => { s.sheetCalculation.pages = 3 },
    s => { s.sheetCalculation.sides = 1; s.sheetCalculation.printing.sides = 1; s.sheetCalculation.printing.colorType = '4+0' },
    s => { s.sheetCalculation.printing.colorType = '4+0' },
    s => { s.colorType = '1+0' },
    s => { s.sheetCalculation.sheetFormat = 'A4' },
    s => { s.sheetCalculation.yieldPerSheet = 5 },
    s => { s.sheetCalculation.operations[0].kind = 'cutting' }
  ]
  for (const mutate of mutations) {
    const body = bodyFor(structuredClone(hanger)); mutate(body.items[0].specifications)
    const response = await post(body)
    assert.equal(response.status, 400); assert.equal(response.queries.length, 0)
  }
  // Construct an otherwise internally consistent one-page duplex snapshot.
  const single = makeQuote({ pages: 1, colorType: '4+0', operations: [] })
  single.sheetCalculation.sides = 2; single.sheetCalculation.printing.sides = 2
  single.sheetCalculation.printing.colorType = '4+4'; single.colorType = '4+4'
  const response = await post(bodyFor(single))
  assert.equal(response.status, 400); assert.equal(response.queries.length, 0)
})


test('booklet snapshots require explicit positive paper density', async () => {
  for (const density of [undefined, null, '', 0, -1, NaN, Infinity]) {
    const quote = makeQuote({ kind: 'booklets', pages: 2 }); quote.sheetCalculation.paper.density = density
    const response = await post(bodyFor(quote))
    assert.equal(response.status, 400); assert.equal(response.queries.length, 0)
  }
})


test('fractional CNC and additional service volumes survive provider and POST persistence without truncation', async () => {
  for (const [category, quantity] of [['cnc-laser', 1.5], ['additionalServices', 0.25]]) {
    let result
    const app = runtime(true, async body => {
      result = await post(body)
      assert.equal(result.status, 200)
      return { id: 123, order_number: 'TEST' }
    })
    const context = app.provider()
    await context.createOrder({ category, quantity, total: quantity * 100, productName: 'Measured service' })
    assert.equal(app.calls[0].items[0].quantity, quantity)
    const persisted = result.queries.find(q => q.sql.includes('INSERT INTO order_items')).params
    assert.equal(persisted[3], quantity)
    assert.equal(JSON.parse(persisted[6]).quantity, quantity)
    assert.equal(persisted[5], quantity * 100)
    for (const invalid of [0, -0.25, NaN, Infinity, '', null, true]) {
      await assert.rejects(context.createOrder({ category, quantity: invalid, total: 1 }))
      const body = { category, total_amount: 1, items: [{ quantity: invalid, unit_price: 1, total_price: 1 }] }
      const rejected = await post(body)
      assert.equal(rejected.status, 400); assert.equal(rejected.queries.length, 0)
    }
  }
  for (const category of ['printing', 'business-cards', 'badges']) {
    await assert.rejects(runtime().provider().createOrder({ category, quantity: 1.5, total: 150 }))
    const rejected = await post({ category, total_amount: 150, items: [{ quantity: 1.5, unit_price: 100, total_price: 150 }] })
    assert.equal(rejected.status, 400); assert.equal(rejected.queries.length, 0)
  }
})

async function postWithTransactionClient(client, body = { category: 'printing', total_amount: 20, items: [{ product_name: 'Print', quantity: 2, unit_price: 10, total_price: 20 }] }) {
  let connects = 0
  const pool = { async connect() { connects++; return client }, async query() { throw new Error('Transaction escaped its checked-out connection') } }
  const router = require('../server/routes/orders.js')(pool)
  const handler = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post).route.stack[0].handle
  const result = { status: 200 }
  await handler({ body }, { status(code) { result.status = code; return this }, json(value) { result.body = value; return this } })
  return { ...result, connects }
}

test('create transaction locks numbering, uses maximum suffix and commits before release', async () => {
  const events = []
  const client = { async query(sql, params) {
    events.push({ sql, params })
    if (sql.includes('AS next_number')) {
      assert.match(sql, /MAX\(CASE WHEN order_number/)
      assert.match(sql, /\^ORD-\[0-9\]\+\$/)
      assert.match(sql, /::numeric/)
      return { rows: [{ next_number: '9007199254740994' }] }
    }
    if (sql.includes('INSERT INTO orders')) return { rows: [{ id: 9, order_number: params[0] }] }
    return { rows: [] }
  }, release(error) { assert.equal(error, undefined); events.push({ sql: 'RELEASE' }) } }
  const response = await postWithTransactionClient(client)
  assert.equal(response.status, 200); assert.equal(response.connects, 1)
  assert.equal(response.body.order_number, 'ORD-9007199254740994')
  assert.equal(events[0].sql, 'BEGIN')
  assert.equal(events[1].sql, 'LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE')
  assert.equal(events.at(-2).sql, 'COMMIT'); assert.equal(events.at(-1).sql, 'RELEASE')
  assert.equal(events.filter(event => event.sql.includes('INSERT')).length, 2)
})

test('failed item insert rolls back the parent and releases the same connection', async t => {
  t.mock.method(console, 'error', () => {})
  const events = [], durable = [], pending = []
  const client = { async query(sql) {
    events.push(sql)
    if (sql.includes('AS next_number')) return { rows: [{ next_number: '8' }] }
    if (sql.includes('INSERT INTO orders')) { pending.push({ id: 8 }); return { rows: [{ id: 8 }] } }
    if (sql.includes('INSERT INTO order_items')) throw new Error('Simulated item constraint failure')
    if (sql === 'ROLLBACK') pending.length = 0
    if (sql === 'COMMIT') durable.push(...pending)
    return { rows: [] }
  }, release() { events.push('RELEASE') } }
  const response = await postWithTransactionClient(client)
  assert.equal(response.status, 500); assert.equal(response.connects, 1)
  assert.equal(durable.length, 0); assert.equal(pending.length, 0)
  assert.equal(events.includes('COMMIT'), false)
  assert.deepEqual(events.slice(-2), ['ROLLBACK', 'RELEASE'])
})

test('rollback failure still releases and discards the checked-out connection', async t => {
  t.mock.method(console, 'error', () => {})
  const rollbackFailure = new Error('Connection lost during rollback')
  let released
  const client = { async query(sql) { if (sql === 'ROLLBACK') throw rollbackFailure; throw new Error('Connection failure') }, release(error) { released = error } }
  assert.equal((await postWithTransactionClient(client)).status, 500)
  assert.equal(released, rollbackFailure)
})

test('sheet money rounds each charge and urgency before discount and persistence', async () => {
  const quote = makeQuote({ paper: { id: 'fractional', name: 'Paper', density: 120, rate: 2.333 }, printRate: 1.111, urgentSurcharge: 12.5, discount: 7.5, operations: [{ id: 'setup', name: 'Setup', unit: 'order', rate: 0.335 }] })
  assert.equal(quote.sheetCalculation.paper.total, 4.67)
  assert.equal(quote.sheetCalculation.printing.total, 3.33)
  assert.equal(quote.servicesTotal, 0.34)
  assert.equal(quote.subtotal, 8.34)
  assert.equal(quote.urgentAmount, 1.04)
  assert.equal(quote.discountAmount, 0.7)
  assert.equal(quote.total, 8.68)
  assert.equal((await post(bodyFor(quote))).status, 200)
  for (const mutate of [
    body => { body.total_amount += 0.001 },
    body => { body.items[0].total_price += 0.001 },
    body => { body.items[0].specifications.total += 0.001 },
    body => { body.items[0].specifications.urgentAmount += 0.001 },
    body => { body.items[0].specifications.sheetCalculation.paper.total += 0.001 },
    body => { body.items[0].specifications.sheetCalculation.operations[0].total += 0.001 }
  ]) {
    const body = bodyFor(structuredClone(quote)); mutate(body)
    const response = await post(body)
    assert.equal(response.status, 400); assert.equal(response.queries.length, 0)
  }
})
