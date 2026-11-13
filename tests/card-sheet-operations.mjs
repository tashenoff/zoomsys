import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { calculateCardOperations, cardSheetCount, isCurrentCardProduct } from '../src/lib/cardSheetPricing.mjs'
const pricing = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url), 'utf8'))
const operations = Object.values(pricing.additionalOperations)
const quote = overrides => calculateCardOperations({ quantity: 100, format: 'A4', yieldPerSheet: 10, operations, ...overrides })
test('sheet counts round up, A3 requires an explicit positive integer yield', () => {
  assert.equal(cardSheetCount(100, 10, 'A4'), 10)
  assert.equal(cardSheetCount(101, 10, 'A4'), 11)
  assert.equal(cardSheetCount(1, 10, 'A4'), 1)
  assert.equal(cardSheetCount(101, 20, 'A3'), 6)
  for (const invalid of ['', 0, -1, 1.5, NaN, Infinity]) {
    assert.equal(cardSheetCount(100, invalid, 'A3'), null)
    assert.equal(cardSheetCount(invalid, 10, 'A4'), null)
  }
  assert.equal(cardSheetCount(100, 10, 'A5'), null)
})
for (const [id, option, rate] of [['prepress', 'leaflet-gloss-a4-1', 90], ['laminationPacket', 'gloss-a4', 250], ['foiling', 'foil-a4-1', 150]]) {
  for (const sides of [1, 2]) test(`${id}: live tariff × ceil(qty/yield) × ${sides} sides`, () => {
    const args = { selected: [id], options: { [id]: option }, sides: { [id]: sides } }
    assert.equal(quote(args).total, rate * 10 * sides)
    assert.equal(quote({ ...args, quantity: 101 }).total, rate * 11 * sides)
    assert.equal(quote({ ...args, operations: operations.map(op => op.id === id ? { ...op, options: op.options.map(opt => opt.id === option ? { ...opt, price: 17 } : opt) } : op) }).total, 17 * 10 * sides)
    assert.equal(quote({ ...args, sides: { [id]: 3 } }), null)
    assert.equal(quote({ ...args, format: 'A3' }), null)
    assert.equal(quote({ ...args, options: {} }), null)
  })
}
test('A3 uses selected A3 rate and explicit yield, not an invented multiplier', () => {
  assert.equal(quote({ format: 'A3', yieldPerSheet: 18, selected: ['foiling'], options: { foiling: 'foil-a3-1' }, sides: { foiling: 2 } }).total, 6 * 250 * 2)
})
test('rounding validates each corner count and uses live rates', () => {
  for (let corners = 1; corners <= 4; corners++) assert.equal(quote({ selected: ['cornerRounding'], quantities: { cornerRounding: corners } }).total, 7 * corners * 100)
  assert.equal(quote({ selected: ['cornerRounding'], operations: operations.map(op => op.id === 'cornerRounding' ? { ...op, price: 9 } : op) }).total, 3600)
  for (const corners of [0, -1, 1.5, 5, '', NaN, Infinity]) assert.equal(quote({ selected: ['cornerRounding'], quantities: { cornerRounding: corners } }), null)
})
test('invalid live prices and selections do not produce partial/NaN/negative quotes', () => {
  for (const price of [-1, NaN, Infinity, null, '']) assert.equal(quote({ selected: ['cornerRounding'], operations: [{ id: 'cornerRounding', price }] }), null)
  assert.equal(quote({ selected: ['removed'] }), null)
  assert.equal(quote({ selectedExtras: ['mount'], extraServices: [{ id: 'mount', name: 'Монтаж', price: 100 }] }), null)
})
test('duplicates across selections and extra services count once; reorder discount scales complete sheet charge', () => {
  assert.equal(quote({ selected: ['foiling', 'foiling'], options: { foiling: 'foil-a4-1' }, selectedExtras: ['duplicate'], extraServices: [{ id: 'duplicate', name: 'Фольгирование', price: 1500 }] }).total, 1500)
  assert.equal(quote({ selected: ['prepress'], options: { prepress: 'leaflet-gloss-a4-1' }, sides: { prepress: 2 }, reorderDiscount: 25 }).total, 1350)
})
test('Touch Cover monochrome variants are hidden without mutating stored products', () => {
  const product = { name: 'Touch Cover 300 г', colorType: '1+1' }
  assert.equal(isCurrentCardProduct(product), false)
  assert.equal(product.colorType, '1+1')
  assert.equal(isCurrentCardProduct({ name: 'Тачкавер с лаком', colorType: '1+0' }), false)
  assert.equal(isCurrentCardProduct({ ...product, colorType: '1+0' }), false)
  assert.equal(isCurrentCardProduct({ ...product, colorType: '4+4' }), true)
  assert.equal(isCurrentCardProduct({ name: 'Черно-белые', colorType: '1+0' }), true)
})

