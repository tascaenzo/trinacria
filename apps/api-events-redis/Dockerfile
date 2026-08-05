FROM node:25-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api-events-redis ./apps/api-events-redis

RUN npm ci
RUN npm run build:packages
RUN npm run build -w api-events-redis

FROM node:25-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app /app

ENV HOST=0.0.0.0
ENV PORT=4003

EXPOSE 4003

USER node
CMD ["npm", "run", "start", "-w", "api-events-redis"]
