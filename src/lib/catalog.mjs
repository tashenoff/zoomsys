import catalogConfig from '../../server/catalog-config.json' with { type: 'json' }

export { catalogConfig }

export function isServiceAllowed(service, category) {
  if (category === 'uv-printing' && /^монтаж\s*\/\s*демонтаж\s+конструкции$/i.test((service?.name || '').trim())) return false
  const printing = ['printing', 'flyers', 'booklets', 'certificates', 'notebooks', 'folders', 'paper-bags', 'digital-printing', 'paper-density', 'multipage']
  return !(printing.includes(category) && /монтаж|демонтаж/i.test(service?.name || ''))
}

export function getCanvasOperationKey(operation) {
  const name = String(operation?.name || '').trim().toLowerCase()
  return catalogConfig.canvasOperations.find(item => String(operation?.id) === item.id
    || name === item.name.toLowerCase())?.id || null
}

export function isCanvasMaterial(material) {
  return String(material?.name || '').trim().toLowerCase() === 'холст'
}

export function getStateSymbolName(item) {
  return item?.category === 'signs'
    ? String(item.name || '').replace(/^Вывеска(?= 600×800 мм,)/i, catalogConfig.displayNames.signs)
    : item?.name
}

export function getDisplayCategories(categories) {
  return (categories || []).map(category => ({
    ...category,
    name: catalogConfig.displayNames[category.slug] || category.name,
    ...(category.subcategories ? { subcategories: getDisplayCategories(category.subcategories) } : {})
  }))
}

export function isWideFormatGroupEnabled(group) {
  return !catalogConfig.disabledWideFormatGroups.includes(String(group || 'other'))
}

export function getEnabledWideFormatMaterials(materials) {
  return (materials || []).filter(item => isWideFormatGroupEnabled(item.category))
}

export function resolvePricingTab(activeTab, combinedSection) {
  if (activeTab !== catalogConfig.combinedPricing.id) return activeTab
  return catalogConfig.combinedPricing.sections.some(section => section.id === combinedSection)
    ? combinedSection : catalogConfig.combinedPricing.sections[0].id
}

export function isBadgeProduct(product) {
  return product?.category === 'badges' || product?.productType === 'badges' || /бейдж/i.test(product?.name || product?.productName || '')
}

export function filterCardProducts(items, cardType) {
  return (items || []).filter(item => cardType === 'badges' ? isBadgeProduct(item) : !isBadgeProduct(item))
}

// A manager supplies the agreed amount for the complete batch. No unit tariff is inferred from the PDF.
export function getManualBadgeQuote(quantity, batchTotal) {
  const qty = Number(quantity)
  const total = Number(batchTotal)
  if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(total) || total <= 0) return null
  return { pricingMode: 'manual', manualBatchTotal: total, unitPrice: total / qty, baseTotal: total }
}