import vm from 'node:vm'
import { createRequire } from 'node:module'
import * as catalog from '../src/lib/catalog.mjs'
import * as sheetHelpers from '../src/lib/cardSheetPricing.mjs'
const require = createRequire(import.meta.url)
const React = require('react')
const { transformSync } = require('esbuild')
const source = fs.readFileSync(new URL('../src/components/BusinessCardsCalculator.jsx', import.meta.url), 'utf8')
const compiled = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic', target: 'node18' }).code
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  if (React.isValidElement(node)) return text(node.props.children)
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}
function elements(node, predicate, result = []) {
  if (Array.isArray(node)) node.forEach(child => elements(child, predicate, result))
  else if (React.isValidElement(node)) {
    if (predicate(node)) result.push(node)
    elements(node.props.children, predicate, result)
  }
  return result
}

// Run the real JSX and effects until state settles, including dependency comparison.
// A state/effect loop fails the test instead of hanging a browser tab.
function runtime() {
  const hooks = []; let cursor = 0, dirty = false, effects = []
  let livePricing = structuredClone(pricing); const calls = []; const client = { id: 901, name: 'Local test' }
  const changed = (previous, next) => !previous || !next || previous.length !== next.length || previous.some((value, index) => !Object.is(value, next[index]))
  const react = { ...React,
    useState(initial) {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
      return [hooks[index], value => {
        const next = typeof value === 'function' ? value(hooks[index]) : value
        if (!Object.is(next, hooks[index])) { hooks[index] = next; dirty = true }
      }]
    },
    useRef(initial) { const index = cursor++; return hooks[index] ||= { current: initial } },
    useMemo(fn, deps) { const index = cursor++; if (changed(hooks[index]?.deps, deps)) hooks[index] = { value: fn(), deps }; return hooks[index].value },
    useEffect(fn, deps) { const index = cursor++; if (changed(hooks[index], deps)) { hooks[index] = deps; effects.push(fn) } }
  }
  const module = { exports: {} }
  vm.runInNewContext(compiled, { module, exports: module.exports, setTimeout() {}, alert() {},
    require(name) {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return require(name)
      if (name.endsWith('/catalog.mjs')) return catalog
      if (name.endsWith('/cardSheetPricing.mjs')) return sheetHelpers
      if (name.endsWith('/usePricing')) return { usePricing: () => ({ pricing: livePricing, loading: false }) }
      if (name.endsWith('/useOrders')) return { useOrders: () => ({ isOnline: true, createOrder: async value => calls.push(value) }) }
      if (name.endsWith('/pricing.json')) return pricing
      return { __esModule: true, default: () => null }
    } })
  return { calls, setPricing(value) { livePricing = value },
    render() {
      let tree
      for (let pass = 0; pass < 30; pass++) {
        dirty = false; cursor = 0; effects = []
        tree = module.exports.default({ client })
        effects.forEach(fn => fn())
        if (!dirty) return tree
      }
      throw Error('Calculator state did not settle after 30 renders')
    } }
}
const button = (tree, label) => elements(tree, node => node.type === 'button' && text(node).trim() === label)[0]


