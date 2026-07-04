FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/app-starter ./apps/app-starter

RUN npm ci
RUN npm run build:packages
RUN npm run build -w app-starter

CMD ["npm", "run", "start", "-w", "app-starter"]
