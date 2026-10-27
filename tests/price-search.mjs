import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import * as catalog from '../src/lib/catalog.mjs'
import * as priceSearch from '../src/lib/priceSearch.js'
import * as navCatalog from '../src/lib/navCatalog.js'

const require = createRequire(import.meta.url)
const React = require('react')
const { transformSync } = require('esbuild')
const fixture = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url), 'utf8'))
const categories = [
  'businessCards', 'printing', 'uvPrinting', 'wideFormat', 'stateSymbols',
  'textile', 'flagsProducts', 'advertisingStands', 'cncLaser', 'plotterCutting',
  'eventServices', 'garmentPrinting', 'embroidery', 'additionalOperations', 'additionalServices'
]
const pricing = Object.fromEntries(categories.map(category => {
  const items = category === 'wideFormat' ? catalog.getEnabledWideFormatMaterials(fixture[category]) : Object.values(fixture[category])
  assert.ok(items.length, `fixture has a ${category} item`)
  return [category, [{ ...items[0], id: '7', name: 'Search collision', material: 'Search collision' }]]
}))
pricing.businessCards.push({ ...pricing.businessCards[0], id: '8', name: 'Ordinary selection', material: '' })

// Execute actual JSX and callbacks with mocked hooks/DOM, following the existing
// component tests. These checks do not claim a mounted browser or a live API.
function runtime(file, extraExports = []) {
  const source = fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
  const compiled = transformSync(source + `\nexport { ${extraExports.join(', ')} };`, {
    loader: 'jsx', format: 'cjs', jsx: 'automatic', target: 'node18'
  }).code
  const state = []
  let cursor = 0, effects = []
  const react = { ...React,
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
    },
    useMemo(fn) { return fn() },
    useEffect(fn) { effects.push(fn) },
    useRef(initial) { return { current: initial } }
  }
  const module = { exports: {} }
  vm.runInNewContext(compiled, { module, exports: module.exports, CSS: { escape: String },
    require(name) {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return require(name)
      if (name.startsWith('@heroicons/')) return require(name)
      if (name.endsWith('/catalog.mjs')) return catalog
      if (name.endsWith('/priceSearch')) return priceSearch
      if (name.endsWith('/navCatalog')) return navCatalog
      if (name.endsWith('/usePricing')) return { usePricing: () => ({ pricing, loading: false }) }
      if (name.endsWith('/useAuth')) return { useAuth: () => ({ isAuthenticated: true, user: { role: 'admin' }, hasPermission: () => true }) }
      return { __esModule: true, default: () => null }
    }
  })
  return {
    render(name, props = {}) { cursor = 0; effects = []; return module.exports[name](props) },
    flushEffects() { return effects.map(fn => fn()).filter(fn => typeof fn === 'function') }
  }
}

function elements(node, predicate, result = []) {
  if (Array.isArray(node)) node.forEach(child => elements(child, predicate, result))
  else if (React.isValidElement(node)) {
    if (predicate(node)) result.push(node)
    elements(node.props.children, predicate, result)
  }
  return result
}

function expand(node) {
  if (Array.isArray(node)) return node.map(expand)
  if (!React.isValidElement(node)) return node
  if (typeof node.type === 'function') return expand(node.type(node.props))
  return { ...node, props: { ...node.props, children: expand(node.props.children) } }
}

const { hits, total } = priceSearch.searchPriceHits(pricing, 'Search collision', 100)

test('equal IDs in all pricing categories produce distinct qualified focus identities', () => {
  assert.equal(total, categories.length)
  assert.deepEqual(new Set(hits.map(hit => hit.focusId)), new Set(categories.map(category => `${category}:7`)))
})

// Global search no longer navigates to prices. Keep direct admin-table
// targeting coverage independently of that intentionally removed route.
function selectionForPrice(query, focusId) {
  const hit = priceSearch.searchPriceHits(pricing, query, 100).hits.find(hit => hit.id === focusId)
  return { query, focusId: hit?.focusId || null }
}

function renderSelection(selection) {
  const pageProps = { searchQuery: selection.query, focusItemId: selection.focusId }
  let tree
  const page = runtime('components/PricingManagement.jsx')
  tree = page.render('default', pageProps)
  const root = expand(tree)
  const rows = elements(root, node => node.type === 'tr' && node.props['data-price-id']).map(node => ({
    id: node.props['data-price-id'], scrolled: false, highlighted: false,
    scrollIntoView() { this.scrolled = true },
    classList: {
      add(name) { assert.equal(name, '!bg-blue-100'); this.owner.highlighted = true },
      remove(name) { assert.equal(name, '!bg-blue-100'); this.owner.highlighted = false }
    }
  }))
  rows.forEach(row => { row.classList.owner = row })
  const searchRoot = elements(root, node => node.ref)[0]
  searchRoot.ref.current = {
    querySelector(selector) { return rows.find(row => selector === `[data-price-id="${row.id}"]`) }
  }
  const cleanup = page.flushEffects()
  return { rows, cleanup }
}

for (const category of ['businessCards', 'printing', 'uvPrinting']) {
  test(`selecting ${category} scrolls/highlights only its row despite equal IDs`, () => {
    const focusId = `${category}:7`
    const selection = selectionForPrice('Search collision', focusId)
    assert.equal(selection.focusId, focusId)
    const { rows, cleanup } = renderSelection(selection)
    assert.equal(rows.length, categories.length)
    assert.deepEqual(rows.filter(row => row.scrolled).map(row => row.id), [focusId])
    assert.deepEqual(rows.filter(row => row.highlighted).map(row => row.id), [focusId])
    cleanup.forEach(fn => fn())
    assert.ok(rows.every(row => !row.highlighted))
  })
}

test('every pricing category targets its own rendered row, including combined sections', () => {
  for (const hit of hits) {
    const { rows } = renderSelection({ query: 'Search collision', focusId: hit.focusId })
    assert.deepEqual(rows.filter(row => row.scrolled && row.highlighted).map(row => row.id), [hit.id])
  }
})

test('ordinary selection within a category still targets the selected item', () => {
  const selection = selectionForPrice('Ordinary selection', 'businessCards:8')
  const { rows } = renderSelection(selection)
  assert.deepEqual(rows.filter(row => row.highlighted).map(row => row.id), ['businessCards:8'])
})

test('all-results search preserves every match without focusing any row', () => {
  const selection = selectionForPrice('Search collision', null)
  assert.equal(selection.focusId, null)
  const { rows } = renderSelection(selection)
  assert.equal(rows.length, categories.length)
  assert.ok(rows.every(row => !row.highlighted && !row.scrolled))
})
