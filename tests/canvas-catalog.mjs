import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { getStateSymbolName } from '../src/lib/catalog.mjs'

const require = createRequire(import.meta.url)
const relocate = require('../server/relocate-canvas-operations.js')
const renameSigns = require('../server/rename-departmental-signs.js')
const fixture = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url), 'utf8'))
const legacySigns = [
  { id: '34', category: 'signs', name: 'Вывеска 600×800 мм, ПВХ, голубая пленка, плоттерная резка, герб 125 мм', option: 'шт.', price: 60000 },
  { id: '35', category: 'signs', name: 'Вывеска 600×800 мм, ПВХ, накладные буквы акрил золото, герб 125 мм', option: 'шт.', price: 98000 }
]

test('relocation is idempotent and preserves IDs, custom tariffs, availability and existing order snapshots', async () => {
  const operations = [
    { id: 71, name: 'Натяжка холста', price: '4321.50', prices: { upTo100: 4000 }, unit: 'м²', is_active: false, applicable_to: ['advertising-stands', 'custom-category'] },
    { id: 72, name: 'Подрамник', price: '3987.25', unit: 'пог.м', applicable_to: ['advertising-stands'] },
    { id: 73, name: 'Кайма', price: '999.99', applicable_to: ['advertising-stands'] }
  ]
  const materials = [
    { id: 21, operations: ['wideFormatCutting'] },
    { id: 22, operations: ['wideFormatCutting', 'contourCutting', '72'] },
    { id: 23, operations: null }
  ]
  const orders = [{ id: 1, category: 'advertising-stands', total: 18000,
    specifications: { extras: [{ name: 'Натяжка холста (1 м²)', price: 3500 }] } }]
  const before = structuredClone({ operations, materials, orders })
  const queries = []; let releases = 0
  const pool = { async connect() { return {
    release() { releases++ }, async query(sql, args) {
      queries.push(sql)
      if (/^(BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory|ALTER TABLE)/.test(sql)) return { rows: [] }
      if (sql.startsWith('SELECT id, name')) return { rows: operations.filter(row => args[0].includes(row.name)) }
      if (sql.startsWith('SELECT id, operations')) {
        assert.match(sql, /lower\(btrim\(name\)\)='холст'/)
        assert.match(sql, /category IN \('mimaki','roland'\)/)
        return { rows: materials }
      }
      if (sql.startsWith('UPDATE additional_operations')) {
        assert.equal(sql, 'UPDATE additional_operations SET applicable_to=$1, updated_at=NOW() WHERE id=$2')
        operations.find(row => row.id === args[1]).applicable_to = JSON.parse(args[0]); return { rows: [] }
      }
      if (sql.startsWith('UPDATE wide_format_pricing')) {
        assert.equal(sql, 'UPDATE wide_format_pricing SET operations=$1, updated_at=NOW() WHERE id=$2')
        materials.find(row => row.id === args[1]).operations = JSON.parse(args[0]); return { rows: [] }
      }
      throw Error('Unexpected query: ' + sql)
    }
  } } }
  assert.deepEqual(await relocate(pool), { operations: 2, materials: 2 })
  assert.deepEqual(await relocate(pool), { operations: 0, materials: 0 })
  assert.equal(releases, 2)
  assert.deepEqual(operations.map(({ applicable_to, ...rest }) => rest), before.operations.map(({ applicable_to, ...rest }) => rest))
  assert.deepEqual(operations[0].applicable_to, ['custom-category', 'wide-format'])
  assert.deepEqual(operations[1].applicable_to, ['wide-format'])
  assert.deepEqual(operations[2], before.operations[2])
  assert.deepEqual(materials[0].operations, ['wideFormatCutting', 'canvasStretch', 'subframe'])
  assert.deepEqual(materials[1].operations, ['wideFormatCutting', 'contourCutting', '72', 'canvasStretch'])
  assert.equal(materials[2].operations, null)
  assert.deepEqual(orders, before.orders)
  assert.ok(!queries.some(sql => /INSERT|DELETE|order_items|UPDATE orders/.test(sql)))
})

test('missing operations are not created; failed relocation rolls back and releases the connection', async () => {
  let statements = []; let released = false
  const pool = { async connect() { return { release() { released = true }, async query(sql) {
    statements.push(sql)
    if (sql.startsWith('SELECT id, name')) return { rows: [] }
    return { rows: [] }
  } } } }
  assert.deepEqual(await relocate(pool), { operations: 0, materials: 0 })
  assert.ok(!statements.some(sql => /^(INSERT|UPDATE|DELETE)/.test(sql)))
  statements = []; released = false
  const failing = { async connect() { return { release() { released = true }, async query(sql) {
    statements.push(sql)
    if (sql.startsWith('SELECT id, name')) throw Error('test interruption')
    return { rows: [] }
  } } } }
  await assert.rejects(relocate(failing), /test interruption/)
  assert.equal(statements.at(-1), 'ROLLBACK')
  assert.equal(released, true)
})

test('only the two state-symbol signs are renamed; their IDs, prices and unrelated services stay intact', async () => {
  const oldSigns = legacySigns
  const newSigns = fixture.stateSymbols.filter(item => item.category === 'signs')
  assert.equal(oldSigns.length, 2)
  assert.deepEqual(newSigns, oldSigns.map(item => ({ ...item, name: getStateSymbolName(item) })))
  for (const item of oldSigns) assert.match(getStateSymbolName(item), /^Ведомственная табличка 600×800 мм,/)
  for (const item of [{ category: 'other', name: oldSigns[0].name }, { category: 'signs', name: 'Вывеска уличная' }]) {
    assert.equal(getStateSymbolName(item), item.name)
  }
  const rows = structuredClone([...oldSigns, { id: 'other', category: 'other', name: oldSigns[0].name, price: 123 }])
  const pool = { async query(sql, args) {
    assert.match(sql, /WHERE category='signs' AND name = ANY\(\$3::text\[\]\)/)
    assert.ok(!/SET.*(?:id|price|category)=/.test(sql))
    let rowCount = 0
    for (const row of rows) if (row.category === 'signs' && args[2].includes(row.name)) {
      row.name = args[0] + row.name.slice(args[1].length); rowCount++
    }
    return { rowCount }
  } }
  assert.equal(await renameSigns(pool), 2)
  assert.equal(await renameSigns(pool), 0)
  assert.deepEqual(rows.slice(0, 2), newSigns)
  assert.equal(rows[2].name, oldSigns[0].name)
})
