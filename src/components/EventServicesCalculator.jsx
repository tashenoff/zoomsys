import { useState } from 'react'

const EVENT_SERVICES = [
  { id: 1, name: 'Аренда конструкций (высота до 3 м)', unit: 'кв.м', price: 4500 },
  { id: 2, name: 'Аренда конструкций (от 3 - 5 м)', unit: 'кв.м', price: 7000 },
  { id: 3, name: 'Аренда конструкций (свыше 5 м)', unit: 'кв.м', price: 10000 },
  { id: 4, name: 'Аренда выставочных панелей (1 * 2,3 м)', unit: 'шт.', price: 10000 },
  { id: 5, name: 'Подсветка выставочных панелей', unit: 'шт.', price: 20000 },
  { id: 6, name: 'Аренда тумбочек световых', unit: 'шт.', price: 25000 },
  { id: 7, name: 'Аренда столбов световых (указатели)', unit: 'шт.', price: 25000 },
  { id: 8, name: 'Аренда кресел', unit: 'шт.', price: 25000 },
  { id: 9, name: 'Аренда трибуны для спикера', unit: 'шт.', price: 40000 },
  { id: 10, name: 'Аренда Roll Up (без печати)', unit: 'шт.', price: 12000 },
  { id: 11, name: 'Аренда телескопических стоек', unit: 'шт.', price: 15000 },
]

export default function EventServicesCalculator({ client }) {
  const [selectedService, setSelectedService] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [days, setDays] = useState(1)
  const [calculation, setCalculation] = useState(null)

  const handleCalculate = (e) => {
    e.preventDefault()
    if (!selectedService) return

    const service = EVENT_SERVICES.find(s => s.id === parseInt(selectedService))
    if (!service) return

    const total = service.price * quantity * days

    setCalculation({
      serviceName: service.name,
      unit: service.unit,
      pricePerUnit: service.price,
      quantity,
      days,
      total
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6">Калькулятор</h2>

        <form onSubmit={handleCalculate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите услугу
            </label>
            <select
              value={selectedService}
              onChange={(e) => { setSelectedService(e.target.value); setCalculation(null) }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Выберите услугу --</option>
              {EVENT_SERVICES.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} — {service.price.toLocaleString('ru-RU')} тг/{service.unit}
                </option>
              ))}
            </select>
          </div>

          {selectedService && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Количество ({EVENT_SERVICES.find(s => s.id === parseInt(selectedService))?.unit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => { setQuantity(parseInt(e.target.value) || 1); setCalculation(null) }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Дней аренды
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={days}
                    onChange={(e) => { setDays(parseInt(e.target.value) || 1); setCalculation(null) }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Рассчитать
              </button>
            </>
          )}
        </form>
      </div>

      {calculation && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Результат расчёта</h3>
          <div className="space-y-3 text-gray-700">
            <div className="flex justify-between">
              <span>Услуга:</span>
              <span className="font-medium">{calculation.serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span>Цена за {calculation.unit}:</span>
              <span>{calculation.pricePerUnit.toLocaleString('ru-RU')} тг</span>
            </div>
            <div className="flex justify-between">
              <span>Количество:</span>
              <span>{calculation.quantity} {calculation.unit}</span>
            </div>
            <div className="flex justify-between">
              <span>Дней аренды:</span>
              <span>{calculation.days}</span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-blue-500 font-bold text-xl">
              <span>ИТОГО:</span>
              <span className="text-blue-600">{calculation.total.toLocaleString('ru-RU')} тг</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
