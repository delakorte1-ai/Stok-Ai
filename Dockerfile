# ---- Stage 2: backend + hasil build frontend ----
FROM node:22-alpine AS runtime
WORKDIR /app/backend

ENV NODE_OPTIONS="--max-old-space-size=512"

# Tools untuk compile native module (better-sqlite3 butuh ini)
RUN apk add --no-cache python3 make g++

# Dependency backend
COPY backend/package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm install --omit=dev

# Prisma schema & generate client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Source code backend
COPY backend/src ./src
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Hasil build frontend disajikan dari sini
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
