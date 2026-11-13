const numericInput = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== ''
const integer = value => numericInput(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
const rate = value => numericInput(value) && Number.isFinite(Number(value)) && Number(value) >= 0
export function cardOperationKind(op) {
  if (['prepress', 'laminationPacket', 'foiling', 'cornerRounding', 'graphtec'].includes(op?.id)) return op.id
  const name = String(op?.name || '').trim()
  if (/graphtec/i.test(name)) return 'graphtec'
  if (/^(препресс?|припресс(?:овка)?)$/i.test(name)) return 'prepress'
  if (/ламин.*пакет|пакет.*ламин/i.test(name)) return 'laminationPacket'
  if (/^фольгирование$/i.test(name)) return 'foiling'
  if (/скругление|закругление/i.test(name)) return 'cornerRounding'
  return null
}
export const isSheetBilledOperation = op => isSheetOperation(op) || cardOperationKind(op) === 'graphtec'
export const defaultCardOption = (op, format) => cardOperationKind(op) === 'graphtec' ? (op.options || []).find(option => optionSheetFormat(option) === format && (option.complexity === 'simple' || option.id === `${format.toLowerCase()}-simple`))?.id || '' : ''
export const isSheetOperation = op => ['prepress', 'laminationPacket', 'foiling'].includes(cardOperationKind(op))
export const isCurrentCardProduct = product => !(/touch[\s-]*cover|тач[\s-]*кавер/i.test(product?.name || '') && /^1\s*\+\s*[01]$/.test(product?.colorType || ''))
export function optionSheetFormat(option) {
  if (['A3', 'A4'].includes(option?.sheetFormat)) return option.sheetFormat
  return `${option?.id || ''} ${option?.name || ''}`.match(/[aа]([34])/i)?.[1] === '3' ? 'A3'
    : /[aа]4/i.test(`${option?.id || ''} ${option?.name || ''}`) ? 'A4' : null
}
export function cardSheetCount(quantity, yieldPerSheet, format) {
  if (!['A4', 'A3'].includes(format) || !integer(quantity) || !integer(yieldPerSheet)) return null
  return Math.ceil(Number(quantity) / Number(yieldPerSheet))
}
export function calculateCardOperations({ quantity, format, yieldPerSheet, operations = [], selected = [], options = {}, quantities = {}, sides = {}, extraServices = [], selectedExtras = [], reorderDiscount = 0 }) {
  const sheets = cardSheetCount(quantity, yieldPerSheet, format)
  if (sheets === null || !rate(reorderDiscount) || Number(reorderDiscount) > 100) return null
  const details = [], seenIds = new Set(), seenNames = new Set()
  const append = (service, detail) => {
    const id = String(service.id), name = String(service.name || '').trim().toLowerCase()
    if (seenIds.has(id) || seenNames.has(name)) return
    seenIds.add(id); seenNames.add(name); details.push(Object.freeze(detail))
  }
  for (const id of new Set(selected.map(String))) {
    const op = operations.find(item => String(item.id) === id)
    if (!op || /монтаж|демонтаж/i.test(op.name || '')) return null
    let price, name = op.name
    let evidence = { ...(op.priceStatus === 'provisional' ? { provisional: true } : {}), operationId: id, optionId: null, rate: null, billedQuantity: 1, unit: op.unit || null }
    if (op.type === 'select') {
      const option = (op.options || []).find(item => String(item.id) === String(options[id] || defaultCardOption(op, format)))
      if (!option || !rate(option.price)) return null
      evidence = { ...evidence, optionId: String(option.id), rate: Number(option.price), unit: option.unit || op.unit || null }
      price = Number(option.price); name += `: ${option.name}`
      if (cardOperationKind(op) === 'graphtec') {
        if (optionSheetFormat(option) !== format) return null
        evidence = { ...evidence, billedQuantity: sheets, sheetFormat: format, sheetCount: sheets, yieldPerSheet: Number(yieldPerSheet), complexity: option.complexity }
        price *= sheets
        name += ` (${sheets} лист. ${format})`
      } else if (isSheetOperation(op)) {
        const rawSides = sides[id] === undefined ? 1 : sides[id]
        if (!integer(rawSides)) return null
        const sideCount = Number(rawSides)
        if (![1, 2].includes(sideCount) || optionSheetFormat(option) !== format) return null
        evidence = { ...evidence, billedQuantity: sheets * sideCount, sheetFormat: format, sheetCount: sheets, sides: sideCount, yieldPerSheet: Number(yieldPerSheet) }
        price *= sheets * sideCount
        name += ` (${sheets} лист. ${format} × ${sideCount} стор.)`
      }
    } else {
      if (!rate(op.price)) return null
      const rawCount = quantities[id] === undefined ? (op.defaultQuantity ?? 1) : quantities[id]
      const count = Number(rawCount)
      evidence.rate = Number(op.price)
      if (cardOperationKind(op) === 'cornerRounding' || op.unit === 'тг/угол') {
        if (!integer(rawCount) || count > 4) return null
        evidence = { ...evidence, corners: count, productQuantity: Number(quantity), billedQuantity: count * Number(quantity) }
        price = Number(op.price) * count * Number(quantity)
        name += ` (${count} угл. × ${quantity} шт.)`
      } else if (op.type === 'quantity' || op.unit === 'тг/шт') {
        if (!integer(rawCount)) return null
        evidence = { ...evidence, operationQuantity: count, productQuantity: Number(quantity), billedQuantity: count * (op.type === 'quantity' ? 1 : Number(quantity)) }
        price = Number(op.price) * evidence.billedQuantity
      } else price = Number(op.price)
    }
    const originalPrice = price
    if (cardOperationKind(op) === 'prepress') price *= 1 - Number(reorderDiscount) / 100
    if (!Number.isFinite(price) || price < 0) return null
    append(op, { ...evidence, name, price, ...(price !== originalPrice ? { originalPrice, discount: originalPrice - price } : {}) })
  }
  for (const id of new Set(selectedExtras.map(String))) {
    const svc = extraServices.find(item => String(item.id) === id)
    if (!svc || /монтаж|демонтаж/i.test(svc.name || '')) return null
    if (svc.priceText) return null
    else {
      if (!rate(svc.price)) return null
      const billedQuantity = svc.unit === 'тг/шт' ? Number(quantity) : 1
      append(svc, { operationId: id, optionId: null, rate: Number(svc.price), billedQuantity, unit: svc.unit || null, name: svc.name, price: Number(svc.price) * billedQuantity })
    }
  }
  const total = details.reduce((sum, detail) => sum + detail.price, 0)
  return Number.isFinite(total) ? Object.freeze({ sheets, details: Object.freeze(details), total }) : null
}
