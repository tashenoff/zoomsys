import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import { catalogConfig, getDisplayCategories, getEnabledWideFormatMaterials, isWideFormatGroupEnabled,
  resolvePricingTab, isBadgeProduct, filterCardProducts, getManualBadgeQuote, getCanvasOperationKey, isCanvasMaterial, isServiceAllowed } from '../src/lib/catalog.mjs'

const require = createRequire(import.meta.url)
const React = require('react')
const { transformSync } = require('esbuild')
const { parse } = require('@babel/parser')
const policy = require('../server/catalog-policy.js')
const fixture = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url), 'utf8'))
const badge = fixture.businessCards.find(isBadgeProduct)
const ordinary = fixture.businessCards.find(item => !isBadgeProduct(item))
const helpers = { catalogConfig, getDisplayCategories, getEnabledWideFormatMaterials, isWideFormatGroupEnabled,
  resolvePricingTab, isBadgeProduct, filterCardProducts, getManualBadgeQuote, getCanvasOperationKey, isCanvasMaterial, isServiceAllowed }

function elements(node, predicate = () => true, found = []) {
  if (Array.isArray(node)) node.forEach(child => elements(child, predicate, found))
  else if (React.isValidElement(node)) {
    if (predicate(node)) found.push(node)
    elements(node.props.children, predicate, found)
  }
  return found
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  if (React.isValidElement(node)) return text(node.props.children)
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}

// Compile the actual JSX in memory; no service, browser, filesystem output or real API is used.
function componentRuntime(file, { extraExports = [], initialStates = [], pricing = fixture } = {}) {
  const source = fs.readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8')
  const compiled = transformSync(source + (extraExports.length ? `\nexport { ${extraExports.join(', ')} };` : ''), {
    loader: 'jsx', format: 'cjs', jsx: 'automatic', target: 'node18'
  }).code
  const state = [...initialStates]
  const calls = []
  let cursor = 0
  const module = { exports: {} }
  const api = { async request(...args) { calls.push(args); return { id: 'test-only' } } }
  const react = { ...React,
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
    },
    useMemo(fn) { return fn() }, useEffect() {}, useRef() { return { current: null } }
  }
  const context = {
    module, exports: module.exports, alert() {}, confirm() { return true },
    require(name) {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return require(name)
      if (name.endsWith('/catalog.mjs')) return helpers
      if (name.endsWith('/wideFormatFinishing.mjs')) return finishing
      if (name.endsWith('/garmentPricing.mjs')) return garmentPricing
      if (name.endsWith('/usePricing')) return { usePricing: () => ({ pricing, loading: false, isOffline: false, refreshPricing: async () => {} }) }
      if (name.endsWith('/useAuth')) return { useAuth: () => ({ user: { role: 'admin' }, hasPermission: () => true }) }
      if (name.endsWith('/useOrders')) return { useOrders: () => ({ createOrder: async payload => calls.push(payload), isOnline: true }) }
      if (name.endsWith('/data/pricing.json')) return fixture
      if (name.endsWith('/lib/api')) return api
      if (name.endsWith('.svg')) return 'test-logo.svg'
      return { __esModule: true, default: () => null, ChevronDownIcon: () => null }
    }
  }
  vm.createContext(context)
  vm.runInContext(compiled, context)
  return { state, calls, exports: module.exports,
    render(name = 'default', props = {}) { cursor = 0; return module.exports[name](props) }
  }
}
const finishing = await import('../src/lib/wideFormatFinishing.mjs')
const garmentPricing = await import('../src/lib/garmentPricing.mjs')

test('21: editing a printing row keeps its subsection and saves through /pricing/printing', async () => {
  const item = fixture.printing.find(item => item.category === 'flyers')
  const runtime = componentRuntime('PricingManagement.jsx', { initialStates: ['printing'] })
  const page = runtime.render()
  const table = elements(page, element => typeof element.type === 'function' && element.props.items === fixture.printing)[0]
  table.props.onEdit(item)
  const modal = elements(runtime.render(), element => typeof element.type === 'function' && element.props.onSave)[0]
  assert.equal(modal.props.category, 'printing')
  await modal.props.onSave({ ...item, prices: { ...item.prices } })
  assert.equal(runtime.calls[0][0], `/pricing/printing/${item.id}`)
  assert.equal(runtime.calls[0][1].body.category, 'flyers')
})

