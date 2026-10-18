#!/usr/bin/env bash
# NAS上のアプリ(Metro)と同期サーバーを、このリポジトリの内容に更新する。
#
# GitHub Actions の self-hosted runner から呼ばれるが、NAS上で直接実行してもよい:
#   sudo bash scripts/deploy-nas.sh /path/to/checkout
#
# 更新しないもの(NAS固有・実データのため):
#   server/data/                        同期サーバーのDB
#   server/docker-compose.override.yml  このNAS用の実行ユーザー設定
#   node_modules/ , .container-home/    依存パッケージとキャッシュ
set -euo pipefail

SOURCE_DIR="${1:-$(pwd)}"
DEPLOY_DIR="${DEPLOY_DIR:-/volume1/docker/work-out-app}"
DOCKER="${DOCKER:-docker}"
METRO_CONTAINER="${METRO_CONTAINER:-workout-metro}"
NODE_IMAGE="${NODE_IMAGE:-node:20-bookworm-slim}"
# コンテナを動かすユーザー。NASの共有フォルダのACLに合わせる(README参照)。
RUN_UID="${RUN_UID:-1026}"
RUN_GID="${RUN_GID:-100}"
ADMIN_GID="${ADMIN_GID:-101}"

log() { echo "==> $*"; }

[ -d "$SOURCE_DIR" ] || { echo "source not found: $SOURCE_DIR" >&2; exit 1; }
[ -d "$DEPLOY_DIR" ] || { echo "deploy dir not found: $DEPLOY_DIR" >&2; exit 1; }

log "copy $SOURCE_DIR -> $DEPLOY_DIR"
# 消えたファイルは残るが、実データを巻き込む危険を避けて --delete はしない
tar -C "$SOURCE_DIR" \
  --exclude=.git \
  --exclude=node_modules \
  --exclude=.container-home \
  --exclude=server/data \
  --exclude=server/docker-compose.override.yml \
  -cf - . | tar -C "$DEPLOY_DIR" -xf -

cd "$DEPLOY_DIR"

# 依存パッケージはロックファイルが変わったときだけ入れ直す(NASでは3分ほどかかる)。
# サーバー側はイメージのビルド中に npm ci するので、ここではアプリだけ見る。
LOCK_STAMP="$DEPLOY_DIR/.deployed-app-lock.json"
if cmp -s package-lock.json "$LOCK_STAMP"; then
  log "package-lock.json unchanged, skipping npm ci"
else
  log "package-lock.json changed, running npm ci"
  $DOCKER run --rm \
    -v "$DEPLOY_DIR":/app -w /app \
    -u "$RUN_UID:$RUN_GID" --group-add "$ADMIN_GID" \
    -e HOME=/app/.container-home \
    "$NODE_IMAGE" npm ci
  cp package-lock.json "$LOCK_STAMP"
fi

log "restart Metro"
$DOCKER restart "$METRO_CONTAINER"

log "rebuild sync server"
# レイヤキャッシュが効くので、server/ に変更が無ければすぐ終わる
(cd "$DEPLOY_DIR/server" && $DOCKER compose up -d --build)

log "done"
