import { useState, useEffect } from 'react'
import api from '../lib/api'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'user',
    permissions: {
      viewDashboard: true,
      viewOrders: true,
      createOrders: true,
      editOrders: false,
      deleteOrders: false,
      viewClients: true,
      manageClients: false,
      viewReports: false,
      manageUsers: false,
      viewPricing: true,
      editPricing: false
    }
  })

  // Загрузка пользователей из API
  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getUsers()
      setUsers(data)
    } catch (err) {
      setError(err.message || 'Ошибка загрузки пользователей')
      console.error('Error loading users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      fullName: '',
      role: 'user',
      permissions: {
        viewDashboard: true,
        viewOrders: true,
        createOrders: true,
        editOrders: false,
        deleteOrders: false,
        viewClients: true,
        manageClients: false,
        viewReports: false,
        manageUsers: false,
        viewPricing: true,
        editPricing: false
      }
    })
    setEditingUser(null)
  }

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        username: user.username,
        password: '', // Не показываем пароль
        fullName: user.fullName,
        role: user.role,
        permissions: { ...user.permissions }
      })
    } else {
      resetForm()
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const handleSaveUser = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    
    try {
      if (editingUser) {
        // Редактирование существующего пользователя
        const updateData = {
          username: formData.username,
          fullName: formData.fullName,
          role: formData.role,
          permissions: formData.permissions
        }
        if (formData.password) {
          updateData.password = formData.password
        }
        await api.updateUser(editingUser.id, updateData)
      } else {
        // Создание нового пользователя
        await api.createUser({
          username: formData.username,
          password: formData.password,
          fullName: formData.fullName,
          role: formData.role,
          permissions: formData.permissions
        })
      }
      
      await loadUsers()
      handleCloseModal()
    } catch (err) {
      setError(err.message || 'Ошибка сохранения пользователя')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return
    }
    
    try {
      await api.deleteUser(userId)
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Ошибка удаления пользователя')
    }
  }

  const handleRoleChange = (role) => {
    let newPermissions = { ...formData.permissions }
    
    if (role === 'admin') {
      // Админ имеет все права
      Object.keys(newPermissions).forEach(key => {
        newPermissions[key] = true
      })
    } else if (role === 'manager') {
      // Менеджер имеет большинство прав, кроме управления пользователями
      newPermissions = {
        viewDashboard: true,
        viewOrders: true,
        createOrders: true,
        editOrders: true,
        deleteOrders: true,
        viewClients: true,
        manageClients: true,
        viewReports: true,
        manageUsers: false,
        viewPricing: true,
        editPricing: false
      }
    } else {
      // Обычный пользователь имеет базовые права
      newPermissions = {
        viewDashboard: true,
        viewOrders: true,
        createOrders: true,
        editOrders: false,
        deleteOrders: false,
        viewClients: true,
        manageClients: false,
        viewReports: false,
        manageUsers: false,
        viewPricing: true,
        editPricing: false
      }
    }
    
    setFormData({ ...formData, role, permissions: newPermissions })
  }

  const handlePermissionToggle = (permission) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [permission]: !formData.permissions[permission]
      }
    })
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'manager': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Администратор'
      case 'manager': return 'Менеджер'
      default: return 'Пользователь'
    }
  }

  const permissionLabels = {
    viewDashboard: 'Просмотр дашборда',
    viewOrders: 'Просмотр заказов',
    createOrders: 'Создание заказов',
    editOrders: 'Редактирование заказов',
    deleteOrders: 'Удаление заказов',
    viewClients: 'Просмотр клиентов',
    manageClients: 'Управление клиентами',
    viewReports: 'Просмотр отчетов',
    manageUsers: 'Управление пользователями',
    viewPricing: 'Просмотр прайсов',
    editPricing: 'Редактирование прайсов'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500 text-lg">Загрузка пользователей...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Ошибка */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">×</button>
        </div>
      )}

      {/* Заголовок */}
      <div className="bg-white rounded-lg shadow-md p-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Управление пользователями</h1>
          <p className="text-gray-600 mt-2">Настройка ролей и прав доступа</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          Добавить пользователя
        </button>
      </div>

      {/* Список пользователей */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Пользователь</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Логин</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Роль</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Статус</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Дата создания</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.fullName}</p>
                      <p className="text-sm text-gray-500">{Object.values(user.permissions).filter(Boolean).length} прав доступа</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-700">{user.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {user.isActive !== false ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-700 text-sm">
                  {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleOpenModal(user)}
                    className="text-blue-600 hover:text-blue-800 mr-4 font-medium"
                  >
                    Редактировать
                  </button>
                  {user.username !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Удалить
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модальное окно */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingUser ? 'Редактировать пользователя' : 'Добавить пользователя'}
              </h2>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-6 space-y-6">
              {/* Основная информация */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Полное имя
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Иван Иванов"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Логин
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="user"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Пароль {editingUser && '(оставьте пустым для сохранения текущего)'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Роль
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="user">Пользователь</option>
                    <option value="manager">Менеджер</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
              </div>

              {/* Права доступа */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Права доступа</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(formData.permissions).map(([key, value]) => (
                    <label key={key} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => handlePermissionToggle(key)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{permissionLabels[key]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Кнопки */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : (editingUser ? 'Сохранить' : 'Создать')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
