import { useEffect, useMemo, useRef, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import fallback from '../data/pricing.json'
import ClientSelector from './ClientSelector'
import { calculateSheetLayout, calculateSheetQuote, getGraphtecRate, getPaperChoices, getSheetPrintTariff, PRODUCT_FORMATS, SHEET_FORMATS } from '../lib/sheetPricing.mjs'

const TITLES = { badges: 'Бейджи', flyers: 'Листовки', booklets: 'Буклеты и лифлеты', custom: 'Нестандартная продукция', hangers: 'Хенгеры' }
const RULES = [
  { key: 'lamination', pattern: /ламинация пакетная/i, label: 'Ламинация пакетная', unit: 'sheet-side' },
  { key: 'prepress', pattern: /препрес|припресс/i, label: 'Припресс', unit: 'sheet-side' },
  { key: 'foiling', pattern: /^фольгирование$/i, label: 'Фольгирование', unit: 'sheet-side' },
  { key: 'graphtec', pattern: /graphtec/i, label: 'Фигурная резка Graphtec', unit: 'sheet' },
  { key: 'rounding', pattern: /^скругление углов$/i, label: 'Скругление углов', unit: 'corner' },
  { key: 'holes', pattern: /^отверстие круглое$/i, label: 'Пробивка отверстий', unit: 'hole' },
  { key: 'creasing', pattern: /^биговка$/i, label: 'Биговка', unit: 'fold' },
  { key: 'folding', pattern: /^фальцовка/i, label: 'Фальцовка', unit: 'fold' },
  { key: 'cutting', pattern: /^Обрезка листовая за заказ$/i, label: 'Обрезка: фиксированно за заказ', unit: 'order', manual: true },
  { key: 'lanyard', pattern: /ланьярд/i, label: 'Ланьярд + карабин: комплект на бейдж', unit: 'unit', badgesOnly: true },
  { key: 'varnish', pattern: /^лакировка листовая$/i, label: 'Лакировка', unit: 'sheet-side' }
]
const fieldClass = 'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white'
const money = amount => amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
const optionFormat = option => /SRA3/i.test(option.name || '') ? 'SRA3' : /[АA]3/i.test(option.name || '') ? 'A3' : /[АA]4/i.test(option.name || '') ? 'A4' : null
function initialForm(kind) {
  return { name: TITLES[kind], productFormat: kind === 'hangers' || kind === 'custom' ? 'custom' : kind === 'badges' ? 'badge' : kind === 'booklets' ? 'A4' : 'A5',
    width: ['hangers','custom'].includes(kind) ? '' : kind === 'badges' ? 90 : kind === 'booklets' ? 210 : 148, height: ['hangers','custom'].includes(kind) ? '' : kind === 'badges' ? 120 : kind === 'booklets' ? 297 : 210,
    sheetFormat: 'A3', quantity: 100, pages: ['booklets','hangers'].includes(kind) ? 2 : 1,
    colorType: ['booklets','hangers'].includes(kind) ? '4+4' : '4+0', margin: 0, gap: 0, yieldPerSheet: '',
    paperId: '', paperName: '', paperDensity: '', paperRate: '', printRate: '', operations: kind === 'hangers' ? { graphtec: { enabled: true, complexity: 'simple' } } : {},
    isUrgent: false, discount: 0, notes: '' }
}

export default function SheetProductCalculator({ kind = 'custom', client: externalClient, onBack }) {
  const { pricing } = usePricing()
  const data = pricing || fallback
  const { createOrder } = useOrders()
  const [form, setForm] = useState(() => initialForm(kind))
  const [client, setClient] = useState(externalClient || null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [message, setMessage] = useState('')
  const [savedSignature, setSavedSignature] = useState('')
  useEffect(() => { if (externalClient) setClient(externalClient) }, [externalClient])
  const change = (key, value) => {
    setForm(previous => ({ ...previous, [key]: value,
      ...(['paperId','paperName','paperDensity','sheetFormat'].includes(key) ? { paperRate: '', printRate: '' } : {}),
      ...(key === 'colorType' ? { printRate: '' } : {}),
      ...(key === 'sheetFormat' ? { operations: Object.fromEntries(Object.entries(previous.operations).map(([id, state]) => [id, { ...state, optionId: '', manualRate: '' }])) } : {})
    })); setMessage('')
  }
  const changeOperation = (key, patch) => { setForm(previous => ({ ...previous, operations: { ...previous.operations, [key]: { ...previous.operations[key], ...patch } } })); setMessage('') }
  const papers = useMemo(() => getPaperChoices(data), [data])
  const selectedPaper = papers.find(paper => paper.id === form.paperId)
  const printTariff = getSheetPrintTariff(data, form.sheetFormat, form.colorType)
  const effectivePrintRate = form.printRate !== '' ? form.printRate : printTariff?.rate ?? ''
  const catalogPaperRate = selectedPaper?.sheetFormat === form.sheetFormat ? selectedPaper.rate : null
  const operations = Object.values(data.additionalOperations || {})
  const graphtec = operations.find(operation => /graphtec/i.test(operation.name || '')) || fallback.additionalOperations.graphtec
  const availableRules = RULES.filter(rule => !rule.badgesOnly || kind === 'badges')
  const findOperation = rule => rule.key === 'graphtec' ? graphtec : operations.find(operation => rule.pattern.test(operation.name || ''))
  const built = useMemo(() => {
    try {
      const selected = availableRules.filter(rule => form.operations[rule.key]?.enabled).map(rule => {
        const state = form.operations[rule.key]
        const source = findOperation(rule)
        let rate = state.manualRate ?? source?.price, option = null
        if (rule.key === 'graphtec') rate = getGraphtecRate(source, form.sheetFormat, state.complexity || 'simple') ?? state.manualRate
        else if (!rule.manual && rule.unit === 'sheet-side') {
          option = (source?.options || []).find(item => String(item.id) === String(state.optionId) && optionFormat(item) === form.sheetFormat)
          if (!option && (source?.options || []).some(item => optionFormat(item) === form.sheetFormat)) throw new Error(`Выберите вариант: ${rule.label}`)
          rate = option?.price ?? state.manualRate
        } else if (!rule.manual) rate = source?.price ?? state.manualRate
        return { id: source?.id || rule.key, kind: rule.key, name: [rule.label, option?.name].filter(Boolean).join(': '), unit: rule.unit,
          rate, count: state.count ?? (rule.unit === 'corner' ? 4 : 1), optionId: option?.id, complexity: rule.key === 'graphtec' ? state.complexity || 'simple' : undefined,
          provisional: source?.priceStatus === 'provisional', rateSource: state.manualRate != null ? 'manual' : 'catalog' }
      })
      const paper = { ...(selectedPaper || { id: form.paperId, name: form.paperId === 'manual' ? form.paperName : form.paperId.startsWith('manual-') ? `Бумага ${form.paperId.split('-')[1]} г/м²` : '', density: form.paperId.startsWith('manual-') ? form.paperId.split('-')[1] : form.paperDensity }),
        density: selectedPaper?.density || (form.paperId.startsWith('manual-') ? form.paperId.split('-')[1] : form.paperDensity),
        rate: catalogPaperRate ?? form.paperRate, rateSource: catalogPaperRate == null ? 'manual' : 'catalog' }
      return { quote: calculateSheetQuote({ ...form, kind, productName: form.name, paper, printRate: effectivePrintRate, printRateSource: form.printRate !== '' ? 'manual' : 'catalog', printProvisional: form.printRate === '' && !!printTariff?.provisional, operations: selected, urgentSurcharge: data.settings?.urgentSurcharge ?? 30 }) }
    } catch (error) { return { error: error.message } }
  }, [form, data])
  let layout
  try { layout = calculateSheetLayout({ ...form, sides: form.colorType.endsWith('+0') ? 1 : 2, ...(kind === 'hangers' ? { yieldPerSheet: 6, template: true } : {}) }) } catch { /* The quote shows the validation message. */ }
  const quote = built.quote
  const signature = quote ? JSON.stringify([quote, client?.id]) : ''
  const chooseFormat = value => {
    const dimensions = value === 'badge' ? [90,120] : PRODUCT_FORMATS[value]
    setForm(previous => ({ ...previous, productFormat: value, ...(dimensions ? { width: dimensions[0], height: dimensions[1] } : {}) }))
    setMessage('')
  }
  const save = async () => {
    if (!quote || !client || savingRef.current || signature === savedSignature) return
    savingRef.current = true; setSaving(true); setMessage('')
    try {
      await createOrder({ ...quote, client, category: kind === 'badges' ? 'business-cards' : 'printing', type: kind === 'badges' ? 'business-cards' : 'printing', status: 'draft', paymentStatus: 'not_paid' })
      setSavedSignature(signature); setMessage('Заказ сохранён. Для нового расчёта измените параметры.')
    } catch (error) { setMessage(`Не удалось сохранить: ${error.message}`) }
    finally { savingRef.current = false; setSaving(false) }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3">{onBack && <button type="button" onClick={onBack} className="text-blue-700 font-medium">← Назад</button>}</div>
    <section className="bg-white rounded-xl border p-5 space-y-4">
      <h2 className="text-2xl font-bold">{TITLES[kind]} · расчёт по листам</h2>
      <p className="text-sm text-gray-600">Бумага начисляется один раз за лист, печать без бумаги — за каждую сторону. Предварительные ставки можно исправить в прайсе; это не утверждённые цены клиента. Пакетные цены готовой продукции здесь не используются.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label>Название<input className={fieldClass} value={form.name} onChange={event => change('name', event.target.value)} /></label>
        <label>{kind === 'booklets' ? 'Формат в развороте' : 'Формат изделия'}<select className={fieldClass} value={form.productFormat} onChange={event => chooseFormat(event.target.value)}>
          {kind === 'badges' && <option value="badge">Бейдж 90 × 120 мм</option>}
          {Object.keys(PRODUCT_FORMATS).map(format => <option key={format} value={format}>{format === 'euro' ? 'Евро 100 × 210 мм' : format}</option>)}<option value="custom">Произвольный</option>
        </select></label>
        <label>Печатный лист<select className={fieldClass} value={form.sheetFormat} disabled={kind === 'hangers'} onChange={event => change('sheetFormat', event.target.value)}>{Object.keys(SHEET_FORMATS).map(format => <option key={format}>{format}</option>)}</select></label>
        <label>Ширина, мм<input type="number" min="0.01" step="0.1" className={fieldClass} value={form.width} onChange={event => { change('width', event.target.value); change('productFormat', 'custom') }} /></label>
        <label>Высота, мм<input type="number" min="0.01" step="0.1" className={fieldClass} value={form.height} onChange={event => { change('height', event.target.value); change('productFormat', 'custom') }} /></label>
        <label>Тираж, шт<input type="number" min="1" step="1" className={fieldClass} value={form.quantity} onChange={event => change('quantity', event.target.value)} /></label>
        <label>Цветность<select className={fieldClass} value={form.colorType} onChange={event => { const value = event.target.value; setForm(previous => ({ ...previous, colorType: value, printRate: '', pages: kind === 'booklets' ? (value.endsWith('+0') ? 1 : 2) : Math.max(Number(previous.pages) || 1, value.endsWith('+0') ? 1 : 2) })); setMessage('') }}>{['1+0','1+1','4+0','4+4'].filter(color => (kind !== 'hangers' || !color.endsWith('+0')) && (!/тач\s*кавер|touch\s*cover/i.test(selectedPaper?.name || form.paperName) || !color.startsWith('1'))).map(color => <option key={color}>{color}</option>)}</select></label>
        <label>{kind === 'booklets' ? 'Печатных сторон разворота' : 'Страниц на изделие'}<input type="number" min="1" step="1" className={fieldClass} disabled={['hangers','booklets'].includes(kind)} value={form.pages} onChange={event => change('pages', event.target.value)} /></label>
        <label>Поля с каждой стороны, мм<input type="number" min="0" step="0.1" className={fieldClass} value={form.margin} onChange={event => change('margin', event.target.value)} /></label>
        <label>Зазор между изделиями, мм<input type="number" min="0" step="0.1" className={fieldClass} value={form.gap} onChange={event => change('gap', event.target.value)} /></label>
        <label>Выход с листа {kind === 'hangers' ? '(шаблон)' : '(пусто = автоматически)'}<input type="number" min="1" step="1" className={fieldClass} disabled={kind === 'hangers'} value={kind === 'hangers' ? 6 : form.yieldPerSheet} onChange={event => change('yieldPerSheet', event.target.value)} /></label>
      </div>
      <p className="text-sm text-amber-800">Поля и зазор по умолчанию 0 мм: подтвердите рабочую область и вылеты перед расчётом. Раскладка прямоугольная, с проверкой поворота. Для буклета укажите полный размер одного листа в развороте; число печатных сторон определяется цветностью. Сгибы задаются в биговке/фальцовке. Это не расчёт многостраничной брошюры со спуском полос.</p>
      {kind === 'hangers' && <p className="text-sm text-amber-800">Хенгеры: 6 изделий на A3 по шаблону из ТЗ. Размеры укажите по вашему макету; требуется подтверждение шаблона перед производством.</p>}
      {layout && <div className="rounded-lg bg-blue-50 p-3" aria-live="polite"><b>{layout.yieldPerSheet} изделий с листа · {layout.sheets} листов</b><p className="text-sm">Округление вверх: {form.quantity} / {layout.yieldPerSheet} = {layout.sheetsPerSet} листов на комплект × {layout.sets}. Свободных мест в последнем комплекте: {layout.blankCells}.</p></div>}
    </section>
    <section className="bg-white rounded-xl border p-5 space-y-4">
      <h3 className="text-lg font-bold">Бумага и печать</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <label>Бумага и плотность (обязательно)<select className={fieldClass} value={form.paperId} onChange={event => { change('paperId', event.target.value); change('paperRate', '') }}><option value="">Выберите бумагу</option>{papers.map(paper => <option key={paper.id} value={paper.id}>{paper.name}</option>)}{[80,120,160,300].map(density => <option key={density} value={`manual-${density}`}>{density} г/м² · ручной тариф</option>)}<option value="manual">Другая бумага</option></select></label>
        {form.paperId === 'manual' && <><label>Название бумаги<input className={fieldClass} value={form.paperName} onChange={event => change('paperName', event.target.value)} /></label><label>Плотность, г/м²<input type="number" min="1" className={fieldClass} value={form.paperDensity} onChange={event => change('paperDensity', event.target.value)} /></label></>}
        {selectedPaper && !selectedPaper.density && <label>Плотность выбранной бумаги, г/м²<input type="number" min="1" className={fieldClass} value={form.paperDensity} onChange={event => change('paperDensity', event.target.value)} /></label>}
        <label>Бумага: тг за {form.sheetFormat}<input type="number" min="0" step="0.01" className={fieldClass} readOnly={catalogPaperRate != null} value={catalogPaperRate ?? form.paperRate} onChange={event => change('paperRate', event.target.value)} /><span className="text-xs text-gray-500">{catalogPaperRate != null ? selectedPaper?.provisional ? 'Предварительная цена листа из прайса. Требует утверждения.' : 'Действующий тариф выбранной бумаги из прайса.' : 'Отдельного тарифа этого формата нет. Введите согласованную цену листа, не цену готовой печати.'}</span></label>
        <label>Печать без бумаги: тг за сторону {form.sheetFormat}<input type="number" min="0" step="0.01" className={fieldClass} value={effectivePrintRate} onChange={event => change('printRate', event.target.value)} /><span className="text-xs text-gray-500">{form.printRate !== '' ? 'Ручная ставка для этого расчёта.' : printTariff ? `${printTariff.provisional ? 'Предварительно. ' : ''}Ставка из прайса, без бумаги; при двух сторонах умножается на 2.` : 'Введите тариф без бумаги.'}</span></label>
      </div>
    </section>
    <section className="bg-white rounded-xl border p-5 space-y-3"><h3 className="text-lg font-bold">Технологические операции</h3>
      {availableRules.map(rule => {
        const state = form.operations[rule.key] || {}, source = findOperation(rule)
        const knownGraphtecRate = rule.key === 'graphtec' ? getGraphtecRate(source, form.sheetFormat, state.complexity || 'simple') : null
        const options = (source?.options || []).filter(option => optionFormat(option) === form.sheetFormat)
        const manual = rule.manual || (rule.key === 'graphtec' ? knownGraphtecRate == null : rule.unit === 'sheet-side' ? options.length === 0 : source?.price == null)
        return <div key={rule.key} className="border rounded-lg p-3"><label className="flex gap-2 items-center font-medium"><input type="checkbox" checked={!!state.enabled} disabled={kind === 'hangers' && rule.key === 'graphtec'} onChange={event => changeOperation(rule.key, { enabled: event.target.checked })} />{rule.label}</label>
          {state.enabled && source?.priceStatus === 'provisional' && <p className="text-sm text-amber-800">Предварительная ставка: уточните у клиента в прайсе.</p>}
            {state.enabled && <div className="mt-3 grid sm:grid-cols-3 gap-3">
            {!rule.manual && rule.unit === 'sheet-side' && <label>Вариант {form.sheetFormat}<select className={fieldClass} value={state.optionId || ''} onChange={event => changeOperation(rule.key, { optionId: event.target.value })}><option value="">Выберите вариант</option>{options.map(option => <option key={option.id} value={option.id}>{option.name} · {option.price} тг/сторона</option>)}</select>{!options.length && <span className="text-sm text-red-700">В прайсе нет варианта для этого формата.</span>}</label>}
            {rule.key === 'graphtec' && <label>Сложность<select className={fieldClass} value={state.complexity || 'simple'} onChange={event => changeOperation(rule.key, { complexity: event.target.value, manualRate: '' })}><option value="simple">Простая</option><option value="medium">Средняя</option><option value="complex">Сложная</option></select><span className="text-xs">{knownGraphtecRate == null ? 'Правило этого формата/сложности не согласовано. Нужен ручной тариф.' : `${knownGraphtecRate} тг/лист из прайса`}</span></label>}
            {['sheet-side','corner','fold','hole'].includes(rule.unit) && <label>{rule.unit === 'sheet-side' ? 'Обработанных сторон (1–2)' : rule.unit === 'corner' ? 'Углов на изделие (1–4)' : 'Операций на изделие'}<input className={fieldClass} type="number" min="1" max={rule.unit === 'sheet-side' ? 2 : rule.unit === 'corner' ? 4 : undefined} step="1" value={state.count ?? (rule.unit === 'corner' ? 4 : 1)} onChange={event => changeOperation(rule.key, { count: event.target.value })} /></label>}
            {manual ? <label>Согласованный тариф, тг {rule.unit === 'order' ? 'за заказ' : rule.unit === 'unit' ? 'за комплект' : rule.unit === 'sheet' ? 'за лист' : 'за операцию/сторону'}<input className={fieldClass} type="number" min="0" step="0.01" value={state.manualRate ?? source?.price ?? ''} onChange={event => changeOperation(rule.key, { manualRate: event.target.value })} />{rule.key === 'lanyard' && <span className="text-xs">Количество комплектов автоматически равно тиражу. Старый спорный тариф не подставляется.</span>}</label> : source?.price != null && rule.unit !== 'sheet-side' && rule.key !== 'graphtec' ? <p>Тариф: {source.price} тг. Количество рассчитывается автоматически.</p> : null}
          </div>}
        </div>
      })}
    </section>
    <section className="bg-white rounded-xl border p-5 space-y-4"><div className="grid sm:grid-cols-2 gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={form.isUrgent} onChange={event => change('isUrgent', event.target.checked)} />Срочно (+{data.settings?.urgentSurcharge ?? 30}%)</label><label>Скидка, %<input type="number" min="0" max="100" className={fieldClass} value={form.discount} onChange={event => change('discount', event.target.value)} /></label></div><label className="block">Примечания<textarea className={fieldClass} value={form.notes} onChange={event => change('notes', event.target.value)} /></label></section>
    <section className="bg-white rounded-xl border p-5 space-y-4" aria-live="polite"><h3 className="text-lg font-bold">Расчёт</h3>
      {quote && (quote.sheetCalculation.paper.provisional || quote.sheetCalculation.printing.provisional || quote.sheetCalculation.operations.some(item => item.provisional)) && <p className="text-amber-800 font-medium">Предварительный расчёт: содержит неутверждённые ставки.</p>}
        {built.error ? <p role="status" className="text-amber-800">{built.error}. Итог и сохранение недоступны до заполнения.</p> : <><p>Бумага: {quote.sheetCalculation.sheets} × {money(quote.sheetCalculation.paper.rate)} = {money(quote.sheetCalculation.paper.total)} тг</p><p>Печать: {quote.sheetCalculation.printing.impressions} сторон × {money(quote.sheetCalculation.printing.rate)} = {money(quote.sheetCalculation.printing.total)} тг</p>{quote.sheetCalculation.operations.map(operation => <p key={operation.id}>{operation.name}: {operation.quantity} × {money(operation.rate)} = {money(operation.total)} тг</p>)}{quote.isUrgent && <p>Срочность: +{money(quote.urgentAmount)} тг</p>}{quote.discount > 0 && <p>Скидка: −{money(quote.discountAmount)} тг</p>}<p className="text-2xl font-bold">Итого: {money(quote.total)} тг</p></>}
      <ClientSelector selectedClient={client} onSelectClient={setClient} />
      <button type="button" className="px-5 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50" disabled={!quote || !client || saving || signature === savedSignature} onClick={save}>{saving ? 'Сохранение…' : 'Сохранить заказ'}</button>{message && <p role="status">{message}</p>}
    </section>
  </div>
}
