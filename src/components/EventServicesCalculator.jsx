import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

const CATEGORY_LABELS = {
  mobile: '🖼️ Мобильные конструкции',
  rent: '🎤 Аренда для мероприятий',
  specialists: '👷 Работа специалистов и техники'
}

const PRINT_OPTION_LABELS = {
  mimaki: 'Mimaki баннер',
  roland: 'Roland фронтлит',
  none: 'Без печати'
}

function priceText(item) {
  return item.priceText || (item.price != null ? `${Number(item.price).toLocaleString('ru-RU')} тг` : '—')
}

export default function EventServicesCalculator({ client }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const items = pricingData.eventServices || []
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const [category, setCategory] = useState('mobile')
  const [selectedId, setSelectedId] = useState('')
  const [printOption, setPrintOption] = useState('none')
  const [quantity, setQuantity] = useState(1)
  const [days, setDays] = useState(1)
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const categories = useMemo(() => [...new Set(items.map(i => i.category).filter(Boolean))].filter(c => c !== 'specialists'), [items])
  const effectiveCategory = categories.includes(category) ? category : (categories[0] || 'mobile')
  const catItems = useMemo(() => items.filter(i => i.category === effectiveCategory), [items, effectiveCategory])
  const selected = useMemo(() => catItems.find(i => String(i.id) === String(selectedId)) || catItems[0] || null, [catItems, selectedId])

  const isMobile = effectiveCategory === 'mobile' && !!selected?.printOptions
  const effectivePrintOption = isMobile && selected?.printOptions && !Object.keys(selected.printOptions).includes(printOption)
    ? (Object.keys(selected.printOptions)[0] || 'none') : printOption

  const unitPrice = useMemo(() => {
    if (!selected) return null
    if (isMobile) return Number(selected.printOptions[effectivePrintOption] || 0)
    return selected.price || (selected.priceText ? null : null)
  }, [selected, isMobile, effectivePrintOption])

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selected) { alert('Выберите позицию'); return }
    const qty = parseInt(quantity, 10) || 1
    const d = parseInt(days, 10) || 1

    if (isMobile && unitPrice !== 0) {
      const baseTotal = unitPrice * qty
      const urgentAmount = isUrgent ? Math.max(baseTotal * urgentSurcharge / 100, 5000) : 0
      setCalculation({ label: `${selected.name} (${PRINT_OPTION_LABELS[effectivePrintOption]})`, unit: 'шт', quantity: qty, days: d, baseTotal, isUrgent, urgentSurcharge, urgentAmount, total: baseTotal + urgentAmount, note: null })
      return
    }

    if (unitPrice == null || (selected.priceText)) {
      setCalculation({ note: selected.priceText ? `Цена: ${selected.priceText}. Итог зависит от конкретного объёма — уточните у менеджера.` : 'Цена по запросу — свяжитесь с менеджером.', label: selected.name, unit: selected.unit, quantity: qty, days: d })
      return
    }

    const hourlyBase = effectiveCategory === 'specialists'
    let baseTotal = hourlyBase ? unitPrice * qty : unitPrice * qty * d
    if (hourlyBase && selected.minHours) baseTotal = Math.max(baseTotal, unitPrice * selected.minHours)
    const urgentAmount = isUrgent ? Math.max(baseTotal * urgentSurcharge / 100, 5000) : 0
    setCalculation({ label: selected.name, unit: selected.unit, quantity: qty, days: hourlyBase ? null : d, baseTotal, isUrgent, urgentSurcharge, urgentAmount, total: baseTotal + urgentAmount, note: null })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation || calculation.note) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'event-services', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setCalculation(null); setIsUrgent(false); setOrderStatus('draft')
    } catch (err) { alert('Ошибка сохранения заказа: ' + err.message) }
    finally { setSavingOrder(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-2">Мероприятия</h2>
        <p className="text-sm text-gray-500 mb-6">Мобильные конструкции, аренда, работа специалистов. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Раздел</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {categories.map(cat => (
                <button key={cat} type="button" onClick={() => { setCategory(cat); setSelectedId(''); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${effectiveCategory === cat ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <span className="font-semibold">{CATEGORY_LABELS[cat] || cat}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Позиция</label>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {catItems.map(item => {
                const isSel = String(item.id) === String(selected?.id)
                return (
                  <button key={item.id} type="button" onClick={() => { setSelectedId(String(item.id)); setCalculation(null) }}
                    className={`w-full text-left p-3 border-2 rounded-lg transition ${isSel ? 'bg-blue-50 border-blue-500' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="font-medium text-gray-800">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.printOptions ? 'см. типы печати' : (item.priceText || `${item.price ?? '—'} тг/${item.unit}`)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {isMobile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Тип печати</label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(selected.printOptions).map(([key, val]) => (
                  <button key={key} type="button" onClick={() => { setPrintOption(key); setCalculation(null) }}
                    className={`px-4 py-2 rounded-lg border-2 transition font-medium ${effectivePrintOption === key ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-blue-300 hover:bg-blue-50'}`}>
                    {PRINT_OPTION_LABELS[key] || key}: {Number(val).toLocaleString('ru-RU')} тг
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Количество ({effectiveCategory === 'specialists' ? 'часы' : (selected?.unit || 'шт')})</label>
              <input type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            {effectiveCategory === 'rent' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Дней аренды</label>
                <input type="number" min="1" step="1" value={days} onChange={(e) => setDays(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>
          {effectiveCategory === 'specialists' && selected?.minHours && (
            <p className="text-xs text-gray-500">Минимальное время: {selected.minHours} ч — именно эта сумма будет базовая.</p>
          )}

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
              <p className="text-gray-700">Позиция: {calculation.label}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-600">Позиция:</span><span className="font-semibold text-right">{calculation.label}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Кол-во:</span><span className="font-semibold">{calculation.quantity} {calculation.unit}</span></div>
              {calculation.days && <div className="flex justify-between"><span className="text-gray-600">Дней:</span><span className="font-semibold">{calculation.days}</span></div>}
              <div className="flex justify-between pt-2 border-t"><span className="text-gray-600">База:</span><span className="font-semibold">{calculation.baseTotal.toLocaleString('ru-RU')} тг</span></div>
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
              <button onClick={handleSaveOrder} disabled={!client || savingOrder} className="w-full mt-6 bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg hover:from-green-600 hover:to-green-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg uppercase tracking-wide">
                {savingOrder ? '⏳ Сохранение...' : '💾 Сохранить заказ'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}