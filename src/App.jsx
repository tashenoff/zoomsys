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
import TextilePrintingCalculator from './components/TextilePrintingCalculator'
import FlagsProductsCalculator from './components/FlagsProductsCalculator'
import AdvertisingStandsCalculator from './components/AdvertisingStandsCalculator'
import CncLaserCalculator from './components/CncLaserCalculator'
import PlotterCuttingCalculator from './components/PlotterCuttingCalculator'
import GarmentPrintingCalculator from './components/GarmentPrintingCalculator'
import EmbroideryCalculator from './components/EmbroideryCalculator'
import SpecialistsCalculator from './components/SpecialistsCalculator'
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
    const [sidebarOpen, setSidebarOpen] = useState(false)

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
      setSelectedOrderId(null)
    }

    const handleSelectCategory = (category) => {
      setSelectedCategory(category)
      setSelectedView(null)
      setSelectedOrderId(null)
    }

  return (
      <div className="flex h-screen bg-gray-100">
        {/* Затемнение (только мобилка) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Сайдбар */}
        <Sidebar
          selectedCategory={selectedCategory}
          onSelectCategory={(c) => { handleSelectCategory(c); setSidebarOpen(false) }}
          onLogout={handleLogout}
          selectedView={selectedView}
          onSelectView={(v) => { handleSelectView(v); setSidebarOpen(false) }}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Основной контент */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-3 md:p-6">
            {/* Кнопка меню (только мобилка) */}
            <div className="md:hidden mb-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                ☰ Меню
              </button>
            </div>
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
                                      setSelectedOrderId(null)
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
                                      <UVPrintingCalculator client={selectedClient} initialCategory={selectedCategory.uvSection} />
                                    )}

                  {selectedCategory.slug === 'wide-format' && (
                                      <WideFormatCalculator client={selectedClient} initialGroup={selectedCategory.wideGroup} />
                                    )}

                  {['coat-of-arms', 'flags-rk', 'flagpoles', 'signs', 'stands', 'president-portrait'].includes(selectedCategory.slug) && (
                    <StateSymbolsCalculator client={selectedClient} categorySlug={selectedCategory.slug} />
                  )}

                  {selectedCategory.slug === 'event-services' && (
                                      <EventServicesCalculator client={selectedClient} initialCategory={selectedCategory.eventCategory} />
                                    )}

                  {selectedCategory.slug === 'textile' && (
                                      <TextilePrintingCalculator client={selectedClient} initialCategory={selectedCategory.textileCategory} />
                                    )}

                  {selectedCategory.slug === 'flags-products' && (
                                      <FlagsProductsCalculator client={selectedClient} initialCategory={selectedCategory.flagsCategory} />
                                    )}

                  {selectedCategory.slug === 'advertising-stands' && (
                    <AdvertisingStandsCalculator client={selectedClient} />
                  )}

                  {selectedCategory.slug === 'cnc-laser' && (
                                      <CncLaserCalculator client={selectedClient} initialType={selectedCategory.cncType} />
                                    )}

                  {selectedCategory.slug === 'plotter-cutting' && (
                                                        <PlotterCuttingCalculator client={selectedClient} initialMaterial={selectedCategory.plotterMaterial} />
                                                      )}

                                    {selectedCategory.slug === 'garment-printing' && (
                                      <GarmentPrintingCalculator client={selectedClient} />
                                    )}

                                    {selectedCategory.slug === 'embroidery' && (
                                                                          <EmbroideryCalculator client={selectedClient} />
                                                                        )}

                                                                        {selectedCategory.slug === 'specialists' && (
                                                                                                                                                  <SpecialistsCalculator client={selectedClient} initialGroup={selectedCategory.specialistsGroup} />
                                                                                                                                                )}
                </>
              )}

              {/* Выбор клиента (после калькулятора; не показываем для категорий, где выбор встроен в калькулятор) */}
              {['business-cards', 'printing', 'uv-printing'].includes(selectedCategory.slug) ? null : (
                <ClientSelector
                  selectedClient={selectedClient}
                  onSelectClient={setSelectedClient}
                />
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
