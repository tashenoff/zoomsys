# Dockerfile для ZoomSys (фронт + API в одном контейнере)
# 
# Сборка: docker build -t zoomsys .
# Запуск: docker compose up -d

FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package файлы
COPY package*.json ./
COPY server/package*.json ./server/

# Устанавливаем ВСЕ зависимости (нужны для сборки)
RUN npm ci
RUN cd server && npm ci

# Копируем исходники
COPY . .

# Собираем фронтенд
RUN npm run build

# ============ Production образ ============
FROM node:18-alpine

WORKDIR /app

# Копируем собранный фронт
COPY --from=builder /app/dist ./dist

# Копируем сервер
COPY --from=builder /app/server ./server

# Переходим в server и ставим только prod зависимости
WORKDIR /app/server
RUN npm ci --only=production

EXPOSE 3001

CMD ["node", "index.js"]
