import { useState } from 'react'
import pricingData from '../data/pricing.json'
import logo from '../logo.svg'
import { useAuth } from '../hooks/useAuth'

export default function Sidebar({ selectedCategory, onSelectCategory, onLogout, selectedView, onSelectView }) {
  const { user, hasPermission } = useAuth()
  const categories = pricingData.categories
  const [expandedCategory, setExpandedCategory] = useState(null)

  const handleCategoryClick = (category) => {
    if (category.subcategories) {
      // Если есть подкатегории, раскрываем/скрываем их
      setExpandedCategory(expandedCategory === category.id ? null : category.id)
    } else {
      // Если нет подкатегорий, выбираем категорию
      onSelectCategory(category)
    }
  }

  return (
    <div className="w-72 bg-gray-100 text-gray-800 h-screen flex flex-col border-r border-gray-300">
      {/* Заголовок */}
      <div className="p-6 border-b border-gray-300">
        <img src={logo} alt="Ra Zoom" className="w-32 h-auto mb-2" />
        <p className="text-sm text-gray-600">Система расчета</p>
      </div>

      {/* Навигация */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {/* Главная */}
        <button
          onClick={() => onSelectView('home')}
          className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
            selectedView === 'home'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          🏠 Главная
        </button>

        {/* Заказы - только с правом viewOrders */}
        {hasPermission('viewOrders') && (
          <button
            onClick={() => onSelectView('orders')}
            className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
              selectedView === 'orders'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 Заказы
          </button>
        )}

        {/* Управление пользователями - только с правом manageUsers */}
        {hasPermission('manageUsers') && (
          <button
            onClick={() => onSelectView('users')}
            className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
              selectedView === 'users'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            👥 Пользователи
          </button>
        )}

        {/* Управление прайсами - только с правом editPricing */}
        {hasPermission('editPricing') && (
          <button
            onClick={() => onSelectView('pricing')}
            className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
              selectedView === 'pricing'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            💰 Прайсы
          </button>
        )}

        <div className="my-4 border-t border-gray-300"></div>

        {/* БЛОК: Полиграфия (объединенный с выпадающим списком) */}
        {categories.map((category) => {
          if (category.slug === 'polygraphy' && category.subcategories) {
            const isExpanded = expandedCategory === category.id
            const hasSelectedSubcategory = category.subcategories.some(sub => selectedCategory?.id === sub.id)
            
            return (
              <div key={category.id} className="mb-2">
                <button
                  onClick={() => handleCategoryClick(category)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition font-medium flex items-center justify-between ${
                    hasSelectedSubcategory
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>📄 {category.name}</span>
                  <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                </button>
                
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {category.subcategories
                      .filter(sub => sub.slug !== 'uv-printing') // УФ печать в специализированной печати
                      .map((subcategory) => {
                        let icon = '📋'
                        if (subcategory.slug === 'business-cards') icon = '💼'
                        if (subcategory.slug === 'multipage') icon = '📚'
                        
                        return (
                          <button
                            key={subcategory.id}
                            onClick={() => onSelectCategory(subcategory)}
                            className={`w-full text-left px-4 py-2 rounded-lg transition text-sm ${
                              selectedCategory?.id === subcategory.id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {icon} {subcategory.name}
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>
            )
          }
          return null
        })}

        {/* БЛОК: Государственная символика */}
        {categories.map((category) => {
          if (category.slug === 'state-symbols' && category.subcategories) {
            const isExpanded = expandedCategory === category.id
            const hasSelectedSubcategory = category.subcategories.some(sub => selectedCategory?.id === sub.id)

            return (
              <div key={category.id}>
                <button
                  onClick={() => handleCategoryClick(category)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition font-medium flex items-center justify-between ${
                    hasSelectedSubcategory
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>🏳️ {category.name}</span>
                  <span>{isExpanded ? '▾' : '▸'}</span>
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {category.subcategories.map((subcategory) => {
                      let icon = '📋'
                      if (subcategory.slug === 'coat-of-arms') icon = '🛡️'
                      if (subcategory.slug === 'flags-rk') icon = '🚩'
                      if (subcategory.slug === 'flagpoles') icon = '🎏'
                      if (subcategory.slug === 'signs') icon = '🪧'
                      if (subcategory.slug === 'stands') icon = '📰'
                      if (subcategory.slug === 'president-portrait') icon = '🖼️'

                      return (
                        <button
                          key={subcategory.id}
                          onClick={() => onSelectCategory(subcategory)}
                          className={`w-full text-left px-4 py-2 rounded-lg transition text-sm ${
                            selectedCategory?.id === subcategory.id
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {icon} {subcategory.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          return null
        })}

        {/* БЛОК: Индивидуальный расчет */}
        <p className="text-xs uppercase text-gray-500 font-semibold mb-2 mt-4 px-2">
          🛠️ Индивидуальный расчет
        </p>
        <div className="text-sm text-gray-500 px-4 py-2 italic bg-gray-50 rounded-lg mx-1">
          🚧 В разработке
        </div>

        {/* СПЕЦИАЛИЗИРОВАННАЯ ПЕЧАТЬ */}
        <p className="text-xs uppercase text-gray-500 font-semibold mb-2 mt-4 px-2">
          ✨ Специализированная печать
        </p>
        {categories.map((category) => {
          // УФ печать
          if (category.subcategories) {
            return category.subcategories.filter(sub => sub.slug === 'uv-printing').map((subcategory) => (
              <button
                key={subcategory.id}
                onClick={() => onSelectCategory(subcategory)}
                className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
                  selectedCategory?.id === subcategory.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                🖨️ {subcategory.name}
              </button>
            ))
          }
          // Широкоформатная печать
          if (!category.subcategories && category.slug === 'wide-format') {
            return (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category)}
                className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
                  selectedCategory?.id === category.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                🖼️ {category.name}
              </button>
            )
          }
          return null
        })}
      </nav>

      {/* Информация о пользователе */}
      <div className="p-4 border-t border-gray-300">
        <div className="mb-3">
          <p className="text-xs text-gray-500">Пользователь</p>
          <p className="text-sm font-semibold text-gray-800">{user?.fullName || 'Пользователь'}</p>
          <p className="text-xs text-gray-500">
            {user?.role === 'admin' ? '👑 Администратор' : 
             user?.role === 'manager' ? '📊 Менеджер' : '👤 Пользователь'}
          </p>
        </div>
        <button
          onClick={onLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition text-sm"
        >
          Выход
        </button>
      </div>
    </div>
  )
}
