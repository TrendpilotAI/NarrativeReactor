# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json pnpm-lock.yaml ./

# Install pnpm and ALL deps (including devDeps needed for tsc)
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Patch Express 5 types (postinstall may not run in Docker)
RUN sed -i 's/\[key: string\]: string | string\[\];/[key: string]: string;/' node_modules/@types/express-serve-static-core/index.d.ts 2>/dev/null || true

# Copy source
COPY tsconfig.json ./
COPY src ./src
COPY genkit.config.js ./

# Compile TypeScript → dist/
RUN pnpm run build

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:22-slim AS production

# Non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser

WORKDIR /app

# Only production deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --prod --frozen-lockfile --ignore-scripts && pnpm store prune

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy any non-compiled assets (prompts, public, etc.)
COPY prompts ./prompts
COPY public  ./public

# Create data directory for SQLite (writable by app user)
RUN mkdir -p /app/data /tmp/sqlite && chown -R appuser:nodejs /app/data /tmp/sqlite

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
