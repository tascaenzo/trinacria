FROM node:24-bookworm-slim

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

ENV HOST=0.0.0.0
ENV PORT=4001

EXPOSE 4001

CMD ["sh", "-c", "npm run prisma:push -w api-prisma-postgresql && npm run start -w api-prisma-postgresql"]
