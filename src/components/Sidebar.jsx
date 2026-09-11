import { useState, useMemo } from 'react'
import pricingData from '../data/pricing.json'
import logo from '../logo.svg'
import { useAuth } from '../hooks/useAuth'

export default function Sidebar({ selectedCategory, onSelectCategory, onLogout, selectedView, onSelectView }) {
  const { user, hasPermission } = useAuth()
  const categories = pricingData.categories
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [search, setSearch] = useState('')

  // Реестр всех пунктов сайдбара для поиска: подкатегории + одиночные категории
  const NAV_ITEMS = useMemo(() => {
    const items = []
    const ICONS = {
      'business-cards':'💼','printing':'📄','multipage':'📚','uv-printing':'🖨️',
      'coat-of-arms':'🛡️','flags-rk':'🚩','flagpoles':'🎏','signs':'🪧','stands':'📰','president-portrait':'🖼️',
      'wide-format':'🖼️','plotter-cutting':'✂️','cnc-laser':'🪚','advertising-stands':'🪧','flags-products':'🚩','textile':'🧵',
      'garment-printing':'👕','embroidery':'🧵'
    }
    for (const cat of categories) {
      if (cat.subcategories) {
        for (const sub of cat.subcategories) {
          items.push({ label: sub.name, group: cat.name, payload: sub, icon: ICONS[sub.slug] || '📋' })
        }
      } else {
        items.push({ label: cat.name, group: 'Разделы', payload: cat, icon: ICONS[cat.slug] || '🧾' })
      }
    }
    // Хардкод-пункт не из categories: специалисты
    items.push({ label: 'Работа специалистов и техники', group: 'Разделы', payload: { id: 'specialists', name: 'Работа специалистов и техники', slug: 'specialists', description: 'Монтаж, техника, транспорт, АГП' }, icon: '🔧' })
    return items
  }, [categories])

  const q = search.trim().toLowerCase()
  const searchResults = q ? NAV_ITEMS.filter(i => i.label.toLowerCase().includes(q)).sort((a,b)=>a.label.localeCompare(b.label,'ru')) : []

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
              {/* Поиск по калькуляторам */}
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="🔍 Поиск калькулятора..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {search.trim() ? (
                /* Режим поиска — показываем только совпадения */
                <div className="space-y-1">
                  {searchResults.length === 0 ? (
                    <div className="text-sm text-gray-500 px-3 py-4 italic">Ничего не найдено</div>
                  ) : (
                    searchResults.map((item) => (
                      <button
                        key={item.payload?.id || item.label}
                        onClick={() => { onSelectCategory(item.payload); setSearch('') }}
                        className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
                          selectedCategory?.id === item.payload?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-800 hover:bg-gray-200 border border-gray-300'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className="text-lg mr-3">{item.icon}</span>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-xs text-gray-500">{item.group}</div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
              <>
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

        {/* МОБИЛЬНЫЕ КОНСТРУКЦИИ */}
        <p className="text-xs uppercase text-gray-500 font-semibold mb-2 mt-4 px-2">
          🏗️ Мобильные конструкции
        </p>
        <button
          onClick={() => onSelectCategory({ id: 'event-services', name: 'Сопровождение мероприятий', slug: 'event-services', description: 'Услуги по комплексному сопровождению мероприятий' })}
          className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
            selectedCategory?.slug === 'event-services'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          🎤 Сопровождение мероприятий
        </button>

        {/* Работа специалистов и техники */}
        <button
          onClick={() => onSelectCategory({ id: 'specialists', name: 'Работа специалистов и техники', slug: 'specialists', description: 'Монтаж, техника, транспорт, АГП' })}
          className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
            selectedCategory?.slug === 'specialists'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          🔧 Работа специалистов и техники
        </button>

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
          // Плоттерная резка
          if (!category.subcategories && category.slug === 'plotter-cutting') {
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
                ✂️ {category.name}
              </button>
            )
          }
          // Фрезерный и лазерный станок
          if (!category.subcategories && category.slug === 'cnc-laser') {
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
                🪚 {category.name}
              </button>
            )
          }
          // Рекламные стенды
          if (!category.subcategories && category.slug === 'advertising-stands') {
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
                🪧 {category.name}
              </button>
            )
          }
          // Готовая флаговая продукция
          if (!category.subcategories && category.slug === 'flags-products') {
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
                🚩 {category.name}
              </button>
            )
          }
          // Печать на текстиле
          if (!category.subcategories && category.slug === 'textile') {
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
                🧵 {category.name}
              </button>
            )
          }
          return null
        })}

          {/* Нанесение на одежду/посуду и Вышивка */}
                    {(() => {
                      const slugs = ['garment-printing','embroidery']
                      return categories.filter(c => slugs.includes(c.slug)).map(cat => (
                        <button
                          key={cat.slug}
                          onClick={() => onSelectCategory(cat)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
                            selectedCategory?.slug === cat.slug ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {cat.icon || '🧾'} {cat.name}
                        </button>
                      ))
                    })()}
                    </>
                    )}
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
