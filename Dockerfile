# Dockerfile для ZoomSys API (без фронтенда)
# Фронтенд развёрнут отдельно на Vercel: https://zoomsys-three.vercel.app
# Здесь только Node/Express бэкенд + PostgreSQL.

FROM node:18-alpine AS builder

WORKDIR /app

# Зависимости сервера
COPY server/package*.json ./
RUN npm ci

# Исходники сервера
COPY server ./

# ============ Production образ ============
FROM node:18-alpine

WORKDIR /app

# Только server + его node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

WORKDIR /app

EXPOSE 3001

CMD ["node", "index.js"]