test('27: operations are grouped by product sections; numeric-ID pockets retain selectable variants in price editing', () => {
  const runtime = componentRuntime('PricingManagement.jsx', { extraExports: ['AdditionalOperationsTable', 'OperationEditForm'] })
  const table = runtime.render('AdditionalOperationsTable', { items: Object.values(fixture.additionalOperations) })
  assert.equal(table.props.getGroup(fixture.additionalOperations.pockets), 'Рекламные стенды')
  assert.equal(table.props.getGroup(fixture.additionalOperations.flagStitching), 'Текстиль')
  const editor = runtime.render('OperationEditForm', { formData: { ...fixture.additionalOperations.pockets, id: '901' }, setFormData() {} })
  assert.ok(text(editor).includes('Выбор опции и количество'))
  assert.ok(elements(editor, element => element.type === 'input' && element.props.value === 'A4').length)
})

test('19: custom flag selection reuses the textile calculator and returns to standard sizes', () => {
  const runtime = componentRuntime('FlagsProductsCalculator.jsx')
  const button = elements(runtime.render(), element => element.type === 'button' && text(element) === 'Нестандартный размер')[0]
  assert.ok(button); button.props.onClick()
  const custom = runtime.render()
  const calculator = elements(custom, element => typeof element.type === 'function' && element.props.flagProduct)[0]
  assert.equal(calculator.props.flagProduct.id, fixture.flagsProducts[0].id)
  elements(custom, element => element.type === 'button' && text(element).includes('Стандартные размеры'))[0].props.onClick()
  assert.ok(elements(runtime.render(), element => element.type === 'button' && text(element) === 'Нестандартный размер').length)
})

test('garment price editor exposes named variants and saves them through the existing pricing endpoint', async () => {
  const item = fixture.garmentPrinting.find(item => item.type === 'sublimation')
  const runtime = componentRuntime('PricingManagement.jsx', {
    extraExports: ['GarmentProductsEditForm', 'GarmentPrintingTable'], initialStates: ['garmentPrinting']
  })
  let edited
  const editor = runtime.render('GarmentProductsEditForm', { formData: item, setFormData: value => { edited = value } })
  const variants = elements(editor, element => element.type === 'input' && element.props['aria-label'] === 'Название варианта')
  assert.deepEqual(variants.map(element => element.props.value), ['Кружка белая', 'Кружка перламутровая'])
  variants[1].props.onChange({ target: { value: 'Кружка перламутровая — тест' } })
  assert.equal(edited.productOptions[0].variants[1].id, 'pearl')
  const page = runtime.render()
  const table = elements(page, element => typeof element.type === 'function' && element.props.items === fixture.garmentPrinting)[0]
  const row = elements(runtime.render('GarmentPrintingTable', table.props), element => element.type === 'tr' && text(element).includes(item.name))[0]
  elements(row, element => element.type === 'button' && text(element) === 'Изменить')[0].props.onClick()
  const modal = elements(runtime.render(), element => typeof element.type === 'function' && element.props.onSave)[0]
  await modal.props.onSave(edited)
  assert.equal(runtime.calls[0][0], `/pricing/garment-printing/${item.id}`)
  assert.equal(runtime.calls[0][1].method, 'PUT')
  assert.deepEqual(plainForTest(runtime.calls[0][1].body.product_options), plainForTest(edited.productOptions))
  assert.equal(runtime.calls[0][1].body.price_per_sqcm, 20)
})

function plainForTest(value) { return JSON.parse(JSON.stringify(value)) }

test('canvas price editor preserves numeric operation IDs and can disable each binding without affecting prices', () => {
  const product = fixture.wideFormat.find(item => item.id === 'wf-mimaki-canvas')
  const operations = [
    { ...fixture.additionalOperations.canvasStretch, id: '41' },
    { ...fixture.additionalOperations.subframe, id: '42' }
  ]
  let saved
  const runtime = componentRuntime('PricingManagement.jsx', { extraExports: ['EditModal'] })
  const props = { category: 'wideFormat', item: { ...product, operations: ['wideFormatCutting', '41', '42'] },
    operations, onSave(value) { saved = value } }
  let tree = runtime.render('EditModal', props)
  const canvasLabel = elements(tree, node => node.type === 'label' && text(node).includes('Натяжка холста'))[0]
  assert.ok(canvasLabel)
  const checkbox = elements(canvasLabel, node => node.type === 'input')[0]
  assert.equal(checkbox.props.checked, true)
  checkbox.props.onChange({ target: { checked: false } })
  tree = runtime.render('EditModal', props)
  elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.deepEqual(Array.from(saved.operations), ['wideFormatCutting', '42'])
  assert.equal(saved.pricePerSqm, product.pricePerSqm)
  assert.deepEqual(saved.prices, product.prices)
  const other = componentRuntime('PricingManagement.jsx', { extraExports: ['EditModal'] })
    .render('EditModal', { ...props, item: { ...product, name: 'Винил' } })
  assert.equal(elements(other, node => node.type === 'label' && /Натяжка холста|Подрамник/.test(text(node))).length, 0)
})

