import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const OrdersContext = createContext(null)
const STORAGE_KEY = 'orders'

const validNumber = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) >= 0

export function validateNewOrderData(order) {
  if (!order || !validNumber(order.total)) throw new Error('Order total must be a finite nonnegative number')
  if (!validNumber(order.quantity) || Number(order.quantity) <= 0) throw new Error('Order quantity must be finite and positive')
  const integerQuantity = ['printing', 'business-cards', 'badges'].includes(order.category || 'business-cards') || order.pricingMode === 'sheet' || order.productType === 'badges'
  if (integerQuantity && !Number.isSafeInteger(Number(order.quantity))) throw new Error('Printed product quantity must be a positive integer')
  if (order.pricePerUnit != null && !validNumber(order.pricePerUnit)) throw new Error('Order unit price must be a finite nonnegative number')
  const unresolved = value => value && typeof value === 'object' && (
    value.byRequest === true || value.unresolved === true || value.requiresQuote === true || value.pricingMode === 'byRequest'
    || Object.values(value).some(child => child && typeof child === 'object' && unresolved(child)))
  if (unresolved(order)) throw new Error('Resolve all selected service prices before creating an order')
  return { total: Number(order.total), quantity: Number(order.quantity) }
}

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOnline, setIsOnline] = useState(true)

  // Преобразование snake_case из API в camelCase для фронтенда
  const normalizeOrder = (order) => {
    const specification = order.items?.[0]?.specifications || {}
    // Данные клиента могут прийти из JOIN (client_name), либо из specifications.items[0].client
    const specClient = order.items && order.items[0] && order.items[0].specifications && order.items[0].specifications.client
    const firstName = order.client_name || order.clientName || specClient?.name
    return {
      ...specification,
      ...order,
      id: order.id?.toString(),
      orderNumber: order.order_number || order.orderNumber,
      clientId: order.client_id || order.clientId || specClient?.id,
      clientName: firstName,
      clientPhone: order.client_phone || order.clientPhone || specClient?.phone,
      paymentStatus: order.payment_status || order.paymentStatus || 'not_paid',
      totalAmount: order.total_amount || order.totalAmount,
      total: order.total_amount || order.total || 0,
      createdAt: order.created_at || order.createdAt,
      updatedAt: order.updated_at || order.updatedAt,
      // Позиции заказа (только в детальном запросе GET /:id)
      productName: order.product_name || order.productName || (order.items && order.items[0] && order.items[0].product_name),
      materialName: order.material_name || order.materialName || specification.materialName,
      colorType: order.color_type || order.colorType || specification.colorType,
      quantity: order.quantity || (order.items && order.items[0] && order.items[0].quantity),
      unitPrice: order.unit_price || order.unitPrice || specification.unitPrice,
      // Собираем объект клиента из плоских полей/спеки, которые отдаёт API (JOIN с clients)
      client: order.client || {
        id: order.client_id || order.clientId || specClient?.id,
        name: firstName,
        company: order.client_company || order.clientCompany || specClient?.company,
        phone: order.client_phone || order.clientPhone || specClient?.phone,
        email: order.client_email || order.clientEmail || specClient?.email,
        notes: order.client_notes || order.clientNotes || specClient?.notes
      }
    }
  }

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getOrders()
      const normalized = data.map(normalizeOrder)
      setOrders(normalized)
      setIsOnline(true)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    } catch (err) {
      console.warn('API недоступен:', err.message)
      setIsOnline(false)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setOrders(JSON.parse(stored).map(normalizeOrder))
      setError('Работа в offline режиме')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const createOrder = useCallback(async (orderData) => {
    try {
      const { total, quantity } = validateNewOrderData(orderData)
      // Keep the saved quote independent of later calculator/selection mutations.
      orderData = structuredClone(orderData)
      if (isOnline) {
        const apiData = {
          client_id: orderData.client?.id || null,
          category: orderData.category || 'business-cards',
          status: orderData.status || 'draft',
          payment_status: orderData.paymentStatus || 'not_paid',
          total_amount: total,
          notes: orderData.notes || '',
          items: [{
            product_name: orderData.productName || orderData.materialName || orderData.printType || 'Товар',
            color_type: orderData.colorType || null,
            quantity,
            unit_price: orderData.pricePerUnit != null ? Number(orderData.pricePerUnit) : total / quantity,
            total_price: total,
            specifications: { ...orderData, client: orderData.client }
          }]
        }
        const newOrder = await api.createOrder(apiData)
        const fullOrder = { ...orderData, id: newOrder.id.toString(), orderNumber: newOrder.order_number, createdAt: newOrder.created_at }
        setOrders(prev => { const u = [fullOrder, ...prev]; localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); return u })
        return fullOrder
      } else {
        const newOrder = { ...orderData, id: Date.now().toString(), orderNumber: `ORD-${Date.now()}`, createdAt: new Date().toISOString(), _pendingSync: true }
        setOrders(prev => { const u = [newOrder, ...prev]; localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); return u })
        return newOrder
      }
    } catch (err) { console.error('Ошибка создания заказа:', err); throw err }
  }, [isOnline])

  const updateOrder = useCallback(async (orderId, updates) => {
    try {
      if (isOnline) await api.updateOrder(orderId, { status: updates.status, payment_status: updates.paymentStatus, notes: updates.notes })
      setOrders(prev => { const u = prev.map(o => o.id == orderId ? { ...o, ...updates } : o); localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); return u })
    } catch (err) {
      console.error('Ошибка обновления:', err)
      setOrders(prev => { const u = prev.map(o => o.id == orderId ? { ...o, ...updates, _pendingSync: true } : o); localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); return u })
    }
  }, [isOnline])

  const deleteOrder = useCallback(async (orderId) => {
    try {
      if (isOnline) await api.deleteOrder(orderId)
      setOrders(prev => { const u = prev.filter(o => o.id != orderId); localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); return u })
    } catch (err) { console.error('Ошибка удаления:', err); throw err }
  }, [isOnline])

  const getOrder = useCallback((orderId) => orders.find(o => o.id == orderId), [orders])

  // Полный заказ с сервера (items + клиент), с нормализацией. Fallback на локальный массив.
  const fetchOrderDetail = useCallback(async (orderId) => {
    const local = orders.find(o => o.id == orderId)
    try {
      if (isOnline) {
        const raw = await api.getOrder(orderId)
        if (raw) return normalizeOrder({ ...local, ...raw })
      }
    } catch (err) { console.warn('Не удалось получить детали заказа:', err.message) }
    return local
  }, [orders, isOnline])

  return (
    <OrdersContext.Provider value={{ orders, loading, error, isOnline, loadOrders, createOrder, updateOrder, deleteOrder, getOrder, fetchOrderDetail }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) throw new Error('useOrders must be used within an OrdersProvider')
  return context
}

export default useOrders
