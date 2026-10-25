import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import * as catalog from '../src/lib/catalog.mjs'
import * as finishing from '../src/lib/wideFormatFinishing.mjs'
import { calculateStickerLayout } from '../src/lib/stickerLayout.mjs'
const require = createRequire(import.meta.url)
const { parse } = require('@babel/parser')
const fixture = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url), 'utf8'))
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)
function actual(file, bindings) {
  const source = fs.readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8')
  const tree = parse(source, { sourceType: 'module', plugins: ['jsx'] })
  const component = tree.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration
  const declarations = new Map(component.body.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).map(node => [node.id.name, node.init]))
  let result, saved; const alerts = []
  const context = { ...catalog, ...finishing, calculateStickerLayout, ...bindings,
    alert: message => alerts.push(message), setCalculation(value) { result = value; context.calculation = value },
    createOrder: async value => { saved = value }, setSavingOrder() {}, client: { id: 901, name: 'Test' }, orderStatus: 'draft' }
  for (const name of ['setWidth','setHeight','setQuantity','setSelectedServices','setIsUrgent','setOrderStatus','setCalculationUnused','setServiceQuantities','setSelectedServiceOptions','setSelectedAddServices','setOpts','setSearchMaterial','setSelectedMaterial','setSelectedColorType','setSelectedProduct','setDiscount','setNotes','setSelectedReorder']) context[name] = () => {}
  vm.createContext(context)
  vm.runInContext(tree.program.body.filter(node => node.type === 'FunctionDeclaration').map(node => source.slice(node.start, node.end)).join('\n'), context)
  for (const name of ['getPriceForQuantity','calculatePrice','handleCalculate','handleSaveOrder']) {
    const node = declarations.get(name)
    if (node) context[name] = vm.runInContext('(' + source.slice(node.start, node.end) + ')', context)
  }
  return { context, alerts, calculate() { (context.handleCalculate || context.calculatePrice)({ preventDefault() {} }); return result },
    async save() { await context.handleSaveOrder(); return saved } }
}

test('22: all 64 confirmed card tariffs match PDF page 7; unsupported tariffs remain manual', () => {
  const pdf = {1:[30,28,26,23],2:[32,30,28,26],3:[35,35,33,31],4:[48,47,46,45],7:[43,43,36,34],8:[53,53,46,44],11:[58,56,54,52],12:[70,68,66,64],19:[175,170,160,150],20:[300,290,280,270],31:[160,150,140,135],32:[310,300,280,270],23:[180,170,160,150],24:[410,400,390,380],27:[270,250,240,230],28:[450,430,400,350]}
  const h = actual('BusinessCardsCalculator.jsx', {})
  for (const product of fixture.businessCards) {
    if (product.id === 'bdg1') { assert.deepEqual(product.prices, {}); continue }
    assert.equal(h.context.getPriceForQuantity(product, 49), null)
    for (const [i, quantity] of [50,100,300,500].entries()) assert.equal(h.context.getPriceForQuantity(product, quantity), pdf[product.id]?.[i] ?? null)
  }
})

test('18: actual card calculation and save handler require a client and retain the correct order', async () => {
  const h = actual('BusinessCardsCalculator.jsx', { selectedProduct: fixture.businessCards[0], selectedCardType: 'business-cards', quantity: 100,
    manualBatchTotal: '', selectedServices: [], selectedAddServices: [], availableOperations: [], additionalServices: [],
    selectedServiceOptions: {}, serviceQuantities: {}, selectedReorder: 'no', reorderOptions: [], isUrgent: false, urgentSurcharge: 30, discount: 0, notes: '' })
  const result = h.calculate(); assert.equal(result.total, 2800)
  h.context.client = null; assert.equal(await h.save(), undefined)
  h.context.client = { id: 901, name: 'Test' }; const order = await h.save()
  assert.equal(order.client.id, 901); assert.equal(order.quantity, 100); assert.equal(order.productName, fixture.businessCards[0].name); assert.equal(order.total, 2800)
})

