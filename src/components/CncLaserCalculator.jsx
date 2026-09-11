import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

const THICKNESS_OPTIONS = [
  { id: 't01_15', label: '1–1.5 мм' },
  { id: 't02_4', label: '2–4 мм' },
  { id: 't05_7', label: '5–7 мм' },
  { id: 't08_10', label: '8–10 мм' },
  { id: 't11_15', label: '11–15 мм' },
  { id: 't16_20', label: '16–20 мм' }
]

export default function CncLaserCalculator({ client }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const cncItems = pricingData.cncLaser || []
  const additionalOperations = pricingData.additionalOperations || {}
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  // типы операций: резка (milling) / гравировка (engrave)
  const [opType, setOpType] = useState('milling') // 'milling' | 'engrave'
  const [materialId, setMaterialId] = useState('')
  const [thickness, setThickness] = useState('t01_15')
  const [quantity, setQuantity] = useState(1) // пог.м или кв.см
  const [extraChecked, setExtraChecked] = useState(false)
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const millingItems = useMemo(() => cncItems.filter(i => i.category === 'cnc-cut'), [cncItems])
  const engraveItems = useMemo(() => cncItems.filter(i => i.category === 'cnc-engrave'), [cncItems])
  const availableOps = useMemo(() => {
    return Object.values(additionalOperations).filter(op => {
      const a = Array.isArray(op?.applicableTo) ? op.applicableTo : []
      return a.includes('cnc-laser')
    })
  }, [additionalOperations])

  const opList = opType === 'milling' ? millingItems : engraveItems
  const selectedMaterial = useMemo(
    () => (opList.find(i => String(i.id) === String(materialId)) || opList[0] || null),
    [opList, materialId]
  )

  // доступность резки для выбранной толщины
  const thicknessAvailable = opType === 'milling' && selectedMaterial
    ? (selectedMaterial.prices?.[thickness] !== undefined && selectedMaterial.prices?.[thickness] !== null)
    : true
  const canCalculate = !!selectedMaterial && (opType === 'engrave' ? !!selectedMaterial.price : thicknessAvailable)

  const resetCalc = () => setCalculation(null)
  // при смене типа одновремено сбросить материал
  const switchType = (t) => { setOpType(t); setMaterialId(''); resetCalc() }

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selectedMaterial) { alert('Выберите материал/операцию'); return }
    if (!thicknessAvailable) { alert('Для выбранной толщины резка не предусмотрена'); return }
    const qty = parseFloat(quantity) || 0
    if (qty <= 0) { alert('Введите количество'); return }

    let unitPrice = null
    let unit = selectedMaterial.unit || 'пог.м'
    let thicknessLabel = null

    if (opType === 'milling') {
      const price = selectedMaterial.prices?.[thickness]
      unitPrice = Number(price)
      thicknessLabel = THICKNESS_OPTIONS.find(t => t.id === thickness)?.label
    } else {
      unitPrice = Number(selectedMaterial.price) || 0
    }

    const baseTotal = unitPrice * qty

    // допы (скотч)
    let extrasTotal = 0
    const extras = []
    if (extraChecked && opType === 'milling') {
      availableOps.forEach(op => {
        extrasTotal += Number(op.price) || 0
        extras.push({ name: op.name, price: Number(op.price) || 0 })
      })
    }

    const subtotal = baseTotal + extrasTotal
    const urgentAmount = isUrgent ? Math.max(subtotal * urgentSurcharge / 100, 5000) : 0
    const total = subtotal + urgentAmount

    setCalculation({
      opTypeLabel: opType === 'milling' ? 'Резка' : 'Гравировка',
      materialLabel: selectedMaterial.category === 'cnc-cut' ? (selectedMaterial.material || selectedMaterial.name) : selectedMaterial.name,
      thicknessLabel,
      unit, quantity: qty,
      unitPrice, baseTotal, extras, extrasTotal,
      isUrgent, urgentSurcharge, urgentAmount, total
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation || calculation.note) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'cnc-laser', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setCalculation(null); setExtraChecked(false); setIsUrgent(false); setOrderStatus('draft')
    } catch (err) { alert('Ошибка сохранения заказа: ' + err.message) }
    finally { setSavingOrder(false) }
  }

  const engraveNote = opType === 'engrave' && selectedMaterial?.description

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-2">Фрезерный и лазерный станок</h2>
        <p className="text-sm text-gray-500 mb-6">Фрезер 2400×1200 мм, лазер 1200×600 мм. Цена без материала. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Операция</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['milling', '🪚 Резка (пог.м)'],
                ['engrave', '🖋️ Гравировка (кв.см)']
              ].map(([val, label]) => (
                <button key={val} type="button" onClick={() => switchType(val)}
                  className={`p-4 rounded-lg border-2 transition text-left ${opType === val ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <span className="font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">{opType === 'milling' ? 'Материал' : 'Материал для гравировки'}</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {opList.map(item => (
                <button key={item.id} type="button" onClick={() => { setMaterialId(String(item.id)); resetCalc() }}
                  className={`p-4 rounded-lg border-2 transition text-left ${String(selectedMaterial?.id) === String(item.id) ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="font-medium text-gray-800">{item.category === 'cnc-cut' ? (item.material || item.name) : item.name}</div>
                  {item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}
                  {item.category === 'cnc-engrave' && item.price && <div className="text-xs text-gray-600 mt-1">{item.price} тг/кв.см {item.price_extra || ''}</div>}
                </button>
              ))}
            </div>
          </div>

          {opType === 'milling' && selectedMaterial && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Толщина материала</label>
              <div className="flex gap-2 flex-wrap">
                {THICKNESS_OPTIONS.map(t => {
                  const hasPrice = selectedMaterial.prices?.[t.id] !== undefined && selectedMaterial.prices?.[t.id] !== null
                  return (
                    <button key={t.id} type="button" disabled={!hasPrice}
                      onClick={() => { setThickness(t.id); resetCalc() }}
                      className={`px-4 py-2 rounded-lg border-2 transition font-medium ${!hasPrice ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed' : thickness === t.id ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-blue-300 hover:bg-blue-50'}`}>
                      {t.label}
                    </button>
                  )
                })}
              </div>
              {!thicknessAvailable && (
                <p className="text-xs text-gray-500 mt-2">Для выбранной толщины резка не предусмотрена — выберите другую.</p>
              )}
            </div>
          )}

          {engraveNote && <p className="text-sm text-gray-500">{engraveNote}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Количество ({opType === 'milling' ? 'пог.м' : 'кв.см'})</label>
            <input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {opType === 'milling' && availableOps.length > 0 && (
            <label className="flex items-center p-3 bg-green-50 border-2 border-green-300 rounded-lg cursor-pointer">
              <input type="checkbox" checked={extraChecked} onChange={(e) => { setExtraChecked(e.target.checked); resetCalc() }} className="mr-3 w-5 h-5" />
              <span className="flex-1 text-sm font-medium">Скотч для фрезерной резки (+{availableOps[0].price} тг, за 1 м²)</span>
            </label>
          )}

          <label className="flex items-center p-4 bg-red-50 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition">
            <input type="checkbox" checked={isUrgent} onChange={(e) => { setIsUrgent(e.target.checked); resetCalc() }} className="mr-3 w-5 h-5" />
            <span className="flex-1 font-medium text-red-700">🔥 Срочный заказ (+{urgentSurcharge}%, минимум 5 000 тг)</span>
          </label>

          <button type="submit" disabled={!canCalculate} className={`w-full py-3 rounded-lg transition font-semibold ${canCalculate ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>Рассчитать</button>
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
              <div className="flex justify-between"><span className="text-gray-600">Операция:</span><span className="font-semibold text-right">{calculation.opTypeLabel}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Материал:</span><span className="font-semibold text-right">{calculation.materialLabel}</span></div>
              {calculation.thicknessLabel && <div className="flex justify-between"><span className="text-gray-600">Толщина:</span><span className="font-semibold">{calculation.thicknessLabel}</span></div>}
              <div className="flex justify-between"><span className="text-gray-600">Количество:</span><span className="font-semibold">{calculation.quantity} {calculation.unit}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Цена за ед:</span><span className="font-semibold">{calculation.unitPrice.toLocaleString('ru-RU')} тг</span></div>
              <div className="flex justify-between pt-2 border-t"><span className="text-gray-600">Работа:</span><span className="font-semibold">{calculation.baseTotal.toLocaleString('ru-RU')} тг</span></div>
              {(calculation.extras || []).map(ex => (
                <div key={ex.name} className="flex justify-between"><span className="text-gray-600">{ex.name}:</span><span>{Number(ex.price).toLocaleString('ru-RU')} тг</span></div>
              ))}
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