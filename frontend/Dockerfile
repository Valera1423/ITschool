# ============================================================
# Frontend — multi-stage build
# ============================================================
# Stage 1: Vite build
# Stage 2: nginx:alpine — отдача статики
# ============================================================

# ---------- Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Все VITE_* переменные — build args. Их значения попадают в бандл.
ARG VITE_API_URL
ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_REDIRECT_URI
ARG VITE_OIDC_POST_LOGOUT_REDIRECT_URI
ARG VITE_OIDC_SCOPE
ARG VITE_MINIO_PUBLIC_URL
ARG VITE_VAPID_PUBLIC_KEY

ENV VITE_API_URL=$VITE_API_URL \
    VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY \
    VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID \
    VITE_OIDC_REDIRECT_URI=$VITE_OIDC_REDIRECT_URI \
    VITE_OIDC_POST_LOGOUT_REDIRECT_URI=$VITE_OIDC_POST_LOGOUT_REDIRECT_URI \
    VITE_OIDC_SCOPE=$VITE_OIDC_SCOPE \
    VITE_MINIO_PUBLIC_URL=$VITE_MINIO_PUBLIC_URL \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Runtime ----------
FROM nginx:1.27-alpine AS runtime

# Убираем дефолтный конфиг и ставим свой
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/frontend.conf /etc/nginx/conf.d/default.conf

# Статика из билдера
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA-fallback + healthcheck уже в frontend.conf
# Healthcheck через busybox wget (есть в alpine из коробки).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]