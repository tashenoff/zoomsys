import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateSheetLayout, calculateSheetOperation, calculateSheetQuote, getGraphtecRate, getPaperChoices, PRODUCT_FORMATS } from '../src/lib/sheetPricing.mjs'
const quote = (patch={}) => calculateSheetQuote({ kind:'badges', productName:'Бейдж', quantity:100, width:90,height:120,sheetFormat:'A3',margin:0,gap:0,pages:1,colorType:'4+0',paper:{id:'p',name:'Бумага 120',density:120,rate:100},printRate:20, ...patch })

test('badge A3 geometry rotates when useful, rounds sheets, respects fields and gap', () => {
 const result=quote(); assert.equal(result.sheetCalculation.yieldPerSheet,9); assert.equal(result.sheetCalculation.sheets,12)
 assert.equal(result.baseTotal,1440); assert.equal(result.total,1440)
 assert.equal(quote({quantity:9}).sheetCalculation.sheets,1)
 assert.equal(quote({quantity:10}).sheetCalculation.sheets,2)
 const restricted=quote({margin:15,gap:3}); assert.ok(restricted.sheetCalculation.yieldPerSheet<9)
 const rotated=calculateSheetLayout({width:200,height:100,sheetFormat:'A4',quantity:5}); assert.equal(rotated.yieldPerSheet,2)
 assert.throws(()=>quote({width:500,height:600}),/не помещается/)
 assert.throws(()=>quote({yieldPerSheet:10}),/превышает/)
})

test('all standard flyer formats and euro use geometric output on A3',()=>{
 for(const [format,[width,height]] of Object.entries(PRODUCT_FORMATS)) {
  const result=quote({kind:'flyers',width,height,quantity:37}); assert.ok(result.sheetCalculation.yieldPerSheet>=1,format)
  assert.equal(result.sheetCalculation.sheets,Math.ceil(37/result.sheetCalculation.yieldPerSheet))
 }
 assert.equal(quote({width:70,height:40}).sheetCalculation.yieldPerSheet,42)
})

test('pages, odd duplex surfaces and paper totals remain distinct',()=>{
 const result=quote({pages:3,colorType:'4+4',quantity:10})
 assert.equal(result.sheetCalculation.sheets,4); assert.equal(result.sheetCalculation.printing.impressions,6)
 assert.equal(result.sheetCalculation.paper.total,400); assert.equal(result.sheetCalculation.printing.total,120)
 assert.equal(result.total,520)
 assert.throws(()=>quote({pages:1,colorType:'4+4'}),/меньше/)
})

test('sheet sides, corners, folds, holes, one lanyard per badge and fixed cutting use explicit units',()=>{
 const operations=[{id:'lam',name:'Ламинация',unit:'sheet-side',rate:3,count:2},
 {id:'corner',name:'Углы',unit:'corner',rate:7,count:4},{id:'fold',name:'Биговка',unit:'fold',rate:10,count:2},
 {id:'folding',name:'Фальцовка',unit:'fold',rate:8,count:1},{id:'hole',name:'Отверстия',unit:'hole',rate:5,count:1},
 {id:'lanyard',name:'Ланьярд',unit:'unit',rate:125},{id:'cut',name:'Обрезка',unit:'order',rate:500}]
 const result=quote({operations}); assert.deepEqual(result.sheetCalculation.operations.map(o=>o.total),[72,2800,2000,800,500,12500,500])
 assert.equal(result.total,20612)
 assert.equal(quote({quantity:200,operations:[operations.at(-1)]}).servicesTotal,500)
 assert.throws(()=>quote({operations:[operations[0],operations[0]]}),/дважды/)
})

test('invalid rates and counts never turn into free or negative operations',()=>{
 for(const value of ['',null,undefined,NaN,Infinity,-1,'abc',false,true,[],{}]) {
  assert.throws(()=>quote({paper:{name:'Paper',rate:value}}))
  assert.throws(()=>quote({printRate:value}))
  assert.throws(()=>quote({operations:[{id:'x',name:'X',unit:'order',rate:value}]}))
 }
 for(const count of [0,-1,1.5,5,'',NaN]) assert.throws(()=>calculateSheetOperation({name:'Corner',rate:7,unit:'corner',count},{quantity:100,sheets:10}))
 for(const quantity of [0,-1,1.5,NaN,Infinity,'',null]) assert.throws(()=>quote({quantity}))
 for(const discount of [-1,101,NaN,'']) assert.throws(()=>quote({discount}))
 assert.equal(quote({paper:{name:'Paper',rate:0},printRate:0}).total,0)
})

test('hangers retain exact six-per-A3 rule, duplex printing and mandatory Graphtec',()=>{
 const operations=[{id:'g',kind:'graphtec',name:'Graphtec',unit:'sheet',rate:17}]
 const result=quote({kind:'hangers',width:90,height:200,quantity:7,pages:2,colorType:'4+4',operations})
 assert.equal(result.sheetCalculation.yieldPerSheet,6); assert.equal(result.sheetCalculation.sheets,2)
 assert.equal(result.sheetCalculation.printing.impressions,4); assert.equal(result.servicesTotal,34)
 assert.throws(()=>quote({kind:'hangers',pages:2,colorType:'4+4'}),/Graphtec/)
 assert.throws(()=>quote({kind:'hangers',pages:2,operations}),/двусторонняя/)
 assert.throws(()=>quote({kind:'hangers',pages:2,colorType:'4+4',sheetFormat:'A4',operations}),/только/)
})

