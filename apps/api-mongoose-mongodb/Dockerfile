FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api-mongoose-mongodb ./apps/api-mongoose-mongodb

RUN npm ci
RUN npm run build:packages
RUN npm run build -w api-mongoose-mongodb

ENV HOST=0.0.0.0
ENV PORT=4002

EXPOSE 4002

CMD ["npm", "run", "start", "-w", "api-mongoose-mongodb"]
