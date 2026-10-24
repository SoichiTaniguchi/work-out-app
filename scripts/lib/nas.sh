# NAS用スクリプトの共通処理。deploy-nas.sh と preview-nas.sh から source する。
# 呼び出し側で DOCKER と NODE_IMAGE を定義しておくこと。

log() { echo "==> $*"; }

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
