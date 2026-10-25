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

function validateCatalogOrder(body) {
  for (const item of body.items || []) {
    const spec = item.specifications || {}
    if (body.category === 'wide-format') {
      const group = String(spec.wideGroup || '').toLowerCase()
      const equipment = String(spec.equipment || '').toLowerCase()
      if (config.disabledWideFormatGroups.some(disabled => group === disabled || equipment.includes(disabled))) {
        return 'Phaeton UD-3208P отключён для новых заказов'
      }
    }
    if (isBadgeProduct({ name: item.product_name || spec.productName, productType: spec.productType })) {
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

module.exports = { isBadgeProduct, normalizeBusinessCardPricing, validateCatalogOrder, validateBusinessCardPrices }
