# Dockerfile для ZoomSys (фронт + API в одном контейнере)
# 
# Сборка: docker build -t zoomsys .
# Запуск: docker compose up -d

FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package файлы фронтенда
COPY package*.json ./

# Устанавливаем зависимости фронтенда
RUN npm ci

# Копируем ВСЕ исходники
COPY . .

# Устанавливаем зависимости сервера
RUN cd server && npm ci

# Собираем фронтенд БЕЗ VITE_API_URL (чтобы использовался /api)
RUN unset VITE_API_URL && npm run build

# ============ Production образ ============
FROM node:18-alpine

WORKDIR /app

# Копируем собранный фронт
COPY --from=builder /app/dist ./dist

# Копируем сервер (исходники + node_modules)
COPY --from=builder /app/server ./server

WORKDIR /app/server

EXPOSE 3001

CMD ["node", "index.js"]
