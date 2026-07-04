FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api-events-redis ./apps/api-events-redis

RUN npm ci
RUN npm run build:packages
RUN npm run build -w api-events-redis

ENV HOST=0.0.0.0
ENV PORT=4003

EXPOSE 4003

CMD ["npm", "run", "start", "-w", "api-events-redis"]
