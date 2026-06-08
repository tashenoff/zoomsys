import { useState, useEffect } from 'react'

export default function ClientSelector({ selectedClient, onSelectClient }) {
  const [clients, setClients] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: ''
  })

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = () => {
    const stored = localStorage.getItem('clients')
    if (stored) {
      setClients(JSON.parse(stored))
    }
  }

  const handleCreateClient = (e) => {
    e.preventDefault()
    
    const client = {
      id: Date.now().toString(),
      ...newClient,
      createdAt: new Date().toISOString()
    }

    const updatedClients = [client, ...clients]
    setClients(updatedClients)
    localStorage.setItem('clients', JSON.stringify(updatedClients))
    
    onSelectClient(client)
    setIsCreating(false)
    setNewClient({ name: '', phone: '', email: '', company: '', notes: '' })
  }

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.includes(searchTerm) ||
    client.company?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isCreating) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Новый клиент</h2>
          <button
            onClick={() => setIsCreating(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCreateClient} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Имя клиента *
            </label>
            <input
              type="text"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Иван Иванов"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Телефон
              </label>
              <input
                type="text"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="+996 XXX XXX XXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="client@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Компания
            </label>
            <input
              type="text"
              value={newClient.company}
              onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="ООО Компания"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Примечания
            </label>
            <textarea
              value={newClient.notes}
              onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Дополнительная информация о клиенте"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Создать клиента
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-6 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Выбор клиента</h2>

      {selectedClient ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-lg">{selectedClient.name}</p>
              {selectedClient.company && (
                <p className="text-sm text-gray-600">{selectedClient.company}</p>
              )}
              <div className="mt-2 text-sm space-y-1">
                {selectedClient.phone && <p>📞 {selectedClient.phone}</p>}
                {selectedClient.email && <p>✉️ {selectedClient.email}</p>}
              </div>
            </div>
            <button
              onClick={() => onSelectClient(null)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Изменить
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск клиента..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setIsCreating(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition whitespace-nowrap"
            >
              + Новый
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredClients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {searchTerm ? 'Клиенты не найдены' : 'Нет клиентов. Создайте нового клиента.'}
              </p>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => onSelectClient(client)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition"
                >
                  <p className="font-semibold">{client.name}</p>
                  {client.company && (
                    <p className="text-sm text-gray-600">{client.company}</p>
                  )}
                  {client.phone && (
                    <p className="text-sm text-gray-500">{client.phone}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
