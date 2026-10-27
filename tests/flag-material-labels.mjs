import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import * as catalog from '../src/lib/catalog.mjs'
import * as navCatalog from '../src/lib/navCatalog.js'

const require = createRequire(import.meta.url)
const React = require('react')
const { transformSync } = require('esbuild')
const fixture = require('../src/data/pricing.json')
function RazoomLogo() { return null }

// Actual JSX and handlers with mocked hooks/data, following the repository's
// component-test convention. No server, database, or production write is used.
function runtime(file, { pricing = fixture, initialStates = [] } = {}) {
  const source = fs.readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8')
  const compiled = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code
  const hooks = [...initialStates], orders = []
  let cursor = 0, dirty = false, effects = []
  const react = { ...React,
    useState(initial) {
      const i = cursor++
      if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial
      return [hooks[i], value => {
        const next = typeof value === 'function' ? value(hooks[i]) : value
        if (!Object.is(next, hooks[i])) { hooks[i] = next; dirty = true }
      }]
    },
    useMemo(fn) { return fn() },
    useEffect(fn, deps) {
      const i = cursor++
      if (!hooks[i] || deps.some((value, index) => !Object.is(value, hooks[i][index]))) {
        hooks[i] = deps; effects.push(fn)
      }
    }
  }
  const module = { exports: {} }
  vm.runInNewContext(compiled, { module, exports: module.exports, alert() {},
    require(name) {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime' || name.startsWith('@heroicons/')) return require(name)
      if (name.endsWith('/catalog.mjs')) return catalog
      if (name.endsWith('/navCatalog')) return navCatalog
      if (name.endsWith('/pricing.json')) return pricing
      if (name.endsWith('/usePricing')) return { usePricing: () => ({ pricing }) }
      if (name.endsWith('/useOrders')) return { useOrders: () => ({ createOrder: async order => orders.push(order) }) }
      if (name.endsWith('/useAuth')) return { useAuth: () => ({ hasPermission: () => true }) }
      if (name.endsWith('/RazoomLogo')) return { __esModule: true, default: RazoomLogo }
      return { __esModule: true, default: () => null }
    }
  })
  return { orders, render(props = {}) {
    for (let pass = 0; pass < 20; pass++) {
      cursor = 0; dirty = false; effects = []
      const tree = module.exports.default(props)
      effects.forEach(fn => fn())
      if (!dirty) return tree
    }
    throw Error('State did not settle')
  } }
}
function elements(node, predicate, found = []) {
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
const button = (tree, label) => elements(tree, node => node.type === 'button' && text(node) === label)[0]
const materialButton = (tree, id) => elements(tree, node => node.type === 'button' && node.key === id)[0]

test('only size-based flag materials lose the leading Flag prefix; banner names and source records remain', () => {
  const before = JSON.stringify(fixture)
  const tree = runtime('FlagsProductsCalculator.jsx').render({ initialCategory: 'flags-size' })
  assert.ok(elements(tree, node => node.type === 'label' && text(node) === 'Материал').length)
  for (const item of fixture.flagsProducts.filter(item => item.category === 'flags-size')) {
    assert.equal(text(materialButton(tree, item.id).props.children[0]), item.name.replace(/^Флаг:\s*/, ''))
  }
  assert.ok(text(tree).includes('Знамя: атлас, габардин двухсторонний, бахрома'))
  assert.equal(JSON.stringify(fixture), before)
  const other = { ...fixture, flagsProducts: [{ id: 'desk', category: 'desk-flags', name: 'Флаг: контрольное имя', price: 100 }] }
  const desk = runtime('FlagsProductsCalculator.jsx', { pricing: other }).render({ initialCategory: 'desk-flags' })
  assert.ok(elements(desk, node => node.type === 'label' && text(node) === 'Позиция').length)
  assert.ok(text(desk).includes('Флаг: контрольное имя'))
})

test('material/size selection, totals, urgency, saved names and custom-size routing retain original records', async () => {
  const app = runtime('FlagsProductsCalculator.jsx')
  const props = { initialCategory: 'flags-size', client: { id: 901, name: 'Test only' } }
  let tree = app.render(props)
  materialButton(tree, 'fp-2').props.onClick()
  tree = app.render(props)
  elements(tree, node => node.type === 'button' && text(node).startsWith('1*2 м'))[0].props.onClick()
  tree = app.render(props)
  elements(tree, node => node.type === 'input' && node.props.type === 'number')[0].props.onChange({ target: { value: '2' } })
  elements(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } })
  tree = app.render(props)
  elements(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
  tree = app.render(props)
  const summary = elements(tree, node => typeof node.type === 'function' && node.props.onSave)[0]
  assert.equal(summary.props.total.value.replace(/\s/g, ''), '96200тг')
  const row = elements(tree, node => node.props.label === 'Материал:')[0]
  assert.equal(row.props.value, 'атлас, габардин двухсторонний')
  await summary.props.onSave()
  assert.equal(app.orders[0].productName, fixture.flagsProducts.find(item => item.id === 'fp-2').name)
  assert.equal(app.orders[0].size, '1*2')
  assert.equal(app.orders[0].quantity, 2)
  assert.equal(app.orders[0].total, 96200)
  tree = app.render(props)
  button(tree, 'Нестандартный размер').props.onClick()
  tree = app.render(props)
  const custom = elements(tree, node => node.props.flagProduct)[0]
  assert.equal(custom.props.flagProduct.id, 'fp-2')
  assert.equal(custom.props.flagProduct.name, app.orders[0].productName)
})

test('textile is hidden only in the sidebar rail/full menu; flag submenus, logo and search routes remain', () => {
  const app = runtime('Sidebar.jsx')
  const props = { open: false, onSelectCategory() {}, onSelectView() {} }
  let tree = app.render(props)
  assert.equal(tree.props['data-collapsed'], true)
  assert.ok(!text(tree).includes('Печать на текстиле'))
  elements(tree, node => node.props['aria-label'] === 'Развернуть меню')[0].props.onClick()
  tree = app.render(props)
  assert.ok(!text(tree).includes('Печать на текстиле'))
  assert.ok(elements(tree, node => node.type === RazoomLogo).length)
  button(tree, 'Готовая флаговая продукция').props.onClick()
  tree = app.render(props)
  assert.ok(button(tree, 'Флаги и знамена (по размеру)'))
  assert.ok(!text(tree).includes('Печать на текстиле'))
  assert.ok(navCatalog.buildCalculatorItems().some(item => item.payload.slug === 'textile'))
  assert.ok(fixture.textile.length > 0)
})
