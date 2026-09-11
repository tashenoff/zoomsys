// API клиент для работы с бэкендом
// В production используем относительный путь (фронт и API на одном сервере)
const API_URL = import.meta.env.VITE_API_URL || '/api'

class ApiClient {
  getToken() {
    return localStorage.getItem('auth_token')
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`
    const token = this.getToken()
    
    const config = {
      headers: { 
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers 
      },
      ...options
    }
    
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }))
      // Если токен истёк или недействителен - выходим
      if (response.status === 401) {
        localStorage.removeItem('auth_token')
        window.location.reload()
      }
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    return response.json()
  }

  // === PRICING ===
  async getPricing() {
    return this.request('/pricing')
  }

  // Business Cards
  async getBusinessCards() {
    return this.request('/pricing/business-cards')
  }
  async createBusinessCard(data) {
    return this.request('/pricing/business-cards', { method: 'POST', body: data })
  }
  async updateBusinessCard(id, data) {
    return this.request(`/pricing/business-cards/${id}`, { method: 'PUT', body: data })
  }
  async deleteBusinessCard(id) {
    return this.request(`/pricing/business-cards/${id}`, { method: 'DELETE' })
  }

  // Printing
  async getPrinting() {
    return this.request('/pricing/printing')
  }
  async createPrinting(data) {
    return this.request('/pricing/printing', { method: 'POST', body: data })
  }
  async updatePrinting(id, data) {
    return this.request(`/pricing/printing/${id}`, { method: 'PUT', body: data })
  }
  async deletePrinting(id) {
    return this.request(`/pricing/printing/${id}`, { method: 'DELETE' })
  }

  // Wide Format
  async getWideFormat() {
    return this.request('/pricing/wide-format')
  }
  async createWideFormat(data) {
    return this.request('/pricing/wide-format', { method: 'POST', body: data })
  }
  async updateWideFormat(id, data) {
    return this.request(`/pricing/wide-format/${id}`, { method: 'PUT', body: data })
  }
  async deleteWideFormat(id) {
    return this.request(`/pricing/wide-format/${id}`, { method: 'DELETE' })
  }

  // Services
  async getServices() {
    return this.request('/pricing/services')
  }
  async createService(data) {
    return this.request('/pricing/services', { method: 'POST', body: data })
  }
  async updateService(id, data) {
    return this.request(`/pricing/services/${id}`, { method: 'PUT', body: data })
  }
  async deleteService(id) {
    return this.request(`/pricing/services/${id}`, { method: 'DELETE' })
  }

  // Settings
  async getSettings() {
    return this.request('/pricing/settings')
  }
  async updateSettings(data) {
    return this.request('/pricing/settings', { method: 'PUT', body: data })
  }

  // === CLIENTS ===
  async getClients() {
    return this.request('/clients')
  }
  async getClient(id) {
    return this.request(`/clients/${id}`)
  }
  async createClient(data) {
    return this.request('/clients', { method: 'POST', body: data })
  }
  async updateClient(id, data) {
    return this.request(`/clients/${id}`, { method: 'PUT', body: data })
  }
  async deleteClient(id) {
    return this.request(`/clients/${id}`, { method: 'DELETE' })
  }

  // === ORDERS ===
  async getOrders() {
    return this.request('/orders')
  }
  async getOrder(id) {
    return this.request(`/orders/${id}`)
  }
  async createOrder(data) {
    return this.request('/orders', { method: 'POST', body: data })
  }
  async updateOrder(id, data) {
    return this.request(`/orders/${id}`, { method: 'PUT', body: data })
  }
  async deleteOrder(id) {
    return this.request(`/orders/${id}`, { method: 'DELETE' })
  }

  // === USERS ===
  async getUsers() {
    return this.request('/users')
  }
  async getUser(id) {
    return this.request(`/users/${id}`)
  }
  async createUser(data) {
    return this.request('/users', { method: 'POST', body: data })
  }
  async updateUser(id, data) {
    return this.request(`/users/${id}`, { method: 'PUT', body: data })
  }
  async deleteUser(id) {
    return this.request(`/users/${id}`, { method: 'DELETE' })
  }

  // === AUTH ===
  async login(username, password) {
    return this.request('/auth/login', { method: 'POST', body: { username, password } })
  }
  async verifyToken() {
    return this.request('/auth/verify')
  }
  async getCurrentUser() {
    return this.request('/auth/me')
  }
}

export const api = new ApiClient()
export default api
