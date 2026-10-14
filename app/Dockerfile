# Warefly (site estático) servido pelo nginx.
# Build a partir da raiz do repositório: o CSS importa ../design-system.
#   docker compose up -d --build

FROM node:24-alpine AS build
WORKDIR /src/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY design-system /src/design-system
COPY app ./
# app/.env traz VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (chaves públicas do front).
RUN test -f .env || (echo "Falta app/.env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY" && exit 1)
# Commit mostrado no pé do login (o .git não entra no build). Ver docker-compose.yml.
ARG WAREFLY_COMMIT=
RUN npm run build

FROM nginx:1.27-alpine
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
