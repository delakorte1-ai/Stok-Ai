# Dockerfile satu-container: build frontend -> sajikan lewat backend Express.
# Cocok untuk deploy sekali klik di Railway / Render / Fly.io (platform yang
# mendukung "deploy from Dockerfile").

# ---- Stage 1: build frontend jadi file statis ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Batasi memory Node saat install & build supaya tidak OOM (exit code 137)
ENV NODE_OPTIONS="--max-old-space-size=512"

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund --prefer-offline
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend + hasil build frontend ----
FROM node:20-alpine AS runtime
WORKDIR /app/backend

ENV NODE_OPTIONS="--max-old-space-size=512"

# Dependency backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Prisma schema & generate client (butuh koneksi internet saat build, normal di platform hosting)
COPY backend/prisma ./prisma
RUN npx prisma generate

# Source code backend
COPY backend/src ./src
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Hasil build frontend disajikan dari sini (dibaca oleh src/index.js)
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]