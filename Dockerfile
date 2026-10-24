FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 10001 ibios && useradd --system --uid 10001 --gid ibios --home-dir /app ibios
COPY --from=build --chown=ibios:ibios /app/package.json ./package.json
COPY --from=build --chown=ibios:ibios /app/node_modules ./node_modules
COPY --from=build --chown=ibios:ibios /app/dist ./dist
COPY --from=build --chown=ibios:ibios /app/migrations ./migrations
USER ibios
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:8000/api/v1/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node dist/migrate.js && node dist/server.js"]
