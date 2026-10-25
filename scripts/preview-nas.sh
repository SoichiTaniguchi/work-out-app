#!/usr/bin/env bash
# PRのブランチをNAS上の2つ目のMetro(8082番)から配信し、マージ前にExpo Goで試せるようにする。
# 同時に配信できるのは1本だけ。.github/workflows/preview.yml から呼ばれる。
#
#   bash scripts/preview-nas.sh start <PR番号> <checkout>   配信する(配信中の別のPRは止める)
#   bash scripts/preview-nas.sh update <PR番号> <checkout>  そのPRを配信中のときだけ入れ替える
#   bash scripts/preview-nas.sh stop [PR番号]               止める。PR番号を渡すとそのPRのときだけ
#
# コードはDockerのボリュームに置き、本番の配置先(/volume1/docker/work-out-app)には触れない。
# package-lock.json が本番と同じなら、本番の node_modules を読み取り専用で使い回す。
set -euo pipefail

ACTION="${1:-}"
PR="${2:-}"
SOURCE_DIR="${3:-}"
DOCKER="${DOCKER:-docker}"
MAIN_DIR="${MAIN_DIR:-/volume1/docker/work-out-app}"
CONTAINER="${PREVIEW_CONTAINER:-workout-metro-preview}"
MAIN_CONTAINER="${METRO_CONTAINER:-workout-metro}"
VOLUME="${PREVIEW_VOLUME:-workout-metro-preview}"
PORT="${PREVIEW_PORT:-8082}"
# NASのメモリは1.7GBしかない。プレビューが膨らんでも本番のMetroと同期サーバーを
# 巻き込まないよう、上限を付けて先にプレビューだけが落ちるようにする。
MEMORY="${PREVIEW_MEMORY:-768m}"
PR_LABEL="work-out-app.pr"

# shellcheck source=lib/nas.sh
source "$(dirname "$0")/lib/nas.sh"

# workflowの後続ジョブに結果を渡す(NAS上で直接実行したときは何もしない)
result() {
  log "result: $1"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "result=$1" >>"$GITHUB_OUTPUT"; fi
}

current_pr() {
  $DOCKER inspect -f "{{ index .Config.Labels \"$PR_LABEL\" }}" "$CONTAINER" 2>/dev/null || true
}

remove_container() {
  $DOCKER rm -f "$CONTAINER" >/dev/null 2>&1 || true
}

start() {
  [ -n "$PR" ] || { echo "PR number is required" >&2; exit 1; }
  [ -d "$SOURCE_DIR" ] || { echo "source not found: $SOURCE_DIR" >&2; exit 1; }

  log "stop current preview (PR $(current_pr))"
  remove_container

  # node_modules はボリュームに残し、2回目以降の npm ci を省けるようにする。
  # server/ はアプリのバンドルに含まれないので配らない。
  log "copy $SOURCE_DIR -> volume $VOLUME"
  tar -C "$SOURCE_DIR" \
    --exclude=.git \
    --exclude=node_modules \
    --exclude=server \
    -cf - . |
    $DOCKER run --rm -i -v "$VOLUME":/app "$NODE_IMAGE" sh -c '
      find /app -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} + &&
      tar -C /app -xf - --no-same-owner'

  # Expo Goの一覧で本番と見分けられるよう表示名にPR番号を付け、アプリにプレビューだと知らせる
  # (src/preview.ts がこれを見てデータベースを分け、同期を止める)。
  log "mark app.json as preview of PR $PR"
  $DOCKER run --rm -v "$VOLUME":/app -e PR="$PR" "$NODE_IMAGE" node -e '
    const fs = require("fs");
    const file = "/app/app.json";
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    config.expo.name = `${config.expo.name} (PR #${process.env.PR})`;
    config.expo.extra = { ...config.expo.extra, previewPr: Number(process.env.PR) };
    fs.writeFileSync(file, JSON.stringify(config, null, 2));
  '

  # src/preview.ts が無い古いブランチは、印を付けても本番とデータを共有してしまう
  local started=started
  if ! grep -qs previewPr "$SOURCE_DIR/src/preview.ts"; then
    log "warning: this branch predates src/preview.ts; it shares data with production"
    started=started-shared
  fi

  local modules_mount=()
  if cmp -s "$SOURCE_DIR/package-lock.json" "$MAIN_DIR/.deployed-app-lock.json"; then
    log "package-lock.json same as main, reusing its node_modules (read-only)"
    modules_mount=(-v "$MAIN_DIR/node_modules":/app/node_modules:ro)
  else
    log "package-lock.json differs from main, running npm ci if needed"
    $DOCKER run --rm -v "$VOLUME":/app -w /app -e HOME=/tmp "$NODE_IMAGE" sh -c '
      if cmp -s package-lock.json node_modules/.preview-lock.json; then
        echo "node_modules already matches, skipping npm ci"
      else
        npm ci && cp package-lock.json node_modules/.preview-lock.json
      fi'
  fi

  local token_env=()
  if load_expo_token "$MAIN_CONTAINER"; then token_env=(-e EXPO_TOKEN); fi

  # 引数と環境変数は本番のMetroに揃えている(理由は docs/development.md)
  log "start Metro for PR $PR on port $PORT"
  $DOCKER run -dit --name "$CONTAINER" --network host \
    --label "$PR_LABEL=$PR" \
    --memory "$MEMORY" \
    -v "$VOLUME":/app "${modules_mount[@]}" -w /app \
    -e HOME=/tmp \
    -e CI=1 \
    -e REACT_NATIVE_PACKAGER_HOSTNAME="$PACKAGER_HOSTNAME" \
    "${token_env[@]}" \
    "$NODE_IMAGE" npx expo start --go --port "$PORT" --max-workers 1 >/dev/null

  wait_for "preview metro" "http://localhost:$PORT/status" 60
  result "$started"
}

case "$ACTION" in
  start)
    start
    ;;
  update)
    if [ "$(current_pr)" = "$PR" ]; then
      start
    else
      log "PR $PR is not being previewed, nothing to do"
      result skipped
    fi
    ;;
  stop)
    if [ -n "$PR" ] && [ "$(current_pr)" != "$PR" ]; then
      log "PR $PR is not being previewed, nothing to do"
      result skipped
    else
      log "stop preview (PR $(current_pr))"
      remove_container
      result stopped
    fi
    ;;
  *)
    echo "usage: $0 start|update <PR> <checkout> | stop [PR]" >&2
    exit 1
    ;;
esac
