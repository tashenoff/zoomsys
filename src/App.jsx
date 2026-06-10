import { useState, useEffect } from 'react'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import ClientSelector from './components/ClientSelector'
import BusinessCardsCalculator from './components/BusinessCardsCalculator'
import PrintingCalculator from './components/PrintingCalculator'
import WideFormatCalculator from './components/WideFormatCalculator'
import OrdersList from './components/OrdersList'
import OrderDetail from './components/OrderDetail'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true'
  })
  const [selectedView, setSelectedView] = useState('home')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  useEffect(() => {
    localStorage.setItem('isAuthenticated', isAuthenticated)
  }, [isAuthenticated])

  const handleLogin = (auth) => {
    setIsAuthenticated(auth)
    localStorage.setItem('isAuthenticated', 'true')
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setSelectedCategory(null)
    setSelectedClient(null)
    localStorage.removeItem('isAuthenticated')
  }

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />
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
            <OrdersList onViewOrder={setSelectedOrderId} />
          ) : !selectedCategory ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Добро пожаловать!
                </h2>
                <p className="text-gray-600">
                  Быстрый расчет или выберите категорию из меню слева
                </p>
              </div>

              {/* Быстрый калькулятор визиток */}
              <BusinessCardsCalculator client={null} />
            </div>
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

              {/* Выбор клиента */}
              <ClientSelector
                selectedClient={selectedClient}
                onSelectClient={setSelectedClient}
              />

              {/* Калькулятор в зависимости от категории */}
              {selectedCategory.slug === 'business-cards' && (
                <BusinessCardsCalculator client={selectedClient} />
              )}

              {selectedCategory.slug === 'printing' && (
                <PrintingCalculator client={selectedClient} />
              )}

              {selectedCategory.slug === 'wide-format' && (
                <WideFormatCalculator client={selectedClient} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
