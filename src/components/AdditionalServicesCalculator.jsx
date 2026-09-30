import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'
import ResultSummary from './ResultSummary'
import CalcResultRow from './CalcResultRow'

// Раздел «Дополнительные услуги» — самостоятельная продажа услуги.
// Здесь же живут услуги, которые позже будут добавляться как опции к изделиям
// (applicableTo) прямо внутри калькуляторов. Это одна и та же запись каталога.
export default function AdditionalServicesCalculator({ client }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const services = pricingData.additionalServices || []

  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  // Категории для фильтра (услуга без категории попадает в «Дизайн» — весь текущий
  // каталог это дизайн-работы; новые категории задаёт админ в прайсах).
  const categories = useMemo(() => {
    const set = [...new Set(services.map(s => s.category).filter(Boolean))]
    return ['all', ...set.sort((a, b) => a.localeCompare(b, 'ru'))]
  }, [services])

  const visibleServices = useMemo(() =>
    activeCategory === 'all'
      ? services
      : services.filter(s => s.category === activeCategory),
    [services, activeCategory]
  )

  const selected = useMemo(
    () => visibleServices.find(s => String(s.id) === String(selectedId)) || null,
    [visibleServices, selectedId]
  )

  const isRequestPrice = selected && selected.price == null && (selected.priceText || '').trim() !== ''

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selected) { alert('Выберите услугу'); return }
    if (isRequestPrice) { alert('У услуги цена «по запросу» — итог уточните у менеджера'); return }
    const qty = parseFloat(quantity) || 0
    if (qty <= 0) { alert('Введите количество'); return }
    const unitPrice = selected.price != null ? parseFloat(selected.price) : 0
    const total = unitPrice * qty
    setCalculation({
      label: selected.name,
      unit: selected.unit || 'шт',
      qty,
      unitPrice,
      total
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'additionalServices', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setCalculation(null)
      setOrderStatus('draft')
    } catch (err) { alert('Ошибка сохранения заказа: ' + err.message) }
    finally { setSavingOrder(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-2">Дополнительные услуги</h2>
        <p className="text-sm text-gray-500 mb-4 md:mb-6">Дизайн, монтаж и доработки — продажа как отдельной услуги.</p>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => (
              <button key={cat} type="button"
                onClick={() => { setActiveCategory(cat); setSelectedId(''); setCalculation(null) }}
                className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
                  activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                {cat === 'all' ? 'Все' : cat}
              </button>
            ))}
          </div>
        )}

        {visibleServices.length === 0 ? (
          <div className="text-sm text-gray-500 py-6 italic">В этой категории пока нет услуг. Добавьте их в разделе «Прайсы → Доп. услуги».</div>
        ) : (
          <form onSubmit={handleCalculate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {visibleServices.map(item => {
                const priceLabel = item.priceText
                  ? item.priceText
                  : (item.price != null ? `${Number(item.price).toLocaleString('ru-RU')} тг` : 'по запросу')
                return (
                  <button key={item.id} type="button" onClick={() => { setSelectedId(String(item.id)); setCalculation(null) }}
                    className={`p-4 rounded-lg border-2 transition text-left ${String(selected?.id) === String(item.id) ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                    <div className="font-semibold text-gray-800">{item.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{priceLabel}{item.unit && item.unit !== 'тг' ? ` / ${item.unit}` : ''}</div>
                    {item.category && <div className="text-xs text-gray-400 mt-1">{item.category}</div>}
                  </button>
                )
              })}
            </div>

            {selected && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Количество ({selected.unit || 'шт'})</label>
                  <input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {selected && isRequestPrice && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-700">⚠️ У услуги цена «по запросу» ({selected.priceText}). Итог рассчитывается после согласования с менеджером.</p>
              </div>
            )}

            <button type="submit" disabled={!selected || isRequestPrice}
              className={`w-full py-3 rounded-lg transition font-semibold ${
                selected && !isRequestPrice ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}>
              {isRequestPrice ? 'Цена по запросу' : 'Рассчитать'}
            </button>
          </form>
        )}
      </div>

      {calculation && (
        <ResultSummary
          total={{ label: 'Итого:', value: `${calculation.total.toLocaleString('ru-RU')} тг` }}
          saveVariant="gradient"
          saving={savingOrder}
          onSave={handleSaveOrder}
          saveDisabled={!client}
        >
          <CalcResultRow label="Услуга:" value={calculation.label} reverseOnMobile />
          <CalcResultRow label="Количество:" value={`${calculation.qty} ${calculation.unit}`} />
          <CalcResultRow label="Цена:" value={`${Number(calculation.unitPrice).toLocaleString('ru-RU')} тг / ${calculation.unit}`} />
        </ResultSummary>
      )}
    </div>
  )
}