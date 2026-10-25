import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import { calculateGarmentPrinting } from '../src/lib/garmentPricing.mjs'
import { catalogConfig } from '../src/lib/catalog.mjs'

const require = createRequire(import.meta.url)
const React = require('react')
const { transformSync } = require('esbuild')
const { parse } = require('@babel/parser')
const fixture = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url), 'utf8'))
const [flex, sublimation, metal] = fixture.garmentPrinting
const mugs = sublimation.productOptions.find(item => item.id === 'mugs')
const defaults = { item: flex, area: 100, quantity: 5, urgent: false, urgentSurcharge: 30 }
const quote = changes => calculateGarmentPrinting({ ...defaults, ...changes })
const plain = value => JSON.parse(JSON.stringify(value))

test('all PDF tariffs, the 6000 minimum and preparation/urgency remain unchanged', () => {
  assert.deepEqual([flex.pricePerSqCm, sublimation.pricePerSqCm, metal.pricePerSqCm], [23, 20, 18])
  assert.equal(quote({}).total, 11500)
  const low = quote({ area: 10, fileOperation: fixture.additionalOperations.garmentFile })
  assert.equal(low.baseTotal, 1150)
  assert.equal(low.minimumAdjustment, 4850)
  assert.equal(low.minApplied, 6000)
  assert.equal(low.extrasTotal, 1500)
  assert.equal(low.total, 7500)
  assert.equal(low.baseTotal + low.minimumAdjustment + low.extrasTotal, low.total)
  assert.equal(quote({ item: metal, quantity: 2 }).total, 3600)
  const urgent = quote({ item: sublimation, product: mugs, variant: mugs.variants[0], quantity: 2,
    fileOperation: fixture.additionalOperations.garmentFile, urgent: true })
  assert.equal(urgent.subtotal, 5500)
  assert.equal(urgent.urgentAmount, 5000)
  assert.equal(urgent.total, 10500)
  assert.equal(quote({ area: 1000, urgent: true }).urgentAmount, 34500)
})

test('minimum batch is enforced; invalid inputs cannot be truncated into valid orders', () => {
  for (const quantity of ['', 0, -1, 1, 4, 5.5, '5abc', NaN, Infinity]) assert.throws(() => quote({ quantity }))
  for (const area of ['', 0, -1, 'abc', '1abc', NaN, Infinity]) assert.throws(() => quote({ area }))
  assert.equal(quote({ area: '0.5' }).total, 6000)
  assert.throws(() => quote({ item: { ...flex, pricePerSqCm: null } }))
})

test('white/pearl mugs share the existing area tariff and preserve chosen names/IDs; other sublimation products remain', () => {
  assert.deepEqual(mugs.variants.map(item => item.name), ['Кружка белая', 'Кружка перламутровая'])
  for (const variant of mugs.variants) {
    const result = quote({ item: sublimation, product: mugs, variant, quantity: 2 })
    assert.equal(result.total, 4000)
    assert.equal(result.quantity, 2)
    assert.equal(result.qty, 2)
    assert.equal(result.variantId, variant.id)
    assert.equal(result.variantName, variant.name)
    assert.ok(result.productName.endsWith(variant.name))
    assert.equal(quote({ item: { ...sublimation, pricePerSqCm: 25 }, product: mugs, variant, quantity: 2 }).total, 5000)
  }
  for (const product of sublimation.productOptions.filter(item => item.id !== 'mugs')) {
    assert.equal(quote({ item: sublimation, product, quantity: 1 }).total, 2000)
  }
  assert.throws(() => quote({ item: sublimation, product: mugs, variant: { id: 'unknown' } }))
})

function elements(node, predicate = () => true, found = []) {
  if (Array.isArray(node)) node.forEach(child => elements(child, predicate, found))
  else if (React.isValidElement(node)) { if (predicate(node)) found.push(node); elements(node.props.children, predicate, found) }
  return found
}
function text(node) {
  return Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children)
    : typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}
function runtime() {
  const source = fs.readFileSync(new URL('../src/components/GarmentPrintingCalculator.jsx', import.meta.url), 'utf8')
  const compiled = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic', target: 'node18' }).code
  const state = []; let cursor = 0; const saved = []; const alerts = []; const module = { exports: {} }
  const context = { module, exports: module.exports, alert: value => alerts.push(value), require(name) {
    if (name === 'react') return { ...React, useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] }, useMemo: fn => fn(), useEffect() {} }
    if (name === 'react/jsx-runtime') return require(name)
    if (name.endsWith('/usePricing')) return { usePricing: () => ({ pricing: fixture }) }
    if (name.endsWith('/useOrders')) return { useOrders: () => ({ createOrder: async value => saved.push(value) }) }
    if (name.endsWith('/data/pricing.json')) return fixture
    if (name.endsWith('/catalog.mjs')) return { catalogConfig }
    if (name.endsWith('/garmentPricing.mjs')) return { calculateGarmentPrinting }
    return { __esModule: true, default: () => null }
  } }
  vm.runInNewContext(compiled, context)
  const render = () => { cursor = 0; return module.exports.default({ client: { id: 901, name: 'Local test' } }) }
  const input = label => elements(render(), element => element.type === 'input' && element.props['aria-label'] === label)[0]
  const change = (label, value) => input(label).props.onChange({ target: { value } })
  const calculate = () => elements(render(), element => element.type === 'form')[0].props.onSubmit({ preventDefault() {} })
  const summary = () => elements(render(), element => typeof element.type === 'function' && element.props.onSave)[0]
  return { render, change, calculate, summary, saved, alerts, state }
}

