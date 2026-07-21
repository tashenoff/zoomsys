# 🗺️ Дорожная карта проекта ZoomSys

## 📋 Обзор проекта

**ZoomSys** - система управления заказами и расчета стоимости полиграфических услуг для типографии.

### Текущий стек технологий:
- **Frontend**: React 18 + Vite
- **UI**: TailwindCSS
- **Роутинг**: React Router DOM v6
- **База данных**: Supabase (PostgreSQL) → **Переход на MongoDB**
- **Аутентификация**: Простая (admin/admin) через localStorage

### Основной функционал:
- ✅ Управление клиентами
- ✅ Калькуляторы для различных типов печати (визитки, полиграфия, УФ-печать, широкоформатная печать)
- ✅ Создание и управление заказами
- ✅ Dashboard с аналитикой
- ✅ Канбан-доска для заказов
- ✅ История заказов и статистика

---

## 🎯 Фаза 1: Миграция на MongoDB (Приоритет)

### 1.1 Подготовка инфраструктуры (1-2 дня)

#### Задачи:
- [ ] **Настройка MongoDB Atlas** или локального сервера MongoDB
  - Создать облачный кластер MongoDB Atlas (бесплатный tier)
  - Настроить подключение и безопасность
  - Получить строку подключения

- [ ] **Установка зависимостей**
  ```bash
  pnpm add mongoose
  pnpm remove @supabase/supabase-js
  pnpm remove supabase (devDependencies)
  ```

- [ ] **Создание Node.js Backend**
  - Создать папку `server/`
  - Настроить Express.js сервер
  - Установка дополнительных пакетов:
    ```bash
    pnpm add express mongoose cors dotenv
    pnpm add -D nodemon
    ```

#### Файлы для создания:
```
server/
├── index.js                 # Главный файл сервера
├── config/
│   └── database.js         # Конфигурация MongoDB
├── models/
│   ├── Client.js           # Модель клиента
│   ├── ServiceCategory.js  # Модель категории услуг
│   ├── Pricing.js          # Модель прайса
│   ├── Order.js            # Модель заказа
│   └── OrderItem.js        # Модель позиции заказа
├── routes/
│   ├── clients.js          # API маршруты для клиентов
│   ├── categories.js       # API маршруты для категорий
│   ├── pricing.js          # API маршруты для прайса
│   └── orders.js           # API маршруты для заказов
└── middleware/
    └── auth.js             # Middleware для аутентификации
```

---

### 1.2 Проектирование схемы MongoDB (1 день)

#### Коллекции MongoDB (схема данных):

