import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import * as catalog from '../src/lib/catalog.mjs'
import * as navCatalog from '../src/lib/navCatalog.js'
import * as search from '../src/lib/calculatorSearch.js'
import * as finishing from '../src/lib/wideFormatFinishing.mjs'
import * as stickerLayout from '../src/lib/stickerLayout.mjs'
import * as garmentPricing from '../src/lib/garmentPricing.mjs'

const require = createRequire(import.meta.url)
const React = require('react')
const {transformSync} = require('esbuild')
const pricing = require('../src/data/pricing.json')
const index = search.buildCalculatorSearchItems(pricing)
const results = query => search.searchCalculatorItems(index, query)

function elements(node, predicate, found=[]) {
  if (Array.isArray(node)) node.forEach(child=>elements(child,predicate,found))
  else if (React.isValidElement(node)) {
    if (predicate(node)) found.push(node)
    elements(node.props.children,predicate,found)
  }
  return found
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  if (React.isValidElement(node)) return text(node.props.children)
  return typeof node==='string' || typeof node==='number' ? String(node) : ''
}

// Execute actual JSX, callbacks and effects with stable mocked contexts/refs.
// These tests exercise navigation/state, not a mounted browser or a live API.
function runtime(file, extraExports=[]) {
  const source=fs.readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')
  const compiled=transformSync(source+`\nexport {${extraExports.join(',')}}`,{loader:'jsx',format:'cjs',jsx:'automatic'}).code
  const hooks=[], orders=[]
  let cursor=0, dirty=false, effects=[]
  const changed=(old,next)=>!old || !next || old.length!==next.length || next.some((value,i)=>!Object.is(value,old[i]))
  const react={...React,
    useState(initial) {
      const i=cursor++
      if (!(i in hooks)) hooks[i]=typeof initial==='function'?initial():initial
      return [hooks[i],value=>{const next=typeof value==='function'?value(hooks[i]):value;if(!Object.is(next,hooks[i])){hooks[i]=next;dirty=true}}]
    },
    useRef(initial) {const i=cursor++;return hooks[i] ||= {current:initial}},
    useMemo(fn,deps) {const i=cursor++;if(changed(hooks[i]?.deps,deps))hooks[i]={value:fn(),deps};return hooks[i].value},
    useEffect(fn,deps) {const i=cursor++;if(changed(hooks[i]?.deps,deps)){const previous=hooks[i];hooks[i]={deps};effects.push(()=>{previous?.cleanup?.();hooks[i].cleanup=fn()})}}
  }
  const module={exports:{}}, stubs=new Map()
  vm.runInNewContext(compiled,{module,exports:module.exports,alert(){},setTimeout(){},document:{body:{style:{overflow:''}}},
    require(name) {
      if(name==='react')return react
      if(name==='react/jsx-runtime' || name.startsWith('@heroicons/'))return require(name)
      if(name.endsWith('/catalog.mjs'))return catalog
      if(name.endsWith('/navCatalog'))return navCatalog
      if(name.endsWith('/calculatorSearch'))return search
      if(name.endsWith('/wideFormatFinishing.mjs'))return finishing
      if(name.endsWith('/stickerLayout.mjs'))return stickerLayout
      if(name.endsWith('/garmentPricing.mjs'))return garmentPricing
      if(name.endsWith('/pricing.json'))return pricing
      if(name.endsWith('/useAuth'))return {useAuth:()=>({isAuthenticated:true,loading:false,user:{role:'admin'},hasPermission:()=>true})}
      if(name.endsWith('/usePricing'))return {usePricing:()=>({pricing,loading:false})}
      if(name.endsWith('/useOrders'))return {useOrders:()=>({isOnline:false,createOrder:async value=>orders.push(value)})}
      if(!stubs.has(name))stubs.set(name,{__esModule:true,default:()=>null})
      return stubs.get(name)
    }
  })
  return {orders,hooks,render(name='default',props={}) {
    for(let pass=0;pass<30;pass++) {
      cursor=0;dirty=false;effects=[]
      const tree=module.exports[name](props)
      effects.forEach(fn=>fn())
      if(!dirty)return tree
    }
    throw Error(`State loop in ${file}`)
  }}
}

