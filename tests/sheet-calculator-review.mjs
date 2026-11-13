import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createRequire } from 'node:module'
import * as engine from '../src/lib/sheetPricing.mjs'
const require = createRequire(import.meta.url)
const { transformSync } = require('esbuild')
const fallback = JSON.parse(fs.readFileSync(new URL('../src/data/pricing.json', import.meta.url)))
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(child => nodes(child, predicate))]
}
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : [node?.props?.children].flat(Infinity).map(text).join(' ')
function runtime({ kind = 'custom', save = async () => {}, pricing = fallback } = {}) {
  const states = [], refs = [], calls = [], module = { exports: {} }
  let cursor = 0, refCursor = 0
  const react = { ...require('react'), useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] }, useEffect() {}, useMemo(fn) { return fn() }, useRef(value) { const i = refCursor++; return refs[i] ||= { current: value } } }
  const source = fs.readFileSync(new URL('../src/components/SheetProductCalculator.jsx', import.meta.url), 'utf8')
  vm.runInNewContext(transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code, { module, exports: module.exports, console, require(name) {
    if (name === 'react') return react
    if (name.includes('jsx-runtime')) return require(name)
    if (name.includes('sheetPricing')) return engine
    if (name.includes('pricing.json')) return fallback
    if (name.includes('usePricing')) return { usePricing: () => ({ pricing }) }
    if (name.includes('useOrders')) return { useOrders: () => ({ createOrder: async value => { calls.push(value); return save(value) } }) }
    return { __esModule: true, default: () => null }
  } })
  const render = () => { cursor = 0; refCursor = 0; return module.exports.default({ kind, client: { id: 1 }, onBack() {} }) }
  render()
  const seed = patch => { states[0] = { ...states[0], width: 90, height: 120, quantity: 10, paperId: 'manual', paperName: 'Synthetic paper', paperRate: '2', printRate: '3', ...patch } }
  const field = (label, type = 'input') => { const match = nodes(render(), n => n.type === 'label' && text(n).startsWith(label))[0]; assert.ok(match, label); const input = nodes(match, n => n.type === type)[0]; assert.ok(input, label); return input }
  const saveButton = () => nodes(render(), n => n.type === 'button' && /Сохранить заказ|Сохранение/.test(text(n)))[0]
  return { states, calls, render, seed, field, saveButton }
}
test('changing color preserves multipage count and invalidates manual printing tariff', () => {
  const app = runtime(); app.seed({ pages: 12, colorType: '4+4' })
  app.field('Цветность', 'select').props.onChange({ target: { value: '1+1' } })
  assert.equal(app.states[0].pages, 12); assert.equal(app.states[0].printRate, '')
  assert.equal(app.field('Печать без бумаги').props.value, 70)
  assert.equal(app.saveButton().props.disabled, false)
})
test('changing sheet format invalidates all format-dependent manual rates', () => {
  const app = runtime(); app.seed({ operations: { graphtec: { enabled: true, manualRate: '4' } } })
  app.field('Печатный лист', 'select').props.onChange({ target: { value: 'SRA3' } })
  assert.equal(app.states[0].paperRate, ''); assert.equal(app.states[0].printRate, '')
  assert.equal(app.states[0].operations.graphtec.manualRate, '')
  assert.equal(app.saveButton().props.disabled, true)
})
test('SRA3 finishing accepts an explicit manual tariff when catalog option is unavailable', async () => {
  const pricing = structuredClone(fallback); pricing.additionalOperations.laminationPacket.options = pricing.additionalOperations.laminationPacket.options.filter(o => o.sheetFormat !== 'SRA3')
  const app = runtime({ pricing }); app.seed({ sheetFormat: 'SRA3', operations: { lamination: { enabled: true, manualRate: '7', count: 2 } } })
  assert.equal(app.saveButton().props.disabled, false)
  await app.saveButton().props.onClick()
  const op = app.calls[0].sheetCalculation.operations[0]
  assert.equal(op.rate, 7); assert.equal(op.rateSource, 'manual'); assert.equal(op.quantity, app.calls[0].sheetCalculation.sheets * 2)
})
test('rapid repeated save uses one call, retains original snapshot, and blocks identical resave', async () => {
  let complete
  const app = runtime({ save: () => new Promise(resolve => { complete = resolve }) }); app.seed()
  const button = app.saveButton(), pending = button.props.onClick()
  await button.props.onClick(); assert.equal(app.calls.length, 1)
  app.field('Тираж, шт').props.onChange({ target: { value: '20' } })
  assert.equal(app.calls[0].quantity, 10)
  complete(); await pending
  assert.equal(app.saveButton().props.disabled, false)
  app.field('Тираж, шт').props.onChange({ target: { value: 10 } })
  assert.equal(app.saveButton().props.disabled, true)
})
test('failed save clears the guard and permits retry', async () => {
  let attempt = 0
  const app = runtime({ save: async () => { if (++attempt === 1) throw new Error('Synthetic offline failure') } }); app.seed()
  await app.saveButton().props.onClick(); assert.equal(app.saveButton().props.disabled, false)
  await app.saveButton().props.onClick(); assert.equal(app.calls.length, 2); assert.equal(app.saveButton().props.disabled, true)
})


