import { useState, useMemo } from 'react'
import pricingData from '../data/pricing.json'
import RazoomLogo from './RazoomLogo'
import { getDisplayCategories } from '../lib/catalog.mjs'
import { useAuth } from '../hooks/useAuth'
import {
  Bars3Icon, XMarkIcon, ChevronDownIcon, HomeIcon, ClipboardDocumentListIcon,
  UsersIcon, CurrencyDollarIcon, DocumentDuplicateIcon, DocumentTextIcon,
  BuildingLibraryIcon, TicketIcon, WrenchScrewdriverIcon, SunIcon, PhotoIcon,
  ScissorsIcon, CpuChipIcon, PresentationChartBarIcon, FlagIcon,
  Square3Stack3DIcon, ShoppingBagIcon, SparklesIcon, PuzzlePieceIcon,
  IdentificationIcon, PrinterIcon, BookOpenIcon, ShieldCheckIcon, UserCircleIcon,
  PencilSquareIcon, TruckIcon
} from '@heroicons/react/24/outline'
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

const NAV_ICONS = {
  home: HomeIcon, orders: ClipboardDocumentListIcon, users: UsersIcon, pricing: CurrencyDollarIcon,
  polygraphy: DocumentDuplicateIcon, 'state-symbols': BuildingLibraryIcon,
  'event-services': TicketIcon, specialists: WrenchScrewdriverIcon,
  'uv-printing': SunIcon, 'wide-format': PhotoIcon, 'plotter-cutting': ScissorsIcon,
  'cnc-laser': CpuChipIcon, 'advertising-stands': PresentationChartBarIcon,
  'flags-products': FlagIcon, textile: Square3Stack3DIcon, 'garment-printing': ShoppingBagIcon,
  embroidery: SparklesIcon, 'additional-services': PuzzlePieceIcon,
  'business-cards': IdentificationIcon, printing: PrinterIcon, multipage: BookOpenIcon,
  'coat-of-arms': ShieldCheckIcon, 'flags-rk': FlagIcon, flagpoles: FlagIcon,
  stands: PresentationChartBarIcon, 'president-portrait': UserCircleIcon,
  pens: PencilSquareIcon, cards: IdentificationIcon, promotional: ShoppingBagIcon,
  notebooks: BookOpenIcon, 'notebooks-image': PhotoIcon, materials: Square3Stack3DIcon,
  mimaki: PrinterIcon, roland: PrinterIcon, sublimation: SunIcon, direct: PrinterIcon,
  mesh: Square3Stack3DIcon, service: WrenchScrewdriverIcon,
  'flags-size': FlagIcon, 'desk-flags': FlagIcon, 'auto-flags': FlagIcon,
  ribbons: SparklesIcon, scarves: Square3Stack3DIcon, milling: CpuChipIcon,
  engrave: PencilSquareIcon, mount: WrenchScrewdriverIcon, work: UsersIcon,
  transport: TruckIcon, agp: TruckIcon, mobile: PresentationChartBarIcon, rent: TicketIcon
}

function NavigationLabel({ type, children, compact = false }) {
  const Icon = NAV_ICONS[type] || DocumentTextIcon
  return (
    <span className="flex min-w-0 items-center gap-3" title={children}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className={compact ? 'sr-only' : 'text-left'}>{children}</span>
    </span>
  )
}

