FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api-events-rabbitmq ./apps/api-events-rabbitmq

RUN npm ci
RUN npm run build:packages
RUN npm run build -w api-events-rabbitmq

ENV HOST=0.0.0.0
ENV PORT=4004

EXPOSE 4004

CMD ["npm", "run", "start", "-w", "api-events-rabbitmq"]
