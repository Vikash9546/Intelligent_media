# Multi-stage Dockerfile — separate API and Worker targets
# to allow independent container images with a shared build layer.

# ── Stage 1: Dependencies ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install system dependencies needed by Sharp and Tesseract
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    tesseract-ocr \
    tesseract-ocr-data-eng

COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
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

RUN apk add --no-cache vips tesseract-ocr tesseract-ocr-data-eng curl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "dist/server.js"]

# ── Stage 4: Worker ───────────────────────────────────────────────────────────
FROM node:20-alpine AS worker
WORKDIR /app

RUN apk add --no-cache vips tesseract-ocr tesseract-ocr-data-eng

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

RUN mkdir -p uploads

CMD ["node", "dist/worker.js"]
