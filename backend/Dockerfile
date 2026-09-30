FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

RUN mkdir -p /data

EXPOSE 3001

# Aplica migrations versionadas (idempotente, sem apagar dados) e sobe o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
