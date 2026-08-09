FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

RUN mkdir -p /data

EXPOSE 3001

# Roda as migrations e sobe o servidor
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
