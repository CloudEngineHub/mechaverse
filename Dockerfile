# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy all source
COPY . .

# Build standalone
RUN npm run build

# Manually copy assets into the standalone tree so server.js can serve them
RUN mkdir -p .next/standalone/public \
    && cp -r public/* .next/standalone/public/ || true \
    && mkdir -p .next/standalone/.next/static \
    && cp -r .next/static/* .next/standalone/.next/static/ || true

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

# Copy the complete standalone folder (now containing server.js, .next/static, public)
COPY --from=builder /app/.next/standalone ./

EXPOSE 8080
CMD ["node", "server.js"]
    