#!/usr/bin/env bash
set -e
# DATABASE_URL here comes from the runtime environment, not the build placeholder.
cd /app/packages/db && npx prisma migrate deploy
cd /app/apps/api && node dist/main.js &
cd /app/apps/web && npx next start -H 0.0.0.0 -p "${PORT:-3000}" &
# Exit (and let the platform restart us) as soon as either process dies.
wait -n
exit 1