function textile(width, height, quantity, flagProduct = null) {
  return actual('TextilePrintingCalculator.jsx', { width, height, quantity, flagProduct,
    selectedMaterial: fixture.textile[0], availableOperations: Object.values(fixture.additionalOperations).filter(op => op.applicableTo.includes('textile')),
    selectedServices: ['flagStitching'], isUrgent: false, urgentSurcharge: 30 })
}
test('19/36: custom flag uses existing textile and perimeter tariffs, saves dimensions and blocks contractual prices', async () => {
  const h = textile('1.2', '1.7', 2, fixture.flagsProducts[0]); const result = h.calculate()
  near(result.baseTotal, 30600); near(result.extrasTotal, 8700); near(result.total, 39300)
  const order = await h.save()
  assert.equal(order.category, 'flags-products'); assert.equal(order.sizeMode, 'custom'); assert.equal(order.width, 1.2); assert.equal(order.height, 1.7)
  assert.equal(order.flagProductId, fixture.flagsProducts[0].id); assert.equal(order.size, '1.2*1.7')
  const changedMaterial = textile('1.2', '1.7', 2, fixture.flagsProducts[0])
  changedMaterial.context.selectedMaterial = fixture.textile[1]
  changedMaterial.calculate()
  const changedOrder = await changedMaterial.save()
  assert.ok(changedOrder.productName.includes(fixture.textile[1].name))
  assert.equal(changedOrder.flagProductName, fixture.flagsProducts[0].name)
  near(textile(1, 1.5, 100).calculate().extrasTotal, 375000)
  const over = textile(1, 1.5, 101); assert.match(over.calculate().note, /договорная/); assert.equal(await over.save(), undefined)
  for (const [w,h,q] of [['',1,1],[0,1,1],[-1,1,1],['abc',1,1],[1,1,1.5],[1,1,0]]) assert.equal(textile(w,h,q).calculate(), undefined)
})

test('32: numeric API pocket IDs use option tariff × count, automatically add required border and save the breakdown', async () => {
  const pocket = { ...fixture.additionalOperations.pockets, id: '901' }, border = { ...fixture.additionalOperations.border, id: '902' }
  const h = actual('AdvertisingStandsCalculator.jsx', { selectedItem: fixture.advertisingStands[0], width: '0.5', height: '0.5', quantity: 1,
    effectiveThickness: { label: 'ПВХ 3 мм', price: 18500 }, opts: { pocket: 'a4', pocketQty: 2 },
    pocketOp: pocket, quantityOps: [border], borderOp: border, automaticBorder: true, isUrgent: false, urgentSurcharge: 30 })
  const result = h.calculate(); assert.equal(result.baseTotal, 4625); assert.equal(result.total, 9125)
  assert.equal(result.extras[0].id, '901'); assert.equal(result.extras[0].optionId, 'a4'); assert.equal(result.extras[0].price, 3000)
  assert.equal(result.extras[1].price, 1500); assert.equal(result.extras[1].automatic, true)
  const order = await h.save(); assert.equal(order.width, 0.5); assert.equal(order.options.pocketQty, 2); assert.ok(order.productName)
})

test('29: 45 stickers 15×30 cm fit on the configured 1.2 m vinyl; contour volume and rates are explicit', async () => {
  const product = fixture.wideFormat.find(item => item.id === 'wf-roland-vinyl-4pass')
  assert.equal(product.rollWidth, 1.2)
  const contour = { ...fixture.additionalOperations.contourCutting, id: '903' }
  const h = actual('WideFormatCalculator.jsx', { width: '0.15', height: '0.3', quantity: 45, selectedMaterial: product,
    stickerMode: true, stickerGap: '0', availableOperations: [contour], selectedServices: ['903'], serviceQuantities: {903:2.025},
    selectedServiceOptions: {}, selectedAddServices: [], availableServices: [], additionalOperations: {903:contour}, includeWaste: true,
    effectiveGroup: 'roland', WIDE_FORMAT_GROUPS: { roland: 'Roland' }, isUrgent: false, urgentSurcharge: 30 })
  const result = h.calculate(); assert.equal(result.stickerLayout.columns, 3); assert.equal(result.stickerLayout.rows, 15)
  near(Number(result.itemArea), 0.045)
  near(Number(result.factualArea), 2.695); near(result.baseTotal, 12127.5); near(result.extrasTotal, 4050); near(result.total, 16177.5)
  const order = await h.save(); assert.equal(order.quantity, 45); assert.equal(order.stickerLayout.rollWidth, 1.2)
  assert.throws(() => calculateStickerLayout({ width: 2, height: 3, quantity: 45, rollWidth: 1.2, margin: 0.2, gap: 0 }))
})

