import { useState, useEffect } from 'react'
import { useOrders } from '../hooks/useOrders'

export default function Dashboard() {
  const { orders, loading, isOnline } = useOrders()
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    byStatus: {},
    byPaymentStatus: {},
    byCategory: {},
    byDate: {}
  })

  useEffect(() => {
    calculateStats()
  }, [orders])

  const calculateStats = () => {
    if (orders.length === 0) {
      setStats({
        total: 0,
        totalAmount: 0,
        byStatus: {},
        byPaymentStatus: {},
        byCategory: {},
        byDate: {}
      })
      return
    }

    const newStats = {
      total: orders.length,
      totalAmount: 0,
      byStatus: { draft: 0, in_progress: 0, approved: 0, completed: 0 },
      byPaymentStatus: { not_paid: 0, prepaid: 0, paid: 0 },
      byCategory: {},
      byDate: {}
    }

    orders.forEach(order => {
      // Сумма
      newStats.totalAmount += parseFloat(order.total || 0)

      // По статусам
      const status = order.status || 'draft'
      newStats.byStatus[status] = (newStats.byStatus[status] || 0) + 1

      // По статусу платежа
      const paymentStatus = order.paymentStatus || 'not_paid'
      newStats.byPaymentStatus[paymentStatus] = (newStats.byPaymentStatus[paymentStatus] || 0) + 1

      // По категориям (определяем по типу продукта)
      let category = 'Другое'
      if (order.productName) category = 'Визитки'
      else if (order.materialName) category = 'Широкоформат'
      else if (order.printType) category = 'УФ Печать'
      
      newStats.byCategory[category] = (newStats.byCategory[category] || 0) + 1

      // По датам (последние 7 дней)
      const date = new Date(order.createdAt).toLocaleDateString('ru-RU')
      newStats.byDate[date] = (newStats.byDate[date] || 0) + 1
    })

    setStats(newStats)
  }

  const getStatusConfig = (status) => {
    const configs = {
      draft: { 
        label: '📝 Черновик', 
        color: 'bg-gray-500',
        lightColor: 'bg-gray-100',
        textColor: 'text-gray-700'
      },
      in_progress: { 
        label: '⚙️ В процессе', 
        color: 'bg-blue-500',
        lightColor: 'bg-blue-100',
        textColor: 'text-blue-700'
      },
      approved: { 
        label: '✅ Утверждено', 
        color: 'bg-green-500',
        lightColor: 'bg-green-100',
        textColor: 'text-green-700'
      },
      completed: { 
        label: '🎉 Исполнено', 
        color: 'bg-purple-600',
        lightColor: 'bg-purple-100',
        textColor: 'text-purple-700'
      }
    }
    return configs[status] || configs.draft
  }

  const getPaymentStatusConfig = (status) => {
    const configs = {
      not_paid: { 
        label: '❌ Не оплачено', 
        color: 'bg-red-500',
        lightColor: 'bg-red-100',
        textColor: 'text-red-700'
      },
      prepaid: { 
        label: '💵 Предоплата', 
        color: 'bg-yellow-500',
        lightColor: 'bg-yellow-100',
        textColor: 'text-yellow-700'
      },
      paid: { 
        label: '✅ Оплачено', 
        color: 'bg-green-600',
        lightColor: 'bg-green-100',
        textColor: 'text-green-700'
      }
    }
    return configs[status] || configs.not_paid
  }

  // Получаем последние 7 дней для графика
  const getLast7Days = () => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push(date.toLocaleDateString('ru-RU'))
    }
    return days
  }

  const renderBarChart = () => {
    const days = getLast7Days()
    const maxOrders = Math.max(...days.map(day => stats.byDate[day] || 0), 1)
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">📊 Заказы за последние 7 дней</h2>
        <div className="flex items-end justify-between h-48 gap-2">
          {days.map(day => {
            const count = stats.byDate[day] || 0
            const height = maxOrders > 0 ? (count / maxOrders) * 100 : 0
            const dayName = new Date(day.split('.').reverse().join('-')).toLocaleDateString('ru-RU', { weekday: 'short' })
            
            return (
              <div key={day} className="flex-1 flex flex-col items-center">
                <div className="w-full flex flex-col items-center justify-end h-40">
                  {count > 0 && (
                    <>
                      <span className="text-xs font-bold text-blue-600 mb-1">{count}</span>
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-300 hover:from-blue-700 hover:to-blue-500"
                        style={{ height: `${height}%`, minHeight: count > 0 ? '20px' : '0' }}
                      ></div>
                    </>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className="text-xs font-semibold text-gray-600">{dayName}</p>
                  <p className="text-xs text-gray-500">{day.split('.').slice(0, 2).join('.')}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка данных...</p>
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
          <span className="text-yellow-700 text-sm">Работа в offline режиме. Данные будут синхронизированы при восстановлении связи.</span>
        </div>
      )}

      {/* Приветствие */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-md p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">👋 Добро пожаловать в Ra Zoom!</h1>
        <p className="text-blue-100">Система расчета полиграфической продукции</p>
      </div>

      {/* Основная статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Всего заказов */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Всего заказов</p>
              <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>

        {/* Общая сумма */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Общая сумма</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.totalAmount.toFixed(0)} <span className="text-lg">тг</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>

        {/* Исполнено */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Исполнено</p>
              <p className="text-3xl font-bold text-purple-600">{stats.byStatus.completed || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎉</span>
            </div>
          </div>
        </div>

        {/* Оплачено */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Оплачено</p>
              <p className="text-3xl font-bold text-green-600">{stats.byPaymentStatus.paid || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>
      </div>

      {/* График заказов */}
      {renderBarChart()}

      {/* Детальная статистика */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Статус заказов */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">📊 Статус заказов</h2>
          <div className="space-y-3">
            {Object.entries(stats.byStatus).map(([status, count]) => {
              const config = getStatusConfig(status)
              const percentage = stats.total > 0 ? (count / stats.total * 100).toFixed(1) : 0
              
              return (
                <div key={status}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{config.label}</span>
                    <span className="text-sm font-bold text-gray-900">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`${config.color} h-3 rounded-full transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Статус оплаты */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">💳 Статус оплаты</h2>
          <div className="space-y-3">
            {Object.entries(stats.byPaymentStatus).map(([status, count]) => {
              const config = getPaymentStatusConfig(status)
              const percentage = stats.total > 0 ? (count / stats.total * 100).toFixed(1) : 0
              
              return (
                <div key={status}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{config.label}</span>
                    <span className="text-sm font-bold text-gray-900">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`${config.color} h-3 rounded-full transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Распределение по категориям */}
      {Object.keys(stats.byCategory).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">📦 Распределение по категориям</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(stats.byCategory).map(([category, count]) => {
              const percentage = stats.total > 0 ? (count / stats.total * 100).toFixed(1) : 0
              const icons = {
                'Визитки': '💼',
                'Широкоформат': '🖼️',
                'УФ Печать': '🖨️',
                'Другое': '📄'
              }
              
              return (
                <div key={category} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl">{icons[category] || '📄'}</span>
                    <span className="text-2xl font-bold text-indigo-600">{count}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">{category}</p>
                  <p className="text-xs text-gray-500">{percentage}% от всех заказов</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Подсказка если нет заказов */}
      {stats.total === 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 text-center">
          <span className="text-6xl mb-4 block">📋</span>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Пока нет заказов</h3>
          <p className="text-gray-600 mb-4">
            Начните создавать заказы, выбрав категорию из меню слева
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <span className="px-4 py-2 bg-white rounded-lg shadow text-sm">💼 Визитки</span>
            <span className="px-4 py-2 bg-white rounded-lg shadow text-sm">📋 Листовая полиграфия</span>
            <span className="px-4 py-2 bg-white rounded-lg shadow text-sm">🖼️ Широкоформатная печать</span>
            <span className="px-4 py-2 bg-white rounded-lg shadow text-sm">🖨️ УФ печать</span>
          </div>
        </div>
      )}
    </div>
  )
}