const savedQuote = tree => elements(tree, node => node.type === 'button' && /Сохранить заказ/i.test(text(node)))[0]
function pricedApp() {
  const app = runtime(); let tree = app.render()
  tree.props.onSelectCategory('business-cards'); tree = app.render()
  button(tree, 'Черно-белые').props.onClick(); tree = app.render()
  elements(tree, node => node.type === 'button' && text(node).startsWith('1+0'))[0].props.onClick()
  tree = app.render(); button(tree, 'Рассчитать').props.onClick()
  return { app, tree: app.render() }
}
test('real JSX: notes and live tariff changes clear quote and prevent stale saving', () => {
  const { app, tree } = pricedApp()
  assert.ok(savedQuote(tree))
  elements(tree, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Updated note' } })
  let next = app.render(); assert.equal(savedQuote(next), undefined)
  button(next, 'Рассчитать').props.onClick(); next = app.render()
  assert.match(text(next), /Updated note/); assert.ok(savedQuote(next))
  const updated = structuredClone(pricing); updated.settings.urgentSurcharge = 42
  app.setPricing(updated); next = app.render(); assert.equal(savedQuote(next), undefined)
})
test('real JSX: zero quantity removes previous result and disables calculation', () => {
  const { app, tree } = pricedApp()
  elements(tree, node => node.type === 'input' && node.props.value === 100)[0].props.onChange({ target: { value: '0' } })
  const next = app.render(); assert.equal(savedQuote(next), undefined)
  assert.equal(button(next, 'Рассчитать').props.disabled, true)
})
test('real JSX: corner zero stays zero and cannot restore old result', () => {
  const { app, tree } = pricedApp()
  const box = elements(tree, node => node.type === 'div' && node.props.className?.startsWith('p-4 border-2') && text(node).includes('Скругление углов'))[0]
  elements(box, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } })
  let next = app.render(); button(next, 'Рассчитать').props.onClick(); next = app.render()
  assert.ok(savedQuote(next))
  elements(next, node => node.type === 'input' && node.props.max === 4)[0].props.onChange({ target: { value: '0' } })
  next = app.render(); assert.equal(savedQuote(next), undefined)
  assert.equal(elements(next, node => node.type === 'input' && node.props.max === 4)[0].props.value, '0')
  button(next, 'Рассчитать').props.onClick(); assert.equal(savedQuote(app.render()), undefined)
})

test('numeric database operation IDs retain sheet and corner tariff semantics', () => {
  const databaseOperations = operations.map((op, i) => ({ ...op, id: String(i + 100) }))
  for (const name of ['Препрес', 'Ламинация пакетная', 'Фольгирование']) {
    const op = databaseOperations.find(item => item.name === name)
    const option = op.options.find(item => /a4/i.test(item.id))
    assert.equal(quote({ operations: databaseOperations, selected: [op.id], options: { [op.id]: option.id }, sides: { [op.id]: 2 } }).total, option.price * 10 * 2)
  }
})
test('real JSX: sheet badge entry retains a working legacy mode and Back navigation', () => {
  const app = runtime(); let tree = app.render()
  tree.props.onSelectCategory('badges'); tree = app.render()
  const sheet = elements(tree, node => node.props.kind === 'badges')[0]
  assert.ok(sheet)
  button(tree, 'Согласованная стоимость тиража (прежний расчёт)').props.onClick(); tree = app.render()
  assert.ok(button(tree, 'Рассчитать'))
  button(tree, 'Листовой расчёт бейджей').props.onClick(); tree = app.render()
  elements(tree, node => node.props.kind === 'badges')[0].props.onBack(); tree = app.render()
  assert.equal(typeof tree.props.onSelectCategory, 'function')
})

