import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import { isWideFormatGroupEnabled, getCanvasOperationKey, isCanvasMaterial } from '../src/lib/catalog.mjs'
import { calculateWideFormatFinishing, getBannerOperation, getBannerOperationKey } from '../src/lib/wideFormatFinishing.mjs'
import { calculateStickerLayout } from '../src/lib/stickerLayout.mjs'

const require = createRequire(import.meta.url)
const { parse } = require('@babel/parser')
const source = fs.readFileSync(new URL('../src/components/WideFormatCalculator.jsx', import.meta.url), 'utf8')
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] })
const component = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration
const read = node => source.slice(node.start, node.end)
const variables = new Map(component.body.body.filter(node => node.type === 'VariableDeclaration')
  .flatMap(node => node.declarations).map(node => [node.id.name, node.init]))
const helpers = ast.program.body.filter(node => node.type === 'FunctionDeclaration').map(read).join('\n')
const fixture = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url), 'utf8'))
// Synthetic enabled banner retains the original rate fixture; Phaeton itself is disabled by catalog policy.
const material = { ...fixture.wideFormat.find(item => item.id === 'wf-phaeton-banner-400'), category: 'mimaki' }
// Match the API's numeric operation IDs rather than relying on fallback JSON keys.
const operations = {
  15: { ...fixture.additionalOperations.bannerGluing, id: '15' },
  16: { ...fixture.additionalOperations.bannerJoining, id: '16' },
  17: { ...fixture.additionalOperations.wideFormatCutting, id: '17' }
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`)
}

function harness({ width = 4, height = 5, quantity = 1, edges = false, includeWaste = true,
  product = material, ops = operations, selected, operationQuantities = {} } = {}) {
  let calculation
  let saved
  const context = {
    calculateWideFormatFinishing, getBannerOperation, getBannerOperationKey, isWideFormatGroupEnabled, getCanvasOperationKey, isCanvasMaterial, calculateStickerLayout,
    stickerMode: false, stickerGap: '',
    width: String(width), height: String(height), quantity,
    selectedMaterial: structuredClone(product), additionalOperations: structuredClone(ops),
    selectedServices: selected ?? (edges ? ['15'] : []), serviceQuantities: operationQuantities, selectedServiceOptions: {},
    additionalServices: [],
    selectedAddServices: [], availableServices: [], includeWaste,
    isUrgent: false, urgentSurcharge: 30, effectiveGroup: 'mimaki', WIDE_FORMAT_GROUPS: { mimaki: 'Mimaki' },
    client: { id: 'test-client', name: 'Test' }, orderStatus: 'draft',
    alert() {}, setSavingOrder() {}, createOrder: async value => { saved = value },
    setCalculation(value) { calculation = value; context.calculation = value }
  }
  for (const [setter, field] of Object.entries({ setWidth: 'width', setHeight: 'height', setQuantity: 'quantity',
    setSelectedServices: 'selectedServices', setServiceQuantities: 'serviceQuantities',
    setSelectedServiceOptions: 'selectedServiceOptions', setSelectedAddServices: 'selectedAddServices',
    setIsUrgent: 'isUrgent', setOrderStatus: 'orderStatus' })) context[setter] = value => { context[field] = value }
  vm.createContext(context)
  vm.runInContext(helpers, context)
  context.availableOperations = vm.runInContext(`(${read(variables.get('availableOperations').arguments[0])})()`, context)
  vm.runInContext(`globalThis.calculate = ${read(variables.get('handleCalculate'))}; globalThis.save = ${read(variables.get('handleSaveOrder'))}`, context)
  return {
    context,
    calculate() { context.calculate({ preventDefault() {} }); return calculation },
    async save() { await context.save(); return saved }
  }
}

test('whole banner: edge checkbox controls perimeter finishing; joining is absent', () => {
  for (const edges of [false, true]) {
    const result = harness({ width: 2, height: 1, edges }).calculate()
    near(result.baseTotal, 6600)
    assert.equal(result.wasteInfo.joined, false)
    assert.equal(result.bannerJoiningApplied, false)
    assert.equal(result.bannerGluingSelected, edges)
    near(result.wasteTotal, 1800)
    near(result.extrasTotal, edges ? 2380 : 0)
    near(result.total, edges ? 10780 : 8400)
    if (edges) near(result.extras[0].quantity, 6.8)
  }
})

test('split banner: joining follows actual seams; edges remain optional and are charged once', () => {
  for (const edges of [false, true]) {
    const result = harness({ edges }).calculate()
    assert.equal(result.wasteInfo.pieces, 2)
    assert.equal(result.wasteInfo.seams, 1)
    assert.equal(result.bannerJoiningApplied, true)
    assert.equal(result.bannerGluingSelected, edges)
    near(result.wasteInfo.glueMeters, 5.2)
    near(result.wasteInfo.gluePrice, 5200)
    near(result.wasteInfo.glueingPrice, edges ? 6580 : 0)
    near(result.extrasTotal, edges ? 11780 : 5200)
    near(result.wasteTotal, 17160)
    near(result.total, edges ? 83540 : 76960)
    assert.equal(result.extras.filter(item => item.operationKey === 'bannerJoining').length, 1)
    assert.equal(result.extras.filter(item => item.operationKey === 'bannerGluing').length, edges ? 1 : 0)
    near(result.extras.reduce((total, item) => total + item.price, 0), result.extrasTotal)
  }
})

test('waste toggle only controls waste billing for whole and split banners', () => {
  for (const [width, height] of [[2, 1], [4, 5]]) {
    for (const edges of [false, true]) {
      const on = harness({ width, height, edges }).calculate()
      const off = harness({ width, height, edges, includeWaste: false }).calculate()
      assert.deepEqual(JSON.parse(JSON.stringify(off.extras)), JSON.parse(JSON.stringify(on.extras)))
      assert.equal(off.wasteInfo.joined, on.wasteInfo.joined)
      assert.equal(off.bannerJoiningApplied, on.bannerJoiningApplied)
      assert.equal(off.bannerGluingSelected, edges)
      assert.equal(off.includeWaste, false)
      assert.equal(off.wasteTotal, 0)
      near(off.total, on.total - on.wasteTotal)
    }
  }
})

test('availability is checked independently, including stale selections', () => {
  for (const allowed of [[], ['bannerJoining'], ['bannerGluing']]) {
    const h = harness({ edges: true, product: { ...material, operations: allowed } })
    const result = h.calculate()
    const joining = allowed.includes('bannerJoining')
    const gluing = allowed.includes('bannerGluing')
    assert.equal(result.bannerJoiningApplied, joining)
    assert.equal(result.bannerGluingSelected, gluing)
    near(result.extrasTotal, (joining ? 5200 : 0) + (gluing ? 6580 : 0))
    assert.equal(h.context.availableOperations.some(op => getBannerOperationKey(op) === 'bannerGluing'), gluing)
    assert.equal(h.context.availableOperations.some(op => getBannerOperationKey(op) === 'bannerJoining'), false)
  }
  const blocked = harness({ edges: true, product: { ...material, glueAllowed: false } }).calculate()
  assert.equal(blocked.extrasTotal, 0)
  assert.equal(blocked.bannerJoiningApplied, false)
  assert.equal(blocked.bannerGluingSelected, false)
})

test('missing, inactive or inapplicable operations are never charged', () => {
  for (const missingKey of ['15', '16']) {
    for (const mode of ['missing', 'inactive', 'category']) {
      const ops = structuredClone(operations)
      if (mode === 'missing') delete ops[missingKey]
      if (mode === 'inactive') ops[missingKey].is_active = false
      if (mode === 'category') ops[missingKey].applicableTo = ['business-cards']
      const result = harness({ edges: true, ops }).calculate()
      assert.equal(result.bannerJoiningApplied, missingKey !== '16')
      assert.equal(result.bannerGluingSelected, missingKey !== '15')
      near(result.extrasTotal, missingKey === '15' ? 5200 : 6580)
    }
  }
})

test('legacy materials and fallback IDs retain availability; no roll still permits selected edges', () => {
  const legacy = { ...material }
  delete legacy.operations
  delete legacy.glueAllowed
  assert.ok(getBannerOperation(fixture.additionalOperations, legacy, 'bannerGluing'))
  const result = harness({ edges: true, product: { ...material, rollWidth: null } }).calculate()
  assert.equal(result.wasteInfo, null)
  assert.equal(result.bannerJoiningApplied, false)
  near(result.extrasTotal, 6580)
  const fallback = harness({ ops: fixture.additionalOperations, selected: ['bannerGluing'] }).calculate()
  near(fallback.extrasTotal, 11780)
})

test('rotation, multiple seams, quantity and existing tariff boundaries are preserved', () => {
  const rotated = harness({ width: 5, height: 4, edges: true }).calculate()
  near(rotated.total, 83540)
  const three = harness({ width: 8, height: 9, edges: false }).calculate()
  assert.equal(three.wasteInfo.pieces, 3)
  assert.equal(three.wasteInfo.seams, 2)
  near(three.wasteInfo.glueMeters, 18.4)
  near(three.wasteInfo.gluePrice, 18400)
  const bulk = harness({ edges: true, quantity: 20 }).calculate()
  near(bulk.wasteInfo.glueMeters, 104)
  near(bulk.wasteInfo.glueUnitPrice, 700)
  near(bulk.wasteInfo.glueingMeters, 376)
  near(bulk.wasteInfo.glueingUnitPrice, 300)
  const over500 = harness({ width: 2, height: 1, edges: true, quantity: 74 }).calculate()
  near(over500.extras[0].quantity, 503.2)
  near(over500.extras[0].unitPrice, 300) // Existing resolver behavior, no new tariff.
})

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { node.forEach(item => walk(item, visit)); return }
  visit(node)
  for (const [key, value] of Object.entries(node)) if (key !== 'loc') walk(value, visit)
}

test('real checkbox handler selects and clears edge finishing without accepting a manual meter count', () => {
  let input
  walk(ast, node => {
    if (node.type === 'JSXOpeningElement' && node.name.name === 'input'
      && node.attributes.some(attr => attr.name?.name === 'id' && attr.value?.expression?.consequent?.value === 'banner-gluing')) input = node
  })
  assert.ok(input)
  const onChange = input.attributes.find(attr => attr.name?.name === 'onChange').value.expression
  const h = harness({ width: 2, height: 1 })
  h.context.op = operations[15]
  vm.runInContext(`globalThis.change = ${read(onChange)}`, h.context)
  h.context.change({ target: { checked: true } })
  assert.deepEqual(Array.from(h.context.selectedServices), ['15'])
  h.context.serviceQuantities['15'] = 999 // Must be ignored; perimeter comes from dimensions.
  near(h.calculate().extrasTotal, 2380)
  h.context.change({ target: { checked: false } })
  assert.equal(h.context.calculation, null)
  assert.equal(h.context.selectedServices.length, 0)
  assert.equal(h.calculate().extrasTotal, 0)
})

test('ordinary selected operations coexist without duplicating either finishing charge', () => {
  const h = harness({ selected: ['15', '15', '16', '17'] })
  h.context.serviceQuantities['17'] = 10
  const result = h.calculate()
  assert.equal(result.extras.length, 3)
  near(result.extrasTotal, 12780)
  near(result.total, 84540)
})

test('actual save handler and order adapter preserve selections, breakdown and total; backend stores them unchanged', async () => {
  const ordersSource = fs.readFileSync(new URL('../src/hooks/useOrders.jsx', import.meta.url), 'utf8')
  const ordersAst = parse(ordersSource, { sourceType: 'module', plugins: ['jsx'] })
  let createCallback
  walk(ordersAst, node => {
    if (node.type === 'VariableDeclarator' && node.id.name === 'createOrder') createCallback = node.init.arguments[0]
  })
  assert.ok(createCallback)
  let persistedOrderTotal
  let persistedItemTotal
  let persistedSpecifications
  const router = require('../server/routes/orders.js')({
    async query(sql, values) {
      if (sql.includes('SELECT COUNT(*)')) return { rows: [{ count: '0' }] }
      if (sql.includes('INSERT INTO orders')) {
        persistedOrderTotal = values[5]
        return { rows: [{ id: 'test-order', total_amount: values[5] }] }
      }
      if (sql.includes('INSERT INTO order_items')) {
        persistedItemTotal = values[5]
        persistedSpecifications = JSON.parse(values[6])
        return { rows: [] }
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    }
  })
  const handler = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post).route.stack[0].handle
  for (const [width, height, edges, includeWaste, product, ops, selected, operationQuantities] of [
    [2, 1, true, true], [4, 5, false, true], [4, 5, true, false],
    ...fixture.wideFormat.filter(item => item.name === 'Холст').map(product => [1, 1, false, false, product, {
      41: { ...fixture.additionalOperations.canvasStretch, id: '41' },
      42: { ...fixture.additionalOperations.subframe, id: '42' }
    }, ['41', '42'], { 41: 1, 42: 4 }])
  ]) {
    const h = harness({ width, height, edges, includeWaste, product, ops, selected, operationQuantities })
    const result = h.calculate()
    let apiPayload
    const adapterContext = {
      isOnline: true, STORAGE_KEY: 'test-orders', localStorage: { setItem() {} }, setOrders(update) { update([]) },
      api: { async createOrder(payload) {
        apiPayload = JSON.parse(JSON.stringify(payload))
        let response
        await handler({ body: apiPayload }, { json(value) { response = value }, status() { return this } })
        near(response.total_amount, result.total)
        return { ...response, order_number: 'TEST-ONLY', created_at: '2026-10-19T00:00:00Z' }
      } }
    }
    vm.createContext(adapterContext)
    vm.runInContext(`globalThis.createOrder = ${ordersSource.slice(createCallback.start, createCallback.end)}`, adapterContext)
    h.context.createOrder = adapterContext.createOrder
    await h.save()
    const spec = apiPayload.items[0].specifications
    assert.equal(apiPayload.category, 'wide-format')
    assert.equal(spec.bannerGluingSelected, edges)
    assert.equal(spec.bannerJoiningApplied, width === 4)
    assert.equal(spec.includeWaste, includeWaste)
    near(apiPayload.total_amount, result.total)
    near(apiPayload.items[0].total_price, result.total)
    near(persistedOrderTotal, result.total)
    near(persistedItemTotal, result.total)
    assert.deepEqual(persistedSpecifications, spec)
    near(spec.extras.reduce((total, op) => total + op.price, 0), spec.extrasTotal)
    near(spec.baseTotal + spec.extrasTotal + spec.wasteTotal, apiPayload.total_amount)
    assert.equal(spec.extras.filter(op => op.operationKey === 'bannerGluing').length, edges ? 1 : 0)
    if (product?.name === 'Холст') {
      assert.deepEqual(spec.extras.map(op => op.id), ['41', '42'])
      near(spec.extrasTotal, 15500)
      assert.equal(spec.width, 1)
      assert.equal(spec.height, 1)
    }
  }
})

const canvas = fixture.wideFormat.filter(item => item.name === 'Холст')
const canvasOperations = {
  41: { ...fixture.additionalOperations.canvasStretch, id: '41' },
  42: { ...fixture.additionalOperations.subframe, id: '42' }
}

test('canvas operations use the same records and tariffs in both price sources', () => {
  const server = JSON.parse(fs.readFileSync(new URL('../server/pricing.json', import.meta.url), 'utf8'))
  assert.deepEqual(server.additionalOperations, fixture.additionalOperations)
  for (const product of canvas) assert.ok(['mimaki', 'roland'].includes(product.category))
  for (const [key, price, unit] of [['canvasStretch', 3500, 'м²'], ['subframe', 3000, 'пог.м']]) {
    const op = fixture.additionalOperations[key]
    assert.equal(op.id, key)
    assert.equal(op.price, price)
    assert.equal(op.unit, unit)
    assert.deepEqual(op.applicableTo, ['wide-format'])
    assert.equal(Object.values(fixture.additionalOperations).filter(item => item.name === op.name).length, 1)
    for (const product of canvas) assert.ok(product.operations.includes(key))
  }
})

test('Mimaki/Roland canvas accepts numeric API IDs and fallback keys, with per-material opt-out', () => {
  for (const product of canvas) {
    for (const ops of [canvasOperations, fixture.additionalOperations]) {
      const h = harness({ product, ops })
      assert.equal(h.context.availableOperations.filter(getCanvasOperationKey).length, 2)
    }
    const numeric = harness({ product: { ...product, operations: ['41', '42'] }, ops: canvasOperations })
    assert.equal(numeric.context.availableOperations.filter(getCanvasOperationKey).length, 2)
    const disabled = harness({ product: { ...product, operations: [] }, ops: canvasOperations })
    assert.equal(disabled.context.availableOperations.length, 0)
    const legacy = { ...product }; delete legacy.operations
    assert.equal(harness({ product: legacy, ops: canvasOperations }).context.availableOperations.length, 2)
  }
})

test('other materials, inactive records and stale stand applicability never charge canvas operations', () => {
  for (const product of fixture.wideFormat.filter(item => item.name !== 'Холст')) {
    if (!isWideFormatGroupEnabled(product.category)) continue
    const h = harness({ product, ops: canvasOperations, selected: ['41', '42'], operationQuantities: { 41: 20, 42: 20 } })
    assert.equal(h.context.availableOperations.length, 0)
    assert.equal(h.calculate().extrasTotal, 0)
  }
  for (const change of [{ is_active: false }, { applicableTo: ['advertising-stands'] }]) {
    const ops = Object.fromEntries(Object.entries(canvasOperations).map(([id, op]) => [id, { ...op, ...change }]))
    const h = harness({ product: canvas[0], ops, selected: ['41', '42'], operationQuantities: { 41: 1, 42: 4 } })
    assert.equal(h.context.availableOperations.length, 0)
    assert.equal(h.calculate().extrasTotal, 0)
  }
})

test('canvas quantities keep the existing total-volume formula and use edited price-list rates', async () => {
  for (const product of canvas) {
    const h = harness({ width: 1, height: 1, quantity: 2, product, ops: canvasOperations,
      selected: ['41', '42', '41'], operationQuantities: { 41: 2, 42: 8 } })
    const result = h.calculate()
    near(result.baseTotal, 15840) // Existing print allowance: 1.2 × 1.2 × 2 × 5500.
    near(result.extrasTotal, 31000) // 2 m² × 3500 + 8 m × 3000. No extra multiplication by item count.
    near(result.total, 46840)
    assert.equal(result.extras.length, 2)
    assert.deepEqual(Array.from(result.extras, op => op.id), ['41', '42'])
    const saved = await h.save()
    assert.equal(saved.category, 'wide-format')
    assert.equal(saved.quantity, 2)
    assert.deepEqual(saved.extras, result.extras)
    near(saved.total, 46840)
  }
  const changed = harness({ width: 1, height: 1, product: canvas[0], ops: {
    41: { ...canvasOperations[41], price: 4200 }
  }, selected: ['41'], operationQuantities: { 41: 0.5 } }).calculate()
  near(changed.extrasTotal, 2100)
})

test('selected canvas volume rejects blank, zero, negative and nonnumeric values; fractions are accepted', () => {
  for (const volume of ['', 0, -1, 'abc', '2abc', Infinity, NaN]) {
    const h = harness({ product: canvas[0], ops: canvasOperations, selected: ['41'], operationQuantities: { 41: volume } })
    assert.equal(h.calculate(), null)
  }
  near(harness({ product: canvas[0], ops: canvasOperations, selected: ['41'], operationQuantities: { 41: '0.25' } })
    .calculate().extrasTotal, 875)
})

test('advertising stands excludes migrated operations even when supplied stale catalog data', () => {
  const text = fs.readFileSync(new URL('../src/components/AdvertisingStandsCalculator.jsx', import.meta.url), 'utf8')
  const tree = parse(text, { sourceType: 'module', plugins: ['jsx'] })
  let callback
  walk(tree, node => {
    if (node.type === 'VariableDeclarator' && node.id.name === 'availableOperations') callback = node.init.arguments[0]
  })
  const ops = structuredClone({ ...canvasOperations, border: fixture.additionalOperations.border })
  for (const op of Object.values(ops)) op.applicableTo = ['advertising-stands']
  const available = vm.runInNewContext(`(${text.slice(callback.start, callback.end)})()`, { additionalOperations: ops, getCanvasOperationKey })
  assert.equal(available.length, 1)
  assert.equal(available[0].id, 'border')
})
