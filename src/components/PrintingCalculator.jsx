import { useState, useEffect, useMemo, useRef } from 'react'
import pricingData from '../data/pricing.json'
import ClientSelector from './ClientSelector'

export default function PrintingCalculator({ client: externalClient }) {
  const [pricing, setPricing] = useState(pricingData.printing || [])
  
  // Состояния для выбора клиента
  const [client, setClient] = useState(externalClient)
  
  // Состояния для фильтрации
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchProduct, setSearchProduct] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedColorType, setSelectedColorType] = useState(null)
  
  const [quantity, setQuantity] = useState(100)
  const [isUrgent, setIsUrgent] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')

  const urgentSurcharge = pricingData.settings.urgentSurcharge

  // Refs для автоскролла
  const productsRef = useRef(null)
  const colorTypeRef = useRef(null)
  const quantityRef = useRef(null)

  // Обновляем клиента если приходит извне
  useEffect(() => {
    if (externalClient) {
      setClient(externalClient)
    }
  }, [externalClient])

  // Получаем уникальные категории
  const categories = useMemo(() => {
    const categoryMap = {
      'flyers': { name: 'Флаера, Листовки, Афиши', icon: '📄' },
      'booklets': { name: 'Буклеты', icon: '📒' },
      'certificates': { name: 'Дипломы, Грамоты, Сертификаты, Пригласительные', icon: '🎓' },
      'notebooks': { name: 'Дипломы, Грамоты, Пригласительные', icon: '📔' }
    }
    
    const uniqueCategories = [...new Set(pricing.map(p => p.category))]
    return uniqueCategories.map(cat => ({
      id: cat,
      ...categoryMap[cat]
    }))
  }, [pricing])

  // Фильтруем продукты по категории
  const filteredByCategory = useMemo(() => {
    if (!selectedCategory) return []
    return pricing.filter(p => p.category === selectedCategory)
  }, [selectedCategory, pricing])

  // Фильтруем продукты по поисковому запросу
  const filteredProducts = useMemo(() => {
    if (!searchProduct) return filteredByCategory
    return filteredByCategory.filter(product => 
      product.name.toLowerCase().includes(searchProduct.toLowerCase())
    )
  }, [filteredByCategory, searchProduct])

  // Получаем доступные цветности для выбранного продукта
  const availableColorTypes = useMemo(() => {
    if (!selectedProduct || !selectedProduct.colorTypes) return []
    return selectedProduct.colorTypes
  }, [selectedProduct])

  // При выборе категории сбрасываем выбор продукта
  useEffect(() => {
    setSelectedProduct(null)
    setSelectedColorType(null)
    setSearchProduct('')
    
    if (selectedCategory && productsRef.current) {
      setTimeout(() => {
        productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [selectedCategory])

  // При выборе продукта проверяем нужна ли цветность
  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.colorTypes && selectedProduct.colorTypes.length > 0) {
        setSelectedColorType(null)
        setTimeout(() => {
          colorTypeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      } else {
        // Если у продукта нет colorTypes, сразу переходим к количеству
        setTimeout(() => {
          quantityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
  }, [selectedProduct])

  // При выборе цветности скроллим к количеству
  useEffect(() => {
    if (selectedColorType) {
      setTimeout(() => {
        quantityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [selectedColorType])

  // Пересчитываем при изменении параметров
  useEffect(() => {
    if (selectedProduct && quantity) {
      // Если есть colorTypes, ждем выбора цветности
      if (selectedProduct.colorTypes && !selectedColorType) return
      calculatePrice()
    }
  }, [selectedProduct, selectedColorType, quantity, isUrgent, discount])

  const getPriceForQuantity = (pricesObj, qty) => {
    if (!pricesObj) return 0
    
    // Если есть default цена (например, для фольгирования)
    if (pricesObj.default !== undefined) {
      return pricesObj.default
    }

    // Находим подходящий тираж
    const quantities = Object.keys(pricesObj).map(Number).sort((a, b) => a - b)
    
    // Если количество меньше минимального тиража
    if (qty < quantities[0]) {
      return pricesObj[quantities[0]]
    }
    
    // Находим ближайший меньший или равный тираж
    let selectedQty = quantities[0]
    for (let q of quantities) {
      if (qty >= q) {
        selectedQty = q
      } else {
        break
      }
    }
    
    return pricesObj[selectedQty]
  }

  const calculatePrice = () => {
    if (!selectedProduct) return

    let unitPrice = 0

    // Если у продукта есть colorTypes
    if (selectedProduct.colorTypes && selectedColorType) {
      const colorTypeData = selectedProduct.colorTypes.find(ct => ct.type === selectedColorType)
      if (colorTypeData) {
        unitPrice = getPriceForQuantity(colorTypeData.prices, quantity)
      }
    } 
    // Если у продукта просто prices
    else if (selectedProduct.prices) {
      unitPrice = getPriceForQuantity(selectedProduct.prices, quantity)
    }

    const baseTotal = unitPrice * quantity

    let subtotal = baseTotal

    // Применяем надбавку за срочность
    const urgentAmount = isUrgent ? (subtotal * urgentSurcharge / 100) : 0
    const totalAfterUrgent = subtotal + urgentAmount

    // Применяем скидку
    const discountAmount = totalAfterUrgent * (discount / 100)
    const total = totalAfterUrgent - discountAmount

    setCalculation({
      productName: selectedProduct.name,
      format: selectedProduct.format,
      colorType: selectedColorType,
      quantity,
      unitPrice,
      baseTotal,
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

    const orders = JSON.parse(localStorage.getItem('orders') || '[]')
    const newOrder = {
      id: Date.now().toString(),
      orderNumber: `ORD-${Date.now()}`,
      client,
      type: 'printing',
      ...calculation,
      status: orderStatus,
      createdAt: new Date().toISOString()
    }
    orders.push(newOrder)
    localStorage.setItem('orders', JSON.stringify(orders))

    alert('Заказ успешно сохранен!')
    
    // Сброс формы
    setSelectedCategory(null)
    setSearchProduct('')
    setSelectedProduct(null)
    setSelectedColorType(null)
    setQuantity(100)
    setIsUrgent(false)
    setDiscount(0)
    setNotes('')
    setCalculation(null)
    setOrderStatus('draft')
  }

  const canCalculate = selectedProduct && 
    (!selectedProduct.colorTypes || selectedColorType)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          Расчет полиграфии (Флаера, Листовки, Буклеты)
        </h2>

        {/* СЕКЦИЯ 1: Выбор категории */}
        <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
            📂 Категория продукции
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`p-4 rounded-lg border-2 transition font-semibold text-left ${
                  selectedCategory === category.id
                    ? 'bg-indigo-500 text-white border-indigo-600 shadow-lg'
                    : 'bg-white border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{category.icon}</span>
                  <span>{category.name}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedCategory && (
            <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
              <span className="text-sm font-semibold text-green-800">
                ✓ Выбрана категория: {categories.find(c => c.id === selectedCategory)?.name}
              </span>
            </div>
          )}
        </div>

        {/* СЕКЦИЯ 2: Выбор продукта */}
        {selectedCategory && (
          <div ref={productsRef} className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              📋 Выбор продукта
            </label>
            
            {/* Поле поиска */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="🔍 Поиск продукта..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            {/* Список продуктов */}
            <div className="space-y-2 max-h-64 overflow-y-auto bg-white rounded-lg border border-gray-200 p-2">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product)
                      setSearchProduct('')
                    }}
                    className={`w-full text-left p-3 rounded-lg border-2 transition font-medium ${
                      selectedProduct?.id === product.id
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                        : 'bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{product.name}</span>
                        {selectedProduct?.id === product.id && (
                          <span className="text-lg">✓</span>
                        )}
                      </div>
                      {product.format && (
                        <span className={`text-sm mt-1 ${
                          selectedProduct?.id === product.id ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          Формат: {product.format}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Продукт не найден
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
                <span className="text-sm font-semibold text-green-800">
                  ✓ Выбрано: {selectedProduct.name}
                </span>
              </div>
            )}
          </div>
        )}

        {/* СЕКЦИЯ 3: Выбор цветности (если есть) */}
        {selectedProduct && availableColorTypes.length > 0 && (
          <div ref={colorTypeRef} className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              🎨 Цветность
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {availableColorTypes.map((colorType) => (
                <button
                  key={colorType.type}
                  onClick={() => setSelectedColorType(colorType.type)}
                  className={`p-4 rounded-lg border-2 transition font-bold text-center ${
                    selectedColorType === colorType.type
                      ? 'bg-purple-500 text-white border-purple-600 shadow-lg transform scale-105'
                      : 'bg-white border-purple-300 hover:border-purple-500 hover:bg-purple-50'
                  }`}
                >
                  <div className="text-xl">{colorType.type}</div>
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

        {/* СЕКЦИЯ 4: Количество */}
        {canCalculate && (
          <div ref={quantityRef} className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              🔢 Тираж (количество)
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min="1"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-lg font-semibold mb-3"
            />
            <div className="flex gap-2 flex-wrap">
              {[50, 100, 300, 500, 1000].map(qty => (
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

        {/* СЕКЦИЯ 5: Срочность, скидка и примечания */}
        {canCalculate && (
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
              <span className="text-gray-600 font-medium">Продукт:</span>
              <span className="font-bold text-gray-800">
                {calculation.productName}
              </span>
            </div>

            {calculation.format && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600 font-medium">Формат:</span>
                <span className="font-bold text-gray-800">
                  {calculation.format}
                </span>
              </div>
            )}

            {calculation.colorType && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600 font-medium">Цветность:</span>
                <span className="font-bold text-purple-600 text-lg">
                  {calculation.colorType}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600 font-medium">Тираж:</span>
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

          {/* Выбор клиента */}
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
