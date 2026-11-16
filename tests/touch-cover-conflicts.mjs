import test from 'node:test'
import assert from 'node:assert/strict'
import { currentCardCatalog, exactCardBatchPrice } from '../src/lib/catalog.mjs'
import corrections from '../server/price-corrections-2026.json' with { type: 'json' }
import { cardSheetCount } from '../src/lib/cardSheetPricing.mjs'
const c = corrections.updates.find(x => x.name === 'Таккавер' && x.colorType === '4+4')
const old = { id: 24, name: 'Тачкавер', colorType: '4+4', prices: c.before }
const updated = { id: 41, name: 'Таккавер', colorType: '4+4', prices: c.after }
test('known duplicate is hidden only with exact current replacement, without mutation', () => {
  const rows = [old, updated]; const before = JSON.stringify(rows)
  assert.deepEqual(currentCardCatalog(rows), [updated]); assert.equal(JSON.stringify(rows), before)
  assert.deepEqual(currentCardCatalog([old]), [old])
  const edited = { ...old, prices: { ...old.prices, from500: 777 } }
  assert.deepEqual(currentCardCatalog([edited, updated]), [edited, updated])
  assert.deepEqual(currentCardCatalog([old, { ...updated, is_active: false }]), [old, { ...updated, is_active: false }])
})
test('exact batches use total once and nonstandard quantities require manual quote', () => {
  assert.equal(exactCardBatchPrice(updated, 100), 290)
  assert.equal(exactCardBatchPrice(updated, 50), 300)
  assert.equal(exactCardBatchPrice(updated, 300), 280)
  assert.equal(exactCardBatchPrice(updated, 500), 270)
  for (const q of [0, 49, 51, 99, 101, 299, 301, 501, 'abc']) assert.equal(exactCardBatchPrice(updated, q), null)
  assert.equal(cardSheetCount(100, 10, 'A4'), 10)
  assert.equal(cardSheetCount(101, 10, 'A4'), 11)
})
