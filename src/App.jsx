import { useRef, useState } from 'react'
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
import AdditionalServicesCalculator from './components/AdditionalServicesCalculator'
import OrdersList from './components/OrdersList'
import OrderDetail from './components/OrderDetail'
import Dashboard from './components/Dashboard'
import UserManagement from './components/UserManagement'
import PricingManagement from './components/PricingManagement'
import TopNavbar from './components/TopNavbar'
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
    const [priceSearch, setPriceSearch] = useState(null)
    const searchNavigation = useRef(0)

  const handleLogout = () => {
    logout()
    setSelectedCategory(null)
    setSelectedClient(null)
    setPriceSearch(null)
    setSidebarOpen(false)
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
      setPriceSearch(null)
      setSidebarOpen(false)
    }

    const handleSelectCategory = (category) => {
      // A search selection starts fresh, including repeated selections of the same record.
      setSelectedCategory(category.searchKey ? { ...category, searchKey: `${category.searchKey}:${++searchNavigation.current}` } : category)
      setSelectedView(null)
      setSelectedOrderId(null)
      setPriceSearch(null)
      setSidebarOpen(false)
    }

    const handlePriceSearch = ({ query, focusId }) => {
      setPriceSearch({ query, focusId: focusId || null })
      setSelectedView('pricing')
      setSelectedCategory(null)
      setSelectedClient(null)
      setSelectedOrderId(null)
      setSidebarOpen(false)
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
          onSelectCategory={handleSelectCategory}
          selectedView={selectedView}
          onSelectView={handleSelectView}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Основной контент */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopNavbar
            onOpenMenu={() => setSidebarOpen(true)}
            onLogout={handleLogout}
            onSelectView={handleSelectView}
            onSelectCategory={handleSelectCategory}
          />
          <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-3 md:p-6">
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
              <PricingManagement
                searchQuery={priceSearch?.query || ''}
                focusItemId={priceSearch?.focusId || null}
                onClearSearch={() => setPriceSearch(null)}
              />
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
                    <BusinessCardsCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialItemId={selectedCategory.catalogSource === 'businessCards' ? selectedCategory.catalogItemId : null}
                      initialCardType={selectedCategory.cardType}
                    />
                  )}

                  {selectedCategory.slug === 'printing' && (
                    <PrintingCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialCategory={selectedCategory.printingCategory}
                      initialProductId={selectedCategory.printingProductId}
                      initialColorType={selectedCategory.catalogVariant?.kind === 'printing-color' ? selectedCategory.catalogVariant.value : null}
                    />
                  )}

                  {selectedCategory.slug === 'uv-printing' && (
                    <UVPrintingCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialCategory={selectedCategory.uvSection}
                      initialProductId={selectedCategory.catalogSource === 'uvPrinting' ? selectedCategory.catalogItemId : null}
                      initialSide={selectedCategory.catalogVariant?.kind === 'uv-side' ? selectedCategory.catalogVariant.value : null}
                      initialMaterial={selectedCategory.catalogVariant?.kind === 'uv-material' ? selectedCategory.catalogVariant.value : null}
                    />
                  )}

                  {selectedCategory.slug === 'wide-format' && (
                    <WideFormatCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialGroup={selectedCategory.wideGroup}
                      initialMaterialId={selectedCategory.wideMaterialId}
                    />
                  )}

                  {['coat-of-arms', 'flags-rk', 'flagpoles', 'signs', 'stands', 'president-portrait'].includes(selectedCategory.slug) && (
                    <StateSymbolsCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      categorySlug={selectedCategory.slug}
                      initialItemId={selectedCategory.catalogSource === 'stateSymbols' ? selectedCategory.catalogItemId : null}
                    />
                  )}

                  {selectedCategory.slug === 'event-services' && (
                    <EventServicesCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialCategory={selectedCategory.eventCategory}
                      initialItemId={selectedCategory.catalogSource === 'eventServices' ? selectedCategory.catalogItemId : null}
                      initialPrintOption={selectedCategory.catalogVariant?.kind === 'event-print' ? selectedCategory.catalogVariant.value : null}
                    />
                  )}

                  {selectedCategory.slug === 'textile' && (
                    <TextilePrintingCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialCategory={selectedCategory.textileCategory}
                      initialMaterialId={selectedCategory.textileMaterialId}
                    />
                  )}

                  {selectedCategory.slug === 'flags-products' && (
                    <FlagsProductsCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialCategory={selectedCategory.flagsCategory}
                      initialItemId={selectedCategory.flagsItemId}
                      initialSize={selectedCategory.catalogVariant?.kind === 'flag-size' ? selectedCategory.catalogVariant.value : null}
                    />
                  )}

                  {selectedCategory.slug === 'advertising-stands' && (
                    <AdvertisingStandsCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialItemId={selectedCategory.catalogSource === 'advertisingStands' ? selectedCategory.catalogItemId : null}
                      initialThickness={selectedCategory.catalogVariant?.kind === 'stand-thickness' ? selectedCategory.catalogVariant.value : null}
                    />
                  )}

                  {selectedCategory.slug === 'cnc-laser' && (
                    <CncLaserCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialType={selectedCategory.cncType}
                      initialItemId={selectedCategory.catalogSource === 'cncLaser' ? selectedCategory.catalogItemId : null}
                      initialThickness={selectedCategory.catalogVariant?.kind === 'cnc-thickness' ? selectedCategory.catalogVariant.value : null}
                    />
                  )}

                  {selectedCategory.slug === 'plotter-cutting' && (
                    <PlotterCuttingCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialMaterial={selectedCategory.plotterMaterial}
                      initialItemId={selectedCategory.catalogSource === 'plotterCutting' ? selectedCategory.catalogItemId : null}
                    />
                  )}

                  {selectedCategory.slug === 'garment-printing' && (
                    <GarmentPrintingCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialItemId={selectedCategory.catalogSource === 'garmentPrinting' ? selectedCategory.catalogItemId : null}
                      initialProductId={['garment-product', 'garment-variant'].includes(selectedCategory.catalogVariant?.kind) ? selectedCategory.catalogVariant.productId : null}
                      initialVariantId={selectedCategory.catalogVariant?.kind === 'garment-variant' ? selectedCategory.catalogVariant.variantId : null}
                    />
                  )}

                  {selectedCategory.slug === 'embroidery' && (
                    <EmbroideryCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialItemId={selectedCategory.catalogSource === 'embroidery' ? selectedCategory.catalogItemId : null}
                    />
                  )}

                  {selectedCategory.slug === 'specialists' && (
                    <SpecialistsCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialGroup={selectedCategory.specialistsGroup}
                      initialItemId={selectedCategory.catalogSource === 'eventServices' ? selectedCategory.catalogItemId : null}
                    />
                  )}

                  {selectedCategory.slug === 'additional-services' && (
                    <AdditionalServicesCalculator
                      key={selectedCategory.searchKey}
                      client={selectedClient}
                      initialItemId={selectedCategory.catalogSource === 'additionalServices' ? selectedCategory.catalogItemId : null}
                    />
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
