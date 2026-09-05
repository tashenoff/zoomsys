import { useState, useEffect } from 'react'
import { usePricing } from '../hooks/usePricing'
import api from '../lib/api'

export default function PricingManagement() {
  const { pricing, loading, error, isOffline, refreshPricing } = usePricing()
  const [activeTab, setActiveTab] = useState('businessCards')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)

  // Локальное состояние для отображения (используем данные из контекста)
  const localPricing = pricing || { businessCards: [], printing: [], uvPrinting: [], wideFormat: [], stateSymbols: [], additionalServices: [], additionalOperations: {} }
  
  // Преобразуем additionalOperations объект в массив для отображения
  const additionalOperationsList = localPricing.additionalOperations 
    ? Object.values(localPricing.additionalOperations) 
    : []

  const handleDelete = async (category, itemId) => {
    if (!confirm('Вы уверены, что хотите удалить эту позицию?')) return
    
    setSaving(true)
    try {
      const apiCategory = category === 'businessCards' ? 'business-cards' : 
                          category === 'wideFormat' ? 'wide-format' : 
                          category === 'stateSymbols' ? 'state-symbols' :
                          category === 'additionalServices' ? 'services' :
                          category === 'additionalOperations' ? 'operations' :
                          category === 'uvPrinting' ? 'uv-printing' : category
      
      await api.request(`/pricing/${apiCategory}/${itemId}`, { method: 'DELETE' })
      await refreshPricing()
    } catch (err) {
      alert('Ошибка удаления: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'businessCards', label: '💼 Визитки', count: localPricing.businessCards?.length || 0 },
    { id: 'printing', label: '📄 Полиграфия', count: localPricing.printing?.length || 0 },
    { id: 'uvPrinting', label: '🖨️ УФ печать', count: localPricing.uvPrinting?.length || 0 },
    { id: 'wideFormat', label: '🖼️ Широкоформат', count: localPricing.wideFormat?.length || 0 },
    { id: 'stateSymbols', label: '🇰🇿 Гос. символика', count: localPricing.stateSymbols?.length || 0 },
    { id: 'additionalOperations', label: '⚙️ Доп. операции', count: additionalOperationsList.length },
    { id: 'additionalServices', label: '➕ Доп. услуги', count: localPricing.additionalServices?.length || 0 }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка прайсов...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Статус подключения */}
      {isOffline && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-center">
            <span className="text-yellow-600 mr-2">⚠️</span>
            <p className="text-yellow-700">Работа в оффлайн режиме. Данные загружены из кэша.</p>
            <button onClick={refreshPricing} className="ml-auto text-yellow-600 hover:text-yellow-800 underline">
              Повторить подключение
            </button>
          </div>
        </div>
      )}
      
      {/* Заголовок */}
      <div className="bg-white rounded-lg shadow-md p-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Управление прайсами</h1>
          <p className="text-gray-600 mt-2">
            Редактирование цен и добавление новых позиций
            {!isOffline && <span className="ml-2 text-green-600">● Подключено к БД</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refreshPricing}
            disabled={saving}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg transition"
          >
            🔄 Обновить
          </button>
          <button
            onClick={() => {
              setEditingItem(null)
              setIsModalOpen(true)
            }}
            disabled={isOffline || saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Добавить позицию
          </button>
        </div>
      </div>

      {/* Табы */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="flex flex-wrap border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 font-medium transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Контент табов */}
        <div className="p-6">
          {activeTab === 'businessCards' && (
            <BusinessCardsTable
              items={localPricing.businessCards}
              onEdit={(item) => {
                setEditingItem({ ...item, category: 'businessCards' })
                setIsModalOpen(true)
              }}
              onDelete={(id) => handleDelete('businessCards', id)}
            />
          )}

          {activeTab === 'printing' && (
            <PrintingTable
              items={localPricing.printing}
              onEdit={(item) => {
                setEditingItem({ ...item, category: 'printing' })
                setIsModalOpen(true)
              }}
              onDelete={(id) => handleDelete('printing', id)}
            />
          )}

          {activeTab === 'uvPrinting' && (
            <UVPrintingTable
              items={localPricing.uvPrinting}
              onEdit={(item) => {
                setEditingItem({ ...item, category: 'uvPrinting' })
                setIsModalOpen(true)
              }}
              onDelete={(id) => handleDelete('uvPrinting', id)}
            />
          )}

          {activeTab === 'wideFormat' && (
            <WideFormatTable
              items={localPricing.wideFormat}
              onEdit={(item) => {
                setEditingItem({ ...item, category: 'wideFormat' })
                setIsModalOpen(true)
              }}
              onDelete={(id) => handleDelete('wideFormat', id)}
            />
          )}

          {activeTab === 'stateSymbols' && (
            <StateSymbolsTable
              items={localPricing.stateSymbols}
              onEdit={(item) => {
                setEditingItem({ ...item, pricingTab: 'stateSymbols' })
                setIsModalOpen(true)
              }}
              onDelete={(id) => handleDelete('stateSymbols', id)}
            />
          )}

          {activeTab === 'additionalOperations' && (
            <AdditionalOperationsTable
              items={additionalOperationsList}
              onEdit={(item) => {
                setEditingItem({ ...item, category: 'additionalOperations' })
                setIsModalOpen(true)
              }}
              onDelete={(id) => handleDelete('additionalOperations', id)}
            />
          )}

          {activeTab === 'additionalServices' && (
            <AdditionalServicesTable
              items={localPricing.additionalServices}
              onEdit={(item) => {
                setEditingItem({ ...item, category: 'additionalServices' })
                setIsModalOpen(true)
              }}
              onDelete={(id) => handleDelete('additionalServices', id)}
            />
          )}
        </div>
      </div>

      {/* Модальное окно редактирования */}
      {isModalOpen && (
        <EditModal
          item={editingItem}
          category={activeTab}
          onClose={() => {
            setIsModalOpen(false)
            setEditingItem(null)
          }}
          onSave={async (updatedItem) => {
            const category = editingItem?.pricingTab || activeTab
            setSaving(true)
            
            try {
              // Определяем API endpoint
              const apiCategory = category === 'businessCards' ? 'business-cards' : 
                                  category === 'wideFormat' ? 'wide-format' : 
                                  category === 'stateSymbols' ? 'state-symbols' :
                                  category === 'additionalServices' ? 'services' :
                                  category === 'additionalOperations' ? 'operations' :
                                  category === 'uvPrinting' ? 'uv-printing' : category
              
              // Преобразуем данные для API
              let apiData = {}
              if (category === 'businessCards') {
                apiData = { name: updatedItem.name, color_type: updatedItem.colorType, prices: updatedItem.prices || {} }
              } else if (category === 'printing') {
                apiData = { category: updatedItem.category, name: updatedItem.name, color_type: updatedItem.colorType, prices: updatedItem.prices || {} }
              } else if (category === 'wideFormat') {
                apiData = { name: updatedItem.name, price_per_sqm: updatedItem.pricePerSqm }
              } else if (category === 'stateSymbols') {
                const productCategory = ['coat-of-arms', 'flags-rk', 'flagpoles', 'signs', 'stands', 'president-portrait'].includes(updatedItem.category)
                  ? updatedItem.category
                  : (editingItem?.category && editingItem.category !== 'stateSymbols' ? editingItem.category : 'coat-of-arms')
                apiData = {
                  category: productCategory,
                  name: updatedItem.name,
                  option: updatedItem.option,
                  price: updatedItem.price === '' || updatedItem.price == null ? null : updatedItem.price
                }
              } else if (category === 'additionalServices') {
                apiData = { name: updatedItem.name, price: updatedItem.price, unit: updatedItem.unit, description: updatedItem.description }
              } else if (category === 'additionalOperations') {
                apiData = { 
                  name: updatedItem.name,
                  operation_type: updatedItem.type,
                  applicable_to: updatedItem.applicableTo,
                  options: updatedItem.options,
                  price: updatedItem.price,
                  unit: updatedItem.unit,
                  description: updatedItem.description,
                  default_quantity: updatedItem.defaultQuantity
                }
              } else if (category === 'uvPrinting') {
                apiData = { 
                  category: updatedItem.category || 'pens', 
                  name: updatedItem.name, 
                  description: updatedItem.description,
                  sides: updatedItem.sides,
                  materials: updatedItem.materials,
                  price_type: updatedItem.priceType
                }
              }
              
              if (editingItem?.id) {
                // Обновление
                await api.request(`/pricing/${apiCategory}/${editingItem.id}`, { method: 'PUT', body: apiData })
              } else {
                // Создание
                await api.request(`/pricing/${apiCategory}`, { method: 'POST', body: apiData })
              }
              
              await refreshPricing()
              setIsModalOpen(false)
              setEditingItem(null)
            } catch (err) {
              alert('Ошибка сохранения: ' + err.message)
            } finally {
              setSaving(false)
            }
          }}
        />
      )}
    </div>
  )
}

const PRINTING_CATEGORY_LABELS = {
  flyers: 'Флаера, листовки, афиши',
  booklets: 'Буклеты',
  certificates: 'Дипломы, грамоты, сертификаты',
  notebooks: 'Блокноты'
}

const UV_CATEGORY_LABELS = {
  pens: 'Ручки',
  cards: 'Карты / визитки',
  promotional: 'Промо-продукция',
  notebooks: 'Блокноты / ежедневники',
  other: 'Прочие материалы'
}

function groupByKey(items, keyFn) {
  const map = new Map()
  for (const item of items || []) {
    const key = keyFn(item) || 'Прочее'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return [...map.entries()]
}

function PricingGroups({ items, getGroup, children }) {
  const groups = groupByKey(items, getGroup)
  if (groups.length <= 1) return children(items || [])
  return (
    <div className="space-y-8">
      {groups.map(([label, groupItems]) => (
        <div key={label}>
          <h3 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200">
            {label} <span className="text-sm font-normal text-gray-500">({groupItems.length})</span>
          </h3>
          {children(groupItems)}
        </div>
      ))}
    </div>
  )
}

// Таблица для визиток
function BusinessCardsTable({ items, onEdit, onDelete }) {
  return (
    <PricingGroups items={items} getGroup={(i) => i.name}>
      {(groupItems) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Цветность</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">до 49</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">50-99</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">100-299</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">300-499</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">от 500</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Действия</th>
          </tr>
        </thead>
        <tbody>
          {groupItems.map((item, index) => (
            <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
              <td className="px-4 py-3 text-sm text-gray-700">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {item.colorType}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{item.prices.upTo49} ₸</td>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{item.prices['50to99']} ₸</td>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{item.prices['100to299']} ₸</td>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{item.prices['300to499']} ₸</td>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{item.prices.from500} ₸</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onEdit(item)}
                  className="text-blue-600 hover:text-blue-800 mr-3 text-sm font-medium"
                >
                  Изменить
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
      )}
    </PricingGroups>
  )
}

// Таблица для полиграфии
function PrintingTable({ items, onEdit, onDelete }) {
  return (
    <PricingGroups items={items} getGroup={(i) => PRINTING_CATEGORY_LABELS[i.category] || i.category || i.name}>
      {(groupItems) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Цветность</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Категория</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">50 шт</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">100 шт</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">300 шт</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">500 шт</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Действия</th>
          </tr>
        </thead>
        <tbody>
          {groupItems.map((item, index) => (
            <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
              <td className="px-4 py-3 text-sm">
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                  {item.colorType || '-'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                  {PRINTING_CATEGORY_LABELS[item.category] || item.category}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{item.prices?.['50'] || item.prices?.upTo49 || '-'}</td>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{item.prices?.['100'] || item.prices?.['50to99'] || '-'}</td>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{item.prices?.['300'] || item.prices?.['100to299'] || '-'}</td>
              <td className="px-4 py-3 text-sm text-right text-gray-700">{item.prices?.['500'] || item.prices?.from500 || '-'}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-800 mr-3 text-sm font-medium">Изменить</button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
      )}
    </PricingGroups>
  )
}

// Таблица для УФ печати
function UVPrintingTable({ items, onEdit, onDelete }) {
  return (
    <PricingGroups items={items} getGroup={(i) => UV_CATEGORY_LABELS[i.category] || i.category || 'Прочее'}>
      {(groupItems) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Категория</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Стороны/Цены</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Действия</th>
          </tr>
        </thead>
        <tbody>
          {groupItems.map((item, index) => (
            <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 text-sm text-gray-900">
                <div className="font-medium">{item.name}</div>
                {item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}
              </td>
              <td className="px-4 py-3 text-sm">
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">{UV_CATEGORY_LABELS[item.category] || item.category}</span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.sides?.map((side, i) => (
                  <div key={i} className="mb-1">
                    <span className="font-medium text-gray-700">{side.type}: </span>
                    {side.prices && Object.entries(side.prices).slice(0, 3).map(([qty, price]) => (
                      <span key={qty} className="mr-2 text-xs">{qty}шт: {price}₸</span>
                    ))}
                    {side.prices && Object.keys(side.prices).length > 3 && <span className="text-xs">...</span>}
                  </div>
                )) || '-'}
              </td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-800 mr-3 text-sm font-medium">Изменить</button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Удалить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
      )}
    </PricingGroups>
  )
}

// Таблица для широкоформата
function WideFormatTable({ items, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Цена за м²</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Действия</th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item, index) => (
            <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 font-medium">
                {item.pricePerSqm} ₸/м²
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onEdit(item)}
                  className="text-blue-600 hover:text-blue-800 mr-3 text-sm font-medium"
                >
                  Изменить
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const STATE_SYMBOL_CATEGORIES = [
  { id: 'coat-of-arms', label: 'Герб' },
  { id: 'flags-rk', label: 'Флаги РК' },
  { id: 'flagpoles', label: 'Флагштоки' },
  { id: 'signs', label: 'Вывески' },
  { id: 'stands', label: 'Стенды' },
  { id: 'president-portrait', label: 'Портрет президента' }
]

function StateSymbolsTable({ items, onEdit, onDelete }) {
  const grouped = STATE_SYMBOL_CATEGORIES.map((cat) => ({
    ...cat,
    items: (items || []).filter(i => i.category === cat.id)
  })).filter(g => g.items.length > 0)

  const extras = (items || []).filter(i => !STATE_SYMBOL_CATEGORIES.some(c => c.id === i.category))
  if (extras.length) grouped.push({ id: 'other', label: 'Прочее', items: extras })

  return (
    <div className="space-y-8">
      {grouped.map((group) => (
        <div key={group.id}>
          <h3 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200">
            {group.label} <span className="text-sm font-normal text-gray-500">({group.items.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Опция</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Цена</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Действия</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.option}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700 font-medium">
                      {item.price == null ? 'по запросу' : `${Number(item.price).toLocaleString('ru-RU')} ₸`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-800 mr-3 text-sm font-medium">Изменить</button>
                      <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// Таблица для доп. операций (ламинация, скругление и т.д.)
function AdditionalOperationsTable({ items, onEdit, onDelete }) {
  return (
    <PricingGroups items={items} getGroup={(i) => i.type === 'select' ? 'Выбор опции' : i.type === 'quantity' ? 'С количеством' : 'Фикс. цена'}>
      {(groupItems) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Тип</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Цена</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Единица</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Применимо к</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Действия</th>
          </tr>
        </thead>
        <tbody>
          {groupItems.map((item, index) => (
            <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.name}</td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.type === 'select' ? '📋 Выбор опции' : 
                 item.type === 'quantity' ? '🔢 С количеством' : '💰 Фикс. цена'}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 font-medium">
                {item.type === 'select' && item.options ? 
                  `${item.options.length} опций` : 
                  item.price ? `${item.price} ₸` : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{item.unit || '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.applicableTo?.includes('all') ? 
                  <span className="text-green-600">Все типы</span> : 
                  <span className="text-xs">{item.applicableTo?.slice(0, 2).join(', ')}{item.applicableTo?.length > 2 ? '...' : ''}</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onEdit(item)}
                  className="text-blue-600 hover:text-blue-800 mr-3 text-sm font-medium"
                >
                  Изменить
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!groupItems || groupItems.length === 0) && (
        <div className="text-center py-8 text-gray-500">
          <p>Нет дополнительных операций</p>
          <p className="text-sm mt-2">Операции загружаются из pricing.json при seed базы данных</p>
        </div>
      )}
    </div>
      )}
    </PricingGroups>
  )
}

// Таблица для доп. услуг
function AdditionalServicesTable({ items, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Цена</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Единица</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Действия</th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item, index) => (
            <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
              <td className="px-4 py-3 text-sm text-right text-gray-700 font-medium">{item.price} ₸</td>
              <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onEdit(item)}
                  className="text-blue-600 hover:text-blue-800 mr-3 text-sm font-medium"
                >
                  Изменить
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Форма редактирования операций
function OperationEditForm({ formData, setFormData }) {
  const types = [
    { id: 'all', name: 'Все типы' },
    { id: 'business-cards', name: 'Визитки' },
    { id: 'badges', name: 'Бейджи' },
    { id: 'discount-cards', name: 'Дисконтные карты' },
    { id: 'invitations', name: 'Пригласительные' },
    { id: 'certificates', name: 'Сертификаты' },
    { id: 'flyers', name: 'Флаеры' },
    { id: 'booklets', name: 'Буклеты' },
    { id: 'notebooks', name: 'Блокноты' },
    { id: 'uv-printing', name: 'УФ печать' },
    { id: 'wide-format', name: 'Широкоформат' },
    { id: 'state-symbols', name: 'Гос. символика (все)' },
    { id: 'coat-of-arms', name: 'Герб' },
    { id: 'flags-rk', name: 'Флаги РК' },
    { id: 'flagpoles', name: 'Флагштоки' },
    { id: 'signs', name: 'Вывески' },
    { id: 'stands', name: 'Стенды' },
    { id: 'president-portrait', name: 'Портрет президента' }
  ]
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Тип операции</label>
        <select value={formData.type || ''} onChange={(e) => setFormData({ ...formData, type: e.target.value || null })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg">
          <option value="">Фиксированная цена</option>
          <option value="select">Выбор опции</option>
          <option value="quantity">С количеством</option>
        </select>
      </div>
      {formData.type !== 'select' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Цена</label>
            <input type="number" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Единица</label>
            <input type="text" value={formData.unit || ''} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="тг/шт" />
          </div>
        </div>
      )}
      {formData.type === 'select' && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Опции ({(formData.options || []).length})</h3>
            <button type="button" onClick={() => setFormData({ ...formData, options: [...(formData.options || []), { id: `o${Date.now()}`, name: '', price: 0 }] })}
              className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded">+ Добавить</button>
          </div>
          {(formData.options || []).map((opt, i) => (
            <div key={opt.id || i} className="flex gap-2 mb-2 bg-gray-50 p-2 rounded">
              <input type="text" value={opt.name} placeholder="Название" onChange={(e) => { const o = [...formData.options]; o[i] = { ...o[i], name: e.target.value }; setFormData({ ...formData, options: o }) }}
                className="flex-1 px-3 py-2 border rounded" />
              <input type="number" value={opt.price} placeholder="Цена" onChange={(e) => { const o = [...formData.options]; o[i] = { ...o[i], price: parseFloat(e.target.value) || 0 }; setFormData({ ...formData, options: o }) }}
                className="w-24 px-3 py-2 border rounded" />
              <button type="button" onClick={() => setFormData({ ...formData, options: formData.options.filter((_, j) => j !== i) })} className="text-red-500">✕</button>
            </div>
          ))}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
        <input type="text" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Применимо к</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {types.map(t => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={(formData.applicableTo || []).includes(t.id)}
                onChange={(e) => {
                  let a = [...(formData.applicableTo || [])]
                  a = e.target.checked ? (t.id === 'all' ? ['all'] : [...a.filter(x => x !== 'all'), t.id]) : a.filter(x => x !== t.id)
                  setFormData({ ...formData, applicableTo: a })
                }} className="rounded" />{t.name}
            </label>
          ))}
        </div>
      </div>
    </>
  )
}

// Модальное окно редактирования (полная версия)
function EditModal({ item, category, onClose, onSave }) {
  // Инициализируем formData с дефолтными значениями для разных категорий
  const getInitialFormData = () => {
    if (item) return item
    
    // Дефолтные значения для новых позиций
    if (category === 'businessCards' || category === 'printing') {
      return {
        name: '',
        colorType: '1+0',
        prices: {
          upTo49: 0,
          '50to99': 0,
          '100to299': 0,
          '300to499': 0,
          from500: 0
        }
      }
    }
    if (category === 'wideFormat') {
      return { name: '', pricePerSqm: 0 }
    }
    if (category === 'stateSymbols') {
      return { category: 'coat-of-arms', name: '', option: '', price: null }
    }
    if (category === 'additionalServices') {
      return { name: '', price: 0, unit: '', description: '' }
    }
    if (category === 'additionalOperations') {
      return { 
        name: '', 
        type: null, 
        price: null, 
        unit: '', 
        description: '', 
        defaultQuantity: null,
        applicableTo: ['all'],
        options: []
      }
    }
    if (category === 'uvPrinting') {
      return { name: '', category: 'pens', description: '', sides: null, materials: null, priceType: 'per_piece' }
    }
    return {}
  }
  
  const [formData, setFormData] = useState(getInitialFormData)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  const updatePrice = (priceKey, value) => {
    setFormData({
      ...formData,
      prices: {
        ...formData.prices,
        [priceKey]: parseFloat(value) || 0
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            {item ? 'Редактировать позицию' : 'Добавить позицию'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">Категория: {category}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Основная информация */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название
              </label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Введите название"
              />
            </div>

            {/* Визитки - цветность и градации цен */}
            {category === 'businessCards' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цветность
                  </label>
                  <select
                    value={formData.colorType || '1+0'}
                    onChange={(e) => setFormData({ ...formData, colorType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1+0">1+0 (черно-белая, 1 сторона)</option>
                    <option value="1+1">1+1 (черно-белая, 2 стороны)</option>
                    <option value="4+0">4+0 (цветная, 1 сторона)</option>
                    <option value="4+4">4+4 (цветная, 2 стороны)</option>
                  </select>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">Градации цен по тиражу</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        до 49 шт
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.prices?.upTo49 || ''}
                        onChange={(e) => updatePrice('upTo49', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="18"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        50-99 шт
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.prices?.['50to99'] || ''}
                        onChange={(e) => updatePrice('50to99', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="18"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        100-299 шт
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.prices?.['100to299'] || ''}
                        onChange={(e) => updatePrice('100to299', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="17"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        300-499 шт
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.prices?.['300to499'] || ''}
                        onChange={(e) => updatePrice('300to499', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="16"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        от 500 шт
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.prices?.from500 || ''}
                        onChange={(e) => updatePrice('from500', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="16"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Полиграфия */}
            {category === 'printing' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Подкатегория</label>
                    <select value={formData.category || 'flyers'} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                      <option value="flyers">Флаера</option>
                      <option value="booklets">Буклеты</option>
                      <option value="certificates">Сертификаты</option>
                      <option value="notebooks">Блокноты</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Цветность</label>
                    <select value={formData.colorType || '4+0'} onChange={(e) => setFormData({ ...formData, colorType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                      <option value="1+0">1+0</option>
                      <option value="1+1">1+1</option>
                      <option value="4+0">4+0</option>
                      <option value="4+4">4+4</option>
                    </select>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Цены по тиражу (тг/шт)</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {[['50', '50 шт'], ['100', '100 шт'], ['300', '300 шт'], ['500', '500 шт']].map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                        <input type="number" step="0.01" value={formData.prices?.[key] || ''} onChange={(e) => updatePrice(key, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* УФ печать */}
            {category === 'uvPrinting' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Категория</label>
                    <select value={formData.category || 'pens'} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                      <option value="pens">Ручки</option>
                      <option value="cards">Карты/Визитки</option>
                      <option value="promotional">Промо-материалы</option>
                      <option value="notebooks">Блокноты</option>
                      <option value="materials">Различные материалы</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Описание</label>
                    <input type="text" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="УФ-Печать MIMAKI..." />
                  </div>
                </div>
                {/* Стороны и цены */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-800">Стороны и цены</h3>
                    <button type="button" onClick={() => setFormData({ ...formData, sides: [...(formData.sides || []), { type: '1 сторона', prices: {} }] })}
                      className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded">+ Добавить сторону</button>
                  </div>
                  {(formData.sides || []).map((side, sideIdx) => (
                    <div key={sideIdx} className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <input type="text" value={side.type || ''} placeholder="Тип (1 сторона, 2 стороны)"
                          onChange={(e) => { const s = [...formData.sides]; s[sideIdx] = { ...s[sideIdx], type: e.target.value }; setFormData({ ...formData, sides: s }) }}
                          className="px-3 py-1 border border-gray-300 rounded w-48" />
                        <button type="button" onClick={() => setFormData({ ...formData, sides: formData.sides.filter((_, i) => i !== sideIdx) })}
                          className="text-red-500 text-sm">Удалить сторону</button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {['50', '100', '200', '300', '500'].map(qty => (
                          <div key={qty}>
                            <label className="block text-xs text-gray-500">{qty} шт</label>
                            <input type="text" value={side.prices?.[qty] || ''} placeholder="цена"
                              onChange={(e) => { 
                                const s = [...formData.sides]; 
                                s[sideIdx] = { ...s[sideIdx], prices: { ...s[sideIdx].prices, [qty]: e.target.value } }; 
                                setFormData({ ...formData, sides: s }) 
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(!formData.sides || formData.sides.length === 0) && (
                    <p className="text-gray-500 text-sm text-center py-4">Нет сторон. Нажмите "Добавить сторону"</p>
                  )}
                </div>
              </>
            )}

            {/* Доп. операции (ламинация, скругление и т.д.) */}
            {category === 'additionalOperations' && (
              <OperationEditForm formData={formData} setFormData={setFormData} />
            )}

            {/* Широкоформат */}
            {category === 'wideFormat' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Цена за м²
                </label>
                <input
                  type="number"
                  required
                  value={formData.pricePerSqm || ''}
                  onChange={(e) => setFormData({ ...formData, pricePerSqm: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="350"
                />
              </div>
            )}

            {category === 'stateSymbols' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Подкатегория</label>
                  <select
                    value={formData.category || 'coat-of-arms'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {STATE_SYMBOL_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Опция (исполнение / размер / материал)</label>
                  <input
                    type="text"
                    value={formData.option || ''}
                    onChange={(e) => setFormData({ ...formData, option: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="уличное исполнение"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Цена (пусто = по запросу)</label>
                  <input
                    type="number"
                    value={formData.price ?? ''}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="350000"
                  />
                </div>
              </>
            )}

            {/* Доп. услуги */}
            {category === 'additionalServices' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цена
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="3000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Единица измерения
                  </label>
                  <input
                    type="text"
                    value={formData.unit || ''}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="тг/шт"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {item ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
