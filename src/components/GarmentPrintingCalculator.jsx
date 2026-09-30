import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'
import ResultSummary from './ResultSummary'
import CalcResultRow from './CalcResultRow'

export default function GarmentPrintingCalculator({ client }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const items = pricingData.garmentPrinting || []
  const additionalOperations = pricingData.additionalOperations || {}
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const [selectedId, setSelectedId] = useState('')
  const [area, setArea] = useState(100) // кв.см
  const [quantity, setQuantity] = useState(1)
  const [extraChecked, setExtraChecked] = useState(false)
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const selected = useMemo(() => items.find(i => String(i.id) === String(selectedId)) || items[0] || null, [items, selectedId])
  const fileOp = useMemo(() => Object.values(additionalOperations).find(op => (op.applicableTo||[]).includes('garment-printing')), [additionalOperations])

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selected) { alert('Выберите тип нанесения'); return }
    const sqcm = parseFloat(area) || 0
    const qty = parseInt(quantity, 10) || 1
    if (sqcm <= 0 || qty <= 0) { alert('Укажите площадь и количество'); return }

    const printPrice = sqcm * selected.pricePerSqCm
    const baseTotal = printPrice * qty

    // минимальная сумма (терморезина: от 5 шт не менее 6000)
    let minApplied = null
    if (selected.minAmount) {
      if (baseTotal < selected.minAmount) {
        minApplied = selected.minAmount
      }
    }

    let extrasTotal = 0
    const extras = []
    if (extraChecked && fileOp) {
      extrasTotal += Number(fileOp.price) || 0
      extras.push({ name: fileOp.name, price: Number(fileOp.price) || 0 })
    }

    const subtotal = (minApplied != null ? minApplied : baseTotal) + extrasTotal
    const urgentAmount = isUrgent ? Math.max(subtotal * urgentSurcharge / 100, 5000) : 0
    const total = subtotal + urgentAmount

    setCalculation({
      label: selected.name, sqcm, qty, unitPrice: selected.pricePerSqCm,
      baseTotal, minApplied, extrasTotal, extras, subtotal,
      isUrgent, urgentSurcharge, urgentAmount, total
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'garment-printing', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setCalculation(null); setExtraChecked(false); setIsUrgent(false); setOrderStatus('draft')
    } catch (err) { alert('Ошибка сохранения заказа: ' + err.message) }
    finally { setSavingOrder(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-2">Нанесение на одежду и посуду</h2>
        <p className="text-sm text-gray-500 mb-4 md:mb-6">Терморезина/флекс/ДТФ, сублимация, металлографика — цена за кв.см. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Тип нанесения</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {items.map(item => (
                <button key={item.id} type="button" onClick={() => { setSelectedId(String(item.id)); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${String(selected?.id) === String(item.id) ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="font-semibold text-gray-800">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.pricePerSqCm} тг/кв.см</div>
                  {item.note && <div className="text-xs text-gray-400 mt-1">{item.note}</div>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Площадь изображения (кв.см)</label>
              <input type="number" min="0" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Количество (шт)</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {selected?.minQty && <p className="text-sm text-gray-500">Мин. тираж: {selected.minQty} шт{selected.minAmount ? `, не менее ${selected.minAmount.toLocaleString('ru-RU')} тг` : ''}</p>}

          {fileOp && (
            <label className="flex items-center p-3 bg-green-50 border-2 border-green-300 rounded-lg cursor-pointer">
              <input type="checkbox" checked={extraChecked} onChange={(e) => { setExtraChecked(e.target.checked); setCalculation(null) }} className="mr-3 w-5 h-5" />
              <span className="flex-1 text-sm font-medium">{fileOp.name} (+{fileOp.price} тг)</span>
            </label>
          )}

          <label className="flex items-center p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition">
            <input type="checkbox" checked={isUrgent} onChange={(e) => { setIsUrgent(e.target.checked); setCalculation(null) }} className="mr-3 w-5 h-5" />
            <span className="flex-1 font-medium text-red-700">🔥 Срочный заказ (+{urgentSurcharge}%, минимум 5 000 тг)</span>
          </label>

          <button type="submit" disabled={!selected} className={`w-full py-3 rounded-lg transition font-semibold ${selected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>Рассчитать</button>
        </form>
      </div>

      {calculation && (
        <ResultSummary
          total={{ label: 'Итого:', value: `${calculation.total.toLocaleString('ru-RU')} тг` }}
          saveVariant="gradient"
          saving={savingOrder}
          onSave={handleSaveOrder}
          saveDisabled={!client}
        >
          <CalcResultRow label="Нанесение:" value={calculation.label} reverseOnMobile />
          <CalcResultRow label="Площадь:" value={`${calculation.sqcm} кв.см × ${calculation.qty} шт`} />
          <CalcResultRow label="Цена:" value={`${calculation.unitPrice} тг/кв.см`} />
          <CalcResultRow label="Печать:" value={`${calculation.baseTotal.toLocaleString('ru-RU')} тг`} subtotal />
          {calculation.minApplied != null && (
            <CalcResultRow label={`Мин. сумма заказа (${calculation.minApplied.toLocaleString('ru-RU')} тг):`} value={`${calculation.subtotal.toLocaleString('ru-RU')} тг`} highlight="amber" />
          )}
          {(calculation.extras || []).map((ex) => (
            <CalcResultRow key={ex.name} label={`${ex.name}:`} value={`${Number(ex.price).toLocaleString('ru-RU')} тг`} bold={false} />
          ))}
          {calculation.isUrgent && (
            <CalcResultRow label="Срочность:" value={`+${calculation.urgentAmount.toLocaleString('ru-RU')} тг`} highlight="red" />
          )}
        </ResultSummary>
      )}
    </div>
  )
}