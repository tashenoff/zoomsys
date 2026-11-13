import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {parse}=require('@babel/parser')
const source=fs.readFileSync(new URL('../src/components/PrintingCalculator.jsx',import.meta.url),'utf8')
const ast=parse(source,{sourceType:'module',plugins:['jsx']})
const component=ast.program.body.find(node=>node.type==='ExportDefaultDeclaration').declaration
const declarations=new Map(component.body.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).map(node=>[node.id.name,node.init]))
function actual(product,patch={}) {
 let result=null,error=''
 const context={selectedProduct:product,quantity:10,selectedColorType:null,selectedServices:[],availableOperations:[],reorderOptions:[],selectedReorder:'no',serviceManualPrices:{},selectedAddServices:[],additionalServices:[],customNotes:[],isUrgent:false,urgentSurcharge:30,discount:0,notes:'Local only',
 setCalculation:value=>{result=value},setCalculationError:value=>{error=value},...patch}
 vm.createContext(context)
 for(const name of ['getPriceForQuantity','calculatePrice']) { const node=declarations.get(name);context[name]=vm.runInContext('('+source.slice(node.start,node.end)+')',context) }
 context.calculatePrice();return {result,error}
}

test('legacy printing missing or null tariff blocks quote instead of becoming zero',()=>{
 for(const product of [{name:'Missing'},{name:'Missing',prices:null},{name:'Missing',prices:{default:null}}]) {
  const quote=actual(product);assert.equal(quote.result,null);assert.ok(quote.error)
 }
 const zero=actual({name:'Explicit zero',prices:{default:0}});assert.equal(zero.result.total,0)
})

test('flat API printing color survives in saved quote and the product label',()=>{
 const quote=actual({id:123,name:'Same name',category:'flyers',colorType:'4+4',prices:{10:12}})
 assert.equal(quote.result.colorType,'4+4');assert.equal(quote.result.total,120)
 assert.ok(source.includes("{product.colorType ? ` · ${product.colorType}` : ''}"))
})

test('a negative custom operation is rejected even when other positive operations offset it',()=>{
 const quote=actual({name:'Product',prices:{default:10}},{customNotes:[{title:'Positive',price:20,type:'fixed'},{title:'Negative',price:-5,type:'fixed'}]})
 assert.equal(quote.result,null);assert.ok(quote.error)
})

test('zero live urgency surcharge stays zero in legacy printing',()=>{
 const node=declarations.get('urgentSurcharge')
 const urgentSurcharge=vm.runInNewContext('('+source.slice(node.start,node.end)+')',{pricingData:{settings:{urgentSurcharge:0}}})
 assert.equal(urgentSurcharge,0)
 const quote=actual({name:'Product',prices:{default:10}},{isUrgent:true,urgentSurcharge})
 assert.equal(quote.result.total,100);assert.equal(quote.result.urgentAmount,0)
})
