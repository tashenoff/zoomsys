import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

const CATEGORY_LABELS = {
  'flags-size': 'Флаги и знамена (по размеру)',
  'desk-flags': 'Настольные флаги',
  'auto-flags': 'Автомобильные флаги',
  'ribbons': 'Наградные ленты',
  'scarves': 'Шарфы',
  'other': 'Вымпелы, шевроны и другое'
}

function normalizePrices(p, fallbackPrice) {
  const parsed = typeof p === 'string' ? (() => { try { return JSON.parse(p) } catch { return null } })() : p
  if (parsed && typeof parsed === 'object') return parsed
  return null
}

function formatPrice(value) {
  if (value === null || value === undefined) return 'по запросу'
  return String(value).toLocaleString('ru-RU').replace(/\s/g, ' ')
}

export default function FlagsProductsCalculator({ client }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const items = pricingData.flagsProducts || []
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const categories = useMemo(() => [...new Set(items.map(i => i.category || 'other'))], [items])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const effectiveCategory = categories.includes(selectedCategory) ? selectedCategory : (categories[0] || '')
  const catItems = useMemo(() => items.filter(i => (i.category || 'other') === effectiveCategory), [items, effectiveCategory])
  const selectedItem = useMemo(
    () => catItems.find(i => String(i.id) === String(selectedItemId)) || catItems[0] || null,
    [catItems, selectedItemId]
  )
  const isSizeItem = !!selectedItem && Boolean(normalizePrices(selectedItem.prices))
  const sizes = useMemo(() => {
    const pr = normalizePrices(selectedItem?.prices)
    return pr ? Object.keys(pr) : []
  }, [selectedItem])
  const effectiveSize = sizes.includes(selectedSize) ? selectedSize : (sizes[0] || '')

  const unitPrice = useMemo(() => {
    if (!selectedItem) return null
    const pr = normalizePrices(selectedItem.prices)
    if (pr) {
      // размерный товар
      if (!isSizeItem && pr.default !== undefined) return pr.default // "от 7500"
      if (isSizeItem) {
        const v = effectiveSize ? pr[effectiveSize] : null
        return v === undefined ? null : v
      }
    }
    return selectedItem.price
  }, [selectedItem, isSizeItem, effectiveSize])

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selectedItem) { alert('Выберите позицию'); return }
    if (isSizeItem && !effectiveSize) { alert('Выберите размер'); return }
    if (/^от\s/.test(String(unitPrice || ''))) {
      setCalculation({
        productName: selectedItem.name,
        size: isSizeItem ? effectiveSize : null,
        quantity,
        unitPriceText: String(unitPrice),
        note: 'Цена от — итог зависит от конкретной позиции, уточните у менеджера'
      })
      return
    }
    if (unitPrice === null || unitPrice === undefined) {
      setCalculation({
        productName: selectedItem.name,
        size: isSizeItem ? effectiveSize : null,
        quantity,
        note: 'Цена по запросу — свяжитесь с менеджером'
      })
      return
    }

    const qty = parseInt(quantity, 10) || 1
    const price = Number(unitPrice)
    const baseTotal = price * qty
    const urgentAmount = isUrgent ? Math.max(baseTotal * urgentSurcharge / 100, 5000) : 0
    const total = baseTotal + urgentAmount

    setCalculation({
      productName: selectedItem.name,
      size: isSizeItem ? effectiveSize : null,
      quantity: qty,
      unitPrice: price,
      baseTotal,
      isUrgent, urgentSurcharge, urgentAmount, total
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation || calculation.note) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'flags-products', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setQuantity(1); setIsUrgent(false); setCalculation(null); setOrderStatus('draft')
    } catch (err) {
      alert('Ошибка сохранения заказа: ' + err.message)
    } finally { setSavingOrder(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-2">Готовая флаговая продукция</h2>
        <p className="text-sm text-gray-500 mb-6">Цена с учётом материала, за штуку. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Категория</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map(cat => (
                <button key={cat} type="button"
                  onClick={() => { setSelectedCategory(cat); setSelectedItemId(''); setSelectedSize(''); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${effectiveCategory === cat ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="font-semibold text-gray-800">{CATEGORY_LABELS[cat] || cat}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Позиция</label>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {catItems.map(item => {
                const isItem = String(item.id) === String(selectedItem?.id)
                return (
                  <button key={item.id} type="button"
                    onClick={() => { setSelectedItemId(String(item.id)); setSelectedSize(''); setCalculation(null) }}
                    className={`w-full text-left p-3 border-2 rounded-lg transition ${isItem ? 'bg-blue-50 border-blue-500' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="font-medium text-gray-800">{item.name}</div>
                    {item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}
                  </button>
                )
              })}
            </div>
          </div>

          {isSizeItem && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Размер</label>
              <div className="flex gap-2 flex-wrap">
                {sizes.map(size => (
                  <button key={size} type="button"
                    onClick={() => { setSelectedSize(size); setCalculation(null) }}
                    className={`px-4 py-2 rounded-lg border-2 transition font-medium ${effectiveSize === size ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-blue-300 hover:bg-blue-50'}`}>
                    {size} м — {formatPrice(normalizePrices(selectedItem.prices)[size])} тг
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Количество (шт)</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)} min="1" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          <label className="flex items-center p-4 bg-red-50 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition">
            <input type="checkbox" checked={isUrgent} onChange={(e) => { setIsUrgent(e.target.checked); setCalculation(null) }} className="mr-3 w-5 h-5" />
            <span className="flex-1 font-medium text-red-700">🔥 Срочный заказ (+{urgentSurcharge}%, минимум 5 000 тг)</span>
          </label>

          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold">Рассчитать</button>
        </form>
      </div>

      {calculation && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Расчет</h3>
          {calculation.note ? (
            <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-6 text-center">
              <p className="text-xl font-bold text-yellow-800 mb-2">⚠️ {calculation.note}</p>
              <p className="text-gray-700">Позиция: {calculation.productName}{calculation.size ? `, размер ${calculation.size}` : ''}</p>
              {calculation.unitPriceText && <p className="text-gray-700 mt-1">Цена {calculation.unitPriceText} тг</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-600">Позиция:</span><span className="font-semibold text-right">{calculation.productName}</span></div>
              {calculation.size && <div className="flex justify-between"><span className="text-gray-600">Размер:</span><span className="font-semibold">{calculation.size} м</span></div>}
              <div className="flex justify-between"><span className="text-gray-600">Количество:</span><span className="font-semibold">{calculation.quantity} шт</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Цена за шт:</span><span className="font-semibold">{formatPrice(calculation.unitPrice)} тг</span></div>
              <div className="flex justify-between pt-2 border-t"><span className="text-gray-600">Печать:</span><span className="font-semibold">{calculation.baseTotal.toLocaleString('ru-RU')} тг</span></div>
              {calculation.isUrgent && (
                <div className="flex justify-between py-2 px-3 bg-red-50 rounded"><span className="text-red-700 font-semibold">Срочность:</span><span className="font-bold text-red-600">+{calculation.urgentAmount.toLocaleString('ru-RU')} тг</span></div>
              )}
              <div className="flex justify-between pt-3 border-t-2 border-gray-300"><span className="text-lg font-bold">Итого:</span><span className="text-2xl font-bold text-blue-600">{calculation.total.toLocaleString('ru-RU')} тг</span></div>
            </div>
          )}

          {!calculation.note && (
            <>
              <div className="mt-6 bg-gray-50 rounded-lg p-4 border-2 border-indigo-200">
                <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">📋 Статус заказа</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['draft', '📝 Черновик'], ['in_progress', '⚙️ В процессе'], ['approved', '✅ Утверждено']
                  ].map(([status, label]) => (
                    <button key={status} type="button" onClick={() => setOrderStatus(status)} className={`p-3 rounded-lg border-2 transition font-semibold text-center ${orderStatus === status ? 'bg-blue-500 text-white border-blue-600 shadow-lg' : 'bg-white border-blue-300 hover:border-blue-500 hover:bg-blue-50'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <button onClick={handleSaveOrder} disabled={!client || savingOrder} className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold">
                {savingOrder ? '⏳ Сохранение...' : '💾 Сохранить заказ'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
