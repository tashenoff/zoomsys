import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const ClientsContext = createContext(null)

// Ключ для localStorage (fallback)
const STORAGE_KEY = 'clients'

export function ClientsProvider({ children }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOnline, setIsOnline] = useState(true)

  // Загрузка клиентов
  const loadClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await api.getClients()
      setClients(data)
      setIsOnline(true)
      // Синхронизируем с localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
      console.warn('API недоступен, загрузка из localStorage:', err.message)
      setIsOnline(false)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setClients(JSON.parse(stored))
      }
      setError('Работа в offline режиме')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  // Создание клиента
  const createClient = useCallback(async (clientData) => {
    try {
      if (isOnline) {
        const newClient = await api.createClient({
          name: clientData.name,
          phone: clientData.phone || null,
          email: clientData.email || null,
          company: clientData.company || null,
          notes: clientData.notes || null
        })
        
        const client = {
          ...newClient,
          id: newClient.id.toString(),
          createdAt: newClient.created_at
        }
        
        setClients(prev => {
          const updated = [client, ...prev]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          return updated
        })
        
        return client
      } else {
        // Offline режим
        const newClient = {
          ...clientData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          _pendingSync: true
        }
        
        setClients(prev => {
          const updated = [newClient, ...prev]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          return updated
        })
        
        return newClient
      }
    } catch (err) {
      console.error('Ошибка создания клиента:', err)
      throw err
    }
  }, [isOnline])

  // Обновление клиента
  const updateClient = useCallback(async (clientId, updates) => {
    try {
      if (isOnline) {
        await api.updateClient(clientId, {
          name: updates.name,
          phone: updates.phone,
          email: updates.email,
          company: updates.company,
          notes: updates.notes
        })
      }
      
      setClients(prev => {
        const updated = prev.map(client =>
          client.id === clientId || client.id === clientId.toString()
            ? { ...client, ...updates }
            : client
        )
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        return updated
      })
    } catch (err) {
      console.error('Ошибка обновления клиента:', err)
      // Обновляем локально с пометкой для синхронизации
      setClients(prev => {
        const updated = prev.map(client =>
          client.id === clientId || client.id === clientId.toString()
            ? { ...client, ...updates, _pendingSync: true }
            : client
        )
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        return updated
      })
    }
  }, [isOnline])

  // Удаление клиента
  const deleteClient = useCallback(async (clientId) => {
    try {
      if (isOnline) {
        await api.deleteClient(clientId)
      }
      
      setClients(prev => {
        const updated = prev.filter(client =>
          client.id !== clientId && client.id !== clientId.toString()
        )
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        return updated
      })
    } catch (err) {
      console.error('Ошибка удаления клиента:', err)
      throw err
    }
  }, [isOnline])

  // Получение одного клиента
  const getClient = useCallback((clientId) => {
    return clients.find(client =>
      client.id === clientId || client.id === clientId.toString()
    )
  }, [clients])

  // Поиск клиентов
  const searchClients = useCallback((searchTerm) => {
    if (!searchTerm) return clients
    
    const term = searchTerm.toLowerCase()
    return clients.filter(client =>
      client.name?.toLowerCase().includes(term) ||
      client.phone?.includes(searchTerm) ||
      client.company?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term)
    )
  }, [clients])

  const value = {
    clients,
    loading,
    error,
    isOnline,
    loadClients,
    createClient,
    updateClient,
    deleteClient,
    getClient,
    searchClients
  }

  return (
    <ClientsContext.Provider value={value}>
      {children}
    </ClientsContext.Provider>
  )
}

export function useClients() {
  const context = useContext(ClientsContext)
  if (!context) {
    throw new Error('useClients must be used within a ClientsProvider')
  }
  return context
}

export default useClients
