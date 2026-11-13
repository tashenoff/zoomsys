const config = require('./catalog-config.json')

function isBadgeProduct(product) {
  return product?.category === 'badges' || product?.productType === 'badges' || /бейдж/i.test(product?.name || product?.productName || '')
}

// Presentation policy only: leave stored prices and all existing orders intact.
function normalizeBusinessCardPricing(row) {
  return isBadgeProduct(row) ? { ...row, prices: {}, pricing_mode: 'manual' } : row
}

function validateBusinessCardPrices(prices) {
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) return 'Укажите тарифы визиток'
  return Object.values(prices).some(value => value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0))
    ? 'Цена должна быть неотрицательным числом; для индивидуального расчёта оставьте поле пустым' : null
}

const validNumber = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) >= 0
const positiveInteger = value => validNumber(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
const close = (a, b) => Math.abs(Number(a) - Number(b)) <= 0.011
const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100
const equalAmount = (a, b) => Math.abs(Number(a) - Number(b)) <= 1e-8
const centAmount = value => validNumber(value) && equalAmount(value, roundMoney(Number(value)))

function validateNewOrderAmounts(body) {
  if (!body || !validNumber(body.total_amount)) return 'Order total must be a finite nonnegative number'
  if (!Array.isArray(body.items) || !body.items.length) return 'Order items are required'
  for (const item of body.items) {
    if (!item || !validNumber(item.quantity) || Number(item.quantity) <= 0) return 'Order quantity must be finite and positive'
    const integerQuantity = ['printing', 'business-cards', 'badges'].includes(body.category || 'business-cards') || item.specifications?.pricingMode === 'sheet' || item.specifications?.productType === 'badges'
    if (integerQuantity && !positiveInteger(item.quantity)) return 'Printed product quantity must be a positive integer'
    if (!validNumber(item.unit_price) || !validNumber(item.total_price)) return 'Order item prices must be finite nonnegative numbers'
  }
  if (body.items.some(item => item.specifications?.pricingMode === 'sheet')
    && (!centAmount(body.total_amount) || !equalAmount(body.total_amount, roundMoney(body.items.reduce((sum, item) => sum + Number(item.total_price), 0))))) return 'Sheet order total must match its cent-rounded items'
  if (!close(body.total_amount, body.items.reduce((sum, item) => sum + Number(item.total_price), 0))) return 'Order total does not match items'
  return null
}

function hasUnresolvedPrice(value) {
  return value && typeof value === 'object' && (value.byRequest === true || value.unresolved === true || value.requiresQuote === true || value.pricingMode === 'byRequest'
    || Object.values(value).some(child => child && typeof child === 'object' && hasUnresolvedPrice(child)))
}

function validateSheetOrder(item) {
  const spec = item.specifications || {}
  const sheet = spec.sheetCalculation
  const invalid = 'Invalid or incomplete sheet calculation snapshot'
  if (!sheet || sheet.version !== 1 || !['A3', 'A4', 'SRA3'].includes(sheet.sheetFormat)) return invalid
  if (!positiveInteger(sheet.quantity) || Number(sheet.quantity) !== Number(item.quantity)
    || !positiveInteger(sheet.yieldPerSheet) || !positiveInteger(sheet.sheets) || !positiveInteger(sheet.pages)
    || ![1, 2].includes(sheet.sides) || Number(sheet.pages) < sheet.sides || !validNumber(sheet.width) || Number(sheet.width) <= 0
    || !validNumber(sheet.height) || Number(sheet.height) <= 0 || !validNumber(sheet.margin) || !validNumber(sheet.gap)) return invalid
  const [sheetWidth, sheetHeight] = { A3: [297, 420], A4: [210, 297], SRA3: [320, 450] }[sheet.sheetFormat]
  const usableWidth = sheetWidth - 2 * Number(sheet.margin), usableHeight = sheetHeight - 2 * Number(sheet.margin)
  const width = Number(sheet.width), height = Number(sheet.height), gap = Number(sheet.gap)
  const capacity = Math.max(...[[width, height], [height, width]].map(([w, h]) => Math.floor((usableWidth + gap + 1e-8) / (w + gap)) * Math.floor((usableHeight + gap + 1e-8) / (h + gap))))
  if (usableWidth <= 0 || usableHeight <= 0 || capacity < 1) return invalid
  if (sheet.template ? (spec.productType !== 'hangers' || sheet.sheetFormat !== 'A3' || sheet.yieldPerSheet !== 6) : Number(sheet.yieldPerSheet) > capacity) return invalid
  const sheetsPerSet = Math.ceil(Number(sheet.quantity) / Number(sheet.yieldPerSheet))
  if (Number(sheet.sheets) !== sheetsPerSet * Math.ceil(Number(sheet.pages) / sheet.sides)) return invalid
  if (!sheet.paper || !sheet.printing || !Array.isArray(sheet.operations)) return invalid
  if (spec.productType === 'booklets' && (!validNumber(sheet.paper.density) || Number(sheet.paper.density) <= 0)) return invalid
  if (![sheet.paper.rate, sheet.paper.total, sheet.printing.rate, sheet.printing.total, spec.baseTotal, spec.unitPrice, spec.servicesTotal, spec.subtotal, spec.total].every(validNumber)) return invalid
  if (sheet.printing.sides !== sheet.sides || !['1+0', '1+1', '4+0', '4+4'].includes(sheet.printing.colorType) || sheet.sides !== (sheet.printing.colorType.endsWith('+0') ? 1 : 2)) return invalid
  if (spec.colorType !== sheet.printing.colorType || (item.color_type != null && item.color_type !== sheet.printing.colorType)) return invalid
  if (sheet.printing.impressions !== sheetsPerSet * Number(sheet.pages)) return invalid
  if (!equalAmount(sheet.paper.total, roundMoney(Number(sheet.paper.rate) * Number(sheet.sheets)))
    || !equalAmount(sheet.printing.total, roundMoney(Number(sheet.printing.rate) * sheetsPerSet * Number(sheet.pages)))) return invalid
  if (![sheet.paper.total, sheet.printing.total, spec.baseTotal, spec.servicesTotal, spec.subtotal, spec.total, item.total_price, spec.urgentAmount, spec.discountAmount].every(centAmount)) return invalid
  const seen = new Set()
  for (const op of sheet.operations) {
    if (!op || seen.has(op.id)) return invalid
    seen.add(op.id)
    let count
    if (op.unit === 'order') count = 1
    else if (op.unit === 'sheet') count = Number(sheet.sheets)
    else if (op.unit === 'unit') count = Number(item.quantity)
    else if (['sheet-side', 'corner', 'fold', 'hole'].includes(op.unit) && positiveInteger(op.count)) {
      if ((op.unit === 'sheet-side' && Number(op.count) > 2) || (op.unit === 'corner' && Number(op.count) > 4)) return invalid
      count = Number(op.count) * Number(op.unit === 'sheet-side' ? sheet.sheets : item.quantity)
    } else return invalid
    if (Number(op.quantity) !== count) return invalid
    if (!op || ![op.rate, op.quantity, op.total].every(validNumber) || !centAmount(op.total) || !equalAmount(op.total, roundMoney(Number(op.rate) * Number(op.quantity)))) return invalid
  }
  if (spec.productType === 'hangers' && (!sheet.template || sheet.sheetFormat !== 'A3' || sheet.yieldPerSheet !== 6 || sheet.sides !== 2 || Number(sheet.pages) !== 2 || !sheet.operations.some(op => op.kind === 'graphtec'))) return invalid
  const base = roundMoney(Number(sheet.paper.total) + Number(sheet.printing.total))
  const services = roundMoney(sheet.operations.reduce((sum, op) => sum + Number(op.total), 0))
  const subtotal = roundMoney(base + services)
  if (!equalAmount(spec.baseTotal, base) || !equalAmount(Number(spec.unitPrice) * Number(item.quantity), base)
    || !equalAmount(spec.servicesTotal, services) || !equalAmount(spec.subtotal, subtotal) || !equalAmount(spec.total, item.total_price)) return invalid
  if (![spec.urgentSurcharge, spec.urgentAmount, spec.discount, spec.discountAmount].every(validNumber)
    || Number(spec.urgentSurcharge) > 1000 || Number(spec.discount) > 100) return invalid
  const urgent = spec.isUrgent ? roundMoney(subtotal * Number(spec.urgentSurcharge) / 100) : 0
  const discount = roundMoney((subtotal + urgent) * Number(spec.discount) / 100)
  if (!equalAmount(spec.urgentAmount, urgent) || !equalAmount(spec.discountAmount, discount) || !equalAmount(spec.total, roundMoney(subtotal + urgent - discount))) return invalid
  return null
}

function validateCatalogOrder(body) {
  for (const item of body.items || []) {
    const spec = item.specifications || {}
    if (hasUnresolvedPrice(spec)) return 'Resolve all selected service prices before creating an order'
    if (spec.pricingMode === 'sheet') {
      const validation = validateSheetOrder(item)
      if (validation) return validation
    }
    if (body.category === 'wide-format') {
      const group = String(spec.wideGroup || '').toLowerCase()
      const equipment = String(spec.equipment || '').toLowerCase()
      if (config.disabledWideFormatGroups.some(disabled => group === disabled || equipment.includes(disabled))) {
        return 'Phaeton UD-3208P отключён для новых заказов'
      }
    }
    if (spec.pricingMode !== 'sheet' && isBadgeProduct({ category: body.category, name: item.product_name || spec.productName, productType: spec.productType })) {
      const quantity = Number(item.quantity)
      const manual = Number(spec.manualBatchTotal)
      const base = Number(spec.baseTotal)
      const unit = Number(spec.unitPrice)
      if (spec.pricingMode !== 'manual' || !Number.isInteger(quantity) || quantity <= 0
        || !Number.isFinite(manual) || manual <= 0 || !Number.isFinite(base) || !Number.isFinite(unit)
        || Math.abs(base - manual) > 0.01 || Math.abs(unit * quantity - manual) > 0.01) {
        return 'Для бейджей требуется индивидуальная стоимость всего тиража'
      }
    }
  }
  return null
}

module.exports = { isBadgeProduct, normalizeBusinessCardPricing, validateCatalogOrder, validateBusinessCardPrices, validateNewOrderAmounts, validateSheetOrder }
