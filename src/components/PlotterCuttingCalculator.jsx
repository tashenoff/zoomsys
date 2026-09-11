import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

export default function PlotterCuttingCalculator({ client }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const items = pricingData.plotterCutting || []
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const [materialId, setMaterialId] = useState('')
  const [operationId, setOperationId] = useState('')
  const [area, setArea] = useState(1) // м²
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const materials = useMemo(() => [...new Set(items.map(i => i.material).filter(Boolean))], [items])
  const effectiveMaterial = materials.find(m => m === materialId) || materials[0] || ''
  const operations = useMemo(() =>
    items.filter(i => i.material === effectiveMaterial),
    [items, effectiveMaterial]
  )
  const selectedOperation = useMemo(
    () => operations.find(o => String(o.id) === String(operationId)) || operations[0] || null,
    [operations, operationId]
  )

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selectedOperation) { alert('Выберите операцию'); return }
    const areaM2 = parseFloat(area) || 0
    if (areaM2 <= 0) { alert('Введите площадь'); return }

    // цена числовая или текстовая (от...)
    const numPrice = Number(selectedOperation.price)
    const hasNumeric = selectedOperation.price != null && !isNaN(numPrice)
    const priceText = selectedOperation.priceText || (hasNumeric ? null : String(selectedOperation.price || ''))

    if (priceText) {
      setCalculation({ note: `Цена: ${priceText} тг/м². Итог зависит от конкретной площади — уточните у менеджера.`, material: effectiveMaterial, operation: selectedOperation.operation, areaM2 })
      return
    }

    const baseTotal = numPrice * areaM2
    const urgentAmount = isUrgent ? Math.max(baseTotal * urgentSurcharge / 100, 5000) : 0
    const total = baseTotal + urgentAmount

    setCalculation({
      material: effectiveMaterial,
      operation: selectedOperation.operation,
      areaM2, unitPrice: numPrice, baseTotal,
      isUrgent, urgentSurcharge, urgentAmount, total
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation || calculation.note) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'plotter-cutting', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setArea(1); setIsUrgent(false); setCalculation(null); setOrderStatus('draft')
    } catch (err) { alert('Ошибка сохранения заказа: ' + err.message) }
    finally { setSavingOrder(false) }
  }

  const priceLabel = (op) => op.priceText || (op.price != null ? `${Number(op.price).toLocaleString('ru-RU')} тг/м²` : '—')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-2">Плоттерная резка</h2>
        <p className="text-sm text-gray-500 mb-6">Ширина резки 1300 мм. Цена без материала; монтажная плёнка учитывается. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Материал</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {materials.map(m => (
                <button key={m} type="button" onClick={() => { setMaterialId(m); setOperationId(''); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${effectiveMaterial === m ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <span className="font-semibold">{m}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Операция</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {operations.map(op => (
                <button key={op.id} type="button" onClick={() => { setOperationId(String(op.id)); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${String(selectedOperation?.id) === String(op.id) ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="font-semibold text-gray-800">{op.operation}</div>
                  <div className="text-xs text-gray-500 mt-1">{priceLabel(op)}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Площадь (м²)</label>
            <input type="number" min="0" step="0.01" value={area} onChange={(e) => setArea(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
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
              <p className="text-gray-700">Материал: {calculation.material}, операция: {calculation.operation}, площадь: {calculation.areaM2} м²</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-600">Материал:</span><span className="font-semibold text-right">{calculation.material}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Операция:</span><span className="font-semibold text-right">{calculation.operation}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Площадь:</span><span className="font-semibold">{calculation.areaM2} м²</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Цена за м²:</span><span className="font-semibold">{calculation.unitPrice.toLocaleString('ru-RU')} тг</span></div>
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