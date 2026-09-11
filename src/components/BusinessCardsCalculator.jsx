import { useState, useEffect, useMemo, useRef } from 'react'
import { usePricing } from '../hooks/usePricing'
import { useOrders } from '../hooks/useOrders'
import pricingDataFallback from '../data/pricing.json'
import ClientSelector from './ClientSelector'
import CategorySelector from './CategorySelector'

export default function BusinessCardsCalculator({ client: externalClient }) {
  // Получаем данные из контекста прайсов и заказов
  const { pricing: pricingContext, loading: pricingLoading } = usePricing()
  const { createOrder, isOnline } = useOrders()
  
  // Используем данные из контекста или fallback
  const pricingData = pricingContext || pricingDataFallback
  
  // Состояние для выбора типа карточки
  const [selectedCardType, setSelectedCardType] = useState(null)
  
  const pricing = pricingData.businessCards || []
  const additionalOperations = pricingData.additionalOperations || {}
  const reorderOptions = pricingData.reorderOptions || []
  const additionalServices = pricingData.additionalServices || []
  
  // Состояния для выбора клиента
  const [client, setClient] = useState(externalClient)
  
  // Состояния для фильтрации
  const [searchMaterial, setSearchMaterial] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [selectedColorType, setSelectedColorType] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  
  const [quantity, setQuantity] = useState(100)
  const [selectedServices, setSelectedServices] = useState([])
  const [selectedServiceOptions, setSelectedServiceOptions] = useState({}) // Для выбора опций в select-операциях
  const [serviceQuantities, setServiceQuantities] = useState({}) // Для операций с количеством
  const [isUrgent, setIsUrgent] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [calculation, setCalculation] = useState(null)
  const [orderStatus, setOrderStatus] = useState('draft') // draft, in_progress, approved
  
  // Новые состояния для перезаказа и примечания с ценой
  const [selectedReorder, setSelectedReorder] = useState('no')
  const [customNotes, setCustomNotes] = useState([]) // Массив кастомных услуг

  const urgentSurcharge = pricingData.settings?.urgentSurcharge || 30

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

  // Получаем доступные допоперации и доп. услуги для выбранного типа карточки
  const availableOperations = useMemo(() => {
    if (!selectedCardType) return []
    const seen = new Set()

    // Из доп. операций
    const fromOperations = additionalOperations && typeof additionalOperations === 'object'
      ? Object.values(additionalOperations).filter(op => {
          if (!op || !op.applicableTo) return false
          const applicableTo = Array.isArray(op.applicableTo) ? op.applicableTo : []
          if (!applicableTo.includes('all') && !applicableTo.includes(selectedCardType)) return false
          const key = String(op.id || op.name)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      : []

    // Из доп. услуг (с applicableTo)
    const fromServices = Array.isArray(additionalServices)
      ? additionalServices.filter(svc => {
          const applicableTo = Array.isArray(svc?.applicableTo) ? svc.applicableTo : []
          if (!applicableTo.includes('all') && !applicableTo.includes(selectedCardType)) return false
          const key = String(svc.id || svc.name)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      : []

    return [...fromOperations, ...fromServices]
  }, [selectedCardType, additionalOperations, additionalServices])

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

  // Получаем доступные цветности для выбранного материала (уникальные)
  const availableColorTypes = useMemo(() => {
    if (!selectedMaterial) return []
    const colorTypesMap = new Map()
    pricing
      .filter(p => p.name === selectedMaterial)
      .forEach(p => {
        // Берём только первый продукт для каждой цветности
        if (!colorTypesMap.has(p.colorType)) {
          colorTypesMap.set(p.colorType, { colorType: p.colorType, product: p })
        }
      })
    return Array.from(colorTypesMap.values())
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

  useEffect(() => {
    if (selectedProduct && quantity) {
      calculatePrice()
    }
  }, [selectedProduct, quantity, selectedServices, selectedServiceOptions, serviceQuantities, isUrgent, discount, selectedReorder, customNotes])

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

    // Обрабатываем новые допоперации
    selectedServices.forEach(serviceId => {
      // Ищем среди новых операций
      const operation = availableOperations.find(op => op.id === serviceId)
      if (operation) {
        let servicePrice = 0
        let serviceName = operation.name
        
        // Обработка операций с выбором (select)
        if (operation.type === 'select') {
          const selectedOptionId = selectedServiceOptions[serviceId]
          if (selectedOptionId) {
            const selectedOption = operation.options.find(opt => opt.id === selectedOptionId)
            if (selectedOption) {
              servicePrice = selectedOption.price
              serviceName = `${operation.name}: ${selectedOption.name}`
            }
          }
        }
        // Обработка операций с количеством
        else if (operation.type === 'quantity') {
          const qty = serviceQuantities[serviceId] || 0
          if (qty > 0) {
            servicePrice = operation.price * qty
            serviceName = `${operation.name} (${qty} шт)`
          }
        }
        // Обработка операций с unit='тг/угол'
        else if (operation.unit === 'тг/угол') {
          const corners = serviceQuantities[serviceId] || operation.defaultQuantity || 4
          servicePrice = operation.price * corners * quantity
          serviceName = `${operation.name} (${corners} углов × ${quantity} шт)`
        }
        // Обработка обычных операций
        else {
          const qty = serviceQuantities[serviceId] || 1
          if (operation.unit === 'тг/шт') {
            servicePrice = operation.price * quantity * qty
            if (qty > 1) {
              serviceName = `${operation.name} (${qty} шт на визитку)`
            }
          } else {
            servicePrice = operation.price
          }
        }
        
        // Применяем скидку на препресс при перезаказе
        if (operation.id === 'prepress' && selectedReorder !== 'no' && servicePrice > 0) {
          const reorderOption = reorderOptions.find(opt => opt.id === selectedReorder)
          if (reorderOption && reorderOption.prepressDiscount > 0) {
            const originalPrice = servicePrice
            const discountAmount = servicePrice * (reorderOption.prepressDiscount / 100)
            servicePrice -= discountAmount
            servicesDetails.push({
              name: `${serviceName} (перезаказ -${reorderOption.prepressDiscount}%)`,
              price: servicePrice,
              originalPrice: originalPrice,
              discount: discountAmount
            })
          } else {
            servicesDetails.push({
              name: serviceName,
              price: servicePrice
            })
          }
        } else if (servicePrice > 0) {
          servicesDetails.push({
            name: serviceName,
            price: servicePrice
          })
        }
        
        servicesTotal += servicePrice
      } else {
        // Fallback на старые additionalServices
        const service = additionalServices.find(s => s.id === serviceId)
        if (service) {
          const servicePrice = service.unit === 'тг/шт' 
            ? service.price * quantity 
            : service.price
          servicesTotal += servicePrice
          servicesDetails.push({
            name: service.name,
            price: servicePrice
          })
        }
      }
    })

    // Добавляем кастомные услуги с ценой
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
      reorder: selectedReorder !== 'no' ? reorderOptions.find(opt => opt.id === selectedReorder)?.name : null,
      customNotes: customNotes.filter(n => n.title && n.price),
      total
    })
  }

  const [savingOrder, setSavingOrder] = useState(false)

  const handleSaveOrder = async () => {
    if (!client || !calculation) {
      alert('Выберите клиента и сделайте расчет')
      return
    }

    setSavingOrder(true)
    try {
      const orderData = {
        client,
        category: 'business-cards',
        ...calculation,
        status: orderStatus,
        paymentStatus: 'not_paid'
      }
      
      await createOrder(orderData)
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
      setSelectedReorder('no')
      setCustomNotes([])
    } catch (err) {
      alert('Ошибка сохранения заказа: ' + err.message)
    } finally {
      setSavingOrder(false)
    }
  }

  // Типы карточек для выбора
  const cardTypes = [
    { id: 'business-cards', name: 'Визитки', icon: '💼', active: true, sectionTitle: 'Визитки и карточки' },
    { id: 'badges', name: 'Бейджи', icon: '🎫', active: false },
    { id: 'discount-cards', name: 'Дисконтные / клубные карты', icon: '💳', active: false },
    { id: 'invitations', name: 'Пригласительные карточки', icon: '💌', active: false },
    { id: 'certificates', name: 'Сертификаты малого формата', icon: '🎓', active: false },
    { id: 'custom-cards', name: 'Карточки произвольного типа', icon: '📇', active: false },
  ]

  // Если тип карточки не выбран, показываем экран выбора
  if (!selectedCardType) {
    return (
      <CategorySelector
        categories={cardTypes}
        selectedCategory={selectedCardType}
        onSelectCategory={setSelectedCardType}
        title="Выберите тип продукции для расчета:"
      />
    )
  }

  // Если выбран тип карточки, показываем соответствующий калькулятор
  return (
    <div className="space-y-6">
      {/* Кнопка "Назад" */}
      <button
        onClick={() => {
          setSelectedCardType(null)
          // Сбрасываем все состояния
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
        }}
        className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition font-medium"
      >
        ← Назад к выбору типа
      </button>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {cardTypes.find(ct => ct.id === selectedCardType)?.icon} Расчет: {cardTypes.find(ct => ct.id === selectedCardType)?.name}
        </h2>

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
        <div ref={colorTypeRef} className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
            🎨 Цветность
          </label>
          
          {availableColorTypes.length > 0 ? (
            <>
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
            </>
          ) : (
            <div className="bg-white border-2 border-purple-200 rounded-lg p-6 text-center">
              <p className="text-gray-500 text-sm">
                👆 Сначала выберите материал выше, чтобы увидеть доступные варианты цветности
              </p>
            </div>
          )}
        </div>

        {/* СЕКЦИЯ 3: Количество */}
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

        {/* СЕКЦИЯ 4: Дополнительные операции (новая система) */}
        {availableOperations.length > 0 && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <label className="block text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">
              ⭐ Дополнительные операции
            </label>
            <div className="space-y-3">
              {availableOperations.map((operation) => (
                <div 
                  key={operation.id} 
                  className={`p-4 border-2 rounded-lg transition ${
                    selectedServices.includes(operation.id)
                      ? 'bg-green-100 border-green-500 shadow-md'
                      : 'bg-white border-green-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(operation.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedServices([...selectedServices, operation.id])
                        } else {
                          setSelectedServices(selectedServices.filter(id => id !== operation.id))
                          // Сбрасываем выбор опций при снятии галочки
                          if (operation.type === 'select') {
                            const newOptions = {...selectedServiceOptions}
                            delete newOptions[operation.id]
                            setSelectedServiceOptions(newOptions)
                          }
                          if (operation.type === 'quantity' || operation.unit === 'тг/угол' || operation.unit === 'тг/шт') {
                            const newQty = {...serviceQuantities}
                            delete newQty[operation.id]
                            setServiceQuantities(newQty)
                          }
                        }
                      }}
                      className="mt-1 w-5 h-5 cursor-pointer"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium block">{operation.name}</span>
                        {selectedServices.includes(operation.id) && (
                          <span className="text-green-600 text-xl">✓</span>
                        )}
                      </div>
                      
                      {operation.description && (
                        <p className="text-xs text-gray-600 mb-2">{operation.description}</p>
                      )}
                      
                      {/* Выпадающий список для операций с type='select' */}
                      {operation.type === 'select' && selectedServices.includes(operation.id) && (
                        <div className="mt-3">
                          <select
                            value={selectedServiceOptions[operation.id] || ''}
                            onChange={(e) => setSelectedServiceOptions({
                              ...selectedServiceOptions,
                              [operation.id]: e.target.value
                            })}
                            className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                          >
                            <option value="">Выберите вариант...</option>
                            {operation.options.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name} — {opt.price} {opt.unit}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {/* Поле количества для операций с type='quantity' или unit='тг/угол' */}
                      {(operation.type === 'quantity' || operation.unit === 'тг/угол') && selectedServices.includes(operation.id) && (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {operation.unit === 'тг/угол' ? 'Количество углов:' : 'Количество:'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={serviceQuantities[operation.id] || operation.defaultQuantity || ''}
                            onChange={(e) => setServiceQuantities({
                              ...serviceQuantities,
                              [operation.id]: parseInt(e.target.value) || 0
                            })}
                            placeholder={operation.defaultQuantity ? `По умолчанию: ${operation.defaultQuantity}` : ''}
                            className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      )}
                      
                      {/* Поле количества для операций с unit='тг/шт' (кроме quantity type) */}
                      {operation.unit === 'тг/шт' && operation.type !== 'quantity' && selectedServices.includes(operation.id) && (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Количество на 1 визитку:
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={serviceQuantities[operation.id] || 1}
                            onChange={(e) => setServiceQuantities({
                              ...serviceQuantities,
                              [operation.id]: parseInt(e.target.value) || 1
                            })}
                            className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {operation.price} тг/шт × {serviceQuantities[operation.id] || 1} × {quantity} визиток = {((operation.price * (serviceQuantities[operation.id] || 1) * quantity).toFixed(2))} тг
                          </p>
                        </div>
                      )}
                      
                      {/* Показываем стоимость для обычных операций без полей ввода */}
                      {!operation.type && operation.unit !== 'тг/шт' && operation.unit !== 'тг/угол' && (
                        <span className="text-xs text-gray-500 block mt-1">
                          {operation.price} {operation.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* СЕКЦИЯ 4.5: Перезаказ - Временно скрыто */}
        {/* 
        {reorderOptions.length > 0 && (
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
            {selectedReorder && selectedReorder !== 'no' && (
              <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
                <span className="text-sm font-semibold text-green-800">
                  ✓ Перезаказ: {reorderOptions.find(o => o.id === selectedReorder)?.name}
                </span>
              </div>
            )}
          </div>
        )}
        */}

        {/* СЕКЦИЯ 4.6: Дополнительные услуги с ценой (множественные) */}
        <div className="mb-6 p-4 bg-pink-50 rounded-lg border border-pink-200">
            <div className="mb-3">
              <div className="flex items-center justify-between">
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
                  className="flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition font-medium text-sm"
                >
                  <span className="text-lg">+</span> Добавить услугу
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {customNotes.map((note) => (
                <div key={note.id} className="bg-white border-2 border-pink-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        placeholder="Название услуги (например: Индивидуальная упаковка)"
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
                  <p className="text-sm">Нажмите "Добавить услугу" чтобы добавить</p>
                </div>
            )}
          </div>
        </div>

        {/* СЕКЦИЯ 5: Срочность, скидка и примечания */}
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
            disabled={!client || savingOrder}
            className="w-full mt-6 bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg hover:from-green-600 hover:to-green-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg uppercase tracking-wide"
          >
            {savingOrder ? '⏳ Сохранение...' : '💾 Сохранить заказ'}
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