test('verified product aliases open existing calculators; global search contains no price/admin entries',()=>{
  assert.equal(results('журнал')[0].payload.slug,'multipage')
  assert.ok(results('журнал')[0].unavailableReason)
  assert.equal(results('диплом')[0].payload.slug,'printing')
  assert.equal(results('диплом')[0].payload.printingCategory,'certificates')
  assert.equal(results('политекс')[0].payload.textileMaterialId,'tx-3')
  assert.ok(index.every(item=>!item.focusId && !item.view))
  assert.equal(results('прайсы').length,0)
  assert.equal(results('zzzx-no-match').length,0)
  assert.ok(results('  ').every(item=>item.kind==='calculator'))
})

test('ambiguous materials keep explicit finished-product and fabric-calculation alternatives',()=>{
  for(const query of ['атлас','флажная сетка']) {
    const matches=results(query)
    assert.ok(matches.some(item=>item.payload.slug==='flags-products'),query)
    assert.ok(matches.some(item=>item.payload.slug==='textile' && item.payload.textileMaterialId),query)
    assert.equal(new Set(matches.map(item=>item.id)).size,matches.length)
    assert.ok(matches.every(item=>item.group))
  }
  assert.ok(results('атлас').some(item=>item.payload.flagsCategory==='desk-flags'))
  assert.ok(results('атлас').some(item=>item.payload.flagsCategory==='auto-flags'))
})

test('equal numeric IDs remain qualified by source and category',()=>{
  const collision={flagsProducts:[{id:7,category:'flags-size',name:'Collision flag'},{id:7,category:'desk-flags',name:'Collision desk'}],
    textile:[{id:7,category:'direct',name:'Collision fabric'}],wideFormat:[{id:7,category:'roland',name:'Collision vinyl'}]}
  const matches=search.searchCalculatorItems(search.buildCalculatorSearchItems(collision),'Collision')
  assert.equal(matches.length,4)
  assert.equal(new Set(matches.map(item=>item.payload.searchKey)).size,4)
  assert.equal(matches.filter(item=>item.payload.flagsItemId==='7').length,2)
  assert.equal(matches.filter(item=>item.payload.textileMaterialId==='7').length,1)
})

function palette() {
  const app=runtime('components/TopNavbar.jsx',['GlobalSearchPalette'])
  const selected=[],prices=[],pages=[];let closed=0
  const props={onClose:()=>closed++,onSelectCategory:value=>selected.push(value),onSearchPrices:value=>prices.push(value),onSelectView:value=>pages.push(value)}
  const render=()=>app.render('GlobalSearchPalette',props)
  const query=value=>{elements(render(),node=>node.type==='input')[0].props.onChange({target:{value}});return render()}
  return {app,selected,prices,pages,render,query,get closed(){return closed}}
}
const options=tree=>elements(tree,node=>node.props.role==='option')
const press=(tree,key)=>elements(tree,node=>node.type==='input')[0].props.onKeyDown({key,preventDefault(){}})

test('all-results expands the palette without routing or closing; a new query resets it',()=>{
  const p=palette()
  let tree=p.query('')
  const more=options(tree).find(node=>text(node).includes('Все результаты'))
  assert.ok(more)
  more.props.onClick();tree=p.render()
  assert.ok(options(tree).length>13)
  assert.equal(p.closed,0);assert.equal(p.selected.length,0)
  tree=p.query('печать')
  options(tree).find(node=>text(node).includes('Все результаты')).props.onClick()
  tree=p.render()
  assert.equal(options(tree).length,results('печать').length)
  assert.equal(p.closed,0);assert.equal(p.selected.length,0)
  tree=p.query('политекс')
  assert.equal(options(tree).length,1)
  options(tree)[0].props.onClick()
  assert.equal(p.selected[0].textileMaterialId,'tx-3')
  assert.equal(p.closed,1)
  assert.equal(p.prices.length,0);assert.equal(p.pages.length,0)
})

