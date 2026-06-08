import { useState, useEffect, useMemo, useRef } from 'react'
import pricingData from '../data/pricing.json'
import ClientSelector from './ClientSelector'

export default function BusinessCardsCalculator({ client: externalClient }) {
  const [pricing, setPricing] = useState(pricingData.businessCards)
  const [additionalServices, setAdditionalServices] = useState(pricingData.additionalServices)
  
  // Состояния для выбора клиента
  const [client, setClient] = useState(externalClient)
  
  // Состояния для фильтрации
  const [searchMaterial, setSearchMaterial] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [selectedColorType, setSelectedColorType] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  
  const [quantity, setQuantity] = useState(100)
  const [selectedServices, setSelectedServices] = useState([])
  const [isUrgent, setIsUrgent] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft') // draft, in_progress, approved

  const urgentSurcharge = pricingData.settings.urgentSurcharge

  // Refs для автоскролла
  const colorTypeRef = useRef(null)
  const quantityRef = useRef(null)
  const servicesRef = useRef(null)
  const calculationRef = useRef(null)

  // Обновляем клиента если приходит извне
  useEffect(() => {
    if (externalClient) {
      setClient(externalClient)
    }
  }, [externalClient])

  // Получаем уникальные материалы
  const uniqueMaterials = useMemo(() => {
    const materials = [...new Set(pricing.map(p => p.name))]
    return materials
  }, [pricing])

  // Фильтруем материалы по поисковому запросу
  const filteredMaterials = useMemo(() => {
    if (!searchMaterial) return uniqueMaterials
    return uniqueMaterials.filter(material => 
      material.toLowerCase().includes(searchMaterial.toLowerCase())
    )
  }, [uniqueMaterials, searchMaterial])

  // Получаем доступные цветности для выбранного материала
  const availableColorTypes = useMemo(() => {
    if (!selectedMaterial) return []
    return pricing
      .filter(p => p.name === selectedMaterial)
      .map(p => ({
        colorType: p.colorType,
        product: p
      }))
  }, [selectedMaterial, pricing])

  // При выборе материала сбрасываем цветность и скроллим к цветности
  useEffect(() => {
    setSelectedColorType(null)
    setSelectedProduct(null)
    
    // Автоскролл к секции цветности
    if (selectedMaterial && colorTypeRef.current) {
      setTimeout(() => {
        colorTypeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [selectedMaterial])

  // При выборе цветности устанавливаем продукт и скроллим к количеству
  useEffect(() => {
    if (selectedMaterial && selectedColorType) {
      const product = pricing.find(
        p => p.name === selectedMaterial && p.colorType === selectedColorType
      )
      setSelectedProduct(product)
      
      // Автоскролл к секции количества
      setTimeout(() => {
        quantityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    } else {
      setSelectedProduct(null)
    }
  }, [selectedMaterial, selectedColorType, pricing])

  useEffect(() => {
    if (selectedProduct && quantity) {
      calculatePrice()
    }
  }, [selectedProduct, quantity, selectedServices, isUrgent, discount])

  const getPriceForQuantity = (product, qty) => {
    if (qty < 50) return product.prices.upTo49
    if (qty < 100) return product.prices["50to99"]
    if (qty < 300) return product.prices["100to299"]
    if (qty < 500) return product.prices["300to499"]
    return product.prices.from500 || product.prices["300to499"]
  }

  const calculatePrice = () => {
    if (!selectedProduct) return

    const unitPrice = getPriceForQuantity(selectedProduct, quantity)
    const baseTotal = unitPrice * quantity

    let servicesTotal = 0
    let servicesDetails = []

    selectedServices.forEach(serviceId => {
      const service = additionalServices.find(s => s.id === serviceId)
      if (service) {
        // Если услуга за штуку (тг/шт), умножаем на количество
        // Если фиксированная цена (тг), не умножаем
        const servicePrice = service.unit === 'тг/шт' 
          ? service.price * quantity 
          : service.price
        servicesTotal += servicePrice
        servicesDetails.push({
          name: service.name,
          price: servicePrice
        })
      }
    })

    let subtotal = baseTotal + servicesTotal

    // Применяем надбавку за срочность
    const urgentAmount = isUrgent ? (subtotal * urgentSurcharge / 100) : 0
    const totalAfterUrgent = subtotal + urgentAmount

    // Применяем скидку
    const discountAmount = totalAfterUrgent * (discount / 100)
    const total = totalAfterUrgent - discountAmount

    setCalculation({
      productName: selectedProduct.name,
      colorType: selectedProduct.colorType,
      quantity,
      unitPrice,
      baseTotal,
      servicesDetails,
      servicesTotal,
      subtotal,
      isUrgent,
      urgentSurcharge: urgentSurcharge,
      urgentAmount,
      discount,
      discountAmount,
      notes,
      total
    })
  }

  const handleSaveOrder = () => {
    if (!client || !calculation) {
      alert('Выберите клиента и сделайте расчет')
      return
    }

    // Сохраняем заказ в localStorage
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
    // Сброс формы
    setSearchMaterial('')
    setSelectedMaterial(null)
    setSelectedColorType(null)
    setSelectedProduct(null)
    setQuantity(100)
    setSelectedServices([])
    setIsUrgent(false)
    setDiscount(0)
    setNotes('')
    setCalculation(null)
    setOrderStatus('draft')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Расчет визиток</h2>

        {/* СЕКЦИЯ 1: Выбор материала с поиском */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
            📄 Материал (Тип бумаги)
          </label>
          
          {/* Поле поиска */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="🔍 Поиск материала..."
              value={searchMaterial}
              onChange={(e) => setSearchMaterial(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          {/* Список материалов */}
          <div className="space-y-2 max-h-64 overflow-y-auto bg-white rounded-lg border border-gray-200 p-2">
            {filteredMaterials.length > 0 ? (
              filteredMaterials.map((material) => (
                <button
                  key={material}
                  onClick={() => {
                    setSelectedMaterial(material)
                    setSearchMaterial('')
                  }}
                  className={`w-full text-left p-3 rounded-lg border-2 transition font-medium ${
                    selectedMaterial === material
                      ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                      : 'bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{material}</span>
                    {selectedMaterial === material && (
                      <span className="text-lg">✓</span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                Материал не найден
              </div>
            )}
          </div>

          {selectedMaterial && (
            <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
              <span className="text-sm font-semibold text-green-800">
                ✓ Выбрано: {selectedMaterial}
              </span>
            </div>
          )}
        </div>

        {/* СЕКЦИЯ 2: Выбор цветности */}
        {selectedMaterial && availableColorTypes.length > 0 && (
          <div ref={colorTypeRef} className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              🎨 Цветность
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {availableColorTypes.map(({ colorType, product }) => (
                <button
                  key={colorType}
                  onClick={() => setSelectedColorType(colorType)}
                  className={`p-4 rounded-lg border-2 transition font-bold text-center ${
                    selectedColorType === colorType
                      ? 'bg-purple-500 text-white border-purple-600 shadow-lg transform scale-105'
                      : 'bg-white border-purple-300 hover:border-purple-500 hover:bg-purple-50'
                  }`}
                >
                  <div className="text-xl mb-1">{colorType}</div>
                  <div className="text-xs opacity-80">
                    от {product.prices.upTo49} тг
                  </div>
                </button>
              ))}
            </div>

            {selectedColorType && (
              <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
                <span className="text-sm font-semibold text-green-800">
                  ✓ Выбрана цветность: {selectedColorType}
                </span>
              </div>
            )}
          </div>
        )}

        {/* СЕКЦИЯ 3: Количество */}
        {selectedProduct && (
          <div ref={quantityRef} className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              🔢 Количество (шт)
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min="1"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-lg font-semibold mb-3"
            />
            <div className="flex gap-2 flex-wrap">
              {[50, 100, 200, 300, 500, 1000].map(qty => (
                <button
                  key={qty}
                  onClick={() => setQuantity(qty)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    quantity === qty
                      ? 'bg-yellow-500 text-white shadow-md'
                      : 'bg-white border-2 border-yellow-300 hover:bg-yellow-100'
                  }`}
                >
                  {qty}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* СЕКЦИЯ 4: Дополнительные услуги */}
        {selectedProduct && additionalServices.length > 0 && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              ⭐ Дополнительные услуги
            </label>
            <div className="space-y-2">
              {additionalServices.map((service) => (
                <label 
                  key={service.id} 
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                    selectedServices.includes(service.id)
                      ? 'bg-green-100 border-green-500'
                      : 'bg-white border-green-300 hover:bg-green-50 hover:border-green-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(service.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedServices([...selectedServices, service.id])
                      } else {
                        setSelectedServices(selectedServices.filter(id => id !== service.id))
                      }
                    }}
                    className="mr-3 w-5 h-5"
                  />
                  <span className="flex-1 font-medium">{service.name}</span>
                  <span className="font-bold text-green-700">
                    {service.price} {service.unit}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* СЕКЦИЯ 5: Срочность, скидка и примечания */}
        {selectedProduct && (
          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              ⚙️ Дополнительные опции
            </label>
            
            {/* Срочность */}
            <label className="flex items-center p-4 bg-white border-2 rounded-lg cursor-pointer mb-3 hover:bg-red-50 transition">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="mr-3 w-5 h-5"
              />
              <span className="flex-1 font-medium text-red-700">
                🔥 Срочный заказ (+{urgentSurcharge}%)
              </span>
            </label>

            {/* Скидка */}
            <div className="bg-white border-2 border-orange-300 rounded-lg p-4 mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Скидка (%)
              </label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="0"
              />
            </div>

            {/* Примечания */}
            <div className="bg-white border-2 border-orange-300 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Примечания к заказу
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="3"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Дополнительная информация о заказе..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Результат расчета */}
      {calculation && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-lg p-6 border-2 border-blue-200">
          <h3 className="text-2xl font-bold mb-4 text-gray-800 flex items-center">
            <span className="text-3xl mr-2">📊</span>
            Итоговый расчет
          </h3>
          
          <div className="space-y-3 bg-white rounded-lg p-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600 font-medium">Материал:</span>
              <span className="font-bold text-gray-800">
                {calculation.productName}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600 font-medium">Цветность:</span>
              <span className="font-bold text-purple-600 text-lg">
                {calculation.colorType}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600 font-medium">Количество:</span>
              <span className="font-bold text-gray-800">{calculation.quantity} шт</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600 font-medium">Цена за единицу:</span>
              <span className="font-bold text-gray-800">{calculation.unitPrice} тг</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b-2 border-gray-300">
              <span className="text-gray-700 font-semibold">Базовая стоимость:</span>
              <span className="font-bold text-lg text-blue-600">
                {calculation.baseTotal.toFixed(2)} тг
              </span>
            </div>

            {calculation.servicesDetails.length > 0 && (
              <>
                <div className="text-sm font-bold text-gray-700 mt-4 mb-2 uppercase">
                  Дополнительные услуги:
                </div>
                {calculation.servicesDetails.map((service, idx) => (
                  <div key={idx} className="flex justify-between items-center pl-4 py-2">
                    <span className="text-gray-600">{service.name}:</span>
                    <span className="font-semibold text-green-600">
                      {service.price.toFixed(2)} тг
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Срочность */}
            {calculation.isUrgent && (
              <div className="flex justify-between items-center py-3 bg-red-50 px-4 rounded">
                <span className="text-red-700 font-semibold">
                  🔥 Срочный заказ (+{calculation.urgentSurcharge}%):
                </span>
                <span className="font-bold text-red-600">
                  +{calculation.urgentAmount.toFixed(2)} тг
                </span>
              </div>
            )}

            {/* Скидка */}
            {calculation.discount > 0 && (
              <div className="flex justify-between items-center py-3 bg-green-50 px-4 rounded">
                <span className="text-green-700 font-semibold">
                  💰 Скидка ({calculation.discount}%):
                </span>
                <span className="font-bold text-green-600">
                  -{calculation.discountAmount.toFixed(2)} тг
                </span>
              </div>
            )}

            {/* Примечания */}
            {calculation.notes && (
              <div className="py-3 px-4 bg-yellow-50 rounded border-l-4 border-yellow-400">
                <p className="text-sm font-semibold text-yellow-800 mb-1">📝 Примечания:</p>
                <p className="text-sm text-gray-700">{calculation.notes}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 mt-4 border-t-4 border-blue-500">
              <span className="text-xl font-bold text-gray-800">ИТОГО:</span>
              <span className="text-3xl font-bold text-blue-600">
                {calculation.total.toFixed(2)} тг
              </span>
            </div>
          </div>

          {/* СЕКЦИЯ 5: Выбор клиента и статуса перед сохранением */}
          <div className="mt-6">
            <ClientSelector
              selectedClient={client}
              onSelectClient={setClient}
            />
          </div>

          {/* Выбор статуса заказа */}
          <div className="mt-4 bg-white rounded-lg p-4 border-2 border-indigo-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              📋 Статус заказа
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
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
            className="w-full mt-6 bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg hover:from-green-600 hover:to-green-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg uppercase tracking-wide"
          >
            💾 Сохранить заказ
          </button>

          {!client && (
            <p className="text-center text-sm text-red-600 mt-2 font-medium">
              ⚠️ Для сохранения заказа выберите клиента
            </p>
          )}
        </div>
      )}
    </div>
  )
}