**1. Collection: `clients`**
```javascript
{
  _id: ObjectId,
  name: String,           // required
  phone: String,
  email: String,
  company: String,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

**2. Collection: `service_categories`**
```javascript
{
  _id: ObjectId,
  name: String,           // required
  slug: String,           // unique, required
  description: String,
  createdAt: Date
}
```

**3. Collection: `business_cards_pricing`**
```javascript
{
  _id: ObjectId,
  name: String,           // required
  colorType: String,      // '1+0', '1+1', '4+0', '4+4'
  qtyUpTo49: Number,
  qty50_99: Number,
  qty100_299: Number,
  qty300_499: Number,
  qtyFrom500: Number,
  isNegotiable: Boolean,
  createdAt: Date
}
```

**4. Collection: `additional_services`**
```javascript
{
  _id: ObjectId,
  categoryId: ObjectId,   // ссылка на service_categories
  name: String,
  unit: String,
  price: Number,
  createdAt: Date
}
```

**5. Collection: `orders`** (Основная коллекция с встроенными items)
```javascript
{
  _id: ObjectId,
  orderNumber: String,    // unique
  client: {               // Embedded document
    _id: ObjectId,
    name: String,
    phone: String,
    email: String,
    company: String
  },
  category: {             // Embedded document
    _id: ObjectId,
    name: String,
    slug: String
  },
  items: [                // Embedded array
    {
      productName: String,
      colorType: String,
      quantity: Number,
      unitPrice: Number,
      totalPrice: Number,
      specifications: Object,  // Гибкое поле для доп. параметров
      createdAt: Date
    }
  ],
  userId: String,         // Опционально
  status: String,         // 'draft', 'in_progress', 'approved', 'completed'
  paymentStatus: String,  // 'not_paid', 'prepaid', 'paid'
  totalAmount: Number,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Примечание**: В MongoDB используем встроенные документы (embedded) для client, category и items, так как:
- Это ускоряет чтение данных (один запрос вместо JOIN)
- Сохраняет "снимок" данных на момент создания заказа
- Оптимально для системы заказов

---

### 1.3 Разработка Backend API (3-4 дня)

#### API Endpoints:

**Клиенты (`/api/clients`)**
- `GET /api/clients` - Получить список клиентов
- `GET /api/clients/:id` - Получить клиента по ID
- `POST /api/clients` - Создать клиента
- `PUT /api/clients/:id` - Обновить клиента
- `DELETE /api/clients/:id` - Удалить клиента

**Категории (`/api/categories`)**
- `GET /api/categories` - Получить список категорий
- `GET /api/categories/:id` - Получить категорию по ID

**Прайс (`/api/pricing`)**
- `GET /api/pricing/business-cards` - Получить прайс визиток
- `GET /api/pricing/services` - Получить дополнительные услуги
- `POST /api/pricing/calculate` - Расчет стоимости

**Заказы (`/api/orders`)**
- `GET /api/orders` - Получить список заказов (с фильтрами)
- `GET /api/orders/:id` - Получить заказ по ID
- `POST /api/orders` - Создать заказ
- `PUT /api/orders/:id` - Обновить заказ
- `PATCH /api/orders/:id/status` - Обновить статус заказа
- `PATCH /api/orders/:id/payment-status` - Обновить статус оплаты
- `DELETE /api/orders/:id` - Удалить заказ
- `GET /api/orders/stats` - Получить статистику по заказам

**Аутентификация (`/api/auth`)**
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/logout` - Выход из системы
- `GET /api/auth/verify` - Проверка токена

#### Задачи:
- [ ] Создать Mongoose модели для всех коллекций
- [ ] Реализовать CRUD операции для каждой сущности
- [ ] Добавить валидацию данных
- [ ] Реализовать обработку ошибок
- [ ] Добавить middleware для аутентификации
- [ ] Создать скрипты для начальной загрузки данных (seeding)

---

### 1.4 Миграция данных (1-2 дня)

#### Задачи:
- [ ] **Создать скрипт миграции**
  - Экспорт данных из Supabase (PostgreSQL)
  - Трансформация данных в формат MongoDB
  - Импорт данных в MongoDB

- [ ] **Файл миграции**: `server/migrations/migrate-from-supabase.js`
  - Подключение к Supabase
  - Чтение всех данных
  - Преобразование структуры
  - Загрузка в MongoDB

- [ ] **Создать seed данные**
  - Начальные категории услуг
  - Прайс-лист визиток
  - Тестовые клиенты
  - Тестовые заказы

#### Файл: `server/seeds/seed.js`

---

### 1.5 Обновление Frontend (2-3 дня)

#### Задачи:

- [ ] **Удалить Supabase интеграцию**
  - Удалить `src/lib/supabase.js`
  - Удалить импорты Supabase из компонентов
  - Удалить из `.env` переменные Supabase

- [ ] **Создать API клиент**
  - Новый файл: `src/lib/api.js`
  - Использовать fetch или axios для HTTP запросов
  - Централизованная обработка ошибок
  - Добавить interceptors для токенов

```javascript
// src/lib/api.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

class ApiClient {
  constructor() {
    this.baseURL = API_URL
  }

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token')
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }

    return response.json()
  }

  // Методы для каждой сущности
  clients = {
    getAll: () => this.request('/clients'),
    getById: (id) => this.request(`/clients/${id}`),
    create: (data) => this.request('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => this.request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => this.request(`/clients/${id}`, { method: 'DELETE' }),
  }

  orders = {
    getAll: (filters) => this.request(`/orders?${new URLSearchParams(filters)}`),
    getById: (id) => this.request(`/orders/${id}`),
    create: (data) => this.request('/orders', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => this.request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id, status) => this.request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    updatePaymentStatus: (id, paymentStatus) => this.request(`/orders/${id}/payment-status`, { method: 'PATCH', body: JSON.stringify({ paymentStatus }) }),
    delete: (id) => this.request(`/orders/${id}`, { method: 'DELETE' }),
    getStats: () => this.request('/orders/stats'),
  }

  // ... остальные методы
}