test('keyboard navigation, no-results, query changes and Escape never reuse an earlier target',()=>{
  const p=palette()
  let tree=p.query('атлас')
  press(tree,'ArrowDown');tree=p.render()
  assert.equal(elements(tree,node=>node.type==='input')[0].props['aria-activedescendant'],'search-result-1')
  tree=p.query('политекс')
  assert.equal(elements(tree,node=>node.type==='input')[0].props['aria-activedescendant'],'search-result-0')
  press(tree,'Enter')
  assert.equal(p.selected[0].textileMaterialId,'tx-3')
  tree=p.query('zzzx-no-match');press(tree,'Enter')
  assert.equal(p.selected.length,1)
  press(tree,'Escape');assert.equal(p.closed,2)
})

test('the catalog-only journal section explains its unavailable calculator instead of opening a blank route',()=>{
  const p=palette()
  const tree=p.query('журнал')
  assert.equal(options(tree).length,1)
  assert.equal(options(tree)[0].props.disabled,true)
  assert.match(text(options(tree)[0]),/пока не подключён/)
  press(tree,'Enter')
  assert.equal(p.selected.length,0)
  assert.equal(p.closed,0)
})

test('App forwards only scoped selection props and changes calculator keys between targets/ordinary navigation',()=>{
  const app=runtime('App.jsx',['AppContent'])
  const choose=payload=>{
    let tree=app.render('AppContent')
    elements(tree,node=>node.props.onLogout && node.props.onSelectCategory)[0].props.onSelectCategory(payload)
    return app.render('AppContent')
  }
  const flag=results('атлас').find(item=>item.payload.flagsItemId==='fp-2').payload
  let tree=choose(flag)
  let child=elements(tree,node=>node.props.initialItemId==='fp-2')[0]
  assert.ok(child);const firstKey=child.key
  const fabric=results('политекс')[0].payload
  tree=choose(fabric)
  child=elements(tree,node=>node.props.initialMaterialId==='tx-3')[0]
  assert.ok(child);assert.notEqual(child.key,firstKey)
  const fabricKey=child.key;tree=choose(fabric)
  child=elements(tree,node=>node.props.initialMaterialId==='tx-3')[0]
  assert.notEqual(child.key,fabricKey, 'choosing the same target again resets any manual selection')
  const ordinary=index.find(item=>item.kind==='calculator' && item.payload.slug==='textile' && item.id.startsWith('cat:')).payload
  const previousKey=child.key;tree=choose(ordinary)
  child=elements(tree,node=>'initialMaterialId' in node.props)[0]
  assert.ok(child);assert.equal(child.props.initialMaterialId,undefined);assert.notEqual(child.key,previousKey)
})

test('stable material IDs preselect actual records; invalid/cross-category IDs never select an unrelated first row',()=>{
  const flags=runtime('components/FlagsProductsCalculator.jsx')
  let tree=flags.render('default',{initialCategory:'flags-size',initialItemId:'fp-2'})
  assert.ok(elements(tree,node=>node.type==='button' && node.key==='fp-2')[0].props.className.includes('bg-blue-50'))
  tree=flags.render('default',{initialCategory:'desk-flags',initialItemId:'fp-2'})
  assert.ok(!elements(tree,node=>node.type==='button' && node.key?.startsWith('fp-') && node.props.className.includes('bg-blue-50')).length)
  const fabric=runtime('components/TextilePrintingCalculator.jsx')
  tree=fabric.render('default',{initialCategory:'direct',initialMaterialId:'tx-3'})
  assert.ok(elements(tree,node=>node.type==='button' && node.key==='tx-3')[0].props.className.includes('bg-blue-50'))
  const wide=runtime('components/WideFormatCalculator.jsx')
  tree=wide.render('default',{initialGroup:'roland',initialMaterialId:'wf-roland-canvas'})
  assert.ok(elements(tree,node=>node.type==='button' && node.key==='wf-roland-canvas')[0].props.className.includes('bg-blue-50'))
  const printing=runtime('components/PrintingCalculator.jsx')
  tree=printing.render('default',{initialCategory:'certificates',initialProductId:'p10'})
  assert.ok(printing.hooks.some(value=>value?.id==='p10'))
})

