import { useState } from 'react'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import ClientSelector from './components/ClientSelector'
import BusinessCardsCalculator from './components/BusinessCardsCalculator'
import PrintingCalculator from './components/PrintingCalculator'
import WideFormatCalculator from './components/WideFormatCalculator'
import UVPrintingCalculator from './components/UVPrintingCalculator'
import StateSymbolsCalculator from './components/StateSymbolsCalculator'
import EventServicesCalculator from './components/EventServicesCalculator'
import OrdersList from './components/OrdersList'
import OrderDetail from './components/OrderDetail'
import Dashboard from './components/Dashboard'
import UserManagement from './components/UserManagement'
import PricingManagement from './components/PricingManagement'
import { PricingProvider } from './hooks/usePricing'
import { OrdersProvider } from './hooks/useOrders'
import { ClientsProvider } from './hooks/useClients'
import { AuthProvider, useAuth } from './hooks/useAuth'

// Компонент "Нет доступа"
function AccessDenied({ message }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-12 text-center">
      <div className="text-6xl mb-4">🚫</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Доступ запрещён</h2>
      <p className="text-gray-600">{message || 'У вас недостаточно прав для просмотра этой страницы'}</p>
    </div>
  )
}

function AppContent() {
  const { isAuthenticated, loading, logout, user, hasPermission } = useAuth()
  const [selectedView, setSelectedView] = useState('home')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  const handleLogout = () => {
    logout()
    setSelectedCategory(null)
    setSelectedClient(null)
  }

  // Показываем загрузку пока проверяем токен
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Auth />
  }

  const handleSelectView = (view) => {
    setSelectedView(view)
    setSelectedCategory(null)
    setSelectedClient(null)
  }

  const handleSelectCategory = (category) => {
    setSelectedCategory(category)
    setSelectedView(null)
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Сайдбар */}
      <Sidebar
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        onLogout={handleLogout}
        selectedView={selectedView}
        onSelectView={handleSelectView}
      />

      {/* Основной контент */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {selectedOrderId ? (
            <OrderDetail 
              orderId={selectedOrderId} 
              onBack={() => setSelectedOrderId(null)} 
            />
          ) : selectedView === 'orders' ? (
            hasPermission('viewOrders') ? (
              <OrdersList onViewOrder={setSelectedOrderId} />
            ) : (
              <AccessDenied message="У вас нет прав для просмотра заказов" />
            )
          ) : selectedView === 'users' ? (
            hasPermission('manageUsers') ? (
              <UserManagement />
            ) : (
              <AccessDenied message="У вас нет прав для управления пользователями" />
            )
          ) : selectedView === 'pricing' ? (
            hasPermission('editPricing') ? (
              <PricingManagement />
            ) : (
              <AccessDenied message="У вас нет прав для редактирования прайсов" />
            )
          ) : !selectedCategory ? (
            hasPermission('viewDashboard') ? (
              <Dashboard />
            ) : (
              <AccessDenied message="У вас нет прав для просмотра дашборда" />
            )
          ) : (
            <div className="space-y-6">
              {/* Хлебные крошки */}
              <div className="flex items-center text-sm text-gray-600">
                <button
                  onClick={() => {
                    setSelectedCategory(null)
                    setSelectedClient(null)
                  }}
                  className="hover:text-blue-600"
                >
                  Главная
                </button>
                <span className="mx-2">/</span>
                <span className="font-semibold text-gray-800">
                  {selectedCategory.name}
                </span>
              </div>

              {/* Заголовок категории */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-3xl font-bold text-gray-800">
                  {selectedCategory.name}
                </h1>
                <p className="text-gray-600 mt-2">{selectedCategory.description}</p>
              </div>

              {/* Выбор клиента (не показываем для УФ печати, т.к. он встроен в калькулятор) */}
              {selectedCategory.slug !== 'uv-printing' && (
                <ClientSelector
                  selectedClient={selectedClient}
                  onSelectClient={setSelectedClient}
                />
              )}

              {/* Калькулятор в зависимости от категории */}
              {!hasPermission('createOrders') ? (
                <AccessDenied message="У вас нет прав для создания заказов" />
              ) : (
                <>
                  {selectedCategory.slug === 'business-cards' && (
                    <BusinessCardsCalculator client={selectedClient} />
                  )}

                  {selectedCategory.slug === 'printing' && (
                    <PrintingCalculator client={selectedClient} />
                  )}

                  {selectedCategory.slug === 'uv-printing' && (
                    <UVPrintingCalculator client={selectedClient} />
                  )}

                  {selectedCategory.slug === 'wide-format' && (
                    <WideFormatCalculator client={selectedClient} />
                  )}

                  {['coat-of-arms', 'flags-rk', 'flagpoles', 'signs', 'stands', 'president-portrait'].includes(selectedCategory.slug) && (
                    <StateSymbolsCalculator client={selectedClient} categorySlug={selectedCategory.slug} />
                  )}

                  {selectedCategory.slug === 'event-services' && (
                    <EventServicesCalculator client={selectedClient} />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <PricingProvider>
        <ClientsProvider>
          <OrdersProvider>
            <AppContent />
          </OrdersProvider>
        </ClientsProvider>
      </PricingProvider>
    </AuthProvider>
  )
}

export default App