export const api = new ApiClient()
```

- [ ] **Обновить компоненты**
  - Заменить все вызовы `supabase.*` на `api.*`
  - Обновить обработку ответов
  - Обновить обработку ошибок

**Компоненты для обновления:**
1. `ClientSelector.jsx` - использует supabase для клиентов
2. `OrdersList.jsx` - использует supabase для заказов
3. `OrderDetail.jsx` - использует supabase для деталей заказа
4. `Dashboard.jsx` - использует supabase для статистики
5. Все калькуляторы - обновить метод сохранения заказов

- [ ] **Обновить Auth компонент**
  - Переделать авторизацию через API
  - Использовать JWT токены
  - Сохранять токен в localStorage

---

### 1.6 Тестирование и отладка (2-3 дня)

#### Задачи:
- [ ] **Unit тесты**
  - Тесты для API endpoints (Jest + Supertest)
  - Тесты для Mongoose моделей

- [ ] **Интеграционное тестирование**
  - Тестирование полного цикла создания заказа
  - Тестирование расчетов в калькуляторах
  - Тестирование CRUD операций

- [ ] **Ручное тестирование**
  - Создание клиентов
  - Создание заказов через все калькуляторы
  - Обновление статусов
  - Проверка статистики на Dashboard
  - Проверка фильтрации и поиска

- [ ] **Тестирование производительности**
  - Проверка скорости загрузки списка заказов
  - Оптимизация запросов к MongoDB
  - Добавление индексов

---

## 🚀 Фаза 2: Улучшение и расширение функционала (После миграции)

### 2.1 Улучшение аутентификации и авторизации (1-2 дня)

- [ ] **JWT токены**
  - Реализация refresh tokens
  - Автоматическое обновление токенов

- [ ] **Роли пользователей**
  - Admin - полный доступ
  - Manager - работа с заказами
  - Operator - только создание заказов
  - Viewer - только просмотр

- [ ] **Регистрация пользователей**
  - Страница регистрации
  - Подтверждение email (опционально)
  - Восстановление пароля

### 2.2 Расширенная аналитика (2-3 дня)

- [ ] **Детальная статистика**
  - Графики продаж по дням/месяцам
  - Топ клиенты
  - Средний чек
  - Выручка по категориям услуg

- [ ] **Экспорт данных**
  - Экспорт заказов в Excel/CSV
  - Печать заказов (PDF)
  - Отчеты для бухгалтерии

- [ ] **Дашборд real-time**
  - WebSocket для обновлений в реальном времени
  - Уведомления о новых заказах

### 2.3 Улучшение UX/UI (2-3 дня)

- [ ] **Улучшение интерфейса**
  - Адаптивный дизайн для мобильных устройств
  - Темная тема
  - Улучшение доступности (a11y)

- [ ] **Валидация форм**
  - Real-time валидация
  - Подсказки и автозаполнение
  - Сохранение черновиков

- [ ] **Поиск и фильтрация**
  - Глобальный поиск по заказам и клиентам
  - Расширенные фильтры
  - Сохранение фильтров

### 2.4 Дополнительный функционал (Опционально)

- [ ] **Шаблоны заказов**
  - Сохранение часто используемых конфигураций
  - Быстрое создание заказа по шаблону

- [ ] **Уведомления**
  - Email уведомления клиентам
  - SMS уведомления (интеграция)
  - Push уведомления в браузере

- [ ] **История изменений**
  - Логирование всех изменений заказов
  - История статусов
  - Кто и когда вносил изменения

- [ ] **Интеграция с CRM**
  - API для внешних систем
  - Webhook для событий

- [ ] **Система задач**
  - Задачи по заказам
  - Назначение исполнителей
  - Отслеживание выполнения

---

## 🛠️ Фаза 3: Оптимизация и масштабирование

### 3.1 Оптимизация производительности (1-2 дня)

- [ ] **Кеширование**
  - Redis для кеширования частых запросов
  - Кеш прайс-листов
  - Кеш статистики

- [ ] **Оптимизация запросов**
  - Использование MongoDB Aggregation Pipeline
  - Правильные индексы
  - Pagination для больших списков

- [ ] **Frontend оптимизация**
  - Code splitting
  - Lazy loading компонентов
  - Оптимизация bundle size

### 3.2 Безопасность (1-2 дня)

- [ ] **Защита API**
  - Rate limiting
  - CORS настройки
  - Валидация всех входных данных
  - Защита от SQL/NoSQL injection

- [ ] **Аудит безопасности**
  - Проверка зависимостей (npm audit)
  - HTTPS в production
  - Безопасное хранение токенов

### 3.3 DevOps и деплой (2-3 дня)

- [ ] **Контейнеризация**
  - Docker для backend
  - Docker для frontend
  - Docker Compose для локальной разработки

- [ ] **CI/CD**
  - GitHub Actions / GitLab CI
  - Автоматические тесты
  - Автоматический деплой

- [ ] **Деплой**
  - Backend: Heroku / Railway / DigitalOcean
  - Frontend: Vercel / Netlify
  - Database: MongoDB Atlas

- [ ] **Мониторинг**
  - Логирование (Winston / Pino)
  - Мониторинг ошибок (Sentry)
  - Метрики производительности

---

## 📅 Временная шкала

### Быстрый план (минимум):
**Общее время: 2-3 недели**

1. **Неделя 1**: Фаза 1.1 - 1.3 (Подготовка + Backend API)
2. **Неделя 2**: Фаза 1.4 - 1.6 (Миграция + Frontend + Тестирование)
3. **Неделя 3**: Завершение тестирования + деплой

### Полный план (с расширениями):
**Общее время: 6-8 недель**

1. **Недели 1-2**: Фаза 1 - Миграция на MongoDB
2. **Недели 3-4**: Фаза 2 - Улучшения
3. **Недели 5-6**: Фаза 3 - Оптимизация
4. **Недели 7-8**: Тестирование и полировка

---

## 🎯 Приоритеты задач

### Критический приоритет (Must Have):
1. ✅ Миграция на MongoDB
2. ✅ Backend API для всех основных операций
3. ✅ Обновление Frontend для работы с новым API
4. ✅ Базовая аутентификация
5. ✅ Тестирование критических функций

### Высокий приоритет (Should Have):
1. Улучшенная аутентификация с ролями
2. Расширенная аналитика
3. Экспорт данных
4. Валидация форм
5. Адаптивный дизайн

### Средний приоритет (Nice to Have):
1. Темная тема
2. Шаблоны заказов
3. Email уведомления
4. История изменений
5. Кеширование

### Низкий приоритет (Future):
1. Интеграция с CRM
2. SMS уведомления
3. Система задач
4. Advanced мониторинг

---

## 📚 Технические требования

### Backend:
```json
{
  "runtime": "Node.js >= 18.0.0",
  "framework": "Express.js",
  "database": "MongoDB >= 5.0",
  "odm": "Mongoose",
  "authentication": "JWT",
  "validation": "Joi / Yup"
}
```

### Frontend:
```json
{
  "framework": "React 18",
  "builder": "Vite",
  "styling": "TailwindCSS",
  "routing": "React Router v6",
  "http": "Fetch API / Axios",
  "state": "React Hooks (+ Context API при необходимости)"
}
```

### Infrastructure:
```json
{
  "database_host": "MongoDB Atlas (Cloud)",
  "backend_host": "Railway / Heroku / DigitalOcean",
  "frontend_host": "Vercel / Netlify",
  "ci_cd": "GitHub Actions"
}
```

---

## 📝 Структура проекта после миграции

```
zoomsys/
├── client/                     # Frontend (React)
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── api.js         # Новый API клиент
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Backend (Node.js + Express)
│   ├── config/
│   │   └── database.js        # MongoDB конфигурация
│   ├── models/                # Mongoose модели
│   │   ├── Client.js
│   │   ├── Order.js
│   │   ├── ServiceCategory.js
│   │   └── Pricing.js
│   ├── routes/                # API маршруты
│   │   ├── auth.js
│   │   ├── clients.js
│   │   ├── orders.js
│   │   ├── categories.js
│   │   └── pricing.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── controllers/           # Бизнес логика
│   ├── migrations/            # Скрипты миграции
│   ├── seeds/                 # Начальные данные
│   ├── index.js               # Точка входа
│   └── package.json
│
├── .env.example
├── docker-compose.yml         # Для локальной разработки
├── ROADMAP.md                 # Этот файл
└── README.md
```

---

## 🔄 Процесс разработки

### Git workflow:
1. `main` - production ветка
2. `develop` - development ветка
3. `feature/*` - ветки для новых функций
4. `fix/*` - ветки для исправлений

### Code review:
- Все изменения через Pull Request
- Минимум 1 reviewer
- Проверка тестов перед merge

### Тестирование:
- Unit тесты для критического кода
- Integration тесты для API
- E2E тесты для основных сценариев

---

## 📞 Контакты и поддержка

- **Документация API**: `/api/docs` (Swagger/OpenAPI)
- **Issue tracker**: GitHub Issues
- **Команда разработки**: [указать контакты]

---

## ✅ Чек-лист готовности к production

### Backend:
- [ ] Все API endpoints работают
- [ ] Валидация всех входных данных
- [ ] Обработка ошибок
- [ ] Логирование
- [ ] Тесты покрытие > 70%
- [ ] Документация API
- [ ] Environment variables настроены
- [ ] CORS настроен правильно
- [ ] Rate limiting включен
- [ ] MongoDB индексы созданы

### Frontend:
- [ ] Все компоненты работают
- [ ] Обработка ошибок API
- [ ] Loading states
- [ ] Error states
- [ ] Валидация форм
- [ ] Адаптивный дизайн
- [ ] Build без ошибок
- [ ] Environment variables настроены

### Infrastructure:
- [ ] Database backup настроен
- [ ] MongoDB Atlas в production mode
- [ ] SSL сертификаты
- [ ] Domain настроен
- [ ] CI/CD pipeline работает
- [ ] Monitoring настроен
- [ ] Документация для команды

---

## 🎉 Заключение

Эта дорожная карта предоставляет пошаговый план миграции проекта ZoomSys с Supabase (PostgreSQL) на MongoDB, а также дальнейшее развитие системы.

**Ключевые преимущества MongoDB для данного проекта:**
- ✅ Гибкая схема данных (подходит для разных типов калькуляторов)
- ✅ Встроенные документы (быстрый доступ к данным заказа)
- ✅ Легкое горизонтальное масштабирование
- ✅ Отличная производительность для read-heavy операций
- ✅ Простая работа с JSON данными (specifications в заказах)

**Следующий шаг**: Начните с Фазы 1.1 - настройки MongoDB и создания backend структуры.

Удачи в разработке! 🚀
