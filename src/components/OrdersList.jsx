import { useState, useEffect } from 'react'

export default function OrdersList({ onViewOrder }) {
  const [orders, setOrders] = useState([])
  const [filteredOrders, setFilteredOrders] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all, draft, in_progress, approved
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all') // all, not_paid, prepaid, paid
  const [groupByClient, setGroupByClient] = useState(false)
  const [viewMode, setViewMode] = useState('list') // list, kanban

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, searchTerm, dateFrom, dateTo, statusFilter, paymentStatusFilter])

  const loadOrders = () => {
    const stored = localStorage.getItem('orders')
    if (stored) {
      const ordersData = JSON.parse(stored)
      setOrders(ordersData.reverse()) // Новые сверху
    }
  }

  const filterOrders = () => {
    let filtered = [...orders]

    // Поиск по клиенту или номеру заказа
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.client?.company?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Фильтр по дате от
    if (dateFrom) {
      filtered = filtered.filter(order => 
        new Date(order.createdAt) >= new Date(dateFrom)
      )
    }

    // Фильтр по дате до
    if (dateTo) {
      filtered = filtered.filter(order => 
        new Date(order.createdAt) <= new Date(dateTo + 'T23:59:59')
      )
    }

    // Фильтр по статусу
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => (order.status || 'draft') === statusFilter)
    }

    // Фильтр по статусу платежа
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(order => (order.paymentStatus || 'not_paid') === paymentStatusFilter)
    }

    setFilteredOrders(filtered)
  }

  const deleteOrder = (orderId) => {
    if (confirm('Удалить этот заказ?')) {
      const updated = orders.filter(o => o.id !== orderId)
      localStorage.setItem('orders', JSON.stringify(updated))
      setOrders(updated)
    }
  }

  const calculateTotal = () => {
    return filteredOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0)
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
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    )
  }

  const groupOrdersByClient = (orders) => {
    const grouped = {}
    orders.forEach(order => {
      const clientName = order.client?.name || 'Без клиента'
      if (!grouped[clientName]) {
        grouped[clientName] = []
      }
      grouped[clientName].push(order)
    })
    return grouped
  }

  const groupOrdersByStatus = () => {
    const grouped = {
      draft: [],
      in_progress: [],
      approved: [],
      completed: []
    }
    
    filteredOrders.forEach(order => {
      const status = order.status || 'draft'
      if (grouped[status]) {
        grouped[status].push(order)
      }
    })
    
    return grouped
  }

  const renderKanbanCard = (order) => (
    <div
      key={order.id}
      className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer"
      onClick={() => onViewOrder(order.id)}
    >
      <div className="mb-2">
        <h4 className="font-bold text-sm">{order.orderNumber}</h4>
        <p className="text-xs text-gray-500">
          {new Date(order.createdAt).toLocaleDateString('ru-RU')}
        </p>
      </div>
      
      <div className="mb-2">
        <p className="text-xs font-semibold text-gray-700">Клиент:</p>
        <p className="text-sm">{order.client?.name}</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {order.isUrgent && <span className="text-red-600" title="Срочный">🔥</span>}
          {order.discount > 0 && <span className="text-green-600" title="Скидка">💰</span>}
          {order.notes && <span className="text-yellow-600" title="Примечания">📝</span>}
        </div>
        <span className="text-sm font-bold text-blue-600">
          {parseFloat(order.total).toFixed(0)} тг
        </span>
      </div>
    </div>
  )

  const renderOrderCard = (order) => (
    <div
      key={order.id}
      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-lg">{order.orderNumber}</h3>
            {getStatusBadge(order.status)}
            {order.isUrgent && (
              <span className="text-red-600" title="Срочный заказ">🔥</span>
            )}
            {order.discount > 0 && (
              <span className="text-green-600" title={`Скидка ${order.discount}%`}>💰</span>
            )}
            {order.notes && (
              <span className="text-yellow-600" title="Есть примечания">📝</span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {new Date(order.createdAt).toLocaleString('ru-RU')}
          </p>
        </div>
        <span className="text-xl font-bold text-blue-600">
          {parseFloat(order.total).toFixed(2)} тг
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Клиент */}
        <div>
          <p className="text-sm font-semibold text-gray-700">Клиент:</p>
          <p className="text-gray-900">{order.client?.name}</p>
          {order.client?.company && (
            <p className="text-sm text-gray-600">{order.client.company}</p>
          )}
          {order.client?.phone && (
            <p className="text-sm text-gray-600">📞 {order.client.phone}</p>
          )}
        </div>

        {/* Детали заказа */}
        <div>
          <p className="text-sm font-semibold text-gray-700">Детали:</p>
          {order.productName && (
            <p className="text-sm">
              <span className="font-medium">{order.productName}</span>
              {order.colorType && ` (${order.colorType})`}
            </p>
          )}
          {order.materialName && (
            <p className="text-sm">
              <span className="font-medium">{order.materialName}</span>
            </p>
          )}
          {order.quantity && (
            <p className="text-sm text-gray-600">Количество: {order.quantity} шт</p>
          )}
          {order.width && order.height && (
            <p className="text-sm text-gray-600">
              Размер: {order.width}×{order.height} м ({order.area} м²)
            </p>
          )}
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="mt-3 flex justify-end gap-3">
        <button
          onClick={() => onViewOrder(order.id)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          Подробнее
        </button>
        <button
          onClick={() => deleteOrder(order.id)}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          🗑️ Удалить
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800">Заказы</h1>
        <p className="text-gray-600 mt-2">Всего заказов: {filteredOrders.length}</p>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Фильтры</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Поиск */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Поиск по клиенту или номеру
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Имя клиента, номер заказа..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Дата от */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Дата от
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Дата до */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Дата до
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Фильтр по статусам */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📋 Статус заказа
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setStatusFilter('draft')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === 'draft'
                  ? 'bg-gray-500 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              📝 Черновик
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === 'in_progress'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              ⚙️ В процессе
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === 'approved'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              ✅ Утверждено
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === 'completed'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              🎉 Исполнено
            </button>
          </div>
        </div>

        {/* Фильтр по статусу платежа */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💳 Статус платежа
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setPaymentStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                paymentStatusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setPaymentStatusFilter('not_paid')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                paymentStatusFilter === 'not_paid'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              ❌ Не оплачено
            </button>
            <button
              onClick={() => setPaymentStatusFilter('prepaid')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                paymentStatusFilter === 'prepaid'
                  ? 'bg-yellow-500 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              💵 Предоплата
            </button>
            <button
              onClick={() => setPaymentStatusFilter('paid')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                paymentStatusFilter === 'paid'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              ✅ Оплачено 100%
            </button>
          </div>
        </div>

        {/* Режим отображения */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📊 Режим отображения
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              📋 Список
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                viewMode === 'kanban'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              📊 Канбан
            </button>
          </div>
        </div>

        {/* Группировка (только для списка) */}
        {viewMode === 'list' && (
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={groupByClient}
                onChange={(e) => setGroupByClient(e.target.checked)}
                className="mr-2 w-5 h-5"
              />
              <span className="text-sm font-medium text-gray-700">
                👥 Группировать по клиентам
              </span>
            </label>
          </div>
        )}

        {/* Кнопка сброса */}
        {(searchTerm || dateFrom || dateTo || statusFilter !== 'all' || paymentStatusFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('')
              setDateFrom('')
              setDateTo('')
              setStatusFilter('all')
              setPaymentStatusFilter('all')
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {/* Статистика */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-700">
            Общая сумма:
          </span>
          <span className="text-2xl font-bold text-blue-600">
            {calculateTotal().toFixed(2)} тг
          </span>
        </div>
      </div>

      {/* Список заказов / Канбан */}
      {viewMode === 'kanban' ? (
        /* Канбан-представление */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(groupOrdersByStatus()).map(([status, statusOrders]) => {
            const statusConfig = {
              draft: { 
                title: '📝 Черновик',
                bgColor: 'bg-gray-100',
                borderColor: 'border-gray-300',
                headerBg: 'bg-gray-500'
              },
              in_progress: {
                title: '⚙️ В процессе',
                bgColor: 'bg-blue-50',
                borderColor: 'border-blue-300',
                headerBg: 'bg-blue-500'
              },
              approved: {
                title: '✅ Утверждено',
                bgColor: 'bg-green-50',
                borderColor: 'border-green-300',
                headerBg: 'bg-green-500'
              },
              completed: {
                title: '🎉 Исполнено',
                bgColor: 'bg-purple-50',
                borderColor: 'border-purple-300',
                headerBg: 'bg-purple-600'
              }
            }

            const config = statusConfig[status]
            const columnTotal = statusOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0)

            return (
              <div 
                key={status}
                className={`rounded-lg border-2 ${config.borderColor} ${config.bgColor} overflow-hidden`}
              >
                {/* Заголовок колонки */}
                <div className={`${config.headerBg} text-white p-4`}>
                  <h3 className="font-bold text-lg mb-1">{config.title}</h3>
                  <div className="flex justify-between text-sm">
                    <span>{statusOrders.length} заказов</span>
                    <span>{columnTotal.toFixed(0)} тг</span>
                  </div>
                </div>

                {/* Карточки заказов */}
                <div className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto">
                  {statusOrders.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">Нет заказов</p>
                  ) : (
                    statusOrders.map(order => renderKanbanCard(order))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Список заказов */
        <div className="bg-white rounded-lg shadow-md p-6">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {searchTerm || dateFrom || dateTo ? 'Заказы не найдены' : 'Нет заказов'}
              </p>
            </div>
          ) : groupByClient ? (
            /* Отображение с группировкой по клиентам */
            <div className="space-y-6">
              {Object.entries(groupOrdersByClient(filteredOrders)).map(([clientName, clientOrders]) => {
                const clientTotal = clientOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0)
                return (
                  <div key={clientName} className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-indigo-300">
                      <div>
                        <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                          👤 {clientName}
                        </h3>
                        <p className="text-sm text-indigo-700">
                          Заказов: {clientOrders.length}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-indigo-700">Общая сумма:</p>
                        <p className="text-2xl font-bold text-indigo-900">
                          {clientTotal.toFixed(2)} тг
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {clientOrders.map(order => renderOrderCard(order))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Обычное отображение */
            <div className="space-y-4">
              {filteredOrders.map(order => renderOrderCard(order))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
