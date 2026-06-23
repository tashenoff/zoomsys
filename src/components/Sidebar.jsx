import { useState } from 'react'
import pricingData from '../data/pricing.json'
import logo from '../logo.svg'

export default function Sidebar({ selectedCategory, onSelectCategory, onLogout, selectedView, onSelectView }) {
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

        {/* Заказы */}
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

        <div className="my-4 border-t border-gray-300"></div>

        {/* БЛОК 1: Визитки и карточки */}
        <p className="text-xs uppercase text-gray-500 font-semibold mb-2 mt-4 px-2">
          📇 Визитки и карточки
        </p>
        {categories.map((category) => 
          category.subcategories && category.subcategories.filter(sub => sub.slug === 'business-cards').map((subcategory) => (
            <button
              key={subcategory.id}
              onClick={() => onSelectCategory(subcategory)}
              className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
                selectedCategory?.id === subcategory.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              💼 {subcategory.name}
            </button>
          ))
        )}

        {/* БЛОК 2: Оперативная листовая полиграфия */}
        <p className="text-xs uppercase text-gray-500 font-semibold mb-2 mt-4 px-2">
          📄 Листовая полиграфия
        </p>
        {categories.map((category) => 
          category.subcategories && category.subcategories.filter(sub => sub.slug === 'printing').map((subcategory) => (
            <button
              key={subcategory.id}
              onClick={() => onSelectCategory(subcategory)}
              className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
                selectedCategory?.id === subcategory.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 {subcategory.name}
            </button>
          ))
        )}

        {/* БЛОК 3: Многостраничная продукция */}
        <p className="text-xs uppercase text-gray-500 font-semibold mb-2 mt-4 px-2">
          📚 Многостраничная продукция
        </p>
        <div className="text-sm text-gray-500 px-4 py-2 italic bg-gray-50 rounded-lg mx-1">
          🚧 В разработке
        </div>

        {/* БЛОК 4: Индивидуальный расчет */}
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
          <p className="text-sm font-semibold text-gray-800">Admin</p>
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
