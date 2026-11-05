FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 BISHAMON_DB_PATH=/app/data/bishamon.sqlite
RUN mkdir -p /app/data && chown -R node:node /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/scripts/seed.ts ./scripts/seed.ts
COPY --from=build --chown=node:node /app/src/lib/database.ts /app/src/lib/seed.ts /app/src/lib/types.ts ./src/lib/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "test -n \"$APP_PASSWORD\" || { echo 'APP_PASSWORD wajib untuk container'; exit 1; }; node --experimental-strip-types scripts/seed.ts --recover && HOSTNAME=0.0.0.0 node server.js"]
