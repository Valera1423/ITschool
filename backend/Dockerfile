# ============================================================
# CRM Backend — production образ.
#
# Puppeteer требует Chromium + набор библиотек. В alpine их нет,
# поэтому ставим явно. PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true —
# чтобы puppeteer не качал свой Chrome (150 МБ).
# ============================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Chromium + зависимости нужны и на этапе сборки (prisma generate)
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      freetype-dev \
      harfbuzz \
      ca-certificates \
      ttf-dejavu \
      ttf-freefont \
      font-noto-emoji \
    && rm -rf /var/cache/apk/*

# Сообщаем puppeteer использовать системный Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ============================================================
# Production
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Chromium + все либы
RUN apk add --no-cache \
      openssl \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      tini

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Непривилегированный пользователь
RUN addgroup -S crm && adduser -S crm -G crm

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev && \
    npx prisma generate && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma 2>/dev/null || true
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh && \
    chown -R crm:crm /app

USER crm

EXPOSE 4000

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/index.js"]