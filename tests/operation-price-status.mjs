import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const setup=require('../server/routes/pricing-extra')
const {ensureOperationPriceStatus}=require('../server/operation-price-status')
function harness(){
 const handlers={},calls=[]
 const router=Object.fromEntries(['get','post','put','delete'].map(method=>[method,(path,fn)=>handlers[method+' '+path]=fn]))
 setup(router,{async query(sql,args){calls.push({sql,args});return {rows:[{price_status:args?.at(-1)}]}}})
 return {handlers,calls}
}
const response=()=>({code:200,status(n){this.code=n;return this},json(value){this.value=value;return this}})
test('operations API persists explicit status, rejects invalid states, preserves omitted status on update',async()=>{
 const {handlers,calls}=harness()
 for(const status of ['provisional','approved']){
  const res=response();await handlers['post /operations']({body:{name:'Test',price_status:status}},res)
  assert.equal(res.code,200);assert.equal(calls.at(-1).args.at(-1),status)
  assert.match(calls.at(-1).sql,/price_status/)
 }
 const res=response();await handlers['put /operations/:id']({params:{id:7},body:{name:'Test'}},res)
 assert.match(calls.at(-1).sql,/price_status=COALESCE\(\$13,price_status\)/)
 assert.equal(calls.at(-1).args.at(-1),null)
 const count=calls.length,bad=response()
 await handlers['put /operations/:id']({params:{id:7},body:{price_status:'invalid'}},bad)
 assert.equal(bad.code,400);assert.equal(calls.length,count)
})
test('migration initializes only unset statuses and never reads description',async()=>{
 const calls=[];await ensureOperationPriceStatus({async query(sql,args){calls.push({sql,args});return {rows:[]}}})
 const update=calls.find(call=>call.sql.startsWith('UPDATE'))
 assert.match(update.sql,/WHERE price_status IS NULL/)
 assert.doesNotMatch(update.sql,/description/)
 assert.ok(update.args[0].includes('Листовая печать без бумаги'))
})
