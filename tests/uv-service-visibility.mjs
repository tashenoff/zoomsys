import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import { isServiceAllowed } from '../src/lib/catalog.mjs'

const require = createRequire(import.meta.url)
const React = require('react')
const { parse } = require('@babel/parser')
const { transformSync } = require('esbuild')
const mount = { id: 901, name: 'Монтаж / демонтаж конструкции', price: 9000, applicableTo: ['all'] }
const allowed = { id: 902, name: 'Ламинация', price: 25, applicableTo: ['all'] }
const pricing = { additionalServices: [mount, allowed] }

function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  if (React.isValidElement(node)) return text(node.props.children)
  return typeof node === 'string' ? node : ''
}
function modal(category) {
  const source = fs.readFileSync(new URL('../src/components/AdditionalServicesModal.jsx', import.meta.url), 'utf8')
  const module = { exports: {} }
  vm.runInNewContext(transformSync(source, {loader:'jsx',format:'cjs',jsx:'automatic'}).code, {
    module, exports:module.exports, require(name) {
      if (name === 'react') return {...React, useState:()=>[[],()=>{}], useEffect() {}}
      if (name === 'react/jsx-runtime') return require(name)
      if (name.endsWith('/usePricing')) return {usePricing:()=>({pricing})}
      if (name.endsWith('/catalog.mjs')) return {isServiceAllowed}
      if (name.endsWith('/pricing.json')) return pricing
      throw Error(name)
    }
  })
  return module.exports.default({open:true, category, selected:[901], onClose(){}})
}

test('construction installation is unavailable only in UV; other services/categories retain their policy', () => {
  assert.ok(!text(modal('uv-printing')).includes(mount.name))
  assert.ok(text(modal('uv-printing')).includes(allowed.name))
  for (const category of ['wide-format','textile','event-services','advertising-stands','business-cards']) {
    assert.ok(text(modal(category)).includes(mount.name), category)
    assert.equal(isServiceAllowed(mount, category), true)
  }
  assert.equal(isServiceAllowed({name:'Монтаж макета'}, 'uv-printing'), true)
  assert.equal(isServiceAllowed(mount, 'printing'), false)
})

// Execute the real pricing/filter/save expressions with a deliberately stale
// numeric service ID and a numeric price. No backend or saved order is changed.
test('stale installation selection cannot enter a new UV calculation or order; allowed extras keep their rates', async () => {
  const before = JSON.stringify(pricing)
  const source = fs.readFileSync(new URL('../src/components/UVPrintingCalculator.jsx', import.meta.url), 'utf8')
  const ast = parse(source, {sourceType:'module',plugins:['jsx']})
  const component = ast.program.body.find(node=>node.type==='ExportDefaultDeclaration').declaration
  const declarations = new Map(component.body.body.filter(node=>node.type==='VariableDeclaration')
    .flatMap(node=>node.declarations).map(node=>[node.id.name,node.init]))
  let result, saved
  const context = {
    pricingData:pricing, isServiceAllowed,
    selectedProduct:{id:'uv-test',name:'UV test',priceType:'unit',prices:{100:10}},
    selectedSide:null, selectedMaterial:null, quantity:100, area:1, width:10, length:15,
    selectedUvOps:['op'], uvOperations:[{id:'op',name:'Preparation',type:'fixed',price:5}],
    selectedUvOptions:{}, selectedAddServices:[901,902], isUrgent:false, urgentSurcharge:30,
    discount:0, notes:'unchanged', client:{id:903}, orderStatus:'draft',
    setCalculation(value) {result=value; context.calculation=value},
    async createOrder(value) {saved=value}, alert() {}
  }
  for (const name of ['setSavingOrder','setSelectedCategory','setSearchProduct','setSelectedProduct',
    'setSelectedSide','setQuantity','setArea','setWidth','setLength','setIsUrgent','setDiscount',
    'setNotes','setSelectedUvOps','setSelectedAddServices','setSelectedUvOptions','setOrderStatus']) context[name]=()=>{}
  vm.createContext(context)
  for (const name of ['additionalServices','getPriceForQuantity','calculatePrice','handleSaveOrder']) {
    const node=declarations.get(name)
    context[name]=vm.runInContext('('+source.slice(node.start,node.end)+')',context)
  }
  context.calculatePrice()
  assert.equal(result.baseTotal,1000)
  assert.equal(result.extrasTotal,30)
  assert.equal(result.total,1030)
  assert.ok(result.extras.every(extra=>extra.name!==mount.name))
  await context.handleSaveOrder()
  assert.equal(saved.total,1030)
  assert.equal(saved.notes,'unchanged')
  assert.ok(saved.extras.every(extra=>extra.name!==mount.name))
  context.selectedAddServices=[]
  context.calculatePrice()
  assert.equal(result.total,1005)
  assert.equal(JSON.stringify(pricing),before)
})
