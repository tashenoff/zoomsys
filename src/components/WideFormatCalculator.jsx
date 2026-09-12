import { useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

const WIDE_FORMAT_GROUPS = {
  phaeton: 'Широкоформатная печать Phaeton UD-3208P',
  mimaki: 'Интерьерная печать MIMAKI SWJ-320 S4',
  roland: 'Интерьерная печать Roland VS-640 + плоттер',
  other: 'Прочее'
}

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

  if (parsed.default !== undefined) {
    return { price: parsed.default, tier: 'фикс.' }
  }

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
    const label = key === 'default'
      ? 'фикс.'
      : key.replace('upTo', 'до ').replace('over', 'свыше ')
    return `${label}: ${value}`
  }).join(' · ')
}

function getUnitLabel(unit) {
  if (!unit) return 'шт.'
  return String(unit).replace(/^тг\//, '')
}

function matchesWideFormatOperation(op, material, group) {
  const opName = String(op?.name || '').toLowerCase()
  const materialName = String(material?.name || '').toLowerCase()

  // Баннерные операции не показываем на интерьерных винилах/бумаге/холсте.
  if (opName.includes('проклейка баннера') || opName.includes('склейка баннера') || opName.includes('арматура')) {
    return materialName.includes('баннер') || materialName.includes('фронтлит') || materialName.includes('бэклит')
  }

  // Прошивка относится только к баннерной сетке.
  if (opName.includes('прошивка баннерной сетки')) {
    return materialName.includes('баннерная сетка')
  }

  // Ламинация винила относится только к винилам.
  if (opName.includes('ламинация винила')) {
    return materialName.includes('винил')
  }

  // Контурная резка находится в блоке Roland + плоттер.
  if (opName.includes('обрезка по контуру')) {
    return group === 'roland'
  }

  // Обрезка готовой продукции и люверсы остаются доступными для широкоформатных материалов.
  return true
}

export default function WideFormatCalculator({ client }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const wideFormatPricing = pricingData.wideFormat || []
  const additionalOperations = pricingData.additionalOperations || {}
  const additionalServices = pricingData.additionalServices || []
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const availableGroups = useMemo(() => {
    const groups = [...new Set(wideFormatPricing.map(item => item.category || 'other'))]
    return groups.length ? groups : ['other']
  }, [wideFormatPricing])

  const [selectedGroup, setSelectedGroup] = useState(availableGroups[0] || 'phaeton')
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [selectedServices, setSelectedServices] = useState([])
  const [serviceQuantities, setServiceQuantities] = useState({})
  const [selectedServiceOptions, setSelectedServiceOptions] = useState({})
  const [isUrgent, setIsUrgent] = useState(false)
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  const effectiveGroup = availableGroups.includes(selectedGroup) ? selectedGroup : (availableGroups[0] || 'other')

  const materialsForGroup = useMemo(
    () => wideFormatPricing.filter(item => (item.category || 'other') === effectiveGroup),
    [wideFormatPricing, effectiveGroup]
  )

  const selectedMaterial = useMemo(() => {
    return materialsForGroup.find(item => String(item.id) === String(selectedMaterialId)) || materialsForGroup[0] || null
  }, [materialsForGroup, selectedMaterialId])

  const availableOperations = useMemo(() => {
    const seen = new Set()
    const fromOperations = additionalOperations && typeof additionalOperations === 'object'
      ? Object.values(additionalOperations).filter(op => {
          const applicableTo = Array.isArray(op?.applicableTo) ? op.applicableTo : []
          if (!applicableTo.includes('wide-format')) return false
          const key = String(op.id || op.name)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      : []

    const fromServices = Array.isArray(additionalServices)
      ? additionalServices.filter(svc => {
          const applicableTo = Array.isArray(svc?.applicableTo) ? svc.applicableTo : []
          if (!applicableTo.includes('wide-format')) return false
          const key = String(svc.id || svc.name)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      : []

    return [...fromOperations, ...fromServices]
      .filter(op => matchesWideFormatOperation(op, selectedMaterial, effectiveGroup))
  }, [additionalOperations, additionalServices, selectedMaterial, effectiveGroup])

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
    const billableArea = Math.max(factualArea, 1)
    const tier = getTierPrice(selectedMaterial.prices, billableArea, selectedMaterial.pricePerSqm)

    if (tier.price === 'договорная') {
      setCalculation({
        equipment: WIDE_FORMAT_GROUPS[effectiveGroup] || effectiveGroup,
        materialName: selectedMaterial.name,
        width: w,
        height: h,
        itemArea: itemArea.toFixed(2),
        factualArea: factualArea.toFixed(2),
        billableArea: billableArea.toFixed(2),
        quantity: qty,
        priceTier: tier.tier,
        note: 'Цена договорная, свяжитесь с менеджером'
      })
      return
    }

    const pricePerSqM = Number(tier.price) || 0
    const baseTotal = billableArea * pricePerSqM
    let extrasTotal = 0
    const extras = []

    selectedServices.forEach(id => {
      const op = availableOperations.find(o => String(o.id) === String(id))
      if (!op) return

      let add = 0
      let detailName = op.name
      let opQty = 1
      let unitPrice = Number(op.price) || 0
      let opTier = null

      if (op.type === 'select') {
        const selectedOptionId = selectedServiceOptions[id]
        if (selectedOptionId) {
          const selectedOption = (op.options || []).find(opt => String(opt.id) === String(selectedOptionId))
          if (selectedOption) {
            add = Number(selectedOption.price) || 0
            detailName = `${op.name}: ${selectedOption.name}`
            unitPrice = Number(selectedOption.price) || 0
          }
        }
      } else if (op.type === 'quantity') {
              if (op.stepMode) {
                // Ввод: шаг между люверсами (см). Кол-во считаем по периметру одного баннера × количество изделий.
                const step = parseFloat(serviceQuantities[id]) || 0
                const perimeterCm = 2 * ((w + h) * 100)
                const perItem = step > 0 ? Math.round(perimeterCm / step) : 0
                opQty = perItem * qty
              } else {
                opQty = parseFloat(serviceQuantities[id]) || 0
              }
              const opPrice = getTierPrice(op.prices, opQty, op.price)
        unitPrice = Number(opPrice.price) || 0
        opTier = opPrice.tier
        add = unitPrice * opQty
        detailName = `${op.name} (${opQty} ${getUnitLabel(op.unit)}${opTier ? `, ${opTier}` : ''})`
      } else {
        add = op.unit === 'тг/шт' ? unitPrice * qty : unitPrice
      }

      extrasTotal += add
      extras.push({ name: detailName, price: add, quantity: opQty, unit: op.unit, unitPrice, tier: opTier })
    })

    const subtotal = baseTotal + extrasTotal
    const urgentAmount = isUrgent ? Math.max(subtotal * urgentSurcharge / 100, 5000) : 0
    const total = subtotal + urgentAmount

    setCalculation({
      equipment: WIDE_FORMAT_GROUPS[effectiveGroup] || effectiveGroup,
      materialName: selectedMaterial.name,
      width: w,
      height: h,
      itemArea: itemArea.toFixed(2),
      factualArea: factualArea.toFixed(2),
      billableArea: billableArea.toFixed(2),
      quantity: qty,
      priceTier: tier.tier,
      pricePerSqM,
      baseTotal,
      extras,
      extrasTotal,
      isUrgent,
      urgentSurcharge,
      urgentAmount,
      subtotal,
      total
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation || calculation.note) {
      alert('Выберите клиента и сделайте расчет')
      return
    }

    setSavingOrder(true)
    try {
      const orderData = {
        client,
        category: 'wide-format',
        ...calculation,
        status: orderStatus,
        paymentStatus: 'not_paid'
      }

      await createOrder(orderData)
      alert('Заказ успешно сохранен!')
      setWidth('')
      setHeight('')
      setQuantity(1)
      setSelectedServices([])
      setServiceQuantities({})
      setSelectedServiceOptions({})
      setIsUrgent(false)
      setCalculation(null)
      setOrderStatus('draft')
    } catch (err) {
      alert('Ошибка сохранения заказа: ' + err.message)
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-2">Широкоформатная / интерьерная печать</h2>
        <p className="text-sm text-gray-500 mb-6">Минимальная расчетная площадь — 1 м². Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Тип печати / оборудование</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {availableGroups.map(group => (
                <button
                  key={group}
                  type="button"
                  onClick={() => { setSelectedGroup(group); setSelectedMaterialId(''); setSelectedServices([]); setServiceQuantities({}); setSelectedServiceOptions({}); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    effectiveGroup === group ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold">{WIDE_FORMAT_GROUPS[group] || group}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Материал</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {materialsForGroup.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => { setSelectedMaterialId(String(material.id)); setSelectedServices([]); setServiceQuantities({}); setSelectedServiceOptions({}); setCalculation(null) }}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    String(selectedMaterial?.id) === String(material.id)
                      ? 'bg-blue-50 border-blue-500'
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-gray-800">{material.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{formatPrices(material.prices, material.pricePerSqm)} тг/м²</div>
                  {material.description && <div className="text-xs text-gray-400 mt-1">{material.description}</div>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ширина (м)</label>
              <input type="number" step="0.01" value={width} onChange={(e) => setWidth(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="1.0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Высота (м)</label>
              <input type="number" step="0.01" value={height} onChange={(e) => setHeight(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="2.0" />
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Стандартные размеры:</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { w: 1, h: 2, label: '1×2' },
                { w: 2, h: 3, label: '2×3' },
                { w: 3, h: 2, label: '3×2' },
                { w: 3, h: 6, label: '3×6' },
              ].map((size) => (
                <button key={size.label} type="button" onClick={() => { setWidth(size.w.toString()); setHeight(size.h.toString()) }} className="px-4 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">
                  {size.label} м
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Количество (шт)</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)} min="1" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {availableOperations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Доп. операции</label>
              <div className="space-y-3">
                {availableOperations.map((op) => {
                  const isSelected = selectedServices.includes(op.id)
                  return (
                    <div key={op.id} className={`p-4 border-2 rounded-lg transition ${isSelected ? 'bg-green-50 border-green-500 shadow-md' : 'bg-white border-green-300'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedServices([...selectedServices, op.id])
                            } else {
                              setSelectedServices(selectedServices.filter(id => id !== op.id))
                              const newOptions = { ...selectedServiceOptions }
                              delete newOptions[op.id]
                              setSelectedServiceOptions(newOptions)
                              const newQty = { ...serviceQuantities }
                              delete newQty[op.id]
                              setServiceQuantities(newQty)
                            }
                            setCalculation(null)
                          }}
                          className="mt-1 w-5 h-5 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium block">{op.name}</span>
                            {isSelected && <span className="text-green-600 text-xl">✓</span>}
                          </div>
                          {op.description && <p className="text-xs text-gray-600 mb-2">{op.description}</p>}
                          <p className="text-sm text-gray-500">{formatPrices(op.prices, op.price)} тг/{getUnitLabel(op.unit)}</p>

                          {op.type === 'select' && isSelected && (
                            <div className="mt-3">
                              <select value={selectedServiceOptions[op.id] || ''} onChange={(e) => { setSelectedServiceOptions({ ...selectedServiceOptions, [op.id]: e.target.value }); setCalculation(null) }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                <option value="">Выберите опцию</option>
                                {(op.options || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name} — {opt.price} тг</option>)}
                              </select>
                            </div>
                          )}

                          {op.type === 'quantity' && isSelected && (
                                                      <div className="mt-3">
                                                        {op.stepMode ? (
                                                          <>
                                                            <label className="text-xs text-gray-600 mb-1 block">Шаг между люверсами ({op.stepUnit || 'см'}):</label>
                                                            <input type="number" min="0" step="0.1" value={serviceQuantities[op.id] || ''} onChange={(e) => { setServiceQuantities({ ...serviceQuantities, [op.id]: e.target.value }); setCalculation(null) }} className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="20" />
                                                            <p className="text-xs text-gray-400 mt-1">Кол-во люверсов рассчитается автоматически по периметру (2 × (Ш+В), при шаге {op.stepUnit || 'см'})</p>
                                                          </>
                                                        ) : (
                                                          <>
                                                            <label className="text-xs text-gray-600 mb-1 block">Количество ({getUnitLabel(op.unit)}):</label>
                                                            <input type="number" min="0" step="0.01" value={serviceQuantities[op.id] || ''} onChange={(e) => { setServiceQuantities({ ...serviceQuantities, [op.id]: e.target.value }); setCalculation(null) }} className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="0" />
                                                          </>
                                                        )}
                                                      </div>
                                                    )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
              <p className="text-gray-700">Материал: {calculation.materialName}, диапазон: {calculation.priceTier}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-600">Оборудование:</span><span className="font-semibold text-right">{calculation.equipment}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Материал:</span><span className="font-semibold text-right">{calculation.materialName}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Размер:</span><span className="font-semibold">{calculation.width} × {calculation.height} м</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Площадь 1 шт:</span><span className="font-semibold">{calculation.itemArea} м²</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Фактическая площадь:</span><span className="font-semibold">{calculation.factualArea} м²</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Расчетная площадь:</span><span className="font-semibold">{calculation.billableArea} м²</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Количество:</span><span className="font-semibold">{calculation.quantity} шт</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Диапазон цены:</span><span className="font-semibold">{calculation.priceTier}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Цена за м²:</span><span className="font-semibold">{calculation.pricePerSqM.toLocaleString('ru-RU')} тг</span></div>
              <div className="flex justify-between pt-2 border-t"><span className="text-gray-600">Печать:</span><span className="font-semibold">{calculation.baseTotal.toLocaleString('ru-RU')} тг</span></div>

              {(calculation.extras || []).map((ex) => (
                <div key={ex.name} className="flex justify-between">
                  <span className="text-gray-600">{ex.name}:</span>
                  <span>{Number(ex.price).toLocaleString('ru-RU')} тг</span>
                </div>
              ))}

              {calculation.isUrgent && (
                <div className="flex justify-between py-2 px-3 bg-red-50 rounded">
                  <span className="text-red-700 font-semibold">Срочность:</span>
                  <span className="font-bold text-red-600">+{calculation.urgentAmount.toLocaleString('ru-RU')} тг</span>
                </div>
              )}

              <div className="flex justify-between pt-3 border-t-2 border-gray-300">
                <span className="text-lg font-bold">Итого:</span>
                <span className="text-2xl font-bold text-blue-600">{calculation.total.toLocaleString('ru-RU')} тг</span>
              </div>
            </div>
          )}

          {!calculation.note && (
            <>
              <div className="mt-6 bg-gray-50 rounded-lg p-4 border-2 border-indigo-200">
                <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">📋 Статус заказа</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['draft', '📝 Черновик'],
                    ['in_progress', '⚙️ В процессе'],
                    ['approved', '✅ Утверждено']
                  ].map(([status, label]) => (
                    <button key={status} type="button" onClick={() => setOrderStatus(status)} className={`p-3 rounded-lg border-2 transition font-semibold text-center ${orderStatus === status ? 'bg-blue-500 text-white border-blue-600 shadow-lg' : 'bg-white border-blue-300 hover:border-blue-500 hover:bg-blue-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleSaveOrder} disabled={!client || savingOrder} className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold">
                {savingOrder ? '⏳ Сохранение...' : '💾 Сохранить заказ'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