test('catalog provisional rates save one paper charge, per-side printing and tariff warnings', async () => {
  const app = runtime({kind:'badges'})
  app.seed({paperId:'sheet-paper-80-a3',paperRate:'',printRate:'',pages:2,colorType:'4+4',quantity:10,
    operations:{lanyard:{enabled:true},cutting:{enabled:true}}})
  assert.match(text(app.render()), /Предварительный расчёт/)
  await app.saveButton().props.onClick()
  const result=app.calls[0]
  assert.equal(result.sheetCalculation.sheets,2)
  assert.equal(result.sheetCalculation.paper.total,40)
  assert.equal(result.sheetCalculation.printing.total,880)
  assert.equal(result.sheetCalculation.printing.provisional,true)
  assert.equal(result.sheetCalculation.paper.provisional,true)
  assert.equal(result.servicesTotal,3000)
  assert.equal(result.total,3920)
})

test('sheet print tariffs follow edited catalog prices, not bundled product prices', () => {
  const pricing=structuredClone(fallback)
  pricing.additionalOperations.sheetPrinting.options.find(item=>item.id==='a3-color').price=17
  assert.equal(engine.getSheetPrintTariff(pricing,'A3','4+4').rate,17)
  assert.equal(engine.getSheetPrintTariff(pricing,'A3','1+1').rate,70)
  assert.equal(engine.getSheetPrintTariff(pricing,'A2','4+4'),null)
  const noPrices=structuredClone(pricing);delete noPrices.additionalOperations.sheetPrinting
  assert.equal(engine.getSheetPrintTariff(noPrices,'A3','4+4'),null)
})

test('explicit status, not description, controls printing and paper warnings', () => {
  const pricing=structuredClone(fallback)
  const operation=pricing.additionalOperations.sheetPrinting
  operation.description='Окончательная цена без ключевых слов'
  operation.priceStatus='provisional'
  assert.equal(engine.getSheetPrintTariff(pricing,'A3','4+0').provisional,true)
  operation.description='Предварительно: старая заметка'
  operation.priceStatus='approved'
  assert.equal(engine.getSheetPrintTariff(pricing,'A3','4+0').provisional,false)
  const paper=pricing.printing.find(item=>item.id==='sheet-paper-80-a3')
  paper.specification.priceStatus='approved'
  assert.equal(engine.getPaperChoices(pricing).find(item=>item.id===paper.id).provisional,false)
})


