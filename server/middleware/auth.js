const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'zoomsys-secret-key-change-in-production'

// Middleware для проверки JWT токена
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен не предоставлен' })
  }
  
  const token = authHeader.substring(7)
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк' })
    }
    return res.status(401).json({ error: 'Недействительный токен' })
  }
}

// Middleware для проверки роли администратора
const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён. Требуются права администратора.' })
  }
  next()
}

// Middleware для проверки конкретного права доступа
const permissionMiddleware = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' })
    }
    
    // Админ имеет все права
    if (req.user.role === 'admin') {
      return next()
    }
    
    // Проверяем конкретное право
    if (req.user.permissions && req.user.permissions[permission]) {
      return next()
    }
    
    return res.status(403).json({ error: `Недостаточно прав для выполнения этого действия (требуется: ${permission})` })
  }
}

// Опциональная авторизация - не блокирует, но добавляет user если токен есть
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }
  
  const token = authHeader.substring(7)
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
  } catch (err) {
    // Игнорируем ошибки - пользователь просто не авторизован
  }
  
  next()
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  permissionMiddleware,
  optionalAuth,
  JWT_SECRET
}
