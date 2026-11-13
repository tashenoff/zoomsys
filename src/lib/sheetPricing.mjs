export const SHEET_FORMATS = { A4: [210, 297], A3: [297, 420], SRA3: [320, 450] }
export const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100
export const PRODUCT_FORMATS = { A3: [297, 420], A4: [210, 297], A5: [148, 210], A6: [105, 148], A7: [74, 105], euro: [100, 210] }

export function finiteNumber(value, label, { min = 0, integer = false, max = Infinity } = {}) {
  if (!['number','string'].includes(typeof value) || value === '' || value == null || (typeof value === 'string' && !value.trim())) throw new Error(`Укажите: ${label}`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isSafeInteger(number))) throw new Error(`Проверьте: ${label}`)
  return number
}

// Rectangular grid, both orientations. No undocumented bleed, waste or mixed imposition is assumed.
export function calculateSheetLayout({ width, height, sheetFormat = 'A3', margin = 0, gap = 0, quantity, pages = 1, sides = 1, yieldPerSheet, template = false }) {
  width = finiteNumber(width, 'ширина, мм', { min: 0.01 })
  height = finiteNumber(height, 'высота, мм', { min: 0.01 })
  quantity = finiteNumber(quantity, 'тираж', { min: 1, integer: true })
  pages = finiteNumber(pages, 'страниц на изделие', { min: 1, integer: true })
  sides = finiteNumber(sides, 'сторон печати', { min: 1, max: 2, integer: true })
  margin = finiteNumber(margin, 'поле с каждой стороны, мм')
  gap = finiteNumber(gap, 'зазор, мм')
  const dimensions = SHEET_FORMATS[sheetFormat]
  if (!dimensions) throw new Error('Выберите формат печатного листа')
  const [sheetWidth, sheetHeight] = dimensions
  const usableWidth = sheetWidth - margin * 2, usableHeight = sheetHeight - margin * 2
  if (usableWidth <= 0 || usableHeight <= 0) throw new Error('Поля превышают размер листа')
  const candidates = [[width, height, false], [height, width, true]].map(([w, h, rotated]) => {
    const columns = Math.floor((usableWidth + gap + 1e-8) / (w + gap))
    const rows = Math.floor((usableHeight + gap + 1e-8) / (h + gap))
    return { columns, rows, rotated, capacity: columns * rows }
  }).sort((a,b) => b.capacity - a.capacity)
  const layout = candidates[0]
  if (layout.capacity < 1) throw new Error('Изделие не помещается на выбранном листе с этими полями')
  const output = yieldPerSheet === '' || yieldPerSheet == null ? layout.capacity
    : finiteNumber(yieldPerSheet, 'выход изделий с листа', { min: 1, integer: true })
  if (!template && output > layout.capacity) throw new Error('Выход изделий превышает вместимость прямоугольной раскладки')
  if (template && (sheetFormat !== 'A3' || output !== 6)) throw new Error('Шаблон хенгера: только 6 изделий на A3')
  const sheetsPerSet = Math.ceil(quantity / output)
  const sets = Math.ceil(pages / sides)
  const sheets = sheetsPerSet * sets
  if (!Number.isSafeInteger(sheets)) throw new Error('Слишком большой тираж')
  return { ...layout, sheetWidth, sheetHeight, width, height, margin, gap, sheetFormat, quantity, pages, sides,
    yieldPerSheet: output, sheetsPerSet, sets, sheets, template, blankCells: sheetsPerSet * output - quantity }
}

export function calculateSheetOperation(operation, { quantity, sheets }) {
  const rate = finiteNumber(operation.rate, `тариф: ${operation.name}`)
  let count = 1
  if (operation.unit === 'sheet-side') count = sheets * finiteNumber(operation.count, `стороны: ${operation.name}`, { min: 1, max: 2, integer: true })
  else if (operation.unit === 'sheet') count = sheets
  else if (operation.unit === 'unit') count = quantity
  else if (operation.unit === 'corner') count = quantity * finiteNumber(operation.count, 'число углов', { min: 1, max: 4, integer: true })
  else if (operation.unit === 'fold' || operation.unit === 'hole') count = quantity * finiteNumber(operation.count, `операций на изделие: ${operation.name}`, { min: 1, integer: true })
  else if (operation.unit !== 'order') throw new Error(`Неизвестная единица: ${operation.name}`)
  const total = roundMoney(rate * count)
  if (!Number.isFinite(total)) throw new Error(`Слишком большая стоимость: ${operation.name}`)
  return { ...operation, rate, quantity: count, total }
}

