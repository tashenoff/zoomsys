import { useState } from 'react'
import pricingData from '../data/pricing.json'

export default function WideFormatCalculator({ client }) {
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [selectedMaterial, setSelectedMaterial] = useState(pricingData.wideFormat[0])
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft') // draft, in_progress, approved

  const handleCalculate = (e) => {
    e.preventDefault()

    const w = parseFloat(width)
    const h = parseFloat(height)
    const qty = parseInt(quantity)

    if (!w || !h || !qty || !selectedMaterial) {
      alert('Заполните все поля')
      return
    }

    const area = w * h
    const pricePerSqM = selectedMaterial.pricePerSqm
    const totalPerItem = area * pricePerSqM
    const total = totalPerItem * qty

    setCalculation({
      width: w,
      height: h,
      area: area.toFixed(2),
      quantity: qty,
      materialName: selectedMaterial.name,
      pricePerSqM,
      totalPerItem: totalPerItem.toFixed(2),
      total: total.toFixed(2)
    })
  }

  const handleSaveOrder = () => {
    if (!client || !calculation) {
      alert('Выберите клиента и сделайте расчет')
      return
    }

    // Сохраняем в localStorage
    const orders = JSON.parse(localStorage.getItem('orders') || '[]')
    const newOrder = {
      id: Date.now().toString(),
      orderNumber: `ORD-${Date.now()}`,
      client,
      ...calculation,
      status: orderStatus,
      createdAt: new Date().toISOString()
    }
    orders.push(newOrder)
    localStorage.setItem('orders', JSON.stringify(orders))

    alert('Заказ успешно сохранен!')
    setWidth('')
    setHeight('')
    setQuantity(1)
    setCalculation(null)
    setOrderStatus('draft')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6">Широкоформатная печать</h2>

        <form onSubmit={handleCalculate} className="space-y-6">
          {/* Материал */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Материал
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pricingData.wideFormat.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => setSelectedMaterial(material)}
                  className={`p-4 rounded-lg border-2 transition ${
                    selectedMaterial.id === material.id
                      ? 'bg-blue-50 border-blue-500'
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  {material.name} ({material.pricePerSqm} тг/м²)
                </button>
              ))}
            </div>
          </div>

          {/* Размеры */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ширина (м)
              </label>
              <input
                type="number"
                step="0.01"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="1.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Высота (м)
              </label>
              <input
                type="number"
                step="0.01"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="2.0"
              />
            </div>
          </div>

          {/* Быстрый выбор размеров */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Стандартные размеры:</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { w: 1, h: 2, label: '1×2' },
                { w: 2, h: 3, label: '2×3' },
                { w: 3, h: 2, label: '3×2' },
                { w: 3, h: 6, label: '3×6' },
              ].map((size) => (
                <button
                  key={size.label}
                  type="button"
                  onClick={() => {
                    setWidth(size.w.toString())
                    setHeight(size.h.toString())
                  }}
                  className="px-4 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                >
                  {size.label} м
                </button>
              ))}
            </div>
          </div>

          {/* Количество */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Количество (шт)
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Рассчитать
          </button>
        </form>
      </div>

      {/* Результат расчета */}
      {calculation && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Расчет</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Материал:</span>
              <span className="font-semibold">{calculation.materialName}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Размер:</span>
              <span className="font-semibold">
                {calculation.width} × {calculation.height} м
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Площадь:</span>
              <span className="font-semibold">{calculation.area} м²</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Количество:</span>
              <span className="font-semibold">{calculation.quantity} шт</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Цена за м²:</span>
              <span className="font-semibold">{calculation.pricePerSqM} тг</span>
            </div>

            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-600">Стоимость за 1 шт:</span>
              <span className="font-semibold">{calculation.totalPerItem} тг</span>
            </div>

            <div className="flex justify-between pt-3 border-t-2 border-gray-300">
              <span className="text-lg font-bold">Итого:</span>
              <span className="text-2xl font-bold text-blue-600">
                {calculation.total} тг
              </span>
            </div>
          </div>

          {/* Выбор статуса заказа */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border-2 border-indigo-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              📋 Статус заказа
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setOrderStatus('draft')}
                className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                  orderStatus === 'draft'
                    ? 'bg-gray-500 text-white border-gray-600 shadow-lg'
                    : 'bg-white border-gray-300 hover:border-gray-500 hover:bg-gray-50'
                }`}
              >
                📝 Черновик
              </button>
              <button
                type="button"
                onClick={() => setOrderStatus('in_progress')}
                className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                  orderStatus === 'in_progress'
                    ? 'bg-blue-500 text-white border-blue-600 shadow-lg'
                    : 'bg-white border-blue-300 hover:border-blue-500 hover:bg-blue-50'
                }`}
              >
                ⚙️ В процессе
              </button>
              <button
                type="button"
                onClick={() => setOrderStatus('approved')}
                className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                  orderStatus === 'approved'
                    ? 'bg-green-500 text-white border-green-600 shadow-lg'
                    : 'bg-white border-green-300 hover:border-green-500 hover:bg-green-50'
                }`}
              >
                ✅ Утверждено
              </button>
            </div>
          </div>

          <button
            onClick={handleSaveOrder}
            disabled={!client}
            className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            Сохранить заказ
          </button>
        </div>
      )}
    </div>
  )
}
