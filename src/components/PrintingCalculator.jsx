import { useState, useEffect, useMemo, useRef } from 'react'
import pricingData from '../data/pricing.json'
import ClientSelector from './ClientSelector'
import CategorySelector from './CategorySelector'

export default function PrintingCalculator({ client: externalClient }) {
  const [pricing, setPricing] = useState(pricingData.printing || [])
  const [additionalOperations] = useState(pricingData.additionalOperations || {})
  const [reorderOptions] = useState(pricingData.reorderOptions || [])
  
  // Состояния для выбора клиента
  const [client, setClient] = useState(externalClient)
  
  // Состояния для фильтрации
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchProduct, setSearchProduct] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedColorType, setSelectedColorType] = useState(null)
  
  const [quantity, setQuantity] = useState(100)
  const [selectedServices, setSelectedServices] = useState([])
  const [isUrgent, setIsUrgent] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft')
  
  // Новые состояния для перезаказа и кастомных услуг
  const [selectedReorder, setSelectedReorder] = useState('no')
  const [customNotes, setCustomNotes] = useState([])

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

  // Получаем доступные допоперации для выбранной категории
  const availableOperations = useMemo(() => {
    if (!selectedCategory) return []
    return Object.values(additionalOperations).filter(op => 
      op.applicableTo.includes('all') || op.applicableTo.includes(selectedCategory)
    )
  }, [selectedCategory, additionalOperations])

  // Функции для работы с кастомными услугами
  const addCustomNote = () => {
    setCustomNotes([...customNotes, { id: Date.now(), title: '', price: '', type: 'fixed' }])
  }

  const updateCustomNote = (id, field, value) => {
    setCustomNotes(customNotes.map(note => 
      note.id === id ? { ...note, [field]: value } : note
    ))
  }

  const removeCustomNote = (id) => {
    setCustomNotes(customNotes.filter(note => note.id !== id))
  }

  // Получаем уникальные категории
  const categories = useMemo(() => {
    const categoryMap = {
      'flyers': { name: 'Флаера, Листовки, Афиши', icon: '📄' },
      'booklets': { name: 'Буклеты', icon: '📒' },
      'certificates': { name: 'Дипломы, Грамоты, Сертификаты, Пригласительные', icon: '🎓' },
      'notebooks': { name: 'Дипломы, Грамоты, Пригласительные', icon: '📔' }
    }
    
    const uniqueCategories = [...new Set(pricing.map(p => p.category))]
    return uniqueCategories.map((cat, index) => ({
      id: cat,
      ...categoryMap[cat],
      sectionTitle: index === 0 ? 'Оперативная листовая полиграфия' : undefined
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
  }, [selectedProduct, selectedColorType, quantity, selectedServices, isUrgent, discount, selectedReorder, customNotes])

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

    let servicesTotal = 0
    let servicesDetails = []

    // Обрабатываем допоперации
    selectedServices.forEach(serviceId => {
      const operation = availableOperations.find(op => op.id === serviceId)
      if (operation) {
        let servicePrice = operation.unit === 'тг/шт' 
          ? operation.price * quantity 
          : operation.price
        
        // Применяем скидку на препресс при перезаказе
        if (operation.id === 'prepress' && selectedReorder !== 'no') {
          const reorderOption = reorderOptions.find(opt => opt.id === selectedReorder)
          if (reorderOption && reorderOption.prepressDiscount > 0) {
            const discountAmount = servicePrice * (reorderOption.prepressDiscount / 100)
            servicePrice -= discountAmount
            servicesDetails.push({
              name: `${operation.name} (перезаказ -${reorderOption.prepressDiscount}%)`,
              price: servicePrice,
              discount: discountAmount
            })
          } else {
            servicesDetails.push({
              name: operation.name,
              price: servicePrice
            })
          }
        } else {
          servicesDetails.push({
            name: operation.name,
            price: servicePrice
          })
        }
        
        servicesTotal += servicePrice
      }
    })

    // Добавляем кастомные услуги
    customNotes.forEach(note => {
      if (note.title && note.price) {
        const customPrice = note.type === 'per-unit' 
          ? parseFloat(note.price) * quantity 
          : parseFloat(note.price)
        servicesTotal += customPrice
        servicesDetails.push({
          name: note.title,
          price: customPrice,
          isCustom: true
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
      format: selectedProduct.format,
      colorType: selectedColorType,
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
      reorder: selectedReorder !== 'no' ? reorderOptions.find(opt => opt.id === selectedReorder)?.name : null,
      customNotes: customNotes.filter(n => n.title && n.price),
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
    setSelectedServices([])
    setIsUrgent(false)
    setDiscount(0)
    setNotes('')
    setCalculation(null)
    setOrderStatus('draft')
    setSelectedReorder('no')
    setCustomNotes([])
  }

  const canCalculate = selectedProduct && 
    (!selectedProduct.colorTypes || selectedColorType)

  // Если категория не выбрана, показываем экран выбора
  if (!selectedCategory) {
    return (
      <CategorySelector
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        title="Выберите категорию продукции для расчета:"
        gridCols="md:grid-cols-2"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Кнопка "Назад" */}
      <button
        onClick={() => {
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
        }}
        className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition font-medium"
      >
        ← Назад к выбору категории
      </button>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {categories.find(c => c.id === selectedCategory)?.icon} {categories.find(c => c.id === selectedCategory)?.name}
        </h2>

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

        {/* СЕКЦИЯ 4.5: Дополнительные операции */}
        {canCalculate && availableOperations.length > 0 && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              ⭐ Дополнительные операции
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableOperations.map((operation) => (
                <label 
                  key={operation.id} 
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                    selectedServices.includes(operation.id)
                      ? 'bg-green-100 border-green-500 shadow-md'
                      : 'bg-white border-green-300 hover:bg-green-50 hover:border-green-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(operation.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedServices([...selectedServices, operation.id])
                      } else {
                        setSelectedServices(selectedServices.filter(id => id !== operation.id))
                      }
                    }}
                    className="mr-3 w-5 h-5"
                  />
                  <div className="flex-1">
                    <span className="font-medium block">{operation.name}</span>
                    <span className="text-xs text-gray-500">
                      {operation.price} {operation.unit}
                    </span>
                  </div>
                  {selectedServices.includes(operation.id) && (
                    <span className="text-green-600 text-xl">✓</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* СЕКЦИЯ 4.6: Перезаказ */}
        {canCalculate && reorderOptions.length > 0 && (
          <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-800 uppercase tracking-wide">
                🔄 Перезаказ
              </label>
              <p className="text-xs text-gray-600 mt-1">
                Если это повторный заказ, выберите вариант для получения скидки на допечатную подготовку
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {reorderOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedReorder(option.id)}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    selectedReorder === option.id
                      ? 'bg-indigo-500 text-white border-indigo-600 shadow-lg'
                      : 'bg-white border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'
                  }`}
                >
                  <div className="font-semibold mb-1">{option.name}</div>
                  {option.description && (
                    <div className={`text-xs ${selectedReorder === option.id ? 'text-indigo-100' : 'text-gray-500'}`}>
                      {option.description}
                    </div>
                  )}
                  {option.prepressDiscount > 0 && (
                    <div className={`text-sm mt-1 font-medium ${selectedReorder === option.id ? 'text-indigo-200' : 'text-indigo-600'}`}>
                      💰 -{option.prepressDiscount}% на препресс
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* СЕКЦИЯ 4.7: Кастомные услуги */}
        {canCalculate && (
          <div className="mb-6 p-4 bg-pink-50 rounded-lg border border-pink-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-800 uppercase tracking-wide">
                  💬 Дополнительные услуги (с ценой)
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  Добавьте нестандартные услуги, которых нет в списке выше (упаковка, доставка и т.д.)
                </p>
              </div>
              <button
                onClick={addCustomNote}
                className="flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition font-medium text-sm ml-4"
              >
                <span className="text-lg">+</span> Добавить услугу
              </button>
            </div>

            <div className="space-y-3">
              {customNotes.map((note) => (
                <div key={note.id} className="bg-white border-2 border-pink-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        placeholder="Название услуги"
                        value={note.title}
                        onChange={(e) => updateCustomNote(note.id, 'title', e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      />
                      
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="Цена"
                          value={note.price}
                          onChange={(e) => updateCustomNote(note.id, 'price', e.target.value)}
                          className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        />
                        
                        <select
                          value={note.type}
                          onChange={(e) => updateCustomNote(note.id, 'type', e.target.value)}
                          className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        >
                          <option value="fixed">Фикс. сумма</option>
                          <option value="per-unit">За шт</option>
                        </select>
                      </div>

                      {note.title && note.price && (
                        <div className="p-2 bg-pink-100 border border-pink-300 rounded-lg">
                          <span className="text-xs font-semibold text-pink-800">
                            ✓ {note.title}: {note.price} {note.type === 'fixed' ? 'тг' : 'тг/шт'}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => removeCustomNote(note.id)}
                      className="mt-1 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                      title="Удалить"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {customNotes.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <p className="mb-2">Нет дополнительных услуг</p>
                  <p className="text-sm">Нажмите "Добавить услугу"</p>
                </div>
              )}
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

            {/* Дополнительные услуги */}
            {calculation.servicesDetails && calculation.servicesDetails.length > 0 && (
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
