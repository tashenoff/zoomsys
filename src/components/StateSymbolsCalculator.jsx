import { useEffect, useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

const OPTION_LABELS = {
  'coat-of-arms': 'Исполнение',
  'flags-rk': 'Размер',
  flagpoles: 'Модель',
  signs: 'Исполнение',
  stands: 'Размер',
  'president-portrait': 'Материал'
}

const GROUP_LABELS = {
  'coat-of-arms': 'Диаметр',
  'flags-rk': 'Тип',
  flagpoles: 'Тип',
  signs: 'Изделие',
  stands: 'Тип стенда',
  'president-portrait': 'Формат'
}

const VARIANT_LABELS = {
  'coat-of-arms': 'Диаметр',
  'flags-rk': 'Материал / вид',
  flagpoles: 'Модель',
  signs: 'Исполнение',
  stands: 'Размер',
  'president-portrait': 'Материал'
}

function parseItem(item, categorySlug) {
  if (categorySlug === 'coat-of-arms') {
    const m = item.name.match(/диаметр\s+(.+)$/i)
    return { group: 'Герб РК', variant: m ? `диаметр ${m[1]}` : item.name, option: item.option }
  }
  if (categorySlug === 'flags-rk') {
    const [left, right] = item.name.split(':').map(s => s.trim())
    return { group: left, variant: right || 'стандарт', option: item.option }
  }
  if (categorySlug === 'stands') {
    const group = item.name.includes('составной')
      ? 'Составной с объемными элементами'
      : 'Без объемных элементов'
    return { group, variant: item.option, option: item.option }
  }
  if (categorySlug === 'president-portrait') {
    const m = item.name.match(/А\d[^\)]*\)/)
    return { group: m ? m[0] : item.name, variant: item.option, option: item.option }
  }
  if (categorySlug === 'flagpoles') {
    if (item.name.includes('Настольный')) {
      return { group: 'Настольный флагшток', variant: item.name.replace(/^Настольный флагшток \(хром\)\s*/, ''), option: item.option }
    }
    if (item.name.includes('Напольный')) {
      return { group: 'Напольный флагшток', variant: item.name, option: item.option }
    }
    return { group: 'Аксессуары', variant: item.name, option: item.option }
  }
  if (categorySlug === 'signs') {
    return { group: 'Вывеска 600×800 мм', variant: item.name.replace(/^Вывеска 600800 мм,\s*/, ''), option: item.option }
  }
  return { group: item.name, variant: item.option, option: item.option }
}

