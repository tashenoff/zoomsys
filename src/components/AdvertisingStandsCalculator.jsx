import { useEffect, useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'
import ResultSummary from './ResultSummary'
import CalcResultRow from './CalcResultRow'
import { getCanvasOperationKey } from '../lib/catalog.mjs'

export default function AdvertisingStandsCalculator({ client, initialItemId = null, initialThickness = null }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const stands = pricingData.advertisingStands || []
  const additionalOperations = pricingData.additionalOperations || {}
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const blankOps = () => ({ pocket: null, pocketQty: 0, border: 0 })

  const availableOperations = useMemo(() => {
    if (!additionalOperations || typeof additionalOperations !== 'object') return []
    return Object.values(additionalOperations).filter(op => {
      const a = Array.isArray(op?.applicableTo) ? op.applicableTo : []
      return a.includes('advertising-stands') && !getCanvasOperationKey(op) && op.is_active !== false && op.isActive !== false
    })
  }, [additionalOperations])

  const [selectedItemId, setSelectedItemId] = useState(initialItemId == null ? '' : String(initialItemId))
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [thickness, setThickness] = useState(initialThickness || '')
  const [quantity, setQuantity] = useState(1)
  const [opts, setOpts] = useState(blankOps())
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const selectedItem = useMemo(
    () => stands.find(i => String(i.id) === String(selectedItemId)) || (!selectedItemId ? stands[0] : null) || null,
    [stands, selectedItemId]
  )
  const THICK_LABELS = { pvx3: 'ПВХ 3 мм', pvx5: 'ПВХ 5 мм', pvx8: 'ПВХ 8 мм' }

  const thicknessesForItem = useMemo(() => {
    if (selectedItem?.thicknesses && selectedItem.thicknesses.length) return selectedItem.thicknesses
    const pr = typeof selectedItem?.prices === 'string' ? (() => { try { return JSON.parse(selectedItem.prices) } catch { return null } })() : selectedItem?.prices
    if (pr && typeof pr === 'object') {
      return Object.entries(pr).filter(([k]) => THICK_LABELS[k]).map(([k, v]) => ({ id: k, label: THICK_LABELS[k], price: Number(v) || 0 }))
    }
    return []
  }, [selectedItem])

  const effectiveThickness = selectedItem?.type === 'sqm'
    ? thicknessesForItem.find(t => t.id === thickness) || thicknessesForItem[0]
    : null
  const isCalcReady = selectedItem && (selectedItem.type === 'sqm'
    ? (parseFloat(width) > 0 && parseFloat(height) > 0)
    : true)

  // Допы для отрисовки: кармашки (select+кол-во), остальные quantity
  const pocketOp = availableOperations.find(o => o.id === 'pockets' || o.type === 'quantity-select' || o.name === 'Кармашки')
  const quantityOps = availableOperations.filter(o => o !== pocketOp)
  const borderOp = quantityOps.find(o => o.id === 'border' || o.name === 'Декоративная кайма')
  const automaticBorder = selectedItem?.type === 'sqm' && Number(width) > 0 && Number(height) > 0 && Number(width) * Number(height) < 1

  useEffect(() => { setCalculation(null) }, [selectedItem, width, height, thickness, quantity, opts, isUrgent])

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selectedItem) { alert('Выберите позицию'); return }
    if (selectedItem.type === 'sqm' && (!Number.isFinite(Number(width)) || Number(width) <= 0 || !Number.isFinite(Number(height)) || Number(height) <= 0)) { alert('Укажите положительные размеры'); return }
    if (selectedItem.type === 'fixed' && (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0)) { alert('Укажите положительное целое количество'); return }
    if (selectedItem.type === 'sqm' && !effectiveThickness) { alert('Укажите цену выбранной толщины в прайсе'); return }
    if (automaticBorder && !borderOp) { alert('Для стенда меньше 1 м² требуется тариф каймы в прайсе'); return }
    if (opts.pocket && (!pocketOp?.options?.some(option => option.id === opts.pocket) || !Number.isInteger(Number(opts.pocketQty)) || Number(opts.pocketQty) <= 0)) {
      alert('Выберите формат кармашка и положительное целое количество'); return
    }
    if (quantityOps.some(op => opts[op.id] !== undefined && opts[op.id] !== '' && (!Number.isFinite(Number(opts[op.id])) || Number(opts[op.id]) < 0))) {
      alert('Укажите корректный объём дополнительных операций'); return
    }

    let baseTotal = 0
    const details = []

    if (selectedItem.type === 'sqm') {
      const w = parseFloat(width); const h = parseFloat(height)
      const area = w * h
      const price = effectiveThickness ? Number(effectiveThickness.price) : 0
      baseTotal = area * price
      details.push({ name: `${selectedItem.name} (${effectiveThickness?.label})`, price: baseTotal, area, pricePerUnit: price })
    } else {
      const qty = parseInt(quantity, 10) || 1
      const price = Number(selectedItem.price) || 0
      baseTotal = price * qty
      details.push({ name: selectedItem.name, price: baseTotal, quantity: qty, pricePerUnit: price })
    }

    // Допы
    let extrasTotal = 0
    const extras = []
    if (opts.pocket && pocketOp) {
      const opt = pocketOp.options.find(o => o.id === opts.pocket)
      if (opt && opts.pocketQty > 0) {
        const add = Number(opt.price) * opts.pocketQty
        extrasTotal += add
        extras.push({ id: String(pocketOp.id), optionId: opt.id, name: `Кармашки ${opt.name} (${opts.pocketQty} шт)`, price: add, quantity: Number(opts.pocketQty), unitPrice: Number(opt.price) })
      }
    }
    quantityOps.forEach(op => {
      const val = automaticBorder && op === borderOp ? 2 * (Number(width) + Number(height)) : (opts[op.id] || 0)
      const qv = parseFloat(val)
      if (qv > 0) {
        const add = Number(op.price) * qv
        extrasTotal += add
        extras.push({ id: String(op.id), name: `${op.name} (${qv} ${op.unit || ''})`, price: add, quantity: qv, unitPrice: Number(op.price), automatic: automaticBorder && op === borderOp })
      }
    })

    const subtotal = baseTotal + extrasTotal
    const urgentAmount = isUrgent ? Math.max(subtotal * urgentSurcharge / 100, 5000) : 0
    const total = subtotal + urgentAmount

    setCalculation({ itemName: selectedItem.name, productName: selectedItem.name, quantity: selectedItem.type === 'sqm' ? 1 : Number(quantity),
      width: selectedItem.type === 'sqm' ? Number(width) : null, height: selectedItem.type === 'sqm' ? Number(height) : null,
      area: selectedItem.type === 'sqm' ? Number(width) * Number(height) : null, thickness: effectiveThickness?.label || null,
      selectedItemId: String(selectedItem.id), options: opts, baseTotal, details, extrasTotal, extras, isUrgent, urgentSurcharge, urgentAmount, subtotal, total })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'advertising-stands', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setCalculation(null); setIsUrgent(false); setOpts(blankOps()); setOrderStatus('draft')
    } catch (err) { alert('Ошибка сохранения заказа: ' + err.message) }
    finally { setSavingOrder(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-2">Рекламные стенды</h2>
        <p className="text-sm text-gray-500 mb-4 md:mb-6">Цена без установки, с учётом материала. При площади меньше 1 м² добавляется кайма. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Тип стенда</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {stands.map(item => (
                <button key={item.id} type="button"
                  onClick={() => { setSelectedItemId(String(item.id)); setCalculation(null); setOpts(blankOps()) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${String(selectedItem?.id) === String(item.id) ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'}`}>
                  <div className="font-semibold text-gray-800">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedItem?.type === 'sqm' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Толщина ПВХ</label>
                <div className="flex gap-2 flex-wrap">
                  {(thicknessesForItem).map(t => (
                    <button key={t.id} type="button"
                      onClick={() => setThickness(t.id)}
                      className={`px-4 py-2 rounded-lg border-2 transition font-medium ${effectiveThickness?.id === t.id ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-blue-300 hover:bg-blue-50'}`}>
                      {t.label} — {t.price.toLocaleString('ru-RU')} тг/м²
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ширина (м)</label>
                  <input type="number" step="0.01" value={width} onChange={(e) => setWidth(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="1.0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Высота (м)</label>
                  <input type="number" step="0.01" value={height} onChange={(e) => setHeight(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="1.0" />
                </div>
              </div>
            </>
          )}

          {selectedItem?.type === 'fixed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Количество (шт)</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)} min="1" required className="w-full px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {selectedItem?.type === 'sqm' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Доп. опции</label>
              <div className="space-y-3">
                {pocketOp && (
                  <div className="p-3 border-2 border-green-300 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Кармашки (формат)</label>
                      <select value={opts.pocket || ''} onChange={(e) => setOpts({ ...opts, pocket: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="">Нет</option>
                        {(pocketOp.options || []).map(o => <option key={o.id} value={o.id}>{o.name} — {o.price} тг</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Кол-во кармашков</label>
                      <input type="number" min={opts.pocket ? '1' : '0'} step="1" required={!!opts.pocket} value={opts.pocketQty || ''} onChange={(e) => setOpts({ ...opts, pocketQty: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                )}
                {automaticBorder && borderOp && <p className="text-sm text-gray-600">Кайма добавляется автоматически для стенда меньше 1 м²: {2 * (Number(width) + Number(height))} пог.м × {borderOp.price} тг.</p>}
                {quantityOps.filter(op => !(automaticBorder && op === borderOp)).map(op => (
                  <div key={op.id} className="p-3 border-2 border-green-300 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <span className="text-sm font-medium">{op.name}</span>
                        <p className="text-xs text-gray-500 mt-1">{op.price} тг/{op.unit} — {op.description}</p>
                      </div>
                      <input type="number" min="0" step="0.01" value={opts[op.id] || ''} onChange={(e) => setOpts({ ...opts, [op.id]: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={`0 ${op.unit}`} />
                    </div>
                  </div>
                ))}
              </div>
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
          total={{ label: 'Итого:', value: `${calculation.total.toLocaleString('ru-RU')} тг` }}
          saveVariant="gradient"
          saving={savingOrder}
          onSave={handleSaveOrder}
          saveDisabled={!client}
        >
          <CalcResultRow label="Позиция:" value={calculation.itemName} reverseOnMobile />
          {calculation.width && <CalcResultRow label="Размер / материал:" value={`${calculation.width} × ${calculation.height} м; ${calculation.area} м²; ${calculation.thickness}`} />}
          <CalcResultRow label="Основа:" value={`${calculation.baseTotal.toLocaleString('ru-RU')} тг`} subtotal />
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
