FROM node:25-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/app-starter ./apps/app-starter

RUN npm ci
RUN npm run build:packages
RUN npm run build -w app-starter

FROM node:25-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app /app

USER node
CMD ["npm", "run", "start", "-w", "app-starter"]
