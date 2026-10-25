module.exports = function validateMultipage(item) {
  if (item.category !== 'notebooks' && item.specification?.section !== 'multipage') return null
  const spec = item.specification
  if (!item.name?.trim() || !spec || !spec.format?.trim() || !spec.binding?.trim() || !Number.isInteger(spec.sheets) || spec.sheets <= 0 || spec.quantityMode !== 'exact') return 'Заполните название, формат, переплёт, число листов и точный режим тиража'
  if (!item.prices || Array.isArray(item.prices) || typeof item.prices !== 'object' || !Object.keys(item.prices).length) return 'Добавьте тарифы по тиражу'
  for (const [q, price] of Object.entries(item.prices)) {
    if (!/^[1-9]\d*$/.test(q) || !Number.isSafeInteger(Number(q))) return 'Тираж должен быть положительным целым числом'
    if (price !== null && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) return 'Цена должна быть неотрицательным числом или null (ручное заполнение)'
  }
  return null
}
