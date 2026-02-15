# ──────────────────────────────────────────────────────────
# FlowApp2 Server Dockerfile
# ──────────────────────────────────────────────────────────
# Multi-stage build: build dependencies → slim production image.
# Security: runs as non-root user 'appuser' (UID 1001).
# ──────────────────────────────────────────────────────────

# ─── Build stage ──────────────────────────────────────────
FROM node:20-alpine AS build

# OpenSSL is required by Prisma Client for database communication
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first for Docker layer caching.
# Only package.json is copied — source changes won't bust this layer.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy Prisma schema and generate the type-safe client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy application source (excluded items in .dockerignore)
COPY . .

# ─── Production stage ────────────────────────────────────
FROM node:20-alpine

# OpenSSL required by Prisma at runtime
RUN apk add --no-cache openssl

WORKDIR /app

# Security: create a non-root user for least-privilege execution.
# UID 1001 avoids collision with system accounts.
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy only production artifacts from the build stage.
# No dev dependencies, no source maps, no build tools.
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=build --chown=appuser:appgroup /app/src ./src
COPY --from=build --chown=appuser:appgroup /app/package.json ./

# Expose the API port (documentation — does not open the port)
EXPOSE 3001

# Health check: lightweight probe for orchestrator liveness detection.
# Uses wget (available in Alpine) to avoid adding curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Security: drop to non-root user before running the application
USER appuser

# Start the Express server
CMD ["node", "src/index.js"]
