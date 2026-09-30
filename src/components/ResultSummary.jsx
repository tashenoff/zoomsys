import React from 'react'

/**
 * ResultSummary — переиспользуемый блок итогового расчёта (компактный стиль «Расчет»).
 *
 * Вмещает: заголовок, блок-предупреждение (по запросу цены), строки расчёта (children),
 * итог и кнопку сохранения. Поведение идентично тому блоку,
 * который раньше дублировался в 9 калькуляторах. Меняет только вёрстку — логика цен не тронута.
 *
 * Props:
 *  title            — заголовок блока (default 'Расчет')
 *  noteBody         — ReactNode; если задан — вместо строк/итога/подвала рендерится жёлтое предупреждение
 *  children         — строки расчёта (обычно CalcResultRow)
 *  total            — { label: 'Итого:', value: '… тг' } для финальной строки
 *  saveVariant      — 'gradient' | 'solid' (два стиля кнопки сохранения)
 *  saving / onSave / saveDisabled — кнопка сохранения
 */


const SAVE_BTN = {
  gradient:
    'w-full mt-6 bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg hover:from-green-600 hover:to-green-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg uppercase tracking-wide',
  solid:
    'w-full mt-4 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold',
}


export default function ResultSummary({
  title = 'Расчет',
  noteBody = null,
  children,
  total = null,

  saveVariant = 'gradient',
  saving = false,
  onSave,
  saveDisabled = false,
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
      <h3 className="text-xl font-bold mb-4">{title}</h3>

      {noteBody ? (
        <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 md:p-6 text-center">
          {noteBody}
        </div>
      ) : (
        <>
          <div className="space-y-3">{children}</div>
          {total && (
            <div className="flex justify-between pt-3 border-t-2 border-gray-300">
              <span className="text-lg font-bold">{total.label}</span>
              <span className="text-2xl font-bold text-blue-600">{total.value}</span>
            </div>
          )}
        </>
      )}

      {!noteBody && (
        <>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled || saving}
            className={SAVE_BTN[saveVariant]}
          >
            {saving ? '⏳ Сохранение...' : '💾 Сохранить заказ'}
          </button>
        </>
      )}
    </div>
  )
}