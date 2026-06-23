export default function CategorySelector({ 
  categories, 
  selectedCategory, 
  onSelectCategory,
  title = "Выберите тип продукции для расчета:",
  gridCols = "md:grid-cols-2"
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {categories[0]?.sectionTitle || 'Категории'}
        </h2>
        <p className="text-gray-600 mb-6">{title}</p>
        
        <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                if (category.active !== false) {
                  onSelectCategory(category.id)
                }
              }}
              disabled={category.active === false}
              className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                category.active !== false
                  ? 'bg-white border-indigo-300 hover:border-indigo-500 hover:shadow-md cursor-pointer'
                  : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex items-center">
                <span className="text-3xl mr-4">{category.icon}</span>
                <div className="flex-1">
                  <div className="text-base font-semibold text-gray-800">
                    {category.name}
                  </div>
                  {category.active === false && (
                    <div className="text-xs text-gray-500 italic mt-1">
                      Скоро появится
                    </div>
                  )}
                  {category.active !== false && (
                    <div className="text-xs text-green-600 font-medium mt-1">
                      ✓ Доступно
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
