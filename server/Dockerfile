# better-sqlite3 はネイティブモジュール。alpine(musl)だとビルド済みバイナリが無く
# コンパイルが必要になるため、glibcのslimイメージを使う。
FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/work-out-app.db

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# DBファイルはボリュームに置き、コンテナを作り直しても残るようにする
RUN mkdir -p /data && chown -R node:node /data
VOLUME /data

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
