# =========================================================================
# STAGE 1: LOCAL WORKSPACE EXPORTER (BYPASSES NETWORK DOWNLOADS)
# =========================================================================
FROM node:22-alpine AS builder
WORKDIR /app

# Copy your locally pre-compiled dependencies and source files directly
COPY node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compile the standalone production Next.js build bundle
RUN npm run build

# =========================================================================
# STAGE 2: RUNTIME CONTAINER ENGINE
# =========================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Pull the compiled code output from Stage 1 into the minimal execution layers
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENV DATABASE_URL=/app/data/webnx_floor.db

CMD ["node", "server.js"]