test('prefilled flag and Polytex selections retain the actual material tariffs and original order names',async()=>{
  const client={id:901,name:'Local test'}
  const flags=runtime('components/FlagsProductsCalculator.jsx')
  const flagProps={initialCategory:'flags-size',initialItemId:'fp-2',client}
  let tree=flags.render('default',flagProps)
  elements(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}})
  tree=flags.render('default',flagProps)
  let summary=elements(tree,node=>typeof node.type==='function' && node.props.onSave)[0]
  assert.equal(summary.props.total.value.replace(/\s/g,''),'22500тг')
  await summary.props.onSave()
  assert.equal(flags.orders[0].productName,pricing.flagsProducts.find(item=>item.id==='fp-2').name)
  const fabric=runtime('components/TextilePrintingCalculator.jsx')
  const fabricProps={initialCategory:'direct',initialMaterialId:'tx-3',client}
  tree=fabric.render('default',fabricProps)
  const inputs=elements(tree,node=>node.type==='input' && node.props.type==='number')
  inputs[0].props.onChange({target:{value:'1'}});inputs[1].props.onChange({target:{value:'1'}})
  tree=fabric.render('default',fabricProps)
  elements(tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}})
  tree=fabric.render('default',fabricProps)
  summary=elements(tree,node=>typeof node.type==='function' && node.props.onSave)[0]
  assert.equal(summary.props.total.value.replace(/\s/g,''),'6900тг')
  await summary.props.onSave()
  assert.equal(fabric.orders[0].materialName,'Polytex (прямая печать)')
})


const calculatorFiles = {
  printing: 'Printing', flagsProducts: 'FlagsProducts', textile: 'TextilePrinting', wideFormat: 'WideFormat',
  uvPrinting: 'UVPrinting', businessCards: 'BusinessCards', stateSymbols: 'StateSymbols',
  advertisingStands: 'AdvertisingStands', cncLaser: 'CncLaser', plotterCutting: 'PlotterCutting',
  garmentPrinting: 'GarmentPrinting', embroidery: 'Embroidery', additionalServices: 'AdditionalServices'
}
function targetProps(app, payload) {
  let tree=app.render('AppContent')
  elements(tree,node=>node.props.onLogout && node.props.onSelectCategory)[0].props.onSelectCategory(payload)
  tree=app.render('AppContent')
  const child=elements(tree,node=>typeof node.type==='function' && node.key?.startsWith(payload.searchKey+':'))[0]
  assert.ok(child, 'App must mount a calculator for '+payload.searchKey)
  return child.props
}
function receiverFor(payload) {
  const name=payload.catalogSource==='eventServices'
    ? (payload.slug==='specialists' ? 'Specialists' : 'EventServices') : calculatorFiles[payload.catalogSource]
  return runtime('components/'+name+'Calculator.jsx')
}
function selectedRecord(app,id) {
  return app.hooks.some(hook=>String(hook?.id)===String(id) || String(hook?.value?.id)===String(id))
}

test('all real selectable products have a scoped result across every implemented calculator family',()=>{
  const skipped = {
    printing: item=>!['flyers','booklets','certificates','folders','paper-bags','digital-printing','paper-density'].includes(item.category) || item.specification?.section==='multipage' || /^Фольгирование$/i.test(item.name),
    flagsProducts: item=>/^Прошивка/i.test(item.name), textile:item=>item.category==='service',
    wideFormat:item=>!catalog.isWideFormatGroupEnabled(item.category), stateSymbols:item=>item.name.includes('Объемный герб')
  }
  for(const source of [...Object.keys(calculatorFiles),'eventServices']) {
    const rows=(pricing[source] || []).filter(item=>!skipped[source]?.(item))
    assert.ok(rows.length,source)
    for(const row of rows) assert.ok(index.some(entry=>entry.payload.catalogSource===source && entry.payload.catalogItemId===String(row.id) && !entry.payload.catalogVariant),source+':'+row.id)
  }
})

