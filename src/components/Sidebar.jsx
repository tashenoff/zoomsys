import { useState, useMemo } from 'react'
import pricingData from '../data/pricing.json'
import logo from '../logo.svg'
import { getDisplayCategories } from '../lib/catalog.mjs'
import { useAuth } from '../hooks/useAuth'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import {
  UV_SECTIONS,
  WIDE_GROUPS,
  TEXTILE_CATEGORIES,
  FLAG_CATEGORIES,
  PLOTTER_MATERIALS,
  CNC_TYPES,
  SPECIALIST_GROUPS,
  EVENT_GROUPS
} from '../lib/navCatalog'

export default function Sidebar({ selectedCategory, onSelectCategory, selectedView, onSelectView, open, onClose }) {
  const { hasPermission } = useAuth()
  const categories = useMemo(() => getDisplayCategories(pricingData.categories), [])
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
    <div className={`fixed inset-y-0 left-0 z-40 w-80 bg-gray-100 text-gray-800 flex flex-col border-r border-gray-300 transition-transform duration-300 md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Заголовок */}
          <div className="p-6 border-b border-gray-300 flex items-start justify-between">
            <div>
              <img src={logo} alt="Ra Zoom" className="w-32 h-auto mb-2" />
              <p className="text-sm text-gray-600">Система расчета</p>
            </div>
            {/* Закрыть (только мобилка) */}
            <button
              onClick={onClose}
              className="md:hidden text-2xl leading-none text-gray-500 hover:text-gray-800 p-1"
              aria-label="Закрыть меню"
            >
              ✕
            </button>
          </div>

      {/* Навигация */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {/* Главная */}
        <button
          onClick={() => onSelectView('home')}
          className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
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
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
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
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
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
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
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
                  className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
                    hasSelectedSubcategory
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>📄 {category.name}</span>
                  <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
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
                            className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
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
                  className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
                    hasSelectedSubcategory
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>🏳️ {category.name}</span>
                  <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
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
                          className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
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

        {/* Мероприятия — раскрывающийся список разделов */}
        <div className="mb-2">
          <button
            onClick={() => setExpandedCategory(expandedCategory === 'event-services' ? null : 'event-services')}
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
              selectedCategory?.slug === 'event-services'
                ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>🎪 Мероприятия</span>
            <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${expandedCategory === 'event-services' ? 'rotate-180' : ''}`} />
          </button>
          {expandedCategory === 'event-services' && (
            <div className="ml-4 mt-1 space-y-1">
              {EVENT_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onSelectCategory({ id: 'event-services', name: 'Мероприятия', slug: 'event-services', eventCategory: g.id })}
                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                    selectedCategory?.slug === 'event-services' && selectedCategory.eventCategory === g.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {g.icon} {g.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Работа специалистов и техники — раскрывающийся список */}
                <div className="mb-2">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === 'specialists' ? null : 'specialists')}
                    className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
                      selectedCategory?.slug === 'specialists'
                        ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>🔧 Работа специалистов и техники</span>
                    <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${expandedCategory === 'specialists' ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedCategory === 'specialists' && (
                    <div className="ml-4 mt-1 space-y-1">
                      {SPECIALIST_GROUPS.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => onSelectCategory({ id: 'specialists', name: 'Работа специалистов и техники', slug: 'specialists', specialistsGroup: g.id, description: 'Монтаж, техника, транспорт, АГП' })}
                          className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                            selectedCategory?.slug === 'specialists' && selectedCategory.specialistsGroup === g.id
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {g.icon} {g.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

        {/* СПЕЦИАЛИЗИРОВАННАЯ ПЕЧАТЬ (разделы без заголовка) */}
        {categories.map((category) => {
          // УФ печать — раскрывающийся список разделов (как Государственная символика)
                    if (category.subcategories) {
                      return category.subcategories.filter(sub => sub.slug === 'uv-printing').map((subcategory) => {
                        const isUvExpanded = expandedCategory === 'uv-printing'
                        const activeUvSection = selectedCategory?.slug === 'uv-printing' ? selectedCategory.uvSection : null
                        return (
                          <div key={subcategory.id} className="mb-2">
                            <button
                              onClick={() => setExpandedCategory(isUvExpanded ? null : 'uv-printing')}
                              className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
                                selectedCategory?.slug === 'uv-printing'
                                  ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                                  : 'text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <span>🖨️ {subcategory.name}</span>
                              <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${isUvExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isUvExpanded && (
                              <div className="ml-4 mt-1 space-y-1">
                                {UV_SECTIONS.map((section) => (
                                  <button
                                    key={section.id}
                                    onClick={() => onSelectCategory({ ...subcategory, uvSection: section.id })}
                                    className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                      activeUvSection === section.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {section.icon} {section.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    }
          // Широкоформатная печать — раскрывающийся список оборудования (как УФ печать)
                    if (!category.subcategories && category.slug === 'wide-format') {
                      const isWideExpanded = expandedCategory === 'wide-format'
                      const activeWideGroup = selectedCategory?.slug === 'wide-format' ? selectedCategory.wideGroup : null
                      return (
                        <div key={category.id} className="mb-2">
                          <button
                            onClick={() => setExpandedCategory(isWideExpanded ? null : 'wide-format')}
                            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
                              selectedCategory?.slug === 'wide-format'
                                ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                                : 'text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <span>🖼️ {category.name}</span>
                            <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${isWideExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isWideExpanded && (
                            <div className="ml-4 mt-1 space-y-1">
                              {WIDE_GROUPS.map((group) => (
                                <button
                                  key={group.id}
                                  onClick={() => onSelectCategory({ ...category, wideGroup: group.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activeWideGroup === group.id
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {group.icon} {group.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
          // Плоттерная резка — раскрывающийся список материалов
                    if (!category.subcategories && category.slug === 'plotter-cutting') {
                      const isPlotterExpanded = expandedCategory === 'plotter-cutting'
                      const activePlotterMat = selectedCategory?.slug === 'plotter-cutting' ? selectedCategory.plotterMaterial : null
                      return (
                        <div key={category.id} className="mb-2">
                          <button
                            onClick={() => setExpandedCategory(isPlotterExpanded ? null : 'plotter-cutting')}
                            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
                              selectedCategory?.slug === 'plotter-cutting'
                                ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                                : 'text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <span>✂️ {category.name}</span>
                            <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${isPlotterExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isPlotterExpanded && (
                            <div className="ml-4 mt-1 space-y-1">
                              {PLOTTER_MATERIALS.map((mat) => (
                                <button
                                  key={mat.id}
                                  onClick={() => onSelectCategory({ ...category, plotterMaterial: mat.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activePlotterMat === mat.id
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {mat.icon} {mat.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
                    // Фрезерный и лазерный станок — раскрывающийся список типов операции
                    if (!category.subcategories && category.slug === 'cnc-laser') {
                      const isCncExpanded = expandedCategory === 'cnc-laser'
                      const activeCncType = selectedCategory?.slug === 'cnc-laser' ? selectedCategory.cncType : null
                      return (
                        <div key={category.id} className="mb-2">
                          <button
                            onClick={() => setExpandedCategory(isCncExpanded ? null : 'cnc-laser')}
                            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
                              selectedCategory?.slug === 'cnc-laser'
                                ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                                : 'text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <span>🪚 {category.name}</span>
                            <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${isCncExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isCncExpanded && (
                            <div className="ml-4 mt-1 space-y-1">
                              {CNC_TYPES.map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => onSelectCategory({ ...category, cncType: t.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activeCncType === t.id
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {t.icon} {t.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
          // Рекламные стенды
          if (!category.subcategories && category.slug === 'advertising-stands') {
            return (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category)}
                className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
                  selectedCategory?.id === category.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                🪧 {category.name}
              </button>
            )
          }
          // Готовая флаговая продукция — раскрывающийся список категорий
                    if (!category.subcategories && category.slug === 'flags-products') {
                      const isFlagsExpanded = expandedCategory === 'flags-products'
                      const activeFlagsCat = selectedCategory?.slug === 'flags-products' ? selectedCategory.flagsCategory : null
                      return (
                        <div key={category.id} className="mb-2">
                          <button
                            onClick={() => setExpandedCategory(isFlagsExpanded ? null : 'flags-products')}
                            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
                              selectedCategory?.slug === 'flags-products'
                                ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                                : 'text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <span>🚩 {category.name}</span>
                            <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${isFlagsExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isFlagsExpanded && (
                            <div className="ml-4 mt-1 space-y-1">
                              {FLAG_CATEGORIES.map((cat) => (
                                <button
                                  key={cat.id}
                                  onClick={() => onSelectCategory({ ...category, flagsCategory: cat.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activeFlagsCat === cat.id
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {cat.icon} {cat.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
          // Печать на текстиле — раскрывающийся список типов печати
                    if (!category.subcategories && category.slug === 'textile') {
                      const isTextileExpanded = expandedCategory === 'textile'
                      const activeTextileCategory = selectedCategory?.slug === 'textile' ? selectedCategory.textileCategory : null
                      return (
                        <div key={category.id} className="mb-2">
                          <button
                            onClick={() => setExpandedCategory(isTextileExpanded ? null : 'textile')}
                            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium flex items-center justify-between ${
                              selectedCategory?.slug === 'textile'
                                ? 'bg-blue-100 text-blue-800 border-2 border-blue-400'
                                : 'text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <span>🧵 {category.name}</span>
                            <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${isTextileExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isTextileExpanded && (
                            <div className="ml-4 mt-1 space-y-1">
                              {TEXTILE_CATEGORIES.map((cat) => (
                                <button
                                  key={cat.id}
                                  onClick={() => onSelectCategory({ ...category, textileCategory: cat.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activeTextileCategory === cat.id
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  {cat.icon} {cat.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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
                          className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
                            selectedCategory?.slug === cat.slug ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {cat.icon || '🧾'} {cat.name}
                                                  </button>
                                                ))
                                              })()}

                                    {categories.filter(c => c.slug === 'additional-services').map(cat => (
                                      <button
                                        key={cat.slug}
                                        onClick={() => onSelectCategory(cat)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
                                          selectedCategory?.slug === cat.slug ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                                        }`}
                                      >
                                        🧩 {cat.name}
                                      </button>
                                    ))}
                      </nav>

    </div>
  )
}
