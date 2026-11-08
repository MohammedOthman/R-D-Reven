#!/usr/bin/env bash
# Container entrypoint: apply Prisma migrations, then run the API (:4000,
# internal) and the Next.js web app ($PORT, public; proxies /api/* to the API).
#
# Migrations retry in the background instead of blocking boot: if the
# database is briefly unreachable at start, the servers still come up
# (/api/health answers, /api/health/ready reports the DB as down) and the
# schema lands as soon as Postgres accepts connections.

run_migrations() {
  local attempt=1
  until (cd /app/packages/db && npx prisma migrate deploy); do
    if [ "$attempt" -ge 60 ]; then
      echo "[start] migrations still failing after $attempt attempts; giving up" >&2
      return 1
    fi
    echo "[start] migrate attempt $attempt failed; retrying in 10s" >&2
    attempt=$((attempt + 1))
    sleep 10
  done
  echo "[start] migrations applied"
}

run_migrations &

(cd /app/apps/api && exec node dist/main.js) &
(cd /app/apps/web && exec npx next start -H 0.0.0.0 -p "${PORT:-3000}") &

# Exit (and let the platform restart us) as soon as either server dies.
# The migration job is excluded: it finishing must not stop the container.
wait -n %2 %3
exit 1