test('26/25: labels change without changing category IDs, slugs or source records', () => {
  const original = JSON.stringify(fixture.categories)
  const displayed = getDisplayCategories(fixture.categories)
  assert.equal(displayed.find(item => item.slug === 'garment-printing').name, 'Брендирование продукции')
  const sign = displayed.find(item => item.slug === 'state-symbols').subcategories.find(item => item.slug === 'signs')
  assert.equal(sign.name, 'Ведомственная табличка')
  assert.equal(sign.id, fixture.categories.find(item => item.slug === 'state-symbols').subcategories.find(item => item.slug === 'signs').id)
  assert.equal(JSON.stringify(fixture.categories), original)
  const nav = componentRuntime('Sidebar.jsx', { initialStates: ['3', ''] }).render()
  assert.ok(text(nav).includes('Брендирование продукции'))
  assert.ok(text(nav).includes('Ведомственная табличка'))
  assert.ok(!text(nav).includes('Вывески'))
  assert.ok(text(componentRuntime('GarmentPrintingCalculator.jsx').render()).includes('Брендирование продукции'))
})

test('24: a single main price tab contains all three original collections', () => {
  const runtime = componentRuntime('PricingManagement.jsx')
  const root = runtime.render()
  const combined = elements(root, node => node.type === 'button' && text(node).includes('Символика и текстиль'))
  assert.equal(combined.length, 1)
  const count = fixture.stateSymbols.length + fixture.textile.length + fixture.flagsProducts.length
  assert.ok(text(combined[0]).includes(`(${count})`))
  for (const section of catalogConfig.combinedPricing.sections) assert.equal(resolvePricingTab('symbolsTextile', section.id), section.id)
  assert.equal(resolvePricingTab('businessCards', 'textile'), 'businessCards')
})

test('24: edits/additions keep the original endpoint and product subcategory in every combined subsection', async () => {
  for (const [section, tableName, endpoint] of [
    ['stateSymbols', 'StateSymbolsTable', 'state-symbols'], ['textile', 'TextileTable', 'textile'], ['flagsProducts', 'FlagsProductsTable', 'flags-products']
  ]) {
    const runtime = componentRuntime('PricingManagement.jsx', {
      extraExports: [tableName, 'EditModal'], initialStates: ['symbolsTextile', section]
    })
    let root = runtime.render()
    const table = elements(root, element => element.type === runtime.exports[tableName])[0]
    assert.equal(table.props.items, fixture[section])
    const item = fixture[section][0]
    table.props.onEdit(item)
    root = runtime.render()
    let modal = elements(root, element => element.type === runtime.exports.EditModal)[0]
    assert.equal(modal.props.category, section)
    assert.equal(modal.props.item.category, item.category)
    await modal.props.onSave(modal.props.item)
    const [url, request] = runtime.calls.at(-1)
    assert.equal(url, `/pricing/${endpoint}/${item.id}`)
    assert.equal(request.method, 'PUT')
    assert.equal(request.body.category, item.category)
    root = runtime.render()
    elements(root, element => element.type === 'button' && text(element).includes('Добавить позицию'))[0].props.onClick()
    root = runtime.render()
    modal = elements(root, element => element.type === runtime.exports.EditModal)[0]
    assert.equal(modal.props.category, section)
    assert.equal(modal.props.item, null)
  }
})

test('24: global price search includes textile and finished products without changing routing keys', () => {
  const runtime = componentRuntime('PricingManagement.jsx', { extraExports: ['GlobalSearchResults', 'StateSymbolsTable', 'TextileTable', 'FlagsProductsTable'] })
  const root = runtime.render('GlobalSearchResults', { localPricing: fixture, additionalOperationsList: [], query: '', onEdit() {}, onDelete() {} })
  for (const [name, key] of [['StateSymbolsTable', 'stateSymbols'], ['TextileTable', 'textile'], ['FlagsProductsTable', 'flagsProducts']]) {
    const table = elements(root, element => element.type === runtime.exports[name])[0]
    assert.equal(table.props.items.length, fixture[key].length)
  }
})

