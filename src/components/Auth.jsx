import { useState } from 'react'

export default function Auth({ onLogin }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const adminLogin = import.meta.env.VITE_ADMIN_LOGIN || 'admin'
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin'

    if (login === adminLogin && password === adminPassword) {
      onLogin(true)
    } else {
      setError('Неверный логин или пароль')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">ZoomSys</h1>
          <p className="text-gray-600 mt-2">Система расчета услуг</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Логин
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Войти
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Логин по умолчанию: <span className="font-semibold">admin</span></p>
          <p>Пароль по умолчанию: <span className="font-semibold">admin</span></p>
        </div>
      </div>
    </div>
  )
}
