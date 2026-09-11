import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-2">Вышивка</h2>
        <p className="text-sm text-gray-500 mb-6">Цена за 1000 стежков. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Стежков (на изделие)</label>
              <input type="number" min="0" value={stitches} onChange={(e) => setStitches(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Количество (шт)</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
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
            <div className="flex justify-between"><span className="text-gray-600">Вид:</span><span className="font-semibold text-right">{calculation.label}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Стежки:</span><span className="font-semibold">{calculation.stitches.toLocaleString('ru-RU')} × {calculation.qty} шт</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Цена:</span><span className="font-semibold">{calculation.pricePerThousand} тг / 1000 стежков</span></div>
            <div className="flex justify-between pt-2 border-t"><span className="text-gray-600">Вышивка:</span><span className="font-semibold">{calculation.embroideryPrice.toLocaleString('ru-RU')} тг</span></div>
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