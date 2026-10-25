export function calculateMultipage(product, quantity) {
  if (!product?.specification) throw new Error('Выберите изделие с заполненными параметрами каталога')
  const spec = product.specification
  if (!spec.format || !spec.binding || !Number.isInteger(spec.sheets) || spec.sheets <= 0 || spec.quantityMode !== 'exact') throw new Error('Параметры изделия требуют ручного заполнения в админке')
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Тираж должен быть положительным целым числом')
  if (!Object.hasOwn(product.prices || {}, String(quantity))) throw new Error('Для этого тиража требуется ручной тариф; интерполяция в прайсе не указана')
  const unitPrice = product.prices[String(quantity)]
  if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Цена требует ручного заполнения в админке')
  return { productName: product.name, format: spec.format, quantity, sheets: spec.sheets, unitPrice, baseTotal: unitPrice * quantity, total: unitPrice * quantity, specification: spec, source: spec.source }
}
