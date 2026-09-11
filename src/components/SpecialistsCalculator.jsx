import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

export default function SpecialistsCalculator({ client }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const allItems = pricingData.eventServices || []
  const items = allItems.filter(i => i.category === 'specialists')
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const [selectedId, setSelectedId] = useState('')
  const [hours, setHours] = useState(1)
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const selected = useMemo(() => items.find(i => String(i.id) === String(selectedId)) || items[0] || null, [items, selectedId])

  const priceLabel = (item) => {
    if (item.priceText) return item.priceText
    if (item.price != null) return `${Number(item.price).toLocaleString('ru-RU')} тг/час`
    return 'по запросу'
  }

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selected) { alert('Выберите услугу'); return }
    const h = parseFloat(hours) || 0
    if (h <= 0) { alert('Введите часы'); return }

    if (selected.priceText || selected.price == null) {
      setCalculation({ note: `Цена: ${selected.priceText || 'по запросу'}. Итог зависит от объёма — уточните у менеджера.`, label: selected.name, hours: h })
      return
    }

    const unitPrice = Number(selected.price)
    let baseTotal = unitPrice * h
    if (selected.minHours) baseTotal = Math.max(baseTotal, unitPrice * selected.minHours)
    const urgentAmount = isUrgent ? Math.max(baseTotal * urgentSurcharge / 100, 5000) : 0
    const total = baseTotal + urgentAmount

    setCalculation({
      label: selected.name, hours: h, minHours: selected.minHours,
      unitPrice, baseTotal, isUrgent, urgentSurcharge, urgentAmount, total, note: null
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation || calculation.note) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'event-services', type: 'specialists', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setCalculation(null); setIsUrgent(false); setOrderStatus('draft')
    } catch (err) { alert('Ошибка сохранения заказа: ' + err.message) }
    finally { setSavingOrder(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-2">Работа специалистов и техники</h2>
        <p className="text-sm text-gray-500 mb-6">Монтаж, выезд, работа монтажников/электриков, транспорт, АГП. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Услуга</label>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {items.map(item => {
                const isSel = String(item.id) === String(selected?.id)
                return (
                  <button key={item.id} type="button" onClick={() => { setSelectedId(String(item.id)); setCalculation(null) }}
                    className={`w-full text-left p-3 border-2 rounded-lg transition ${isSel ? 'bg-blue-50 border-blue-500' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="font-medium text-gray-800">{item.name}</div>
                    <div className="text-xs text-gray-500">{priceLabel(item)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Часы</label>
            <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          {selected?.minHours && (
            <p className="text-xs text-gray-500">Минимальное время: {selected.minHours} ч — именно эта сумма будет базовая.</p>
          )}

          <label className="flex items-center p-4 bg-red-50 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition">
            <input type="checkbox" checked={isUrgent} onChange={(e) => { setIsUrgent(e.target.checked); setCalculation(null) }} className="mr-3 w-5 h-5" />
            <span className="flex-1 font-medium text-red-700">🔥 Срочный заказ (+{urgentSurcharge}%, минимум 5 000 тг)</span>
          </label>

          <button type="submit" disabled={!selected} className={`w-full py-3 rounded-lg transition font-semibold ${selected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>Рассчитать</button>
        </form>
      </div>

      {calculation && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Расчет</h3>
          {calculation.note ? (
            <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-6 text-center">
              <p className="text-xl font-bold text-yellow-800 mb-2">⚠️ {calculation.note}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-600">Услуга:</span><span className="font-semibold text-right">{calculation.label}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Часы:</span><span className="font-semibold">{calculation.hours} ч {calculation.minHours ? `(мин. ${calculation.minHours} ч)` : ''}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Цена:</span><span className="font-semibold">{calculation.unitPrice.toLocaleString('ru-RU')} тг/час</span></div>
              <div className="flex justify-between pt-2 border-t"><span className="text-gray-600">Работа:</span><span className="font-semibold">{calculation.baseTotal.toLocaleString('ru-RU')} тг</span></div>
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
                  {[['draft','📝 Черновик'],['in_progress','⚙️ В процессе'],['approved','✅ Утверждено']].map(([status,label]) => (
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