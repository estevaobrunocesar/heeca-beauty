# syntax=docker/dockerfile:1.7
# Imagem de produção do Heeca Beauty (Next.js standalone + Prisma migrate no boot).
#   docker build -t heeca-beauty .
#   docker run --env-file .env.production -p 3000:3000 heeca-beauty

# ---- deps: instala com o lockfile (cache por camada) --------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# --ignore-scripts: o postinstall roda `prisma generate`, que fazemos explicitamente no build
# NODE_ENV=development aqui: o Coolify injeta NODE_ENV=production como build-arg e o npm pularia as devDependencies (tailwind, typescript)
RUN NODE_ENV=development npm ci --include=dev --ignore-scripts --no-audit --no-fund

# ---- build: gera o cliente Prisma e o bundle standalone ------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# O build não precisa de banco nem de segredos (a validação do ambiente roda só no boot do servidor).
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---- runner: só o necessário para rodar --------------------------------------
FROM node:24-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app && apk add --no-cache curl
# Prisma CLI isolado (só para `migrate deploy`): não mistura com o node_modules rastreado do standalone
RUN mkdir -p /opt/prisma && cd /opt/prisma && npm init -y >/dev/null && npm install prisma@7.10.0 dotenv@17 --no-audit --no-fund --silent
# Bundle standalone (server.js + node_modules rastreados) + estáticos + public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Migrações + config do Prisma para `prisma migrate deploy` no boot (em /opt/prisma, junto do CLI)
COPY --from=build --chown=app:app /app/prisma /opt/prisma/prisma
COPY --from=build --chown=app:app /app/prisma.config.ts /opt/prisma/prisma.config.ts
RUN chown -R app:app /opt/prisma
COPY --chown=app:app scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fsS http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