export function calculateSheetQuote(input) {
  const { kind = 'custom', productName, colorType, paper, operations = [], notes = '' } = input
  if (!['1+0','1+1','4+0','4+4'].includes(colorType)) throw new Error('Выберите цветность')
  if (/тач\s*кавер|touch\s*cover/i.test(paper?.name || '') && colorType.startsWith('1')) throw new Error('Для Touch Cover доступны только 4+0 и 4+4')
  if (!paper?.name?.trim()) throw new Error('Выберите бумагу')
  const sides = colorType.endsWith('+0') ? 1 : 2
  if (['booklets', 'flyers'].includes(kind)) finiteNumber(paper.density, 'плотность бумаги', { min: 1 })
  if (kind === 'booklets' && Number(input.pages) !== sides) throw new Error('Буклет: один разворот с числом печатных сторон по цветности; многостраничная брошюра требует спуска полос')
  if (kind === 'hangers' && Number(input.pages) !== 2) throw new Error('Хенгеры: ровно две печатные стороны')
  if (kind === 'hangers' && sides !== 2) throw new Error('Для хенгеров требуется двусторонняя печать')
  if (Number(input.pages) < sides) throw new Error('Число страниц меньше выбранного числа сторон печати')
  const layout = calculateSheetLayout({ ...input, sides, ...(kind === 'hangers' ? { yieldPerSheet: 6, template: true } : {}) })
  const paperRate = finiteNumber(paper.rate, 'стоимость бумаги за лист')
  const printRate = finiteNumber(input.printRate, 'стоимость печати за сторону листа')
  const paperTotal = roundMoney(paperRate * layout.sheets)
  // Odd final pages have one printed side, rather than charging a fictitious blank side.
  const impressions = layout.sheetsPerSet * layout.pages
  const printTotal = roundMoney(printRate * impressions)
  const seen = new Set()
  const details = operations.map(operation => {
    if (seen.has(operation.id)) throw new Error('Операция выбрана дважды')
    seen.add(operation.id)
    return calculateSheetOperation(operation, layout)
  })
  if (kind === 'hangers' && !details.some(operation => operation.kind === 'graphtec')) throw new Error('Для хенгеров добавьте фигурную резку Graphtec')
  const baseTotal = roundMoney(paperTotal + printTotal)
  const servicesTotal = roundMoney(details.reduce((sum, operation) => sum + operation.total, 0))
  const subtotal = roundMoney(baseTotal + servicesTotal)
  const urgentSurcharge = finiteNumber(input.urgentSurcharge ?? 0, 'надбавка за срочность', { max: 1000 })
  const discount = finiteNumber(input.discount ?? 0, 'скидка', { max: 100 })
  const urgentAmount = input.isUrgent ? roundMoney(subtotal * urgentSurcharge / 100) : 0
  const discountAmount = roundMoney((subtotal + urgentAmount) * discount / 100)
  const total = roundMoney(subtotal + urgentAmount - discountAmount)
  if (![baseTotal, servicesTotal, subtotal, total].every(Number.isFinite)) throw new Error('Слишком большая стоимость')
  return { productName: productName?.trim() || 'Листовая продукция', productType: kind, pricingMode: 'sheet', quantity: layout.quantity,
    format: `${layout.width}×${layout.height} мм`, colorType, unitPrice: baseTotal / layout.quantity, baseTotal, servicesTotal, subtotal,
    servicesDetails: details.map(operation => ({ ...operation, price: operation.total })), isUrgent: !!input.isUrgent, urgentSurcharge, urgentAmount,
    discount, discountAmount, notes, total,
    sheetCalculation: { version: 1, ...layout, layout, paper: { ...paper, rate: paperRate, total: paperTotal },
      printing: { colorType, rate: printRate, sides, impressions, total: printTotal, rateSource: input.printRateSource || 'manual', provisional: !!input.printProvisional }, operations: details } }
}

export function getGraphtecRate(operation, sheetFormat, complexity = 'simple') {
  const options = operation?.options || []
  const direct = options.find(option => option.sheetFormat === sheetFormat && option.complexity === complexity)
    || options.find(option => option.id === `${sheetFormat.toLowerCase()}-${complexity}`)
  return direct && typeof direct.price === 'number' && Number.isFinite(direct.price) && direct.price >= 0 ? direct.price : null
}

export function getPaperChoices(pricing) {
  return (pricing?.printing || []).filter(item => item.category === 'paper-density' && (item.specification?.section === 'sheet-paper' || !/печать/i.test(item.name || ''))).map(item => {
    const name = item.name || ''
    const format = item.specification?.sheetFormat || (/SRA3/i.test(name + (item.format || '')) ? 'SRA3' : /[АA]3/.test(name + (item.format || '')) || /дизайнерская/i.test(name) ? 'A3' : null)
    const rate = item.prices?.default
    return { id: String(item.id), name, density: item.specification?.density || name.match(/(\d+)\s*(?:гр|г\/)/)?.[1] || '', sheetFormat: format,
      rate: typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 ? rate : null, rateSource: 'catalog', provisional: item.specification?.priceStatus === 'provisional', source: item.specification?.source || '' }
  })
}

export function getSheetPrintTariff(pricing, format, colorType) {
  const operation = Object.values(pricing?.additionalOperations || {}).find(item => item.name === 'Листовая печать без бумаги')
  const option = operation?.options?.find(item => item.id === `${format.toLowerCase()}-${colorType.startsWith('1') ? 'mono' : 'color'}`)
  if (!option || typeof option.price !== 'number' || !Number.isFinite(option.price) || option.price < 0) return null
  return { rate: option.price, provisional: operation.priceStatus === 'provisional', source: operation.description, optionId: option.id }
}
