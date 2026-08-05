FROM node:25-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api-mongoose-mongodb ./apps/api-mongoose-mongodb

RUN npm ci
RUN npm run build:packages
RUN npm run build -w api-mongoose-mongodb

FROM node:25-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app /app

ENV HOST=0.0.0.0
ENV PORT=4002

EXPOSE 4002

USER node
CMD ["npm", "run", "start", "-w", "api-mongoose-mongodb"]
