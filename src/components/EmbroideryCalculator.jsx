import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'
import ResultSummary from './ResultSummary'
import CalcResultRow from './CalcResultRow'

export default function EmbroideryCalculator({ client }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const items = pricingData.embroidery || []
  const additionalOperations = pricingData.additionalOperations || {}
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const [selectedId, setSelectedId] = useState('')
  const [stitches, setStitches] = useState(1000)
  const [quantity, setQuantity] = useState(1)
  const [fileChecked, setFileChecked] = useState(false)
  const [metalChecked, setMetalChecked] = useState(false)
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const selected = useMemo(() => items.find(i => String(i.id) === String(selectedId)) || items[0] || null, [items, selectedId])
  const fileOp = useMemo(() => Object.values(additionalOperations).find(op => (op.applicableTo||[]).includes('embroidery') && op.id === 'embFile'), [additionalOperations])
  const metalOp = useMemo(() => Object.values(additionalOperations).find(op => op.id === 'embMetalThread'), [additionalOperations])

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selected) { alert('Выберите вид вышивки'); return }
    const st = parseFloat(stitches) || 0
    const qty = parseInt(quantity, 10) || 1
    if (st <= 0 || qty <= 0) { alert('Введите стежки и количество'); return }

    // цена за 1000 стежков
    const thousands = st / 1000
    let embroideryPrice = selected.price * thousands * qty
    let metalAmount = 0

    if (metalChecked && metalOp) {
      metalAmount = embroideryPrice * (Number(metalOp.price) / 100)
      embroideryPrice += metalAmount
    }

    let extrasTotal = 0
    const extras = []
    if (fileChecked && fileOp) {
      extrasTotal += Number(fileOp.price) || 0
      extras.push({ name: fileOp.name, price: Number(fileOp.price) || 0 })
    }
    if (metalChecked && metalOp && metalAmount > 0) {
      extras.push({ name: metalOp.name, price: metalAmount })
    }

    const subtotal = embroideryPrice + extrasTotal
    const urgentAmount = isUrgent ? Math.max(subtotal * urgentSurcharge / 100, 5000) : 0
    const total = subtotal + urgentAmount

    setCalculation({
      label: selected.name, stitches: st, qty, pricePerThousand: selected.price,
      embroideryPrice, metalAmount, extras, extrasTotal, subtotal,
      isUrgent, urgentSurcharge, urgentAmount, total
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'embroidery', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setCalculation(null); setFileChecked(false); setMetalChecked(false); setIsUrgent(false); setOrderStatus('draft')
    } catch (err) { alert('Ошибка сохранения заказа: ' + err.message) }
    finally { setSavingOrder(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-2">Вышивка</h2>
        <p className="text-sm text-gray-500 mb-4 md:mb-6">Цена за 1000 стежков. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Вид вышивки</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {items.map(item => (
                <button key={item.id} type="button" onClick={() => { setSelectedId(String(item.id)); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${String(selected?.id) === String(item.id) ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="font-semibold text-gray-800">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.price} тг / 1000 стежков</div>
                  {item.note && <div className="text-xs text-gray-400 mt-1">{item.note}</div>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Стежков (на изделие)</label>
              <input type="number" min="0" value={stitches} onChange={(e) => setStitches(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Количество (шт)</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {fileOp && (
            <label className="flex items-center p-3 bg-green-50 border-2 border-green-300 rounded-lg cursor-pointer">
              <input type="checkbox" checked={fileChecked} onChange={(e) => { setFileChecked(e.target.checked); setCalculation(null) }} className="mr-3 w-5 h-5" />
              <span className="flex-1 text-sm font-medium">{fileOp.name} (+{fileOp.price} тг)</span>
            </label>
          )}
          {metalOp && (
            <label className="flex items-center p-3 bg-amber-50 border-2 border-amber-300 rounded-lg cursor-pointer">
              <input type="checkbox" checked={metalChecked} onChange={(e) => { setMetalChecked(e.target.checked); setCalculation(null) }} className="mr-3 w-5 h-5" />
              <span className="flex-1 text-sm font-medium">{metalOp.name} (+{metalOp.price}%)</span>
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
          <CalcResultRow label="Вид:" value={calculation.label} reverseOnMobile />
          <CalcResultRow label="Стежки:" value={`${calculation.stitches.toLocaleString('ru-RU')} × ${calculation.qty} шт`} />
          <CalcResultRow label="Цена:" value={`${calculation.pricePerThousand} тг / 1000 стежков`} />
          <CalcResultRow label="Вышивка:" value={`${calculation.embroideryPrice.toLocaleString('ru-RU')} тг`} subtotal />
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