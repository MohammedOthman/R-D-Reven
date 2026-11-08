# Single-container deploy: Next.js web on $PORT (public), NestJS API on 4000
# (internal), web proxies /api/* to the API. Migrations run on boot.
FROM node:22.23-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /app
ENV CI=1 HUSKY=0 NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_API_URL=https://reven-r4aryo.cranl.net/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    API_INTERNAL_URL=http://127.0.0.1:4000 \
    DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN cd packages/db && npx prisma generate \
  && cd /app/apps/api && pnpm build \
  && cd /app/apps/web && pnpm build

ENV NODE_ENV=production API_PORT=4000 PORT=3000
EXPOSE 3000
CMD ["bash", "/app/start.sh"]
