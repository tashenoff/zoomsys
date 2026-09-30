import { useEffect, useState } from 'react'
import { usePricing } from '../hooks/usePricing'
import pricingDataFallback from '../data/pricing.json'

/**
 * AdditionalServicesModal — переиспользуемая модалка выбора дополнительных услуг.
 *
 * Показывает дополнительные услуги (pricing.additionalServices), отфильтрованные
 * по применимости к категории калькулятора: применяются услуги с applicableTo,
 * содержащим категорию `category` ИЛИ 'all'.
 *
 * Props:
 *  open        — булево: открыта ли модалка
 *  onClose     — закрыть без изменений
 *  category    — идентификатор категории калькулятора (напр. 'wide-format', 'printing', …)
 *  selected    — массив id уже выбранных услуг
 *  onChange    — (ids: string[]) => void, вызывается при нажатии «Добавить»
 *  title       — заголовок модалки (default 'Доп услуги')
 */
export default function AdditionalServicesModal({
  open,
  onClose,
  category,
  selected = [],
  onChange,
  title = 'Доп услуги',
}) {
  const { pricing: pricingContext } = usePricing()
  const pricingData = pricingContext || pricingDataFallback

  const services = (Array.isArray(pricingData.additionalServices) ? pricingData.additionalServices : [])
    .filter((svc) => {
      const applicableTo = Array.isArray(svc.applicableTo)
        ? svc.applicableTo
        : (Array.isArray(svc.applicable_to) ? svc.applicable_to : ['all'])
      return applicableTo.includes('all') || (category && applicableTo.includes(category))
    })

  const [draft, setDraft] = useState([])

  useEffect(() => {
    if (open) setDraft(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const toggle = (id) => {
    setDraft(draft.includes(id) ? draft.filter((i) => i !== id) : [...draft, id])
  }

  const apply = () => {
    if (onChange) onChange(draft)
    if (onClose) onClose()
  }

  const priceLabel = (svc) =>
    svc.priceText ||
    (svc.price != null ? `${Number(svc.price).toLocaleString('ru-RU')} тг` : '')

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">Дополнительные услуги ({draft.length} выбрано)</p>
        </div>

        {services.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            Нет доступных дополнительных услуг для этой категории.
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {services.map((svc) => {
              const checked = draft.includes(svc.id)
              return (
                <label
                  key={svc.id}
                  className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${checked ? 'bg-green-50 border-green-500' : 'bg-white border-gray-300 hover:border-gray-400'}`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(svc.id)} className="mt-1 w-5 h-5" />
                  <div className="flex-1">
                    <div className="font-medium">{svc.name}</div>
                    {svc.category && <div className="text-xs text-gray-500">{svc.category}</div>}
                    {svc.description && <div className="text-xs text-gray-600">{svc.description}</div>}
                    <div className="text-sm text-gray-500">{priceLabel(svc)}</div>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={apply}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Добавить ({draft.length})
          </button>
        </div>
      </div>
    </div>
  )
}