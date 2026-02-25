FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/cron-example ./apps/cron-example

RUN npm ci
RUN npm run build:packages
RUN npm run build -w cron-example

CMD ["npm", "run", "start", "-w", "cron-example"]