test('every indexed product and nested variant opens its exact real record through App',()=>{
  const app=runtime('App.jsx',['AppContent'])
  for(const entry of index.filter(item=>item.kind==='material')) {
    const props=targetProps(app,entry.payload)
    const calc=receiverFor(entry.payload)
    const tree=calc.render('default',props)
    assert.ok(selectedRecord(calc,entry.payload.catalogItemId),entry.id+' must select its original record')
    const choice=entry.payload.catalogVariant
    if(!choice)continue
    const expected=choice.value || choice.variantId || choice.productId
    assert.ok(calc.hooks.includes(String(expected)) || elements(tree,node=>node.type==='select' && String(node.props.value)===String(expected)).length,entry.id+' must select its nested option')
  }
})

test('invalid item IDs do not silently charge the first product in other calculator families',()=>{
  for(const source of [...Object.keys(calculatorFiles),'eventServices']) {
    const original=index.find(item=>item.payload.catalogSource===source && !item.payload.catalogVariant)
    const payload={...original.payload,catalogItemId:'missing-product'}
    if(source==='printing')payload.printingProductId='missing-product'
    if(source==='flagsProducts')payload.flagsItemId='missing-product'
    if(source==='textile')payload.textileMaterialId='missing-product'
    if(source==='wideFormat')payload.wideMaterialId='missing-product'
    const props=targetProps(runtime('App.jsx',['AppContent']),payload)
    const calc=receiverFor(payload);calc.render('default',props)
    for(const row of pricing[source])assert.ok(!selectedRecord(calc,row.id),source+' must not select '+row.id)
  }
})


test('representative search selections preserve real tariff totals across calculator families',()=>{
  const cases=[
    ['businessCards','1',null,2800],
    ['printing','p10',null,65000],
    ['uvPrinting','uv1',{kind:'uv-side',value:'2 стороны'},24000],
    ['stateSymbols','2',null,3600000],
    ['advertisingStands','as-2',null,20000],
    ['cncLaser','cnc-2',{kind:'cnc-thickness',value:'t02_4'},180],
    ['plotterCutting','pl-1',null,2000],
    ['eventServices','es-mob2',{kind:'event-print',value:'roland'},30000],
    ['eventServices','es-work7',null,80000],
    ['garmentPrinting','gm2',{kind:'garment-variant',variantId:'pearl'},10000],
    ['embroidery','em2',null,250],
    ['additionalServices','sv-biz',null,3500]
  ]
  for(const [source,id,variant,total] of cases) {
    const entry=index.find(item=>item.payload.catalogSource===source && item.payload.catalogItemId===id
      && (variant ? Object.entries(variant).every(([key,value])=>item.payload.catalogVariant?.[key]===value) : !item.payload.catalogVariant)
      && (source!=='businessCards' || item.payload.cardType==='business-cards'))
    assert.ok(entry,source+':'+id)
    const props=targetProps(runtime('App.jsx',['AppContent']),entry.payload)
    const calc=receiverFor(entry.payload);let tree=calc.render('default',props)
    const form=elements(tree,node=>node.type==='form')[0]
    if(form)form.props.onSubmit({preventDefault(){}})
    else {
      const calculate=elements(tree,node=>node.type==='button' && /Рассчитать/.test(text(node)))[0]
      calculate?.props.onClick()
    }
    tree=calc.render('default',props)
    const calculation=calc.hooks.find(hook=>hook && typeof hook.total==='number')
    assert.ok(calculation,source+':'+id+' must calculate')
    assert.equal(calculation.total,total,source+':'+id)
  }
})