test('23: Phaeton is hidden from new calculations/navigation/pricing but source materials are retained', () => {
  const before = JSON.stringify(fixture.wideFormat)
  const enabled = getEnabledWideFormatMaterials(fixture.wideFormat)
  assert.equal(enabled.some(item => item.category === 'phaeton'), false)
  assert.ok(fixture.wideFormat.some(item => item.category === 'phaeton'))
  assert.equal(JSON.stringify(fixture.wideFormat), before)
  const nav = componentRuntime('Sidebar.jsx', { initialStates: ['wide-format', ''] }).render()
  assert.ok(!text(nav).includes('Phaeton'))
  assert.ok(text(nav).includes('MIMAKI'))
  const runtime = componentRuntime('PricingManagement.jsx', { extraExports: ['WideFormatTable'] })
  const table = runtime.render('WideFormatTable', { items: fixture.wideFormat, onEdit() {}, onDelete() {} })
  assert.equal(table.props.items.some(item => item.category === 'phaeton'), false)
})

test('20: batch amount is mandatory; no unit tariff is inferred from 700 or legacy 7', () => {
  assert.ok(badge)
  assert.deepEqual(filterCardProducts(fixture.businessCards, 'badges').map(item => item.id), [badge.id])
  assert.equal(filterCardProducts(fixture.businessCards, 'business-cards').some(isBadgeProduct), false)
  for (const amount of ['', 0, -1, 'invalid', Infinity]) assert.equal(getManualBadgeQuote(100, amount), null)
  for (const quantity of [0, -1, 1.5, NaN]) assert.equal(getManualBadgeQuote(quantity, 1000), null)
  assert.deepEqual(getManualBadgeQuote(100, 25000), { pricingMode: 'manual', manualBatchTotal: 25000, unitPrice: 250, baseTotal: 25000 })
  const read = policy.normalizeBusinessCardPricing(badge)
  assert.deepEqual(read.prices, {})
  assert.equal(read.pricing_mode, 'manual')
  assert.equal(policy.normalizeBusinessCardPricing(ordinary), ordinary)
})

test('20: actual price table and badge edit form show individual calculation rather than a fixed 7', () => {
  const runtime = componentRuntime('PricingManagement.jsx', { extraExports: ['BusinessCardsTable', 'EditModal'] })
  const wrapper = runtime.render('BusinessCardsTable', { items: [badge], onEdit() {}, onDelete() {} })
  const table = wrapper.props.children([badge])
  assert.ok(text(table).includes('Индивидуальный расчёт'))
  assert.ok(!text(table).includes('7 ₸'))
  const modalRuntime = componentRuntime('PricingManagement.jsx', { extraExports: ['EditModal'] })
  const modal = modalRuntime.render('EditModal', { item: badge, category: 'businessCards', onClose() {}, onSave() {} })
  assert.ok(text(modal).includes('индивидуальный расчёт'))
  assert.ok(!text(modal).includes('Градации цен по тиражу'))
})

function calculationHarness({ product = badge, quantity = 100, manualBatchTotal = '', cardType = 'badges' } = {}) {
  const source = fs.readFileSync(new URL('../src/components/BusinessCardsCalculator.jsx', import.meta.url), 'utf8')
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] })
  const component = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration
  const declarations = new Map(component.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).map(node => [node.id.name, node.init]))
  let result
  let saved
  const context = { ...helpers, selectedProduct: product, selectedCardType: cardType, quantity, manualBatchTotal,
    selectedServices: [], selectedAddServices: [], additionalServices: [], availableOperations: [], selectedServiceOptions: {}, serviceQuantities: {},
    selectedReorder: 'no', reorderOptions: [], isUrgent: false, urgentSurcharge: 30, discount: 0, notes: '',
    client: { id: 'test-client' }, orderStatus: 'draft', alert() {}, setSavingOrder() {},
    setCalculation(value) { result = value; context.calculation = value }, createOrder: async payload => { saved = payload }
  }
  for (const name of ['setSearchMaterial', 'setSelectedMaterial', 'setSelectedColorType', 'setSelectedProduct', 'setQuantity', 'setSelectedServices', 'setSelectedAddServices', 'setIsUrgent', 'setDiscount', 'setNotes', 'setOrderStatus', 'setSelectedReorder']) context[name] = () => {}
  vm.createContext(context)
  for (const name of ['getPriceForQuantity', 'calculatePrice', 'handleSaveOrder']) {
    const node = declarations.get(name)
    vm.runInContext(`globalThis.${name} = ${source.slice(node.start, node.end)}`, context)
  }
  return { context, calculate() { context.calculatePrice(); return result }, async save() { await context.handleSaveOrder(); return saved } }
}

