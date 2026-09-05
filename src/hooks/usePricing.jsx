import { useState, useEffect, createContext, useContext } from 'react'
import api from '../lib/api'
import pricingDataFallback from '../data/pricing.json'

// Контекст для прайсов
const PricingContext = createContext(null)

export function PricingProvider({ children }) {
  const [pricing, setPricing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOffline, setIsOffline] = useState(false)

  const loadPricing = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await api.getPricing()
      
      // Преобразуем данные из БД в формат фронтенда
      const formattedData = {
        settings: {
          urgentSurcharge: data.settings?.urgent_surcharge || 30
        },
        businessCards: (data.businessCards || []).map(item => ({
          id: String(item.id),
          name: item.name,
          colorType: item.color_type,
          prices: typeof item.prices === 'string' ? JSON.parse(item.prices) : item.prices
        })),
        printing: (data.printing || []).map(item => ({
          id: String(item.id),
          category: item.category,
          name: item.name,
          colorType: item.color_type,
          prices: typeof item.prices === 'string' ? JSON.parse(item.prices) : item.prices
        })),
        uvPrinting: (data.uvPrinting || []).map(item => ({
          id: String(item.id),
          category: item.category,
          name: item.name,
          description: item.description,
          priceType: item.price_type,
          sides: typeof item.sides === 'string' ? JSON.parse(item.sides) : item.sides,
          materials: typeof item.materials === 'string' ? JSON.parse(item.materials) : item.materials
        })),
        wideFormat: (data.wideFormat || []).map(item => ({
          id: String(item.id),
          name: item.name,
          pricePerSqm: parseFloat(item.price_per_sqm)
        })),
        stateSymbols: (data.stateSymbols || []).map(item => ({
          id: String(item.id),
          category: item.category,
          name: item.name,
          option: item.option,
          price: item.price == null ? null : parseFloat(item.price)
        })),
        additionalServices: (data.additionalServices || []).map(item => ({
          id: String(item.id),
          name: item.name,
          price: parseFloat(item.price),
          unit: item.unit,
          description: item.description
        })),
        // additionalOperations из БД приходит как массив, преобразуем в объект
        additionalOperations: Array.isArray(data.additionalOperations) 
          ? data.additionalOperations.reduce((acc, item) => {
              const id = item.id || item.name?.toLowerCase().replace(/\s+/g, '_')
              acc[id] = {
                id: String(item.id),
                name: item.name,
                type: item.operation_type,
                applicableTo: typeof item.applicable_to === 'string' 
                  ? JSON.parse(item.applicable_to) 
                  : (item.applicable_to || ['all']),
                options: typeof item.options === 'string' 
                  ? JSON.parse(item.options) 
                  : item.options,
                price: item.price ? parseFloat(item.price) : undefined,
                unit: item.unit,
                description: item.description,
                defaultQuantity: item.default_quantity
              }
              return acc
            }, {})
          : (data.additionalOperations || {}),
        reorderOptions: data.reorderOptions || []
      }
      
      setPricing(formattedData)
      setIsOffline(false)
      
      // Кэшируем в localStorage
      localStorage.setItem('crm_pricing_cache', JSON.stringify(formattedData))
    } catch (err) {
      console.error('Ошибка загрузки прайсов:', err)
      setError(err.message)
      setIsOffline(true)
      
      // Пробуем загрузить из кэша
      const cached = localStorage.getItem('crm_pricing_cache')
      if (cached) {
        setPricing(JSON.parse(cached))
        console.log('Загружены данные из кэша')
      } else {
        // Fallback на локальный JSON
        setPricing(pricingDataFallback)
        console.log('Загружены данные из fallback JSON')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPricing()
  }, [])

  const refreshPricing = () => loadPricing()

  return (
    <PricingContext.Provider value={{ pricing, loading, error, isOffline, refreshPricing }}>
      {children}
    </PricingContext.Provider>
  )
}

export function usePricing() {
  const context = useContext(PricingContext)
  if (!context) {
    throw new Error('usePricing должен использоваться внутри PricingProvider')
  }
  return context
}

export default usePricing