test('actual UI clears obsolete results for every editable parameter and displays an additive minimum breakdown', async () => {
  const ui = runtime()
  ui.change('Площадь изображения (кв.см)', '10')
  ui.calculate()
  let summary = ui.summary()
  const adjustment = elements(summary, element => element.props.label?.startsWith('Доплата до минимума'))[0]
  assert.ok(adjustment.props.value.includes('4'))
  assert.ok(!adjustment.props.value.includes('7500'))
  for (const label of ['Площадь изображения (кв.см)', 'Количество (шт)']) {
    ui.change(label, label.startsWith('Площадь') ? '20' : '6')
    assert.equal(ui.summary(), undefined)
    ui.calculate(); assert.ok(ui.summary())
  }
  elements(ui.render(), element => element.type === 'button' && text(element).includes('Сублимационная'))[0].props.onClick()
  assert.equal(ui.summary(), undefined)
  ui.change('Количество (шт)', '2'); ui.change('Площадь изображения (кв.см)', '100'); ui.calculate()
  assert.ok(ui.summary())
  elements(ui.render(), element => element.type === 'select' && element.props.id === 'garment-variant')[0]
    .props.onChange({ target: { value: 'pearl' } })
  assert.equal(ui.summary(), undefined)
  ui.calculate(); summary = ui.summary(); await summary.props.onSave()
  assert.equal(ui.saved[0].variantName, 'Кружка перламутровая')
  assert.equal(ui.saved[0].quantity, 2)
  assert.equal(ui.saved[0].total, 4000)
})

test('real order adapter and POST handler persist actual quantity, product, variant and charge breakdown', async () => {
  const source = fs.readFileSync(new URL('../src/hooks/useOrders.jsx', import.meta.url), 'utf8')
  const tree = parse(source, { sourceType: 'module', plugins: ['jsx'] }); let callback
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.type === 'VariableDeclarator' && node.id.name === 'createOrder') callback = node.init.arguments[0]
    Object.values(node).forEach(walk)
  }
  walk(tree)
  let persisted
  const router = require('../server/routes/orders.js')({ async query(sql, values) {
    if (sql.includes('SELECT COUNT')) return { rows: [{ count: '0' }] }
    if (sql.includes('INSERT INTO orders')) return { rows: [{ id: 10, total_amount: values[5] }] }
    if (sql.includes('INSERT INTO order_items')) persisted = { name: values[1], quantity: values[3], total: values[5], spec: JSON.parse(values[6]) }
    return { rows: [] }
  } })
  const handler = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post).route.stack[0].handle
  for (const variant of mugs.variants) {
    const result = quote({ item: sublimation, product: mugs, variant, quantity: 3 })
    const context = { isOnline: true, STORAGE_KEY: 'test', localStorage: { setItem() {} }, setOrders: update => update([]),
      api: { async createOrder(payload) { let response; await handler({ body: payload }, { json(value) { response = value } }); return response } } }
    const create = vm.runInNewContext('(' + source.slice(callback.start, callback.end) + ')', context)
    await create({ ...result, category: 'garment-printing', client: { id: 901 } })
    assert.equal(persisted.quantity, 3); assert.equal(persisted.total, 6000)
    assert.ok(persisted.name.endsWith(variant.name))
    assert.equal(persisted.spec.variantId, variant.id)
    assert.equal(persisted.spec.sqcm, 100)
  }
})

test('price API preserves product options on create/edit, validates bad variants and migration never changes tariffs', async () => {
  const { validateProductOptions, configureGarmentProducts } = require('../server/garment-products.js')
  assert.equal(validateProductOptions(sublimation.productOptions), null)
  assert.ok(validateProductOptions([{ id: 'mugs', name: 'Кружки', variants: [{ id: 'white', name: '' }] }]))
  let lastQuery; let mutations = 0
  const router = require('../server/routes/pricing.js')({ async query(sql, values) { lastQuery = { sql, values }; mutations++; return { rows: [{ id: 51 }] } } })
  const body = { name: sublimation.name, type: sublimation.type, price_per_sqcm: 20, product_options: sublimation.productOptions }
  for (const method of ['post', 'put']) {
    const path = method === 'post' ? '/garment-printing' : '/garment-printing/:id'
    const handler = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle
    const response = { statusCode: 200, status(value) { this.statusCode = value; return this }, json() {} }
    await handler({ body, params: { id: 51 } }, response)
    assert.equal(response.statusCode, 200)
    assert.ok(lastQuery.values.includes(JSON.stringify(sublimation.productOptions)))
    assert.match(lastQuery.sql, /product_options/)
    const before = mutations
    await handler({ body: { ...body, product_options: [{}] }, params: { id: 51 } }, response)
    assert.equal(response.statusCode, 400); assert.equal(mutations, before)
  }
  let options = null
  const pool = { async query(sql, values) {
    if (sql.startsWith('ALTER')) return { rowCount: 0 }
    assert.match(sql, /product_options IS NULL/)
    assert.ok(!/SET.*price_per_sqcm=/.test(sql))
    if (options) return { rowCount: 0 }
    options = JSON.parse(values[0]); return { rowCount: 1 }
  } }
  assert.equal(await configureGarmentProducts(pool), 1)
  assert.equal(await configureGarmentProducts(pool), 0)
  assert.deepEqual(options, sublimation.productOptions)
})
