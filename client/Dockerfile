# ──────────────────────────────────────────────────────────
# FlowApp2 Client Dockerfile
# ──────────────────────────────────────────────────────────
# Multi-stage build: Node compiles React → Nginx serves static files.
# Security: Nginx runs as non-root user 'nginx' (UID 101, default).
# ──────────────────────────────────────────────────────────

# ─── Build stage ──────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi \
    && npm cache clean --force

# Copy source and build the production bundle
COPY . .
RUN npm run build

# ─── Production stage — Nginx ────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx config and HTML to reduce attack surface
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy the compiled React SPA
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx config with security headers and API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the frontend port (documentation only)
EXPOSE 3000

# Health check: verify Nginx is serving the SPA
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
