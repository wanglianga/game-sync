FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY --from=builder /app/dist ./dist
COPY api ./api
COPY shared ./shared
COPY migrations ./migrations
COPY public ./public
COPY index.html ./index.html
COPY vite.config.ts ./vite.config.ts
COPY tsconfig.json ./tsconfig.json
COPY tailwind.config.js ./tailwind.config.js
COPY postcss.config.js ./postcss.config.js

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npx", "tsx", "api/server.ts"]
