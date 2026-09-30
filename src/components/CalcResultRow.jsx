import React from 'react'

/**
 * CalcResultRow — универсальная строка «Label: значение» для блока итогового расчёта.
 *
 * Покрывает все варианты вёрстки, встречающиеся в калькуляторах:
 *  - простая строка            flex justify-between
 *  - длинный текст             items-start + flex-1 min-w-0 break-words text-right (перенос значения)
 *  - мобильный б/м              flex-col md:flex-row
 *  - подзаголовочная            pt-2 border-t
 *  - выделенная (срочность/мин) py-2 px-3 bg-red-50 / bg-amber-50
 *
 * Меняет только разметку/структуру JSX — никакой логики цен.
 */

const HIGHLIGHTS = {
  red: {
    row: 'py-2 px-3 bg-red-50 rounded',
    label: 'text-red-700 font-semibold',
    value: 'font-bold text-red-600',
  },
  amber: {
    row: 'py-2 px-3 bg-amber-50 rounded',
    label: 'text-amber-700 font-semibold',
    value: 'font-bold text-amber-700',
  },
}

export default function CalcResultRow({
  label,
  value,
  wrap = false,             // длинный текст: перенос значения, label не сжимается
  reverseOnMobile = false,  // flex-col md:flex-row (устаревший вариант переноса)
  subtotal = false,         // pt-2 border-t — строка-подзаголовок суммы
  highlight = null,         // 'red' | 'amber' — фоновая выделенная строка
  bold = true,              // жирное значение (для строк-подписей услуг — false)
  labelClassName,
  valueClassName,
  rowClassName,
}) {
  const h = HIGHLIGHTS[highlight]

  // База строки
  let rowBase
  if (h) rowBase = `flex justify-between ${h.row}`
  else if (wrap) rowBase = 'flex items-start justify-between gap-2'
  else if (reverseOnMobile) rowBase = 'flex flex-col md:flex-row md:justify-between md:items-center gap-1'
  else rowBase = 'flex justify-between'

  const rowParts = [rowBase]
  if (subtotal) rowParts.push('pt-2 border-t')
  if (rowClassName) rowParts.push(rowClassName)

  const labelCls = [
    h ? h.label : 'text-gray-600',
    wrap ? 'shrink-0' : '',
    labelClassName || '',
  ].filter(Boolean).join(' ')

  const valueCls = [
    h ? h.value : (bold === false ? '' : 'font-semibold'),
    wrap ? 'flex-1 min-w-0 break-words text-right' : (reverseOnMobile ? 'text-right break-words' : ''),
    valueClassName || '',
  ].filter(Boolean).join(' ')

  return (
    <div className={rowParts.join(' ')}>
      <span className={labelCls}>{label}</span>
      <span className={valueCls || undefined}>{value}</span>
    </div>
  )
}