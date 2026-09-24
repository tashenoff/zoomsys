import { useEffect, useMemo, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'

const SPECIALIST_LABELS = {
  mount: 'Монтаж и выезд',
  work: 'Работа специалистов',
  transport: 'Транспорт',
  agp: 'АГП'
}

export default function SpecialistsCalculator({ client, initialGroup }) {
  const { pricing: pricingContext } = usePricing()
  const { createOrder } = useOrders()
  const pricingData = pricingContext || pricingDataFallback
  const allItems = pricingData.eventServices || []
  const specialistsItems = allItems.filter(i => i.category === 'specialists')
  const items = initialGroup
    ? specialistsItems.filter(i => (i.subtype || '') === initialGroup)
    : specialistsItems
  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

  const [selectedId, setSelectedId] = useState('')
    const [hours, setHours] = useState(1)
    const [bannerCount, setBannerCount] = useState(1)
    const [banners, setBanners] = useState(() => [{ width: '', height: '' }])
    const [isUrgent, setIsUrgent] = useState(false)
    const [calculation, setCalculation] = useState(null)
    const [orderStatus, setOrderStatus] = useState('draft')
    const [savingOrder, setSavingOrder] = useState(false)

    const selected = useMemo(() => items.find(i => String(i.id) === String(selectedId)) || items[0] || null, [items, selectedId])
    const isArea = !!selected && selected.unit === 'м²'

    // При смене количества баннеров — расширяем/сужаем список строк с размерами.
    useEffect(() => {
      if (!isArea) return
      const n = Math.max(1, parseInt(bannerCount, 10) || 1)
      setBanners((cur) => {
        const arr = Array.from({ length: n }, (_, i) => cur[i] ? { ...cur[i] } : { width: '', height: '' })
        return arr
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isArea, bannerCount])

    const priceLabel = (item) => {
      if (item.priceText) return item.priceText
      if (item.price != null) return `${Number(item.price).toLocaleString('ru-RU')} тг/${item.unit || 'час'}`
      return 'по запросу'
    }

    const handleCalculate = (e) => {
      e.preventDefault()
      if (!selected) { alert('Выберите услугу'); return }
      if (selected.priceText || selected.price == null) {
        setCalculation({ note: `Цена: ${selected.priceText || 'по запросу'}. Итог зависит от объёма — уточните у менеджера.`, label: selected.name })
        return
      }

      const unitPrice = Number(selected.price)
      let qtyLabel
      let baseTotal
      if (isArea) {
        // Несколько баннеров, у каждого свои размеры Ш×В (м) — суммарная площадь.
        const count = Math.max(1, parseInt(bannerCount, 10) || 1)
        let totalArea = 0
        const rows = []
        for (let i = 0; i < count; i++) {
          const b = banners[i] || { width: '', height: '' }
          const w = parseFloat(b.width) || 0
          const h = parseFloat(b.height) || 0
          if (w <= 0 || h <= 0) { alert(`Укажите ширину и высоту для баннера №${i + 1}`); return }
          const area = w * h
          totalArea += area
          rows.push({ idx: i + 1, w, h, area })
        }
        qtyLabel = `${rows.length} банер(ов), ${totalArea.toLocaleString('ru-RU')} м²`
        baseTotal = unitPrice * totalArea
        const urgentAmountA = isUrgent ? Math.max(baseTotal * urgentSurcharge / 100, 5000) : 0
        setCalculation({
          label: selected.name, unit: 'м²', bannerRows: rows, totalArea, qtyLabel,
          unitPrice, baseTotal, isUrgent, urgentSurcharge, urgentAmount: urgentAmountA, total: baseTotal + urgentAmountA, note: null
        })
        return
      } else {
        const h = parseFloat(hours) || 0
        if (h <= 0) { alert('Введите часы'); return }
        qtyLabel = `${h} ч${selected.minHours ? ` (мин. ${selected.minHours} ч)` : ''}`
        baseTotal = unitPrice * h
        if (selected.minHours) baseTotal = Math.max(baseTotal, unitPrice * selected.minHours)
      }
      const urgentAmount = isUrgent ? Math.max(baseTotal * urgentSurcharge / 100, 5000) : 0
      const total = baseTotal + urgentAmount

      setCalculation({
      label: selected.name, unit: selected.unit || 'час', qtyLabel, unitPrice,
      baseTotal, isUrgent, urgentSurcharge, urgentAmount, total, note: null
    })
  }

  const handleSaveOrder = async () => {
    if (!client || !calculation || calculation.note) { alert('Выберите клиента и сделайте расчет'); return }
    setSavingOrder(true)
    try {
      await createOrder({ client, category: 'event-services', type: 'specialists', ...calculation, status: orderStatus, paymentStatus: 'not_paid' })
      alert('Заказ успешно сохранен!')
      setCalculation(null); setIsUrgent(false); setOrderStatus('draft')
    } catch (err) { alert('Ошибка сохранения заказа: ' + err.message) }
    finally { setSavingOrder(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-2">{initialGroup ? (SPECIALIST_LABELS[initialGroup] || initialGroup) : 'Работа специалистов и техники'}</h2>
        <p className="text-sm text-gray-500 mb-4 md:mb-6">Монтаж, выезд, работа монтажников/электриков, транспорт, АГП. Срочность: +{urgentSurcharge}%, но не менее 5 000 тг.</p>

        <form onSubmit={handleCalculate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Услуга</label>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {items.map(item => {
                const isSel = String(item.id) === String(selected?.id)
                return (
                  <button key={item.id} type="button" onClick={() => { setSelectedId(String(item.id)); setCalculation(null) }}
                    className={`w-full text-left p-3 border-2 rounded-lg transition ${isSel ? 'bg-blue-50 border-blue-500' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="font-medium text-gray-800">{item.name}</div>
                    <div className="text-xs text-gray-500">{priceLabel(item)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {isArea && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Количество баннеров</label>
                <input type="number" min="1" value={bannerCount} onChange={(e) => setBannerCount(parseInt(e.target.value, 10) || 1)} className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Размеры баннеров (м)</label>
                <div className="space-y-3">
                  {banners.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                      <span className="text-xs text-gray-500 w-6">№{idx + 1}</span>
                      <input type="number" min="0" step="0.1" placeholder="Ширина, м" value={b.width}
                        onChange={(e) => setBanners(cur => cur.map((x, i) => i === idx ? { ...x, width: e.target.value } : x))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      <span className="text-gray-400">×</span>
                      <input type="number" min="0" step="0.1" placeholder="Высота, м" value={b.height}
                        onChange={(e) => setBanners(cur => cur.map((x, i) => i === idx ? { ...x, height: e.target.value } : x))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      {bannerCount > 1 && (
                        <button type="button" onClick={() => setBannerCount(Math.max(1, bannerCount - 1))} className="w-8 h-8 rounded-full border border-red-300 text-red-500 hover:bg-red-50">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {!isArea && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Часы</label>
              <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} required className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {!isArea && selected?.minHours && (
            <p className="text-xs text-gray-500">Минимальное время: {selected.minHours} ч — именно эта сумма будет базовая.</p>
          )}

          <label className="flex items-center p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition">
            <input type="checkbox" checked={isUrgent} onChange={(e) => { setIsUrgent(e.target.checked); setCalculation(null) }} className="mr-3 w-5 h-5" />
            <span className="flex-1 font-medium text-red-700">🔥 Срочный заказ (+{urgentSurcharge}%, минимум 5 000 тг)</span>
          </label>

          <button type="submit" disabled={!selected} className={`w-full py-3 rounded-lg transition font-semibold ${selected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>Рассчитать</button>
        </form>
      </div>

      {calculation && (
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <h3 className="text-xl font-bold mb-4">Расчет</h3>
          {calculation.note ? (
            <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3 md:p-4 text-center">
              <p className="text-xl font-bold text-yellow-800 mb-2">⚠️ {calculation.note}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-1"><span className="text-gray-600">Услуга:</span><span className="font-semibold text-right break-words">{calculation.label}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Объём:</span><span className="font-semibold">{calculation.qtyLabel}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Цена:</span><span className="font-semibold">{calculation.unitPrice.toLocaleString('ru-RU')} тг/{calculation.unit}</span></div>
              {calculation.bannerRows && calculation.bannerRows.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Баннеры:</div>
                  {calculation.bannerRows.map(r => (
                    <div key={r.idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">№{r.idx}:</span>
                      <span>{r.w} × {r.h} м = {Number(r.area).toLocaleString('ru-RU')} м²</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-600">Итого площадь:</span><span className="font-semibold">{Number(calculation.totalArea).toLocaleString('ru-RU')} м²</span></div>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t"><span className="text-gray-600">Работа специалиста:</span><span className="font-semibold">{calculation.baseTotal.toLocaleString('ru-RU')} тг</span></div>
              {calculation.isUrgent && (
                <div className="flex justify-between py-2 px-3 bg-red-50 rounded"><span className="text-red-700 font-semibold">Срочность:</span><span className="font-bold text-red-600">+{calculation.urgentAmount.toLocaleString('ru-RU')} тг</span></div>
              )}
              <div className="flex justify-between pt-3 border-t-2 border-gray-300"><span className="text-lg font-bold">Итого:</span><span className="text-2xl font-bold text-blue-600">{calculation.total.toLocaleString('ru-RU')} тг</span></div>
            </div>
          )}

          {!calculation.note && (
            <>
              <div className="mt-6 bg-gray-50 rounded-lg p-3 md:p-4 border-2 border-indigo-200">
                <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">📋 Статус заказа</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[['draft','📝 Черновик'],['in_progress','⚙️ В процессе'],['approved','✅ Утверждено']].map(([status,label]) => (
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