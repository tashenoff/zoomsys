-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- admin, manager, user
  permissions JSONB DEFAULT '{
    "viewDashboard": true,
    "viewOrders": true,
    "createOrders": true,
    "editOrders": false,
    "deleteOrders": false,
    "viewClients": true,
    "manageClients": false,
    "viewReports": false,
    "manageUsers": false,
    "viewPricing": true,
    "editPricing": false
  }',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем индекс для поиска по username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Вставляем администратора по умолчанию (пароль: admin)
-- Хеш пароля admin: $2a$10$JK7hd5YdP7KGaZn5Y3E3POl1cOgNKJFB5.TmfMJlVPOdPMVIc6tTy
INSERT INTO users (username, password_hash, full_name, role, permissions)
VALUES (
  'admin',
  '$2a$10$JK7hd5YdP7KGaZn5Y3E3POl1cOgNKJFB5.TmfMJlVPOdPMVIc6tTy',
  'Администратор',
  'admin',
  '{
    "viewDashboard": true,
    "viewOrders": true,
    "createOrders": true,
    "editOrders": true,
    "deleteOrders": true,
    "viewClients": true,
    "manageClients": true,
    "viewReports": true,
    "manageUsers": true,
    "viewPricing": true,
    "editPricing": true
  }'
) ON CONFLICT (username) DO NOTHING;
