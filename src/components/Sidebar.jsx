import pricingData from '../data/pricing.json'
import logo from '../logo.svg'

export default function Sidebar({ selectedCategory, onSelectCategory, onLogout, selectedView, onSelectView }) {
  const categories = pricingData.categories

  return (
    <div className="w-64 bg-gray-100 text-gray-800 h-screen flex flex-col border-r border-gray-300">
      {/* Заголовок */}
      <div className="p-6 border-b border-gray-300">
        <img src={logo} alt="ZoomSys" className="w-32 h-auto mb-2" />
        <p className="text-sm text-gray-600">Система расчета</p>
      </div>

      {/* Навигация */}
      <nav className="flex-1 p-4 space-y-2">
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

        <p className="text-xs uppercase text-gray-500 font-semibold mb-3">Категории услуг</p>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category)}
            className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${
              selectedCategory?.id === category.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category.name}
          </button>
        ))}
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
