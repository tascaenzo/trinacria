FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api-events-rabbitmq ./apps/api-events-rabbitmq

RUN npm ci
RUN npm run build:packages
RUN npm run build -w api-events-rabbitmq

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app /app

ENV HOST=0.0.0.0
ENV PORT=4004

EXPOSE 4004

USER node
CMD ["npm", "run", "start", "-w", "api-events-rabbitmq"]
