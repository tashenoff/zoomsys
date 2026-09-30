import { useEffect, useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'
import ResultSummary from './ResultSummary'
import CalcResultRow from './CalcResultRow'

export default function PlotterCuttingCalculator({ client, initialMaterial }) {
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
  const [manualPrice, setManualPrice] = useState('')

  // При выборе материала в сайдбаре — сбрасываем операцию/расчёт.
  useEffect(() => {
    if (initialMaterial) {
      setMaterialId(initialMaterial)
      setOperationId('')
      setManualPrice('')
      setCalculation(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMaterial])

  const materials = useMemo(() => [...new Set(items.map(i => i.material).filter(Boolean))], [items])
  const effectiveMaterial = (initialMaterial && materials.includes(initialMaterial) ? initialMaterial : '') || (materials.find(m => m === materialId) || materials[0] || '')
  const operations = useMemo(() =>
    items.filter(i => i.material === effectiveMaterial),
    [items, effectiveMaterial]
  )
  const selectedOperation = useMemo(
    () => operations.find(o => String(o.id) === String(operationId)) || operations[0] || null,
    [operations, operationId]
  )
  const isRangePrice = (selectedOperation?.priceText && /от|до/.test(selectedOperation.priceText)) || (selectedOperation?.price != null && isNaN(Number(selectedOperation.price)))


  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selectedOperation) { alert('Выберите операцию'); return }
    const areaM2 = parseFloat(area) || 0
    if (areaM2 <= 0) { alert('Введите площадь'); return }

    // Ручной ввод цены для позиций с диапазоном
    if (isRangePrice) {
      const manual = parseFloat(manualPrice) || 0
      if (manual <= 0) {
        setCalculation({ note: `Цена по прайсу: ${selectedOperation.priceText || selectedOperation.price} тг/м². Укажите конкретную цену, либо уточните у менеджера.`, material: effectiveMaterial, operation: selectedOperation.operation, areaM2 })
        return
      }
      const baseTotal = manual * areaM2
      const urgentAmount = isUrgent ? Math.max(baseTotal * urgentSurcharge / 100, 5000) : 0
      const total = baseTotal + urgentAmount
      setCalculation({ material: effectiveMaterial, operation: selectedOperation.operation, areaM2, unitPrice: manual, baseTotal, isUrgent, urgentSurcharge, urgentAmount, total })
      return
    }

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
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-2">{initialMaterial ? effectiveMaterial : 'Плоттерная резка'}</h2>
        <p className="text-sm text-gray-500 mb-4 md:mb-6">Ширина резки 1300 мм. Цена без материала; монтажная плёнка учитывается. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          {!initialMaterial && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Материал</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {materials.map(m => (
                <button key={m} type="button" onClick={() => { setMaterialId(m); setOperationId(''); setManualPrice(''); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${effectiveMaterial === m ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <span className="font-semibold">{m}</span>
                </button>
              ))}
            </div>
          </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Операция</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {operations.map(op => (
                <button key={op.id} type="button" onClick={() => { setOperationId(String(op.id)); setManualPrice(''); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${String(selectedOperation?.id) === String(op.id) ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="font-semibold text-gray-800">{op.operation}</div>
                  <div className="text-xs text-gray-500 mt-1">{priceLabel(op)}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Площадь (м²)</label>
            <input type="number" min="0" step="0.01" value={area} onChange={(e) => setArea(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {isRangePrice && (
            <div className="p-3 md:p-4 bg-indigo-50 border-2 border-indigo-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">✍️ Указать стоимость услуги (тг/м²)</label>
              <p className="text-xs text-gray-500 mb-2">Цена по прайсу: {selectedOperation.priceText || selectedOperation.price} тг/м². Введите конкретную сумму — итог посчитается от неё.</p>
              <input type="number" min="0" step="0.01" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="Например 2500" className="w-full px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}

          <label className="flex items-center p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition">
            <input type="checkbox" checked={isUrgent} onChange={(e) => { setIsUrgent(e.target.checked); setCalculation(null) }} className="mr-3 w-5 h-5" />
            <span className="flex-1 font-medium text-red-700">🔥 Срочный заказ (+{urgentSurcharge}%, минимум 5 000 тг)</span>
          </label>

          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold">Рассчитать</button>
        </form>
      </div>

      {calculation && (
        <ResultSummary
          noteBody={calculation.note ? (
            <>
              <p className="text-xl font-bold text-yellow-800 mb-2">⚠️ {calculation.note}</p>
              <p className="text-gray-700">Материал: {calculation.material}, операция: {calculation.operation}, площадь: {calculation.areaM2} м²</p>
            </>
          ) : null}
          total={{ label: 'Итого:', value: `${calculation.total.toLocaleString('ru-RU')} тг` }}
          saveVariant="gradient"
          saving={savingOrder}
          onSave={handleSaveOrder}
          saveDisabled={!client}
        >
          <CalcResultRow label="Материал:" value={calculation.material} reverseOnMobile />
          <CalcResultRow label="Операция:" value={calculation.operation} reverseOnMobile />
          <CalcResultRow label="Площадь:" value={`${calculation.areaM2} м²`} />
          <CalcResultRow label="Цена за м²:" value={`${calculation.unitPrice.toLocaleString('ru-RU')} тг`} />
          <CalcResultRow label={`Сумма за ${calculation.operation.toLowerCase()}:`} value={`${calculation.baseTotal.toLocaleString('ru-RU')} тг`} subtotal />
          {calculation.isUrgent && (
            <CalcResultRow label="Срочность:" value={`+${calculation.urgentAmount.toLocaleString('ru-RU')} тг`} highlight="red" />
          )}
        </ResultSummary>
      )}
    </div>
  )
}