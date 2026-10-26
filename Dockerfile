# Stage 1: Dependencies
FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS deps
WORKDIR /app
RUN test "$(node --version)" = "v24.18.0" && test "$(npm --version)" = "11.16.0"
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run test:audit && npm run test:audit:posix
ENV LANDING_CLONE_PREVIEW=0
ENV NEXT_PUBLIC_LANDING_CLONE_PREVIEW=0
RUN npm run build -- --webpack

# Stage 3: Production runner
FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV LANDING_CLONE_PREVIEW=0
ENV NEXT_PUBLIC_LANDING_CLONE_PREVIEW=0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Cloud history is runtime opt-in; no retention policy or encryption key is
# compiled into this image. The persistent mount must be writable by UID1001.
ENV AUDIT_HISTORY_ENABLED=false

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

CMD ["node", "server.js"]
