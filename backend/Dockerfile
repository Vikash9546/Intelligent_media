# ── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# Install build tools for native addons (e.g., sharp)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev

COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ vips-dev
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 3: API ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS api
WORKDIR /app

# Install runtime dependencies for sharp and tesseract
RUN apk add --no-cache vips tesseract-ocr tesseract-ocr-data-eng curl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]

# ── Stage 4: Worker ───────────────────────────────────────────────────────────
FROM node:20-alpine AS worker
WORKDIR /app

RUN apk add --no-cache vips tesseract-ocr tesseract-ocr-data-eng
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
CMD ["node", "dist/worker.js"]
