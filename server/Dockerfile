# ──────────────────────────────────────────────────────────
# FlowApp2 Server Dockerfile
# ──────────────────────────────────────────────────────────
# Multi-stage build: build dependencies → slim production image.
# Security measures:
#   - Non-root user 'appuser' (UID 1001)
#   - Minimal Alpine base with only required packages
#   - Read-only root FS compatible (writable dirs via tmpfs)
#   - No dev dependencies or build tools in final image
#   - COPY --chown for least-privilege file ownership
# ──────────────────────────────────────────────────────────

# ─── Build stage ──────────────────────────────────────────
# Installs all dependencies (including dev) and generates
# the Prisma client. None of the build tools carry over
# to the production stage.
FROM node:20-alpine AS build

# OpenSSL is required by Prisma Client for TLS database connections
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
# Minimal image: only Node runtime, OpenSSL, and our app code.
FROM node:20-alpine

# OpenSSL required by Prisma at runtime for TLS
RUN apk add --no-cache openssl \
    # Remove package cache to reduce image size
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Security: create a non-root user for least-privilege execution.
# UID 1001 avoids collision with system accounts.
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy only production artifacts from the build stage.
# No dev dependencies, no source maps, no build tools.
# --chown ensures the non-root user owns all files.
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

# Security: drop to non-root user before running the application.
# All subsequent commands (including CMD) run as appuser.
USER appuser

# Start the Express server directly (no shell wrapper = PID 1 signal handling)
CMD ["node", "src/index.js"]
