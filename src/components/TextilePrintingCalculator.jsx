import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'
import ResultSummary from './ResultSummary'
import CalcResultRow from './CalcResultRow'

function normalizePrices(prices) {
  if (!prices) return null
  if (typeof prices === 'string') {
    try { return JSON.parse(prices) } catch { return null }
  }
  return prices
}

function getTierPrice(prices, qty, fallbackPrice = 0) {
  const parsed = normalizePrices(prices)
  if (!parsed || typeof parsed !== 'object') return { price: Number(fallbackPrice) || 0, tier: 'фикс.' }

  if (parsed.default !== undefined) return { price: Number(parsed.default) || 0, tier: 'фикс.' }

  const upTo = Object.entries(parsed)
    .map(([key, value]) => {
      const match = key.match(/^upTo(\d+)$/)
      return match ? { limit: Number(match[1]), value, key } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.limit - b.limit)

  for (const tier of upTo) {
    if (qty <= tier.limit) return { price: tier.value, tier: `до ${tier.limit}` }
  }

  const over = Object.entries(parsed)
    .map(([key, value]) => {
      const match = key.match(/^over(\d+)$/)
      return match ? { limit: Number(match[1]), value, key } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.limit - a.limit)

  if (over.length) return { price: over[0].value, tier: `свыше ${over[0].limit}` }
  if (upTo.length) {
    const last = upTo[upTo.length - 1]
    return { price: last.value, tier: `до ${last.limit}` }
  }
  return { price: Number(fallbackPrice) || 0, tier: 'фикс.' }
}

function formatPrices(prices, fallbackPrice) {
  const parsed = normalizePrices(prices)
  if (!parsed || typeof parsed !== 'object') return `${fallbackPrice || 0} тг/м²`
  return Object.entries(parsed).map(([key, value]) => {
    const label = key === 'default' ? 'фикс.' : key.replace('upTo', 'до ').replace('over', 'свыше ')
    return `${label}: ${value}`
  }).join(' · ')
}

function getUnitLabel(unit) {
  if (!unit) return 'шт.'
  const u = String(unit)
  if (u.trim() === 'пог.м') return 'пог.м / за 1 шт.'
  return u.replace(/^тг\//, '')
}

export default function TextilePrintingCalculator({ client, initialCategory }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const allTextile = pricingData.textile || []
  // Группы (тип печати) — сопоставление подкатегориям сайдбара
  const TEXTILE_CATEGORIES = {
    sublimation: 'Сублимация',
    direct: 'Прямая печать',
    mesh: 'Сетки',
    service: 'Услуги'
  }
  const textile = initialCategory
    ? allTextile.filter(item => (item.category || '') === initialCategory)
    : allTextile
  const additionalOperations = pricingData.additionalOperations || {}
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [selectedServices, setSelectedServices] = useState([])
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const selectedMaterial = useMemo(
    () => textile.find(item => String(item.id) === String(selectedMaterialId)) || textile[0] || null,
    [textile, selectedMaterialId]
  )

  const availableOperations = useMemo(() => {
    if (!additionalOperations || typeof additionalOperations !== 'object') return []
    const seen = new Set()
    return Object.values(additionalOperations).filter(op => {
      const applicableTo = Array.isArray(op?.applicableTo) ? op.applicableTo : []
      if (!applicableTo.includes('textile')) return false
      const key = String(op.id || op.name)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [additionalOperations])

  const handleCalculate = (e) => {
    e.preventDefault()

    const w = parseFloat(width)
    const h = parseFloat(height)
    const qty = parseInt(quantity, 10)

    if (!w || !h || !qty || !selectedMaterial) {
      alert('Заполните все поля')
      return
    }

    const itemArea = w * h
    const factualArea = itemArea * qty
    const tier = getTierPrice(selectedMaterial.prices, factualArea, selectedMaterial.pricePerSqm)

    if (tier.price === 'договорная') {
      setCalculation({
        materialName: selectedMaterial.name,
        width: w, height: h, itemArea: itemArea.toFixed(2),
        factualArea: factualArea.toFixed(2), quantity: qty,
        priceTier: tier.tier,
        note: 'Цена договорная, свяжитесь с менеджером'
      })
      return
    }

    const pricePerSqM = Number(tier.price) || 0
    const baseTotal = factualArea * pricePerSqM
    let extrasTotal = 0
    const extras = []
    const perimeterPerItem = 2 * (w + h) // пог.м на 1 шт.

    selectedServices.forEach(id => {
      const op = availableOperations.find(o => String(o.id) === String(id))
      if (!op) return
      const opQty = perimeterPerItem * qty
      const opPrice = getTierPrice(op.prices, opQty, op.price)
      const unitPrice = Number(opPrice.price) || 0
      const add = unitPrice * opQty
      extrasTotal += add
      extras.push({ name: `${op.name} (${opQty.toLocaleString('ru-RU')} пог.м${opPrice.tier ? `, ${opPrice.tier}` : ''})`, price: add })
    })

    const subtotal = baseTotal + extrasTotal
    const urgentAmount = isUrgent ? Math.max(subtotal * urgentSurcharge / 100, 5000) : 0
    const total = subtotal + urgentAmount

    setCalculation({
      materialName: selectedMaterial.name,
      width: w, height: h, itemArea: itemArea.toFixed(2),
      factualArea: factualArea.toFixed(2), quantity: qty,
      priceTier: tier.tier, pricePerSqM, baseTotal,
      extras, extrasTotal, subtotal,
      isUrgent, urgentSurcharge, urgentAmount, total
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation || calculation.note) {
      alert('Выберите клиента и сделайте расчет')
      return
    }
    setSavingOrder(true)
    try {
      await createOrder({
        client, category: 'textile', ...calculation,
        status: orderStatus, paymentStatus: 'not_paid'
      })
      alert('Заказ успешно сохранен!')
      setWidth(''); setHeight(''); setQuantity(1)
      setSelectedServices([])
      setIsUrgent(false); setCalculation(null); setOrderStatus('draft')
    } catch (err) {
      alert('Ошибка сохранения заказа: ' + err.message)
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-2">{initialCategory ? (TEXTILE_CATEGORIES[initialCategory] || initialCategory) : 'Печать на текстиле'}</h2>
        <p className="text-sm text-gray-500 mb-4 md:mb-6">Рабочее поле 1600 мм. Цена с учётом материала. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Материал / технология</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {textile.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => { setSelectedMaterialId(String(material.id)); setSelectedServices([]); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    String(selectedMaterial?.id) === String(material.id)
                      ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-gray-800">{material.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{formatPrices(material.prices, material.pricePerSqm)} тг/м²</div>
                  {material.description && <div className="text-xs text-gray-400 mt-1">{material.description}</div>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ширина (м)</label>
              <input type="number" step="0.01" value={width} onChange={(e) => setWidth(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="1.0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Длина (м)</label>
              <input type="number" step="0.01" value={height} onChange={(e) => setHeight(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="1.5" />
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Популярные размеры флагов:</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { w: 1, h: 1.5, label: '1×1.5' },
                { w: 1, h: 2, label: '1×2' },
                { w: 1.5, h: 3, label: '1.5×3' },
                { w: 2, h: 4, label: '2×4' },
              ].map((size) => (
                <button key={size.label} type="button" onClick={() => { setWidth(size.w.toString()); setHeight(size.h.toString()) }} className="px-4 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">
                  {size.label} м
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Количество (шт)</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)} min="1" required className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {availableOperations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Доп. услуги (пог.м)</label>
              <div className="space-y-3">
                {availableOperations.map((op) => {
                  const isSelected = selectedServices.includes(op.id)
                  return (
                    <div key={op.id} className={`p-4 border-2 rounded-lg ${isSelected ? 'bg-green-50 border-green-500 shadow-md' : 'bg-white border-green-300'}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={isSelected} onChange={(e) => {
                          if (e.target.checked) setSelectedServices([...selectedServices, op.id])
                          else {
                            setSelectedServices(selectedServices.filter(id => id !== op.id))
                          }
                          setCalculation(null)
                        }} className="mt-1 w-5 h-5 cursor-pointer" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium block">{op.name}</span>
                            {isSelected && <span className="text-green-600 text-xl">✓</span>}
                          </div>
                          {op.description && <p className="text-xs text-gray-600 mb-1">{op.description}</p>}
                          <p className="text-sm text-gray-500">{formatPrices(op.prices, op.price)} тг/{getUnitLabel(op.unit)}</p>
                          {isSelected && (
                            <p className="text-xs text-green-600 mt-1">пог.м считается автоматически по периметру (2 × (ширина + длина))</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
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
          noteBody={calculation.note ? (
            <>
              <p className="text-xl font-bold text-yellow-800 mb-2">⚠️ {calculation.note}</p>
              <p className="text-gray-700">Материал: {calculation.materialName}, диапазон: {calculation.priceTier}</p>
            </>
          ) : null}
          total={{ label: 'Итого:', value: `${calculation.total.toLocaleString('ru-RU')} тг` }}
          saveVariant="solid"
          saving={savingOrder}
          onSave={handleSaveOrder}
          saveDisabled={!client}
        >
          <CalcResultRow label="Материал:" value={calculation.materialName} wrap />
          <CalcResultRow label="Размер:" value={`${calculation.width} × ${calculation.height} м`} />
          <CalcResultRow label="Площадь 1 шт:" value={`${calculation.itemArea} м²`} />
          <CalcResultRow label="Фактическая площадь:" value={`${calculation.factualArea} м²`} />
          <CalcResultRow label="Количество:" value={`${calculation.quantity} шт`} />
          <CalcResultRow label="Диапазон цены:" value={calculation.priceTier} wrap />
          <CalcResultRow label="Цена за м²:" value={`${calculation.pricePerSqM.toLocaleString('ru-RU')} тг`} />
          <CalcResultRow label="Печать:" value={`${calculation.baseTotal.toLocaleString('ru-RU')} тг`} subtotal />
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