test('30: installation is excluded from typography only; other services and categories retain it', () => {
  const mount = { name: 'Монтаж / демонтаж конструкции' }
  for (const category of ['printing','flyers','booklets','notebooks','multipage']) assert.equal(catalog.isServiceAllowed(mount, category), false)
  assert.equal(catalog.isServiceAllowed(mount, 'wide-format'), true)
  assert.equal(catalog.isServiceAllowed({ name: 'Ламинация' }, 'printing'), true)
})

test('saved specifications restore dimensions, operations and layout when loading a server order', () => {
  const source = fs.readFileSync(new URL('../src/hooks/useOrders.jsx', import.meta.url), 'utf8')
  const tree = parse(source, { sourceType: 'module', plugins: ['jsx'] }); let node
  function walk(value) { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) return value.forEach(walk)
    if (value.type === 'VariableDeclarator' && value.id.name === 'normalizeOrder') node = value.init
    Object.values(value).forEach(walk) }
  walk(tree)
  const normalize = vm.runInNewContext('(' + source.slice(node.start,node.end) + ')')
  const spec = { width: 1.2, height: 1.7, sizeMode: 'custom', materialName: 'Атлас', extras: [{name:'Прошивка',price:8700}], stickerLayout: {columns:3,rows:15} }
  const order = normalize({ id: 1, total_amount: 39300, items: [{ product_name: 'Флаг', quantity: 2, specifications: spec }] })
  assert.equal(order.width, 1.2); assert.equal(order.height, 1.7); assert.equal(order.quantity, 2); assert.equal(order.total, 39300)
  assert.equal(order.materialName, 'Атлас'); assert.equal(order.extras[0].price, 8700); assert.equal(order.stickerLayout.rows, 15)
})

test('price correction migration preserves IDs, custom-edited values and order history; repeat does not reapply', async () => {
  const changes = require('../server/price-corrections-2026.json').updates
  const migrate = require('../server/apply-price-corrections.js')
  const rows = changes.map((change, index) => ({ id: index + 100, value: structuredClone(change.before) }))
  rows[0].value.upTo49 = 999
  const originalIds = rows.map(row => row.id)
  const pool = { async connect() { return { release() {}, async query(sql, values) {
    if (!sql.startsWith('UPDATE')) return { rows: [] }
    assert.ok(!/order_items|UPDATE orders|INSERT|DELETE/.test(sql))
    const change = changes.find(item => item.name === values[1] && (item.colorType ? item.colorType === values[2] : item.category ? item.category === values[2] : true))
    const row = rows[changes.indexOf(change)]
    const expected = change.table === 'wide_format_pricing' ? values[3] : JSON.parse(values.at(-1))
    if (JSON.stringify(row.value) !== JSON.stringify(expected)) return { rowCount: 0 }
    row.value = change.table === 'wide_format_pricing' ? values[0] : JSON.parse(values[0])
    return { rowCount: 1, rows: [{ id: row.id }] }
  } } } }
  assert.equal((await migrate(pool)).updated, changes.length - 1)
  assert.equal((await migrate(pool)).updated, 0)
  assert.equal(rows[0].value.upTo49, 999)
  assert.deepEqual(rows.map(row => row.id), originalIds)
})
