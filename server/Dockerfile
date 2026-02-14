# ─── Build stage ──────────────────────────────────────────
FROM node:20-alpine AS build

# OpenSSL required by Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json ./
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY . .

# ─── Production stage ────────────────────────────────────
FROM node:20-alpine

# OpenSSL required by Prisma at runtime
RUN apk add --no-cache openssl

WORKDIR /app

# Copy from build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Start server
CMD ["node", "src/index.js"]
