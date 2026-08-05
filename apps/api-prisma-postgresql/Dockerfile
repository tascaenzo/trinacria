FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trinacria_example?schema=public

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api-prisma-postgresql ./apps/api-prisma-postgresql

RUN npm ci
RUN npm run build:packages
RUN npm run prisma:generate -w api-prisma-postgresql
RUN npm run build -w api-prisma-postgresql

FROM node:24-bookworm-slim AS runtime

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV AUTO_DB_PUSH=false
WORKDIR /app

COPY --from=build --chown=node:node /app /app

ENV HOST=0.0.0.0
ENV PORT=4001

EXPOSE 4001

USER node
CMD ["sh", "-c", "if [ \"$AUTO_DB_PUSH\" = \"true\" ]; then npm run prisma:push -w api-prisma-postgresql; fi; exec npm run start -w api-prisma-postgresql"]
