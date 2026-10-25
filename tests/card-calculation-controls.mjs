import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import * as catalog from '../src/lib/catalog.mjs'
const require = createRequire(import.meta.url)
const React = require('react')
const { transformSync } = require('esbuild')
const pricing = require('../server/pricing.json')
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
  const calls = []; const client = { id: 901, name: 'Local test' }
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
      if (name.endsWith('/usePricing')) return { usePricing: () => ({ pricing, loading: false }) }
      if (name.endsWith('/useOrders')) return { useOrders: () => ({ isOnline: true, createOrder: async value => calls.push(value) }) }
      if (name.endsWith('/pricing.json')) return pricing
      return { __esModule: true, default: () => null }
    } })
  return { calls,
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

test('badges select a product without a color gate; visible Calculate validates quote and saving retains manual price', async () => {
  const app = runtime(); let tree = app.render()
  tree.props.onSelectCategory('badges'); tree = app.render()
  assert.ok(button(tree, 'Рассчитать').props.disabled)
  const badge = pricing.businessCards.find(catalog.isBadgeProduct)
  button(tree, badge.name).props.onClick(); tree = app.render()
  assert.ok(!text(tree).includes('🎨 Цветность'))
  assert.ok(button(tree, 'Рассчитать').props.disabled)
  elements(tree, node => node.props.id === 'badge-batch-total')[0].props.onChange({ target: { value: '1000' } })
  tree = app.render(); assert.equal(button(tree, 'Рассчитать').props.disabled, false)
  button(tree, 'Рассчитать').props.onClick(); tree = app.render()
  assert.match(text(tree), /1000.00 тг/)
  const save = elements(tree, node => node.type === 'button' && /Сохранить заказ/i.test(text(node)))[0]
  assert.ok(save); await save.props.onClick()
  assert.equal(app.calls[0].manualBatchTotal, 1000); assert.equal(app.calls[0].quantity, 100)
  assert.equal(app.calls[0].productType, 'badges')
})

for (const type of ['business-cards', 'discount-cards']) test(`${type}: Calculate is visible before color selection and works after selecting a priced material/color`, () => {
  const app = runtime(); let tree = app.render()
  tree.props.onSelectCategory(type); tree = app.render()
  assert.ok(button(tree, 'Рассчитать').props.disabled)
  button(tree, 'Черно-белые').props.onClick(); tree = app.render()
  const color = elements(tree, node => node.type === 'button' && text(node).startsWith('1+0'))[0]
  color.props.onClick(); tree = app.render()
  assert.ok(!text(tree).includes('null тг'))
  assert.equal(button(tree, 'Рассчитать').props.disabled, false)
  button(tree, 'Рассчитать').props.onClick(); tree = app.render()
  assert.match(text(tree), /2800.00 тг/)
})
