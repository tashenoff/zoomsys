-- Создание структуры базы данных для ZoomSys

-- Таблица клиентов
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица категорий услуг
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Вставка начальных категорий
INSERT INTO service_categories (name, slug, description) VALUES
('Полиграфия', 'polygraphy', 'Визитки, флаера и другая полиграфическая продукция'),
('Широкоформатная печать', 'wide-format', 'Баннеры, стенды, плакаты большого формата')
ON CONFLICT (slug) DO NOTHING;

-- Таблица прайса для визиток (полиграфия)
CREATE TABLE IF NOT EXISTS business_cards_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color_type TEXT NOT NULL, -- '1+0', '1+1', '4+0', '4+4'
  qty_up_to_49 NUMERIC(10,2),
  qty_50_99 NUMERIC(10,2),
  qty_100_299 NUMERIC(10,2),
  qty_300_499 NUMERIC(10,2),
  qty_from_500 NUMERIC(10,2),
  is_negotiable BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Вставка прайса из скриншота (Изготовление визиток 55*90/54*86)
INSERT INTO business_cards_pricing (name, color_type, qty_up_to_49, qty_50_99, qty_100_299, qty_300_499, qty_from_500, is_negotiable) VALUES
('Черно-белые', '1+0', 18, 18, 17, 16, NULL, true),
('Черно-белые', '1+1', 20, 20, 19, 18, NULL, true),
('Цветные (250-300гр.)', '4+0', 28, 27, 26, 25, NULL, true),
('Цветные (250-300гр.)', '4+4', 35, 33, 31, 30, NULL, true),
('Цветные (лен 280 гр)', '4+0', 38, 38, 36, 34, NULL, true),
('Цветные (лен 280 гр)', '4+4', 46, 46, 43, 40, NULL, true),
('Сирио /слендергель (280гр/м)', '4+0', 50, 50, 48, 46, NULL, true),
('Сирио /слендергель (280гр/м)', '4+4', 60, 60, 57, 54, NULL, true),
('Дизайнерская бумага (300-350гр)', '4+0', 80, 80, 78, 76, NULL, true),
('Дизайнерская бумага (300-350гр)', '4+4', 90, 90, 87, 84, NULL, true),
('Таккавер', '4+0', 150, 140, 120, 110, NULL, true),
('Таккавер', '4+4', 170, 160, 140, 130, NULL, true),
('Таккавер с УФ печатью без лака', '4+0', 180, 170, 160, 150, NULL, true),
('Таккавер с УФ печатью без лака', '4+4', 210, 200, 190, 180, NULL, true),
('Таккавер с УФ печатью и с лаком', '4+0', 230, 220, 210, 200, NULL, true),
('Таккавер с УФ печатью и с лаком', '4+4', 260, 250, 240, 230, NULL, true),
('Нанесение УФ печати без лака на дизайнерской бумаге', '4+0', 130, 120, 115, 110, NULL, true),
('Нанесение УФ печати без лака на дизайнерской бумаге', '4+4', 180, 170, 160, 150, NULL, true)
ON CONFLICT DO NOTHING;

-- Дополнительные услуги для визиток
CREATE TABLE IF NOT EXISTS additional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES service_categories(id),
  name TEXT NOT NULL,
  unit TEXT, -- 'шт', 'тг' и т.д.
  price NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Дополнительные услуги из скриншота
INSERT INTO additional_services (category_id, name, unit, price)
SELECT id, 'Фольгирование', '15тг/шт', 15
FROM service_categories WHERE slug = 'polygraphy'
ON CONFLICT DO NOTHING;

INSERT INTO additional_services (category_id, name, unit, price)
SELECT id, 'Дизайн визитки', '', 3000
FROM service_categories WHERE slug = 'polygraphy'
ON CONFLICT DO NOTHING;

-- Таблица заказов/просчетов
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  client_id UUID REFERENCES clients(id),
  category_id UUID REFERENCES service_categories(id),
  user_id UUID, -- Сделано nullable для работы без Supabase Auth
  status TEXT DEFAULT 'draft', -- draft, in_progress, approved, completed
  payment_status TEXT DEFAULT 'not_paid', -- not_paid, prepaid, paid
  total_amount NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица позиций заказа
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  color_type TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  specifications JSONB, -- для хранения дополнительных параметров
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Отключаем RLS для простоты (так как используется простая авторизация admin/admin)
-- Если нужна безопасность, включите RLS и настройте политики
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_cards_pricing DISABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE additional_services DISABLE ROW LEVEL SECURITY;