test('SRA3 finishing and designer paper are editable provisional catalog rates, retained in saved quotes', async () => {
  for (const [key, optionId, rate] of [['lamination','gloss-sra3',550],['prepress','leaflet-gloss-sra3-1',210],['foiling','foil-sra3-1',300],['graphtec',null,750]]) {
    const app = runtime(); app.seed({sheetFormat:'SRA3', operations:{[key]:{enabled:true,optionId,count:2,complexity:'simple'}}})
    assert.equal(app.saveButton().props.disabled,false)
    await app.saveButton().props.onClick()
    const op=app.calls[0].sheetCalculation.operations[0]
    assert.equal(op.rate,rate);assert.equal(op.provisional,true)
    assert.equal(op.quantity,app.calls[0].sheetCalculation.sheets*(key==='graphtec'?1:2))
  }
  const papers=engine.getPaperChoices(fallback)
  for (const format of Object.keys(engine.SHEET_FORMATS)) {
    for(const density of [80,120,160,300]) assert.ok(papers.some(p=>p.sheetFormat===format && Number(p.density)===density && p.rate>0))
    assert.ok(papers.some(p=>p.sheetFormat===format && /Тачкавер/.test(p.name) && p.rate>0 && p.provisional))
  }
})


test('booklets use one spread and keep printed sides synchronized with color', async () => {
  const app=runtime({kind:'booklets'}); app.seed({pages:2,colorType:'4+4',paperDensity:120});
  assert.equal(app.field('Печатных сторон разворота').props.disabled,true);
  app.field('Цветность','select').props.onChange({target:{value:'4+0'}});
  assert.equal(app.states[0].pages,1);
  assert.equal(app.saveButton().props.disabled,false);
  await app.saveButton().props.onClick();
  assert.equal(app.calls[0].sheetCalculation.sets,1);
  app.field('Цветность','select').props.onChange({target:{value:'4+4'}});
  assert.equal(app.states[0].pages,2);
  app.seed({pages:12});
  assert.equal(app.saveButton().props.disabled,true);
  assert.match(text(app.render()),/многостраничная брошюра/);
});

test('new leaflets and booklets require explicit paper and density before save', () => {
  for(const kind of ['flyers','booklets']) {
    const app=runtime({kind}); app.seed({paperId:'',paperName:'',paperDensity:''});
    assert.equal(app.saveButton().props.disabled,true);
    app.seed({paperId:'manual',paperName:'Paper',paperDensity:''});
    assert.equal(app.saveButton().props.disabled,true);
    app.seed({paperDensity:120});
    assert.equal(app.saveButton().props.disabled,false);
    assert.doesNotMatch(text(app.render()),/Готовые изделия по прежнему прайсу/);
  }
});

test('sheet categories always use the new calculator, including old product search links', () => {
  const source=fs.readFileSync(new URL('../src/components/PrintingCalculator.jsx',import.meta.url),'utf8');
  const module={exports:{}};
  const Sheet=()=>null;
  const react={...require('react'),useState(initial){return [typeof initial==='function'?initial():initial,()=>{}]},useEffect(){},useMemo(fn){return fn()},useRef(){return {current:null}}};
  vm.runInNewContext(transformSync(source,{loader:'jsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,console,require(name){
    if(name==='react')return react;
    if(name.includes('jsx-runtime'))return require(name);
    if(name.includes('pricing.json'))return fallback;
    if(name.includes('usePricing'))return {usePricing:()=>({pricing:fallback})};
    if(name.includes('useOrders'))return {useOrders:()=>({createOrder:async()=>{},isOnline:true})};
    if(name.includes('catalog.mjs'))return {isServiceAllowed:()=>true};
    return {__esModule:true,default:Sheet};
  }});
  for(const category of ['flyers','booklets','custom','hangers']) for(const productId of [null,'old-product',123]) {
    const rendered=module.exports.default({initialCategory:category,initialProductId:productId,client:{id:1}});
    assert.equal(rendered.type,Sheet);
    assert.equal(rendered.props.kind,category);
    assert.equal(rendered.props.onLegacy,undefined);
  }
});
