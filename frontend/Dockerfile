# Multi-stage: compila o frontend DENTRO da imagem (garante que o deploy sempre
# reflete o código atual — impossível subir um dist/ desatualizado).
#
# Usa Debian (bookworm), NÃO Alpine: o vite-plugin-pwa tem um bug conhecido no
# hook buildEnd rodando em Alpine/musl sem cache de transform do Vite.
FROM node:20-bookworm AS build
WORKDIR /app

# Instala dependências primeiro (camada cacheável)
COPY package*.json ./
RUN npm ci

# Copia o restante e builda
COPY . .
# API URL e commit são injetados pelo docker-compose (build args)
ARG VITE_API_URL=/api
ARG APP_COMMIT=""
ENV VITE_API_URL=$VITE_API_URL
ENV APP_COMMIT=$APP_COMMIT
RUN npm run build

# ── Runtime: nginx servindo os estáticos ──────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html/taskflow
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
