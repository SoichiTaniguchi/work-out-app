# NAS用スクリプトの共通処理。deploy-nas.sh と preview-nas.sh から source する。
# 呼び出し側で DOCKER を定義しておくこと。

# Metroとnpm ciを動かすNodeのイメージ。Expo SDKが要求するNodeのバージョンに合わせる
# (SDK 58は22.13以上が必須)。.nvmrc と揃えること。
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"
# Expo GoがMetroへ繋ぎに来るアドレス(NASのTailscaleアドレス)
PACKAGER_HOSTNAME="${PACKAGER_HOSTNAME:-100.98.40.63}"

log() { echo "==> $*"; }

# コンテナに設定されている EXPO_TOKEN を読み、環境変数として export する。
# Expo Goがログイン済みだと、CLI側もログインしていないと開けない(docs/troubleshooting.md)。
# トークンはGitHubに置かず、本番のMetroコンテナに渡してあるものを引き継いで使う。
# 渡すときは docker run -e EXPO_TOKEN と名前だけ指定し、値をコマンドラインに出さない。
load_expo_token() {
  EXPO_TOKEN="$($DOCKER inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1" 2>/dev/null |
    sed -n 's/^EXPO_TOKEN=//p')" || true
  if [ -n "$EXPO_TOKEN" ]; then
    export EXPO_TOKEN
  else
    log "warning: $1 has no EXPO_TOKEN; Expo Go signed in to an account cannot open it"
    return 1
  fi
}

# 起動確認はホストのネットワークに入ったコンテナから行う。
# GitHub Actionsのself-hosted runnerはコンテナの中で動いており、そのままcurlすると
# localhost が runner 自身を指してしまってNASのポートに届かない。
wait_for() {
  local name="$1" url="$2" tries="$3"
  log "wait for $name ($url)"
  if $DOCKER run --rm --network host "$NODE_IMAGE" node -e '
    const [url, tries] = [process.argv[1], Number(process.argv[2])];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      for (let i = 0; i < tries; i += 1) {
        try {
          if ((await fetch(url)).ok) process.exit(0);
        } catch {}
        await sleep(2000);
      }
      process.exit(1);
    })();
  ' "$url" "$tries"; then
    log "$name: ok"
  else
    echo "$name did not come back: $url" >&2
    return 1
  fi
}