test('saved operation snapshots retain immutable tariff and billing evidence', () => {
  const live = structuredClone(operations)
  const result = quote({ operations: live, selected: ['foiling', 'cornerRounding'], options: { foiling: 'foil-a4-1' }, sides: { foiling: 2 }, quantities: { cornerRounding: 3 } })
  const foil = result.details[0], corners = result.details[1]
  assert.deepEqual({ ...foil }, { provisional: true, operationId: 'foiling', optionId: 'foil-a4-1', rate: 150, billedQuantity: 20, unit: 'тг', sheetFormat: 'A4', sheetCount: 10, sides: 2, yieldPerSheet: 10, name: 'Фольгирование: А4 лист, 1 сторона (10 лист. A4 × 2 стор.)', price: 3000 })
  assert.equal(corners.rate, 7); assert.equal(corners.corners, 3)
  assert.equal(corners.productQuantity, 100); assert.equal(corners.billedQuantity, 300)
  assert.equal(corners.operationId, 'cornerRounding')
  live.find(op => op.id === 'foiling').options.find(opt => opt.id === 'foil-a4-1').price = 999
  assert.equal(foil.rate, 150)
  assert.throws(() => { foil.rate = 999 }, TypeError)
  assert.ok(Object.isFrozen(result.details))
  const extra = quote({ selectedExtras: ['design'], extraServices: [{ id: 'design', name: 'Design', price: 500 }] }).details[0]
  assert.equal(extra.operationId, 'design'); assert.equal(extra.rate, 500); assert.equal(extra.billedQuantity, 1)
})
test('booleans, arrays, objects and blank strings never coerce into valid numeric inputs', () => {
  for (const value of [null, true, false, [], [1], {}, '   ']) {
    assert.equal(cardSheetCount(value, 10, 'A4'), null)
    assert.equal(cardSheetCount(100, value, 'A4'), null)
    assert.equal(quote({ selected: ['cornerRounding'], quantities: { cornerRounding: value } }), null)
    assert.equal(quote({ selected: ['cornerRounding'], operations: [{ id: 'cornerRounding', price: value }] }), null)
    assert.equal(quote({ selected: ['foiling'], options: { foiling: 'foil-a4-1' }, sides: { foiling: value } }), null)
    assert.equal(quote({ reorderDiscount: value }), null)
  }
})
test('unresolved extra-service tariffs block the complete quote, even when a numeric placeholder exists', () => {
  for (const price of [undefined, 0, 100]) assert.equal(quote({ selectedExtras: ['custom'], extraServices: [{ id: 'custom', name: 'Custom service', priceText: 'По запросу', price }] }), null)
})


test('Graphtec defaults to simple and bills every physical sheet, not every item or print side', () => {
  for (const [format, yieldPerSheet, complexity, expectedRate] of [
    ['A4', 10, 'simple', 325], ['A4', 10, 'medium', 425], ['A4', 10, 'complex', 500],
    ['A3', 20, 'simple', 650], ['A3', 20, 'medium', 850], ['A3', 20, 'complex', 1000]
  ]) {
    const result = quote({ format, yieldPerSheet, quantity: 101, selected: ['graphtec'], options: complexity === 'simple' ? {} : { graphtec: format.toLowerCase() + '-' + complexity }, sides: { graphtec: 2 } })
    assert.equal(result.total, Math.ceil(101 / yieldPerSheet) * expectedRate)
    assert.equal(result.details[0].billedQuantity, Math.ceil(101 / yieldPerSheet))
    assert.equal(result.details[0].complexity, complexity)
  }
  assert.equal(quote({ selected: ['graphtec'], options: { graphtec: 'a3-simple' } }), null)
  const live = operations.map(op => op.id === 'graphtec' ? { ...op, id: '555', options: op.options.map(option => ({ ...option, price: 17 })) } : op)
  assert.equal(quote({ operations: live, selected: ['555'] }).total, 170)
})

// Price source: local Price ZOOM 2026.pdf, page 7, Additional services.
test('gloss lamination A3/A4 tariffs match the PDF in both catalogs', () => {
  const server = JSON.parse(fs.readFileSync(new URL('../server/pricing.json', import.meta.url), 'utf8'))
  for (const catalog of [pricing, server]) {
    const options = catalog.additionalOperations.laminationPacket.options
    for (const [id, expected] of [['gloss-a4',250],['gloss-a3',450],['matte-a4',300],['matte-a3',600]])
      assert.equal(options.find(option => option.id === id).price, expected)
  }
  for (const [format, option, rate, yieldPerSheet] of [['A4','gloss-a4',250,10],['A3','gloss-a3',450,20]]) {
    for (const quantity of [100,101]) for (const sides of [1,2]) {
      assert.equal(quote({quantity,format,yieldPerSheet,selected:['laminationPacket'],options:{laminationPacket:option},sides:{laminationPacket:sides}}).total,
        Math.ceil(quantity/yieldPerSheet)*rate*sides)
    }
  }
})