export default function StateSymbolsCalculator({ client, categorySlug }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const items = useMemo(
    () => (pricingData.stateSymbols || []).filter(
      i => i.category === categorySlug && !i.name.includes('Объемный герб')
    ),
    [pricingData, categorySlug]
  )
  const additionalOperations = pricingData.additionalOperations || {}
  const additionalServices = pricingData.additionalServices || []
  const availableOperations = useMemo(() => {
    const seen = new Set()

    // Из доп. операций
    const fromOperations = additionalOperations && typeof additionalOperations === 'object'
      ? Object.values(additionalOperations).filter(op => {
          const applicableTo = Array.isArray(op?.applicableTo) ? op.applicableTo : []
          const matches = applicableTo.includes('state-symbols') || applicableTo.includes(categorySlug)
          if (!matches) return false
          const key = String(op.id || op.name)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      : []

    // Из доп. услуг (с applicableTo)
    const fromServices = Array.isArray(additionalServices)
      ? additionalServices.filter(svc => {
          const applicableTo = Array.isArray(svc?.applicableTo) ? svc.applicableTo : []
          const matches = applicableTo.includes('all') || applicableTo.includes('state-symbols') || applicableTo.includes(categorySlug)
          if (!matches) return false
          const key = String(svc.id || svc.name)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      : []

    return [...fromOperations, ...fromServices]
  }, [additionalOperations, additionalServices, categorySlug])
  const parsedItems = useMemo(
    () => items.map(i => ({ ...i, ...parseItem(i, categorySlug) })),
    [items, categorySlug]
  )
  const groups = useMemo(() => [...new Set(parsedItems.map(i => i.group))], [parsedItems])

  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [includeEmblem, setIncludeEmblem] = useState(false)
  const [selectedServices, setSelectedServices] = useState([])
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  const [savingOrder, setSavingOrder] = useState(false)

  useEffect(() => {
    setSelectedGroup(null)
    setSelectedVariant(null)
    setSelectedOption(null)
    setIncludeEmblem(false)
    setSelectedServices([])
    setCalculation(null)
    setQuantity(1)
  }, [categorySlug])

  const variantsForGroup = useMemo(
    () => [...new Set(parsedItems.filter(i => i.group === selectedGroup).map(i => i.variant))],
    [parsedItems, selectedGroup]
  )
  const optionsForVariant = useMemo(
    () => parsedItems.filter(i => i.group === selectedGroup && i.variant === selectedVariant),
    [parsedItems, selectedGroup, selectedVariant]
  )
  const selected = useMemo(
    () => optionsForVariant.find(i => i.option === selectedOption) || (optionsForVariant.length === 1 ? optionsForVariant[0] : null),
    [optionsForVariant, selectedOption]
  )
  const emblemExtra = (pricingData.stateSymbols || []).find(
    i => i.category === 'stands' && i.name.includes('Объемный герб')
  )
  const showEmblemExtra = categorySlug === 'stands' && selectedGroup?.includes('объемн')
  const groupLabel = GROUP_LABELS[categorySlug] || 'Тип'
  const variantLabel = VARIANT_LABELS[categorySlug] || 'Вариант'
  const optionLabel = OPTION_LABELS[categorySlug] || 'Опция'
  const showOptionStep = optionsForVariant.length > 1 && optionsForVariant.some(i => i.option !== i.variant)

  const pickGroup = (group) => {
    setSelectedGroup(group)
    setSelectedVariant(null)
    setSelectedOption(null)
    setIncludeEmblem(false)
    setCalculation(null)
    const vars = [...new Set(parsedItems.filter(i => i.group === group).map(i => i.variant))]
    if (vars.length === 1) {
      setSelectedVariant(vars[0])
      const opts = parsedItems.filter(i => i.group === group && i.variant === vars[0])
      if (opts.length === 1) setSelectedOption(opts[0].option)
    }
  }

  const pickVariant = (variant) => {
    setSelectedVariant(variant)
    setCalculation(null)
    const opts = parsedItems.filter(i => i.group === selectedGroup && i.variant === variant)
    setSelectedOption(opts.length === 1 ? opts[0].option : null)
  }

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selectedGroup) { alert(`Выберите: ${groupLabel.toLowerCase()}`); return }
    if (!selectedVariant) { alert(`Выберите: ${variantLabel.toLowerCase()}`); return }
    if (!selected) { alert(`Выберите: ${optionLabel.toLowerCase()}`); return }
    if (selected.price == null) { alert('Цена не указана в прайсе'); return }
    const qty = parseInt(quantity, 10) || 1
    const extra = showEmblemExtra && includeEmblem && emblemExtra?.price ? emblemExtra.price : 0
    let extrasTotal = extra
    const extras = extra ? [{ name: 'Объемный герб', price: extra }] : []
    selectedServices.forEach(id => {
      const op = availableOperations.find(o => o.id === id)
      if (!op) return
      const price = Number(op.price) || 0
      const add = op.unit === 'тг/шт' ? price * qty : price
      extrasTotal += add
      extras.push({ name: op.name, price: add })
    })
    const unit = selected.price
    setCalculation({ productName: selected.name, option: [selected.variant, selected.option].filter((v, i, a) => v && a.indexOf(v) === i).join(', '), quantity: qty, unitPrice: unit, extra: extrasTotal, extras, total: unit * qty + extrasTotal })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation) {
      alert('Выберите клиента и сделайте расчет')
      return
    }
    setSavingOrder(true)
    try {
      await createOrder({
        client,
        category: categorySlug,
        ...calculation,
        status: orderStatus,
        paymentStatus: 'not_paid'
      })
      alert('Заказ успешно сохранен!')
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
        <h2 className="text-2xl font-bold mb-2">Калькулятор</h2>
        <p className="text-sm text-gray-500 mb-6">Цены указаны без НДС</p>
        {items.length === 0 ? (
          <p className="text-gray-500">Позиции прайса не найдены</p>
        ) : (
          <form onSubmit={handleCalculate} className="space-y-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">1. {groupLabel}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groups.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => pickGroup(group)}
                    className={`p-4 rounded-lg border-2 text-left transition ${
                      selectedGroup === group ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-800">{group}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedGroup && variantsForGroup.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">2. {variantLabel}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {variantsForGroup.map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => pickVariant(variant)}
                      className={`p-4 rounded-lg border-2 text-left transition ${
                        selectedVariant === variant ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-medium text-gray-800">{variant}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showOptionStep && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">3. {optionLabel}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {optionsForVariant.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setSelectedOption(item.option); setCalculation(null) }}
                      className={`p-4 rounded-lg border-2 text-left transition ${
                        selectedOption === item.option ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-medium text-gray-800">{item.option}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {item.price == null ? 'цена по запросу' : `${item.price.toLocaleString('ru-RU')} тг`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showEmblemExtra && emblemExtra && selected && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includeEmblem} onChange={(e) => { setIncludeEmblem(e.target.checked); setCalculation(null) }} />
                <span>Добавить объемный герб (+{emblemExtra.price?.toLocaleString('ru-RU')} тг)</span>
              </label>
            )}

            {selected && availableOperations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Доп. операции</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableOperations.map((op) => (
                    <label key={op.id} className="flex items-center gap-2 p-3 border rounded-lg">
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(op.id)}
                        onChange={(e) => {
                          setSelectedServices(e.target.checked
                            ? [...selectedServices, op.id]
                            : selectedServices.filter(id => id !== op.id))
                        }}
                      />
                      <span>{op.name}{op.price ? ` (${op.price} ${op.unit || 'тг'})` : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selected && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Количество</label>
                <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-40 px-4 py-2 border border-gray-300 rounded-lg" />
              </div>
            )}

            {selected && (
              <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Рассчитать</button>
            )}
          </form>
        )}
      </div>
      {calculation && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Результат</h3>
          <div className="space-y-2 text-gray-700">
            <div>{calculation.productName}</div>
            <div className="flex justify-between"><span>{optionLabel}</span><span>{calculation.option}</span></div>
            <div className="flex justify-between"><span>Кол-во</span><span>{calculation.quantity}</span></div>
            {(calculation.extras || []).map((ex) => (
              <div key={ex.name} className="flex justify-between"><span>{ex.name}</span><span>+{ex.price.toLocaleString('ru-RU')} тг</span></div>
            ))}
            <div className="flex justify-between pt-3 border-t-2 border-blue-500 font-bold text-xl">
              <span>ИТОГО:</span>
              <span className="text-blue-600">{calculation.total.toLocaleString('ru-RU')} тг</span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {['draft', 'in_progress', 'approved'].map((s) => (
              <button key={s} type="button" onClick={() => setOrderStatus(s)} className={`p-3 rounded-lg border-2 ${orderStatus === s ? 'bg-blue-500 text-white border-blue-600' : 'border-gray-300'}`}>
                {s === 'draft' ? 'Черновик' : s === 'in_progress' ? 'В работе' : 'Согласован'}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleSaveOrder} disabled={savingOrder} className="mt-4 w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">
            {savingOrder ? 'Сохранение...' : 'Сохранить заказ'}
          </button>
        </div>
      )}
    </div>
  )
}
