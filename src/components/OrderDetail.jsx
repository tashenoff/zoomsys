import { useState, useEffect } from 'react'
import { useOrders } from '../hooks/useOrders'
import { useAuth } from '../hooks/useAuth'

export default function OrderDetail({ orderId, onBack }) {
  const { hasPermission } = useAuth()
  const { getOrder, updateOrder, deleteOrder: apiDeleteOrder, isOnline } = useOrders()
  const [order, setOrder] = useState(null)
  const [currentStatus, setCurrentStatus] = useState('draft')
  const [paymentStatus, setPaymentStatus] = useState('not_paid')

  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [orderId, getOrder])

  const loadOrder = () => {
    const found = getOrder(orderId)
    setOrder(found)
    setCurrentStatus(found?.status || 'draft')
    setPaymentStatus(found?.paymentStatus || found?.payment_status || 'not_paid')
  }

  const updateStatus = async (newStatus) => {
    setUpdating(true)
    try {
      await updateOrder(orderId, { status: newStatus })
      setCurrentStatus(newStatus)
      setOrder({ ...order, status: newStatus })
    } catch (err) {
      alert('Ошибка обновления статуса: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const updatePaymentStatus = async (newPaymentStatus) => {
    setUpdating(true)
    try {
      await updateOrder(orderId, { paymentStatus: newPaymentStatus })
      setPaymentStatus(newPaymentStatus)
      setOrder({ ...order, paymentStatus: newPaymentStatus })
    } catch (err) {
      alert('Ошибка обновления статуса оплаты: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { label: '📝 Черновик', className: 'bg-gray-500 text-white' },
      in_progress: { label: '⚙️ В процессе', className: 'bg-blue-500 text-white' },
      approved: { label: '✅ Утверждено', className: 'bg-green-500 text-white' },
      completed: { label: '🎉 Исполнено', className: 'bg-purple-600 text-white' }
    }
    const statusInfo = statusMap[status || 'draft']
    return (
      <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    )
  }

  const getPaymentStatusBadge = (status) => {
    const statusMap = {
      not_paid: { label: '❌ Не оплачено', className: 'bg-red-500 text-white' },
      prepaid: { label: '💵 Предоплата получена', className: 'bg-yellow-500 text-white' },
      paid: { label: '✅ Оплачено 100%', className: 'bg-green-600 text-white' }
    }
    const statusInfo = statusMap[status || 'not_paid']
    return (
      <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    )
  }

  const deleteOrder = async () => {
    if (confirm('Удалить этот заказ?')) {
      try {
        await apiDeleteOrder(orderId)
        onBack()
      } catch (err) {
        alert('Ошибка удаления: ' + err.message)
      }
    }
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Назад к списку
        </button>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-500">Заказ не найден</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Индикатор offline */}
      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
          <span>📴</span>
          <span className="text-yellow-700 text-sm">Работа в offline режиме. Изменения синхронизируются при восстановлении связи.</span>
        </div>
      )}

      {/* Индикатор обновления */}
      {updating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-blue-700 text-sm">Сохранение изменений...</span>
        </div>
      )}

      {/* Навигация назад */}
      <button
        onClick={onBack}
        className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
      >
        <span>←</span> Назад к списку заказов
      </button>

      {/* Заголовок заказа */}
      <div className="bg-white rounded-lg shadow-md p-6 border-2 border-blue-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{order.orderNumber}</h1>
            <p className="text-gray-600 mt-1">
              {new Date(order.createdAt).toLocaleString('ru-RU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-blue-600">
              {parseFloat(order.total).toFixed(2)} тг
            </span>
          </div>
        </div>
      </div>

      {/* Управление статусом */}
      <div className="bg-white rounded-lg shadow-md p-6 border-2 border-indigo-200">
        <h2 className="text-xl font-bold mb-4">Статус заказа:</h2>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm font-medium text-gray-700">Текущий статус:</span>
          {getStatusBadge(currentStatus)}
        </div>
        {hasPermission('editOrders') ? (
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Изменить статус:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => updateStatus('draft')}
              disabled={currentStatus === 'draft' || updating}
              className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                currentStatus === 'draft'
                  ? 'bg-gray-300 text-gray-500 border-gray-300 cursor-not-allowed'
                  : updating ? 'opacity-50 cursor-wait' : 'bg-white border-gray-300 hover:border-gray-500 hover:bg-gray-50'
              }`}
            >
              📝 Черновик
            </button>
            <button
              onClick={() => updateStatus('in_progress')}
              disabled={currentStatus === 'in_progress' || updating}
              className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                currentStatus === 'in_progress'
                  ? 'bg-blue-300 text-blue-500 border-blue-300 cursor-not-allowed'
                  : updating ? 'opacity-50 cursor-wait' : 'bg-white border-blue-300 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              ⚙️ В процессе
            </button>
            <button
              onClick={() => updateStatus('approved')}
              disabled={currentStatus === 'approved' || updating}
              className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                currentStatus === 'approved'
                  ? 'bg-green-300 text-green-500 border-green-300 cursor-not-allowed'
                  : updating ? 'opacity-50 cursor-wait' : 'bg-white border-green-300 hover:border-green-500 hover:bg-green-50'
              }`}
            >
              ✅ Утверждено
            </button>
            <button
              onClick={() => updateStatus('completed')}
              disabled={currentStatus === 'completed' || updating}
              className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                currentStatus === 'completed'
                  ? 'bg-purple-300 text-purple-500 border-purple-300 cursor-not-allowed'
                  : updating ? 'opacity-50 cursor-wait' : 'bg-white border-purple-300 hover:border-purple-500 hover:bg-purple-50'
              }`}
            >
              🎉 Исполнено
            </button>
          </div>
        </div>
        ) : (
          <div className="border-t pt-4 text-gray-500 text-sm">
            У вас нет прав для изменения статуса заказа
          </div>
        )}
      </div>

      {/* Управление статусом платежа */}
      <div className="bg-white rounded-lg shadow-md p-6 border-2 border-green-200">
        <h2 className="text-xl font-bold mb-4">Статус платежа:</h2>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm font-medium text-gray-700">Текущий статус:</span>
          {getPaymentStatusBadge(paymentStatus)}
        </div>
        {hasPermission('editOrders') ? (
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Изменить статус платежа:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => updatePaymentStatus('not_paid')}
              disabled={paymentStatus === 'not_paid' || updating}
              className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                paymentStatus === 'not_paid'
                  ? 'bg-red-300 text-red-500 border-red-300 cursor-not-allowed'
                  : updating ? 'opacity-50 cursor-wait' : 'bg-white border-red-300 hover:border-red-500 hover:bg-red-50'
              }`}
            >
              ❌ Не оплачено
            </button>
            <button
              onClick={() => updatePaymentStatus('prepaid')}
              disabled={paymentStatus === 'prepaid' || updating}
              className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                paymentStatus === 'prepaid'
                  ? 'bg-yellow-300 text-yellow-600 border-yellow-300 cursor-not-allowed'
                  : updating ? 'opacity-50 cursor-wait' : 'bg-white border-yellow-300 hover:border-yellow-500 hover:bg-yellow-50'
              }`}
            >
              💵 Предоплата получена
            </button>
            <button
              onClick={() => updatePaymentStatus('paid')}
              disabled={paymentStatus === 'paid' || updating}
              className={`p-3 rounded-lg border-2 transition font-semibold text-center ${
                paymentStatus === 'paid'
                  ? 'bg-green-300 text-green-600 border-green-300 cursor-not-allowed'
                  : updating ? 'opacity-50 cursor-wait' : 'bg-white border-green-300 hover:border-green-600 hover:bg-green-50'
              }`}
            >
              ✅ Оплачено 100%
            </button>
          </div>
        </div>
        ) : (
          <div className="border-t pt-4 text-gray-500 text-sm">
            У вас нет прав для изменения статуса платежа
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Информация о клиенте */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Клиент:</h2>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-900">{order.client?.name}</p>
            {order.client?.company && (
              <p className="text-gray-700">{order.client.company}</p>
            )}
            {order.client?.phone && (
              <p className="text-gray-600 flex items-center gap-2">
                <span>📞</span> {order.client.phone}
              </p>
            )}
            {order.client?.email && (
              <p className="text-gray-600 flex items-center gap-2">
                <span>✉️</span> {order.client.email}
              </p>
            )}
            {order.client?.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-semibold text-gray-700">Примечания:</p>
                <p className="text-sm text-gray-600">{order.client.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Детали заказа */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Детали:</h2>
          <div className="space-y-3">
            {/* Для визиток */}
            {order.productName && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Продукт:</p>
                  <p className="font-semibold text-lg">
                    {order.productName} {order.colorType && `(${order.colorType})`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Количество:</p>
                  <p className="font-semibold">{order.quantity} шт</p>
                </div>
                {order.unitPrice && (
                  <div>
                    <p className="text-sm text-gray-600">Цена за единицу:</p>
                    <p className="font-semibold">{order.unitPrice} тг</p>
                  </div>
                )}
                {order.baseTotal && (
                  <div>
                    <p className="text-sm text-gray-600">Базовая стоимость:</p>
                    <p className="font-semibold">{parseFloat(order.baseTotal).toFixed(2)} тг</p>
                  </div>
                )}
                
                {order.servicesDetails && order.servicesDetails.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Доп. услуги:</p>
                    {order.servicesDetails.map((service, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{service.name}</span>
                        <span className="font-medium">{service.price.toFixed(2)} тг</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Для широкоформата */}
            {order.materialName && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Материал:</p>
                  <p className="font-semibold text-lg">{order.materialName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Размер:</p>
                  <p className="font-semibold">{order.width} × {order.height} м</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Площадь:</p>
                  <p className="font-semibold">{order.area} м²</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Количество:</p>
                  <p className="font-semibold">{order.quantity} шт</p>
                </div>
                {order.pricePerSqM && (
                  <div>
                    <p className="text-sm text-gray-600">Цена за м²:</p>
                    <p className="font-semibold">{order.pricePerSqM} тг</p>
                  </div>
                )}
                {order.totalPerItem && (
                  <div>
                    <p className="text-sm text-gray-600">Стоимость за 1 шт:</p>
                    <p className="font-semibold">{order.totalPerItem} тг</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Итоговая информация */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Итоговая информация:</h2>
        
        <div className="space-y-3">
          {/* Срочность */}
          {order.isUrgent && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <span className="text-2xl">🔥</span>
              <div className="flex-1">
                <p className="font-semibold text-red-700">Срочный заказ</p>
                <p className="text-sm text-red-600">+{order.urgentSurcharge}% надбавка</p>
              </div>
              <span className="font-bold text-red-700">
                +{order.urgentAmount?.toFixed(2)} тг
              </span>
            </div>
          )}

          {/* Скидка */}
          {order.discount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <span className="text-2xl">💰</span>
              <div className="flex-1">
                <p className="font-semibold text-green-700">Скидка</p>
                <p className="text-sm text-green-600">{order.discount}%</p>
              </div>
              <span className="font-bold text-green-700">
                -{order.discountAmount?.toFixed(2)} тг
              </span>
            </div>
          )}

          {/* Примечания к заказу */}
          {order.notes && (
            <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
              <div className="flex items-start gap-2">
                <span className="text-xl">📝</span>
                <div>
                  <p className="font-semibold text-yellow-800 mb-1">Примечания к заказу:</p>
                  <p className="text-gray-700">{order.notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Итого */}
          <div className="flex justify-between items-center text-2xl pt-4 mt-4 border-t-2 border-gray-300">
            <span className="font-bold text-gray-800">Итого:</span>
            <span className="font-bold text-blue-600">
              {parseFloat(order.total).toFixed(2)} тг
            </span>
          </div>
        </div>
      </div>

      {/* Действия */}
      {hasPermission('deleteOrders') && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex gap-4">
            <button
              onClick={deleteOrder}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
            >
              🗑️ Удалить заказ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
