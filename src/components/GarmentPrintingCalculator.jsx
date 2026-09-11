import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-2">Нанесение на одежду и посуду</h2>
        <p className="text-sm text-gray-500 mb-6">Терморезина/флекс/ДТФ, сублимация, металлографика — цена за кв.см. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Площадь изображения (кв.см)</label>
              <input type="number" min="0" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Количество (шт)</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {selected?.minQty && <p className="text-sm text-gray-500">Мин. тираж: {selected.minQty} шт{selected.minAmount ? `, не менее ${selected.minAmount.toLocaleString('ru-RU')} тг` : ''}</p>}

          {fileOp && (
            <label className="flex items-center p-3 bg-green-50 border-2 border-green-300 rounded-lg cursor-pointer">
              <input type="checkbox" checked={extraChecked} onChange={(e) => { setExtraChecked(e.target.checked); setCalculation(null) }} className="mr-3 w-5 h-5" />
              <span className="flex-1 text-sm font-medium">{fileOp.name} (+{fileOp.price} тг)</span>
            </label>
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
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-600">Нанесение:</span><span className="font-semibold text-right">{calculation.label}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Площадь:</span><span className="font-semibold">{calculation.sqcm} кв.см × {calculation.qty} шт</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Цена:</span><span className="font-semibold">{calculation.unitPrice} тг/кв.см</span></div>
            <div className="flex justify-between pt-2 border-t"><span className="text-gray-600">Печать:</span><span className="font-semibold">{calculation.baseTotal.toLocaleString('ru-RU')} тг</span></div>
            {calculation.minApplied != null && (
              <div className="flex justify-between py-2 px-3 bg-amber-50 rounded"><span className="text-amber-700 font-semibold">Мин. сумма заказа ({calculation.minApplied.toLocaleString('ru-RU')} тг):</span><span className="font-bold text-amber-700">{calculation.subtotal.toLocaleString('ru-RU')} тг</span></div>
            )}
            {(calculation.extras||[]).map(ex => (
              <div key={ex.name} className="flex justify-between"><span className="text-gray-600">{ex.name}:</span><span>{Number(ex.price).toLocaleString('ru-RU')} тг</span></div>
            ))}
            {calculation.isUrgent && (
              <div className="flex justify-between py-2 px-3 bg-red-50 rounded"><span className="text-red-700 font-semibold">Срочность:</span><span className="font-bold text-red-600">+{calculation.urgentAmount.toLocaleString('ru-RU')} тг</span></div>
            )}
            <div className="flex justify-between pt-3 border-t-2 border-gray-300"><span className="text-lg font-bold">Итого:</span><span className="text-2xl font-bold text-blue-600">{calculation.total.toLocaleString('ru-RU')} тг</span></div>
          </div>

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
        </div>
      )}
    </div>
  )
}