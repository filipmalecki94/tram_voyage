# syntax=docker/dockerfile:1.7

# 1. deps — pełna instalacja (dev + prod) na potrzeby builda
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. builder — next build + esbuild server.ts → dist/server.js
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# Kompilacja server.ts → dist/server.js (brak tsx w runtime → mniejszy RAM)
RUN node_modules/.bin/esbuild server.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile=dist/server.js \
    --packages=external \
    --tsconfig=tsconfig.json

# 3. runner — chudy image produkcyjny, node bez tsx
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Tylko produkcyjne zależności (tsx wraca do devDependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Artefakty builda
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
# Skompilowany bundle serwera
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]