export default function Sidebar({ selectedCategory, onSelectCategory, selectedView, onSelectView, open, onClose }) {
  const { hasPermission } = useAuth()
  const categories = useMemo(() => getDisplayCategories(pricingData.categories), [])
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [collapsed, setCollapsed] = useState(true)
  const compact = collapsed && !open
  const toggleGroup = (id) => {
    setExpandedCategory(compact || expandedCategory !== id ? id : null)
    setCollapsed(false)
  }
  const handleCategoryClick = (category) => {
    if (category.subcategories) {
      // Если есть подкатегории, раскрываем/скрываем их
      toggleGroup(category.id)
    } else {
      // Если нет подкатегорий, выбираем категорию
      onSelectCategory(category)
    }
  }

  return (
    <div data-collapsed={compact} className={`sidebar fixed inset-y-0 left-0 z-40 w-80 shrink-0 bg-white text-slate-600 flex flex-col border-r border-slate-200 transition-[width,transform] duration-200 motion-reduce:transition-none md:static md:translate-x-0 ${compact ? 'md:w-14' : 'md:w-80'} ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Заголовок */}
          <div className={`flex min-h-16 items-center gap-3 border-b border-slate-200 ${compact ? 'p-2' : 'p-4'}`}>
            <button
              type="button"
              onClick={() => setCollapsed(value => !value)}
              aria-label={compact ? 'Развернуть меню' : 'Свернуть меню'}
              title={compact ? 'Развернуть меню' : 'Свернуть меню'}
              aria-expanded={!compact}
              aria-controls="sidebar-navigation"
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 md:flex"
            >
              <Bars3Icon className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className={compact ? 'hidden' : 'flex-1'}>
              {!compact && <RazoomLogo alt="Ra Zoom" className="w-32 h-auto mb-2" />}
              <p className="text-sm text-gray-600">Система расчета</p>
            </div>
            {/* Закрыть (только мобилка) */}
            <button
              onClick={onClose}
              type="button"
              className="md:hidden ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Закрыть меню"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

      {/* Навигация */}
            <nav id="sidebar-navigation" aria-label="Основная навигация" className={`flex-1 space-y-2 overflow-y-auto ${compact ? 'p-1.5' : 'p-4'}`}>
              {/* Главная */}
        <button
          onClick={() => onSelectView('home')}
          className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
            selectedView === 'home'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <NavigationLabel type="home" compact={compact}>Главная</NavigationLabel>
        </button>

        {/* Заказы - только с правом viewOrders */}
        {hasPermission('viewOrders') && (
          <button
            onClick={() => onSelectView('orders')}
            className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
              selectedView === 'orders'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <NavigationLabel type="orders" compact={compact}>Заказы</NavigationLabel>
          </button>
        )}

        {/* Управление пользователями - только с правом manageUsers */}
        {hasPermission('manageUsers') && (
          <button
            onClick={() => onSelectView('users')}
            className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
              selectedView === 'users'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <NavigationLabel type="users" compact={compact}>Пользователи</NavigationLabel>
          </button>
        )}

        {/* Управление прайсами - только с правом editPricing */}
        {hasPermission('editPricing') && (
          <button
            onClick={() => onSelectView('pricing')}
            className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
              selectedView === 'pricing'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <NavigationLabel type="pricing" compact={compact}>Прайсы</NavigationLabel>
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
                  aria-expanded={expandedCategory === category.id && !compact}
                  className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
                    hasSelectedSubcategory
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <NavigationLabel type={category.slug} compact={compact}>{category.name}</NavigationLabel>
                  <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                
                {isExpanded && (
                  <div className="sidebar-submenu ml-4 mt-1 space-y-1">
                    {category.subcategories
                      .filter(sub => sub.slug !== 'uv-printing') // УФ печать в специализированной печати
                      .map((subcategory) => {
                        return (
                          <button
                            key={subcategory.id}
                            onClick={() => onSelectCategory(subcategory)}
                            className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                              selectedCategory?.id === subcategory.id
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <NavigationLabel type={subcategory.slug}>{subcategory.name}</NavigationLabel>
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
                  aria-expanded={expandedCategory === category.id && !compact}
                  className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
                    hasSelectedSubcategory
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <NavigationLabel type={category.slug} compact={compact}>{category.name}</NavigationLabel>
                  <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="sidebar-submenu ml-4 mt-1 space-y-1">
                    {category.subcategories.map((subcategory) => {
                      return (
                        <button
                          key={subcategory.id}
                          onClick={() => onSelectCategory(subcategory)}
                          className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                            selectedCategory?.id === subcategory.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <NavigationLabel type={subcategory.slug}>{subcategory.name}</NavigationLabel>
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
            onClick={() => toggleGroup('event-services')}
                  aria-expanded={expandedCategory === 'event-services' && !compact}
            className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
              selectedCategory?.slug === 'event-services'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <NavigationLabel type="event-services" compact={compact}>Мероприятия</NavigationLabel>
            <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${expandedCategory === 'event-services' ? 'rotate-180' : ''}`} />
          </button>
          {expandedCategory === 'event-services' && (
            <div className="sidebar-submenu ml-4 mt-1 space-y-1">
              {EVENT_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onSelectCategory({ id: 'event-services', name: 'Мероприятия', slug: 'event-services', eventCategory: g.id })}
                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                    selectedCategory?.slug === 'event-services' && selectedCategory.eventCategory === g.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <NavigationLabel type={g.id}>{g.name}</NavigationLabel>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Работа специалистов и техники — раскрывающийся список */}
                <div className="mb-2">
                  <button
                    onClick={() => toggleGroup('specialists')}
                  aria-expanded={expandedCategory === 'specialists' && !compact}
                    className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
                      selectedCategory?.slug === 'specialists'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <NavigationLabel type="specialists" compact={compact}>Работа специалистов и техники</NavigationLabel>
                    <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${expandedCategory === 'specialists' ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedCategory === 'specialists' && (
                    <div className="sidebar-submenu ml-4 mt-1 space-y-1">
                      {SPECIALIST_GROUPS.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => onSelectCategory({ id: 'specialists', name: 'Работа специалистов и техники', slug: 'specialists', specialistsGroup: g.id, description: 'Монтаж, техника, транспорт, АГП' })}
                          className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                            selectedCategory?.slug === 'specialists' && selectedCategory.specialistsGroup === g.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <NavigationLabel type={g.id}>{g.name}</NavigationLabel>
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
                              onClick={() => toggleGroup('uv-printing')}
                  aria-expanded={expandedCategory === 'uv-printing' && !compact}
                              className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
                                selectedCategory?.slug === 'uv-printing'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <NavigationLabel type={subcategory.slug} compact={compact}>{subcategory.name}</NavigationLabel>
                              <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${isUvExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isUvExpanded && (
                              <div className="sidebar-submenu ml-4 mt-1 space-y-1">
                                {UV_SECTIONS.map((section) => (
                                  <button
                                    key={section.id}
                                    onClick={() => onSelectCategory({ ...subcategory, uvSection: section.id })}
                                    className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                      activeUvSection === section.id
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <NavigationLabel type={section.id}>{section.name}</NavigationLabel>
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
                            onClick={() => toggleGroup('wide-format')}
                  aria-expanded={expandedCategory === 'wide-format' && !compact}
                            className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
                              selectedCategory?.slug === 'wide-format'
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <NavigationLabel type={category.slug} compact={compact}>{category.name}</NavigationLabel>
                            <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${isWideExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isWideExpanded && (
                            <div className="sidebar-submenu ml-4 mt-1 space-y-1">
                              {WIDE_GROUPS.map((group) => (
                                <button
                                  key={group.id}
                                  onClick={() => onSelectCategory({ ...category, wideGroup: group.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activeWideGroup === group.id
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  <NavigationLabel type={group.id}>{group.name}</NavigationLabel>
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
                            onClick={() => toggleGroup('plotter-cutting')}
                  aria-expanded={expandedCategory === 'plotter-cutting' && !compact}
                            className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
                              selectedCategory?.slug === 'plotter-cutting'
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <NavigationLabel type={category.slug} compact={compact}>{category.name}</NavigationLabel>
                            <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${isPlotterExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isPlotterExpanded && (
                            <div className="sidebar-submenu ml-4 mt-1 space-y-1">
                              {PLOTTER_MATERIALS.map((mat) => (
                                <button
                                  key={mat.id}
                                  onClick={() => onSelectCategory({ ...category, plotterMaterial: mat.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activePlotterMat === mat.id
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  <NavigationLabel type={mat.id}>{mat.name}</NavigationLabel>
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
                            onClick={() => toggleGroup('cnc-laser')}
                  aria-expanded={expandedCategory === 'cnc-laser' && !compact}
                            className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
                              selectedCategory?.slug === 'cnc-laser'
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <NavigationLabel type={category.slug} compact={compact}>{category.name}</NavigationLabel>
                            <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${isCncExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isCncExpanded && (
                            <div className="sidebar-submenu ml-4 mt-1 space-y-1">
                              {CNC_TYPES.map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => onSelectCategory({ ...category, cncType: t.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activeCncType === t.id
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  <NavigationLabel type={t.id}>{t.name}</NavigationLabel>
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
                className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
                  selectedCategory?.id === category.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <NavigationLabel type={category.slug} compact={compact}>{category.name}</NavigationLabel>
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
                            onClick={() => toggleGroup('flags-products')}
                  aria-expanded={expandedCategory === 'flags-products' && !compact}
                            className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
                              selectedCategory?.slug === 'flags-products'
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <NavigationLabel type={category.slug} compact={compact}>{category.name}</NavigationLabel>
                            <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${isFlagsExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isFlagsExpanded && (
                            <div className="sidebar-submenu ml-4 mt-1 space-y-1">
                              {FLAG_CATEGORIES.map((cat) => (
                                <button
                                  key={cat.id}
                                  onClick={() => onSelectCategory({ ...category, flagsCategory: cat.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activeFlagsCat === cat.id
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  <NavigationLabel type={cat.id}>{cat.name}</NavigationLabel>
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
                            onClick={() => toggleGroup('textile')}
                  aria-expanded={expandedCategory === 'textile' && !compact}
                            className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium justify-between ${
                              selectedCategory?.slug === 'textile'
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <NavigationLabel type={category.slug} compact={compact}>{category.name}</NavigationLabel>
                            <ChevronDownIcon className={`sidebar-chevron w-5 h-5 flex-shrink-0 transition-transform ${isTextileExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isTextileExpanded && (
                            <div className="sidebar-submenu ml-4 mt-1 space-y-1">
                              {TEXTILE_CATEGORIES.map((cat) => (
                                <button
                                  key={cat.id}
                                  onClick={() => onSelectCategory({ ...category, textileCategory: cat.id })}
                                  className={`w-full text-left px-4 py-2 rounded-lg transition text-xs ${
                                    activeTextileCategory === cat.id
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  <NavigationLabel type={cat.id}>{cat.name}</NavigationLabel>
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
                          className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
                            selectedCategory?.slug === cat.slug ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <NavigationLabel type={cat.slug} compact={compact}>{cat.name}</NavigationLabel>
                                                  </button>
                                                ))
                                              })()}

                                    {categories.filter(c => c.slug === 'additional-services').map(cat => (
                                      <button
                                        key={cat.slug}
                                        onClick={() => onSelectCategory(cat)}
                                        className={`sidebar-main-button flex items-center w-full text-left px-4 py-3 rounded-lg transition text-sm font-medium ${
                                          selectedCategory?.slug === cat.slug ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        <NavigationLabel type={cat.slug} compact={compact}>{cat.name}</NavigationLabel>
                                      </button>
                                    ))}
                      </nav>

    </div>
  )
}
