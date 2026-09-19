#!/bin/sh
# Boot do container: aplica migrações pendentes (idempotente; seguro com várias
# réplicas porque o Prisma serializa por lock no banco) e sobe o servidor.
# MIGRATE_ON_START=false pula (quando o deploy roda `prisma migrate deploy` à parte).
set -e
if [ "${MIGRATE_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] prisma migrate deploy"
  (cd /opt/prisma && ./node_modules/.bin/prisma migrate deploy)
fi
exec "$@"
