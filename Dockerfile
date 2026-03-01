# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./

# Install ALL deps (including devDeps needed for tsc)
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json ./
COPY src ./src
COPY genkit.config.js ./
COPY genkit.config.ts ./

# Compile TypeScript → dist/
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:20-slim AS production

# Non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser

WORKDIR /app

# Only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy any non-compiled assets (prompts, public, etc.)
COPY prompts ./prompts
COPY public  ./public

# Drop to non-root
USER appuser

# Railway injects PORT; default 8080
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Healthcheck — Railway uses this to validate deploy success
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
