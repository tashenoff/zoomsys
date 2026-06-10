import { useState, useEffect, useMemo, useRef } from 'react'
import pricingData from '../data/pricing.json'
import ClientSelector from './ClientSelector'

export default function UVPrintingCalculator({ client: externalClient }) {
  const [pricing, setPricing] = useState(pricingData.uvPrinting || [])
  
  const [client, setClient] = useState(externalClient)
  
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchProduct, setSearchProduct] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedSide, setSelectedSide] = useState(null)
  
  const [quantity, setQuantity] = useState(100)
  const [area, setArea] = useState(1) // для расчета по площади (кв.см)
  const [isUrgent, setIsUrgent] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')

  const urgentSurcharge = pricingData.settings.urgentSurcharge

  const productsRef = useRef(null)
  const sidesRef = useRef(null)
  const quantityRef = useRef(null)

  useEffect(() => {
    if (externalClient) {
      setClient(externalClient)
    }
  }, [externalClient])

  const categories = useMemo(() => {
    const categoryMap = {
      'pens': { name: 'Ручки', icon: '🖊️' },
      'cards': { name: 'Флеш-карты, пластиковые карты', icon: '💳' },
      'promotional': { name: 'Промо-продукция', icon: '🎁' },
      'notebooks': { name: 'Блокноты (логотип)', icon: '📔' },
      'notebooks-image': { name: 'Блокноты (изображение)', icon: '📓' },
      'materials': { name: 'На материалах', icon: '🎨' }
    }
    
    const uniqueCategories = [...new Set(pricing.map(p => p.category))]
    return uniqueCategories.map(cat => ({
      id: cat,
      ...categoryMap[cat]
    }))
  }, [pricing])

  const filteredByCategory = useMemo(() => {
    if (!selectedCategory) return []
    return pricing.filter(p => p.category === selectedCategory)
  }, [selectedCategory, pricing])

  const filteredProducts = useMemo(() => {
    if (!searchProduct) return filteredByCategory
    return filteredByCategory.filter(product => 
      product.name.toLowerCase().includes(searchProduct.toLowerCase())
    )
  }, [filteredByCategory, searchProduct])

  const availableSides = useMemo(() => {
    if (!selectedProduct || !selectedProduct.sides) return []
    return selectedProduct.sides
  }, [selectedProduct])

  useEffect(() => {
    setSelectedProduct(null)
    setSelectedSide(null)
    setSearchProduct('')
    
    if (selectedCategory && productsRef.current) {
      setTimeout(() => {
        productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [selectedCategory])

  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.sides && selectedProduct.sides.length > 0) {
        setSelectedSide(null)
        setTimeout(() => {
          sidesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      } else {
        setTimeout(() => {
          quantityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
  }, [selectedProduct])

  useEffect(() => {
    if (selectedSide) {
      setTimeout(() => {
        quantityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [selectedSide])

  useEffect(() => {
    if (selectedProduct && quantity) {
      if (selectedProduct.sides && !selectedSide) return
      calculatePrice()
    }
  }, [selectedProduct, selectedSide, quantity, area, isUrgent, discount])

  const getPriceForQuantity = (pricesObj, qty) => {
    if (!pricesObj) return 0
    
    const quantities = Object.keys(pricesObj).map(Number).sort((a, b) => a - b)
    
    if (qty < quantities[0]) {
      return pricesObj[quantities[0]]
    }
    
    let selectedQty = quantities[0]
    for (let q of quantities) {
      if (qty >= q) {
        const price = pricesObj[q]
        if (price === "договорная") {
          return price
        }
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
    let baseTotal = 0
    let calculationType = ''

    // Если продукт со сторонами
    if (selectedProduct.sides && selectedSide) {
      const sideData = selectedProduct.sides.find(s => s.type === selectedSide)
      if (sideData) {
        unitPrice = getPriceForQuantity(sideData.prices, quantity)
        if (unitPrice === "договорная") {
          setCalculation({
            productName: selectedProduct.name,
            side: selectedSide,
            quantity,
            note: "Цена договорная, свяжитесь с менеджером"
          })
          return
        }
        baseTotal = unitPrice * quantity
        calculationType = 'sides'
      }
    }
    // Если продукт с ценой за единицу
    else if (selectedProduct.priceType === 'unit') {
      unitPrice = getPriceForQuantity(selectedProduct.prices, quantity)
      if (unitPrice === "договорная") {
        setCalculation({
          productName: selectedProduct.name,
          quantity,
          note: "Цена договорная, свяжитесь с менеджером"
        })
        return
      }
      baseTotal = unitPrice * quantity
      calculationType = 'unit'
    }
    // Если продукт с ценой за кв.см
    else if (selectedProduct.priceType === 'sqcm') {
      if (selectedProduct.pricePerSqCm) {
        unitPrice = selectedProduct.pricePerSqCm
        baseTotal = unitPrice * area * quantity
        calculationType = 'sqcm'
      } else {
        unitPrice = getPriceForQuantity(selectedProduct.prices, area)
        baseTotal = unitPrice * area * quantity
        calculationType = 'sqcm-tiered'
      }
    }

    let subtotal = baseTotal

    const urgentAmount = isUrgent ? (subtotal * urgentSurcharge / 100) : 0
    const totalAfterUrgent = subtotal + urgentAmount

    const discountAmount = totalAfterUrgent * (discount / 100)
    const total = totalAfterUrgent - discountAmount

    setCalculation({
      productName: selectedProduct.name,
      description: selectedProduct.description,
      side: selectedSide,
      quantity,
      area: selectedProduct.priceType === 'sqcm' ? area : null,
      unitPrice,
      baseTotal,
      subtotal,
      calculationType,
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
      type: 'uv-printing',
      ...calculation,
      status: orderStatus,
      createdAt: new Date().toISOString()
    }
    orders.push(newOrder)
    localStorage.setItem('orders', JSON.stringify(orders))

    alert('Заказ успешно сохранен!')
    
    setSelectedCategory(null)
    setSearchProduct('')
    setSelectedProduct(null)
    setSelectedSide(null)
    setQuantity(100)
    setArea(1)
    setIsUrgent(false)
    setDiscount(0)
    setNotes('')
    setCalculation(null)
    setOrderStatus('draft')
  }

  const canCalculate = selectedProduct && 
    (!selectedProduct.sides || selectedSide)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          Расчет УФ печати
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
            
            <div className="mb-3">
              <input
                type="text"
                placeholder="🔍 Поиск продукта..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

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
                      {product.description && (
                        <span className={`text-sm mt-1 ${
                          selectedProduct?.id === product.id ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {product.description}
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

        {/* СЕКЦИЯ 3: Выбор стороны (если есть) */}
        {selectedProduct && availableSides.length > 0 && (
          <div ref={sidesRef} className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              🔄 Количество сторон
            </label>
            <div className="grid grid-cols-2 gap-3">
              {availableSides.map((side) => (
                <button
                  key={side.type}
                  onClick={() => setSelectedSide(side.type)}
                  className={`p-4 rounded-lg border-2 transition font-bold text-center ${
                    selectedSide === side.type
                      ? 'bg-purple-500 text-white border-purple-600 shadow-lg transform scale-105'
                      : 'bg-white border-purple-300 hover:border-purple-500 hover:bg-purple-50'
                  }`}
                >
                  <div className="text-lg">{side.type}</div>
                </button>
              ))}
            </div>

            {selectedSide && (
              <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
                <span className="text-sm font-semibold text-green-800">
                  ✓ Выбрано: {selectedSide}
                </span>
              </div>
            )}
          </div>
        )}

        {/* СЕКЦИЯ 4: Количество и площадь */}
        {canCalculate && (
          <div ref={quantityRef} className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              🔢 Параметры заказа
            </label>
            
            {/* Количество */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Количество (шт)
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                min="1"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-lg font-semibold mb-3"
              />
              <div className="flex gap-2 flex-wrap">
                {selectedProduct.priceType === 'sqcm' 
                  ? [1, 10, 50, 100, 200].map(qty => (
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
                    ))
                  : [10, 50, 100, 200, 500, 1000].map(qty => (
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
                    ))
                }
              </div>
            </div>

            {/* Площадь (для продуктов с ценой за кв.см) */}
            {selectedProduct.priceType === 'sqcm' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Площадь изображения (кв.см)
                </label>
                <input
                  type="number"
                  value={area}
                  onChange={(e) => setArea(parseFloat(e.target.value) || 0)}
                  min="1"
                  step="0.1"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-lg font-semibold"
                />
              </div>
            )}
          </div>
        )}

        {/* СЕКЦИЯ 5: Срочность, скидка и примечания */}
        {canCalculate && (
          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              ⚙️ Дополнительные опции
            </label>
            
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
          
          {calculation.note ? (
            <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-6 text-center">
              <p className="text-xl font-bold text-yellow-800 mb-2">⚠️ {calculation.note}</p>
              <p className="text-gray-700">Для уточнения стоимости свяжитесь с менеджером</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 bg-white rounded-lg p-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600 font-medium">Продукт:</span>
                  <span className="font-bold text-gray-800">
                    {calculation.productName}
                  </span>
                </div>

                {calculation.description && (
                  <div className="py-2 border-b">
                    <p className="text-sm text-gray-600">{calculation.description}</p>
                  </div>
                )}

                {calculation.side && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600 font-medium">Сторон:</span>
                    <span className="font-bold text-purple-600 text-lg">
                      {calculation.side}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600 font-medium">Количество:</span>
                  <span className="font-bold text-gray-800">{calculation.quantity} шт</span>
                </div>

                {calculation.area && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600 font-medium">Площадь:</span>
                    <span className="font-bold text-gray-800">{calculation.area} кв.см</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600 font-medium">
                    {calculation.calculationType === 'sqcm' ? 'Цена за кв.см:' : 'Цена за единицу:'}
                  </span>
                  <span className="font-bold text-gray-800">{calculation.unitPrice} тг</span>
                </div>

                <div className="flex justify-between items-center py-3 border-b-2 border-gray-300">
                  <span className="text-gray-700 font-semibold">Базовая стоимость:</span>
                  <span className="font-bold text-lg text-blue-600">
                    {calculation.baseTotal.toFixed(2)} тг
                  </span>
                </div>

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

              <div className="mt-6">
                <ClientSelector
                  selectedClient={client}
                  onSelectClient={setClient}
                />
              </div>

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
            </>
          )}
        </div>
      )}
    </div>
  )
}
