import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const OrdersContext = createContext(null)
const STORAGE_KEY = 'orders'

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOnline, setIsOnline] = useState(true)

  // Преобразование snake_case из API в camelCase для фронтенда
  const normalizeOrder = (order) => ({
    ...order,
    id: order.id?.toString(),
    orderNumber: order.order_number || order.orderNumber,
    clientId: order.client_id || order.clientId,
    clientName: order.client_name || order.clientName,
    clientPhone: order.client_phone || order.clientPhone,
    paymentStatus: order.payment_status || order.paymentStatus || 'not_paid',
    totalAmount: order.total_amount || order.totalAmount,
    total: order.total_amount || order.total || 0,
    createdAt: order.created_at || order.createdAt,
    updatedAt: order.updated_at || order.updatedAt
  })

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
      if (stored) setOrders(JSON.parse(stored))
      setError('Работа в offline режиме')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const createOrder = useCallback(async (orderData) => {
    try {
      if (isOnline) {
        const apiData = {
          client_id: orderData.client?.id || null,
          category: orderData.category || 'business-cards',
          status: orderData.status || 'draft',
          payment_status: orderData.paymentStatus || 'not_paid',
          total_amount: parseFloat(orderData.total) || 0,
          notes: orderData.notes || '',
          items: [{
            product_name: orderData.productName || orderData.materialName || orderData.printType || 'Товар',
            color_type: orderData.colorType || null,
            quantity: orderData.quantity || 1,
            unit_price: orderData.pricePerUnit || (parseFloat(orderData.total) / (orderData.quantity || 1)),
            total_price: parseFloat(orderData.total) || 0,
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

  return (
    <OrdersContext.Provider value={{ orders, loading, error, isOnline, loadOrders, createOrder, updateOrder, deleteOrder, getOrder }}>
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