test('Graphtec uses only matching live format+complexity and does not invent other-format rules',()=>{
 const live={options:[{id:'a3-simple',price:17},{id:'a3-medium',price:23},{id:'a3-complex',price:29},{id:'a4-simple',price:11}]}
 assert.equal(getGraphtecRate(live,'A3','simple'),17); assert.equal(getGraphtecRate(live,'A3','medium'),23)
 assert.equal(getGraphtecRate(live,'A3','complex'),29); assert.equal(getGraphtecRate(live,'A4','simple'),11)
 for(const [format,complexity] of [['A4','medium'],['SRA3','simple'],['A4','complex']]) assert.equal(getGraphtecRate(live,format,complexity),null)
 live.options[0].price=37; assert.equal(getGraphtecRate(live,'A3','simple'),37)
 assert.equal(getGraphtecRate(undefined,'A3'),null)
})

test('Touch Cover color restriction and urgency/discount notes are captured',()=>{
 assert.throws(()=>quote({paper:{name:'Тачкавер',rate:1700},colorType:'1+0'}),/Touch Cover/)
 const result=quote({isUrgent:true,urgentSurcharge:30,discount:10,notes:'Test'})
 assert.equal(result.total,1684.8); assert.equal(result.notes,'Test')
 assert.equal(result.sheetCalculation.paper.rate,100)
})

test('paper selector does not treat bundled printing as standalone paper',()=>{
 const choices=getPaperChoices({printing:[{id:1,category:'paper-density',name:'Плотность 120 гр — SRA3',prices:{default:160}},
 {id:2,category:'paper-density',name:'Печать на самоклейке A4',prices:{default:200}},
 {id:3,category:'flyers',name:'Листовка',prices:{default:50}}]})
 assert.equal(choices.length,1); assert.equal(choices[0].sheetFormat,'SRA3'); assert.equal(choices[0].rate,160)
})


test('explicit admin metadata selects paper and Graphtec rates without relying on display labels',()=>{
 const [paper]=getPaperChoices({printing:[{id:77,category:'paper-density',name:'Paper',prices:{default:123},specification:{section:'sheet-paper',sheetFormat:'A4',density:160}}]})
 assert.equal(paper.sheetFormat,'A4');assert.equal(paper.density,160);assert.equal(paper.rate,123)
 assert.equal(getGraphtecRate({options:[{id:'random-id',sheetFormat:'SRA3',complexity:'medium',price:41}]},'SRA3','medium'),41)
})


test('sheet currency stages use explicit cents consistent with PostgreSQL numeric totals',()=>{
 const result=quote({quantity:1,paper:{name:'Synthetic paper',rate:20},printRate:5,isUrgent:true,urgentSurcharge:17,discount:25})
 assert.equal(result.subtotal,25);assert.equal(result.urgentAmount,4.25);assert.equal(result.discountAmount,7.31);assert.equal(result.total,21.94)
 const operation=calculateSheetOperation({id:'x',name:'Synthetic fraction',unit:'unit',rate:0.333},{quantity:3,sheets:1})
 assert.equal(operation.total,1)
 for(const value of [result.baseTotal,result.servicesTotal,result.subtotal,result.urgentAmount,result.discountAmount,result.total]) assert.ok(Math.abs(value*100-Math.round(value*100))<1e-8)
})


test('Graphtec tariffs are shared by browser catalog and seed, including explicit provisional SRA3', async () => {
 const fs = await import('node:fs')
 const frontend = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url)))
 const server = JSON.parse(fs.readFileSync(new URL('../server/pricing.json', import.meta.url)))
 assert.deepEqual(frontend.additionalOperations.graphtec, server.additionalOperations.graphtec)
 const op = frontend.additionalOperations.graphtec
 for (const [format, rates] of [['A3',[650,850,1000]],['A4',[325,425,500]]])
  ['simple','medium','complex'].forEach((complexity,index) => assert.equal(getGraphtecRate(op,format,complexity),rates[index]))
 assert.equal(getGraphtecRate(op,'SRA3'),750)
  assert.equal(op.priceStatus,'provisional')
 const result=quote({kind:'hangers',width:90,height:200,quantity:7,pages:2,colorType:'4+4',operations:[{id:'graphtec',kind:'graphtec',name:op.name,unit:'sheet',rate:getGraphtecRate(op,'A3')}]})
 assert.equal(result.servicesTotal,1300)
})


test('folded booklets are single spreads, not guessed multipage impositions',()=>{
 for(const [colorType,pages] of [['4+0',1],['4+4',2],['1+0',1],['1+1',2]]) {
  const result=quote({kind:'booklets',colorType,pages});
  assert.equal(result.sheetCalculation.sets,1);
 }
 for(const pages of [3,4,6,12]) assert.throws(()=>quote({kind:'booklets',pages,colorType:'4+4'}),/спуска полос/);
 for(const kind of ['flyers','booklets']) {
  assert.throws(()=>quote({kind,paper:{name:'Paper',rate:10}}),/плотность/);
  assert.throws(()=>quote({kind,paper:{name:'',density:120,rate:10}}),/бумагу/);
 }
});
