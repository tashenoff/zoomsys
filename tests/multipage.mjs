import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { calculateMultipage } from '../src/lib/multipagePricing.mjs'
const require = createRequire(import.meta.url)
const data = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url)))
const backend = JSON.parse(fs.readFileSync(new URL('../server/pricing.json', import.meta.url)))
const products = data.printing.filter(p => p.category === 'notebooks')
assert.deepEqual(products, backend.printing.filter(p => p.category === 'notebooks'))
assert.equal(products.length, 2)
const expected = [[1850,1800,1700,1600],[950,900,850,800]]
for (const [i,p] of products.entries()) {
  for (const [j,q] of [50,100,200,300].entries()) {
    const result = calculateMultipage(p,q)
    assert.equal(result.unitPrice, expected[i][j])
    assert.equal(result.total, q*expected[i][j])
  }
  for (const q of [0,-1,49,75,500,1.5,NaN]) assert.throws(() => calculateMultipage(p,q))
  assert.equal(calculateMultipage(p,100).sheets, p.specification.sheets)
  assert.throws(() => calculateMultipage({...p,prices:{100:null}},100,50))
}
const validate = require('../server/validate-multipage.js')
assert.equal(validate(products[0]), null)
assert.ok(validate({...products[0],prices:{100:-1}}))
assert.ok(validate({...products[0],specification:null}))
const seed = require('../server/seed-multipage-data.js')
const rows = []
const client = {release(){}, async query(sql,args) {
  if (sql.startsWith('SELECT id')) return { rows: rows.filter(r => r.category===args[0] && r.name===args[1]) }
  if (sql.startsWith('INSERT')) rows.push({id:rows.length+1, category:args[0],name:args[1],prices:JSON.parse(args[3])})
  return {rows:[]}
}}
const pool = {async connect(){return client}}
await seed(pool, products)
rows[0].prices['100'] = 1999
await seed(pool, products)
assert.equal(rows.length,2)
assert.equal(rows[0].prices['100'],1999)
console.log('PASS: 8 source tariffs, invalid inputs, missing prices, API validation, repeated seed preserves edited prices')
console.log('A4 / 200 × 1700 =',calculateMultipage(products[0],200).total)
console.log('A5 / 100 × 900 =',calculateMultipage(products[1],100).total)

// Exercise the real CRUD handlers with a query stub; never connect to a DB.
const router = require('../server/routes/pricing.js')({async query(sql,args) {
  if (sql.startsWith('INSERT INTO printing_pricing')) {
    assert.deepEqual(JSON.parse(args[4]), products[0].specification)
    return { rows: [{id:1, category:args[0],name:args[1],prices:JSON.parse(args[3]),specification:JSON.parse(args[4])}] }
  }
  if (sql.startsWith('UPDATE printing_pricing SET category')) assert.deepEqual(JSON.parse(args[4]),products[0].specification)
  return { rows:[{id:1}] }
}})
async function call(method, path, body) {
  const layer = router.stack.find(l => l.route?.path===path && l.route.methods[method])
  let code=200, output
  const res = {status(c){code=c;return this},json(v){output=v;return this}}
  await layer.route.stack[0].handle({body,params:{id:1}},res)
  return {code,output}
}
const payload = {...products[0],color_type:null}
assert.equal((await call('post','/printing',payload)).code,200)
assert.equal((await call('put','/printing/:id',payload)).code,200)
assert.equal((await call('get','/printing',{})).code,200)
assert.equal((await call('delete','/printing/:id',{})).code,200)
assert.equal((await call('post','/printing',{...payload,prices:{100:'unknown'}})).code,400)
console.log('PASS: real printing CRUD handlers and specification mapping with query stub')
