# Развёртывание ZoomSys на Heroku

## Структура проекта

```
zoomsys/
├── server/           # Express.js API сервер
│   ├── index.js      # Главный файл сервера
│   ├── routes/       # API маршруты
│   ├── migrate.js    # Миграции БД
│   └── seed.js       # Загрузка начальных данных
├── src/              # React фронтенд
├── Procfile          # Конфигурация Heroku
└── package.json      # Зависимости фронтенда
```

## Локальная разработка

### 1. Установка PostgreSQL

**Windows (Chocolatey):**
```bash
choco install postgresql
```

**Или Docker:**
```bash
docker run -d --name zoomsys-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=zoomsys -p 5432:5432 postgres:15
```

### 2. Настройка бэкенда

```bash
cd server
npm install

# Создайте .env файл
cp .env.example .env
# Отредактируйте DATABASE_URL

# Запустите миграции
npm run migrate

# Загрузите начальные данные из pricing.json
npm run seed

# Запустите сервер
npm run dev
```

### 3. Настройка фронтенда

```bash
# В корне проекта
npm install

# Создайте .env файл
echo "VITE_API_URL=http://localhost:3001/api" > .env

# Запустите dev сервер
npm run dev
```

## Развёртывание на Heroku

### 1. Создание приложения

```bash
heroku login
heroku create zoomsys-app
```

### 2. Добавление PostgreSQL

```bash
heroku addons:create heroku-postgresql:essential-0
```

### 3. Настройка переменных окружения

```bash
heroku config:set NODE_ENV=production
heroku config:set VITE_API_URL=https://zoomsys-app.herokuapp.com/api
heroku config:set VITE_ADMIN_LOGIN=admin
heroku config:set VITE_ADMIN_PASSWORD=your_secure_password
```

### 4. Деплой

```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### 5. Миграции и seed на Heroku

```bash
# Запустить миграции
heroku run node server/migrate.js

# Загрузить начальные данные
heroku run node server/seed.js
```

## API Endpoints

### Прайсы
- `GET /api/pricing` - Все прайсы
- `GET /api/pricing/business-cards` - Визитки
- `POST /api/pricing/business-cards` - Добавить визитку
- `PUT /api/pricing/business-cards/:id` - Обновить
- `DELETE /api/pricing/business-cards/:id` - Удалить

### Клиенты
- `GET /api/clients` - Все активные клиенты
- `GET /api/clients/:id` - Детали клиента
- `POST /api/clients` - Создать клиента
- `PUT /api/clients/:id` - Обновить клиента
- `DELETE /api/clients/:id` - Удалить (soft delete, is_active=false)

### Заказы
- `GET /api/orders` - Все заказы с данными клиента
- `GET /api/orders/:id` - Детали заказа с позициями
- `POST /api/orders` - Создать заказ с позициями
- `PUT /api/orders/:id` - Обновить статус заказа/оплаты
- `DELETE /api/orders/:id` - Удалить заказ и позиции

## Архитектура

### Фронтенд Hooks (React Context)
- `usePricing` - Управление прайсами
- `useOrders` - Управление заказами (с синхронизацией localStorage)
- `useClients` - Управление клиентами (с синхронизацией localStorage)

### Offline режим
При недоступности API данные сохраняются в localStorage и синхронизируются
при восстановлении связи. Компоненты показывают индикатор 📴 Offline.

### Структура заказа
```json
{
  "client_id": 1,
  "category": "business-cards",
  "status": "draft|in_progress|approved|completed",
  "payment_status": "not_paid|prepaid|paid",
  "total_amount": 15000.00,
  "notes": "Примечания",
  "items": [{
    "product_name": "Визитки 350г",
    "color_type": "4+0",
    "quantity": 500,
    "unit_price": 30.00,
    "total_price": 15000.00,
    "specifications": { ... }
  }]
}
```

## Troubleshooting

### Ошибка подключения к БД
```bash
# Проверить переменную DATABASE_URL
heroku config:get DATABASE_URL

# Проверить логи
heroku logs --tail
```

### Сброс базы данных
```bash
heroku pg:reset DATABASE_URL --confirm zoomsys-app
heroku run node server/migrate.js
heroku run node server/seed.js
```
