// Uses the existing area tariff, minimum order amount and urgency rule from the price list.
export function calculateGarmentPrinting({ item, area, quantity, product, variant, fileOperation, urgent, urgentSurcharge }) {
  const sqcm = Number(area)
  const qty = Number(quantity)
  if (!Number.isFinite(sqcm) || sqcm <= 0) throw new Error('Укажите площадь изображения больше нуля')
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Количество должно быть положительным целым числом')
  if (!item) throw new Error('Выберите тип нанесения')
  const minQty = Number(item.minQty || 1)
  if (qty < minQty) throw new Error(`Минимальный тираж для этой позиции — ${minQty} шт`)
  const rate = Number(item.pricePerSqCm)
  const minimum = Number(item.minAmount || 0)
  if (item.pricePerSqCm == null || item.pricePerSqCm === '' || !Number.isFinite(rate) || rate < 0
    || !Number.isFinite(minimum) || minimum < 0) throw new Error('Проверьте тариф и минимальную сумму в прайсе')
  if (item.productOptions?.length) {
    if (!product || !item.productOptions.some(option => option.id === product.id)) throw new Error('Выберите изделие')
    if (product.variants?.length && !product.variants.some(option => option.id === variant?.id)) throw new Error('Выберите вариант изделия')
  }
  const baseTotal = sqcm * rate * qty
  const minApplied = baseTotal < minimum ? minimum : null
  const minimumAdjustment = minApplied == null ? 0 : minimum - baseTotal
  const extras = []
  if (fileOperation) {
    const price = Number(fileOperation.price)
    if (fileOperation.price == null || !Number.isFinite(price) || price < 0) throw new Error('Укажите цену подготовки файла в прайсе')
    extras.push({ id: String(fileOperation.id), name: fileOperation.name, price })
  }
  const extrasTotal = extras.reduce((sum, operation) => sum + operation.price, 0)
  const subtotal = baseTotal + minimumAdjustment + extrasTotal
  const urgentPercent = Number(urgentSurcharge)
  if (!Number.isFinite(urgentPercent) || urgentPercent < 0) throw new Error('Проверьте процент срочности в прайсе')
  const urgentAmount = urgent ? Math.max(subtotal * urgentPercent / 100, 5000) : 0
  const total = subtotal + urgentAmount
  if (!Number.isFinite(total)) throw new Error('Слишком большая площадь или количество')
  const productLabel = variant?.name || product?.name || null
  return {
    pricingItemId: String(item.id), label: item.name,
    productName: productLabel ? `${item.name} — ${productLabel}` : item.name,
    productOptionId: product?.id || null, productOptionName: product?.name || null,
    variantId: variant?.id || null, variantName: variant?.name || null,
    sqcm, qty, quantity: qty, unitPrice: rate, baseTotal, minApplied, minimumAdjustment,
    extrasTotal, extras, subtotal, isUrgent: !!urgent, urgentSurcharge: urgentPercent, urgentAmount, total
  }
}