test('20: actual calculator uses the quoted batch amount and saves manual-pricing evidence', async () => {
  assert.equal(calculationHarness().calculate(), null)
  const h = calculationHarness({ manualBatchTotal: 25000 })
  const result = h.calculate()
  assert.equal(result.total, 25000)
  assert.equal(result.unitPrice, 250)
  assert.equal(result.productType, 'badges')
  const payload = await h.save()
  assert.equal(payload.category, 'business-cards')
  assert.equal(payload.pricingMode, 'manual')
  assert.equal(payload.manualBatchTotal, 25000)
  const stale = calculationHarness({ manualBatchTotal: 10000 })
  stale.calculate()
  stale.context.manualBatchTotal = ''
  assert.equal(await stale.save(), undefined)
  const regular = calculationHarness({ product: ordinary, cardType: 'business-cards' }).calculate()
  assert.equal(regular.unitPrice, ordinary.prices['100to299'])
  assert.equal(regular.total, ordinary.prices['100to299'] * 100)
})

function route(router, method, path) {
  return router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle
}
async function invoke(handler, request) {
  let status = 200, output
  await handler(request, { status(value) { status = value; return this }, json(value) { output = value; return this } })
  return { status, output }
}

test('23/20: backend rejects disabled equipment and legacy automatic badge payloads before any SQL', async () => {
  let queries = 0
  const router = require('../server/routes/orders.js')({ async query() { queries++; throw Error('Unexpected query') } })
  for (const specifications of [{ wideGroup: 'phaeton' }, { equipment: 'Широкоформатная печать Phaeton UD-3208P' }]) {
    const response = await invoke(route(router, 'post', '/'), { body: { category: 'wide-format', items: [{ specifications }] } })
    assert.equal(response.status, 400)
  }
  const response = await invoke(route(router, 'post', '/'), { body: {
    category: 'business-cards', items: [{ product_name: badge.name, quantity: 100, unit_price: 7, specifications: { baseTotal: 700 } }]
  } })
  assert.equal(response.status, 400)
  assert.equal(queries, 0)
  const result = calculationHarness({ manualBatchTotal: 25000 }).calculate()
  assert.equal(policy.validateCatalogOrder({ category: 'business-cards', items: [{ product_name: badge.name, quantity: 100, specifications: result }] }), null)
})

test('23/24/25/26: old orders keep their categories, labels, totals and specifications on reads', async () => {
  const old = { id: 'history', category: 'wide-format', total_amount: 83540 }
  const item = { product_name: 'Баннер', specifications: { equipment: 'Phaeton UD-3208P', total: 83540 } }
  const router = require('../server/routes/orders.js')({ async query(sql) {
    assert.ok(sql.trim().startsWith('SELECT'))
    return { rows: sql.includes('order_items') ? [item] : [old] }
  } })
  const response = await invoke(route(router, 'get', '/:id'), { params: { id: old.id } })
  assert.equal(response.status, 200)
  assert.equal(response.output.category, old.category)
  assert.equal(response.output.total_amount, 83540)
  assert.deepEqual(response.output.items[0], item)
})

test('20: real pricing read handlers suppress legacy badge tariffs without changing source rows', async () => {
  const row = { id: 37, name: badge.name, color_type: '4+0', prices: { upTo49: 7 }, is_active: true }
  const original = JSON.stringify(row)
  const router = require('../server/routes/pricing.js')({ async query(sql) {
    assert.ok(sql.startsWith('SELECT'))
    return { rows: sql.includes('business_cards_pricing') ? [row] : [] }
  } })
  for (const path of ['/', '/business-cards']) {
    const response = await invoke(route(router, 'get', path), {})
    assert.equal(response.status, 200)
    const output = path === '/' ? response.output.businessCards : response.output
    assert.equal(output[0].id, row.id)
    assert.equal(output[0].is_active, true)
    assert.deepEqual(output[0].prices, {})
    assert.equal(output[0].pricing_mode, 'manual')
  }
  assert.equal(JSON.stringify(row), original)
})
