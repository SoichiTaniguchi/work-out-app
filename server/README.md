# 同期用APIサーバー

NAS(Synology)上のDockerで動かす、アプリとの差分同期用APIサーバー。
Node.js + Express + SQLite。アプリ本体(リポジトリ直下)とは別のnpmパッケージで、
Expoのバンドルには含まれない。

## 動かし方(開発中・PC上)

```bash
cd server
npm install
npm run dev        # tsx watch で起動。既定は http://localhost:3000
npm test           # 同期の動作確認(インメモリDBでHTTP越しに検証)
npm run typecheck
npm run build      # dist/ に出力
```

DBファイルは既定で `server/data/work-out-app.db` に作られる(gitignore済み)。

## 動かし方(NAS上・Docker)

イメージはNAS上でビルドする(PCで作ったイメージはCPUが違う機種では動かないため)。
実績のある環境: DS423+(x86_64)、DSM 7、Container Manager の Docker Compose v2.20.1。

### 1. コードをNASに送る

NASにgitが入っていない場合は、PC側でGit管理下のファイルだけを固めて送る
(`node_modules`はWindows用のネイティブバイナリを含むので持ち込まない)。

```powershell
# PC(PowerShell)・リポジトリのルートで
git archive --format=tar -o $env:TEMP\work-out-app-server.tar HEAD server
scp -O $env:TEMP\work-out-app-server.tar <ユーザー名>@<NASのIP>:/volume1/docker/
```

`-O`が必要。OpenSSH 9以降の`scp`は内部でSFTPを使うが、DSMは既定でSFTPが無効なため
`subsystem request failed on channel 0`で失敗する。

```bash
# NAS側
cd /volume1/docker
mkdir -p work-out-app && tar -xf work-out-app-server.tar -C work-out-app
rm work-out-app-server.tar
cd work-out-app/server
```

### 2. 共有フォルダのACLに合わせてコンテナの実行ユーザーを決める(重要)

DSMの共有フォルダにはACLがかかっており、**`chown`や`chmod 777`だけでは書き込めるようにならない**。
`/volume1/docker`配下の既定のACLは次のようになっている。

```
$ synoacltool -get data
[0] group:administrators:allow:rwxpdDaARWc--   ← 書ける
[1] user:ContainerManager:allow:rwxpdDaARWc--  ← 書ける
[2] everyone::allow:r-x---a-R-c--              ← 読むだけ
```

コンテナのプロセスが`administrators`(gid 101)に属していないと`everyone`として扱われ、
読み取り専用になってSQLiteが`SQLITE_CANTOPEN: unable to open database file`で起動直後に落ちる
(`docker compose ps`では`Restarting (1)`になる)。

そこでNAS固有の設定を`docker-compose.override.yml`に書く。composeが自動で読み込むので、
リポジトリの`docker-compose.yml`は変更しない(このファイルはgit管理外)。

```bash
mkdir -p data
sudo chown -R $(id -u):$(id -g) data

cat > docker-compose.override.yml <<EOF
services:
  server:
    user: "$(id -u):$(id -g)"
    group_add:
      - "101"
EOF
```

書き込めるかは、起動前に単体で試せる。

```bash
sudo docker run --rm -u $(id -u):$(id -g) --group-add 101 \
  -v $(pwd)/data:/data work-out-app-server \
  sh -c 'touch /data/write-test && echo WRITE_OK && rm /data/write-test'
```

### 3. ビルドして起動

```bash
sudo docker compose up -d --build     # 初回は5〜10分
sudo docker compose ps                # STATUS が Up ... (healthy) になればOK
curl http://localhost:3000/health
sudo docker compose logs -f           # 落ちるときはここを見る
```

PCからも `curl.exe http://<NASのIP>:3000/health` で確認する。繋がらない場合はDSMの
ファイアウォールでLANからの3000番を許可する。

- DBファイルは `server/data/` をコンテナの `/data` にマウントして永続化する。
  NASのHyper Backupでこのフォルダを対象にしておけばバックアップになる。
- NASのIPはルーターのDHCP設定で固定しておくと、アプリ側の接続先を入れ直さずに済む。
- 外出先からはTailscaleで繋ぐ(手順はルートの`README.md`)。NASのTailscaleアドレス
  (`100.x.y.z`)を使えば自宅でも外出先でも同じアドレスになるので、アプリ側の接続先は1つで済む。
  QuickConnectはDSMと純正パッケージを中継する仕組みで、自前のコンテナのポートは対象外なので使えない。

### 更新するとき

1. の手順でtarを送り直して展開し、`sudo docker compose up -d --build`。
`docker-compose.override.yml`と`data/`はtarに含まれないので上書きされない。

### 環境変数

| 変数 | 既定値 | 内容 |
| --- | --- | --- |
| `PORT` | `3000` | 待ち受けポート |
| `DATABASE_PATH` | `./data/work-out-app.db` | SQLiteのファイルパス |
| `SYNC_TOKEN` | (未設定) | 設定すると全APIで `Authorization: Bearer <値>` が必須になる |

`SYNC_TOKEN`は未設定なら認証なし。LAN/VPN内からしか繋がらない前提のMVP仕様
(仕様書「認証はユーザー選択のみ」)に合わせた既定値で、インターネットに直接公開する場合は設定する。

## API

### `POST /sync`

差分同期。ローカルの変更を送り、前回以降のサーバー側の変更を受け取る。

```jsonc
// リクエスト
{
  "userId": "u1",
  "since": 12,          // 前回のレスポンスのcursor。初回はnull(全件受け取る)
  "changes": {
    "users": [{ "id": "u1", "name": "そーいち", "updatedAt": "...", "deletedAt": null }],
    "exercises": [{ "id": "ex1", "userId": "u1", "name": "ベンチプレス",
                    "bodyParts": ["胸"], "equipment": "バーベル",
                    "fieldDefinition": ["weight", "reps"],
                    "updatedAt": "...", "deletedAt": null }],
    "folders": [{ "id": "fd1", "userId": "u1", "name": "胸の日", "order": 0,
                  "exerciseIds": ["ex1"], "updatedAt": "...", "deletedAt": null }],
    "workoutLogs": [{ "id": "wl1", "exerciseId": "ex1", "date": "...", "completed": true,
                      "sets": [{ "weight": 60, "reps": 10 }],
                      "updatedAt": "...", "deletedAt": null }],
    "personalRecords": [{ "id": "pr1", "exerciseId": "ex1", "type": "maxWeight",
                          "value": 60, "achievedAt": "...",
                          "updatedAt": "...", "deletedAt": null }]
  }
}

// レスポンス
{ "cursor": 13, "changes": { /* 同じ形 */ } }
```

| 状況 | ステータス |
| --- | --- |
| 正常 | 200 |
| リクエストの形が違う | 400(どの項目かをメッセージで返す) |
| 他ユーザーのデータ・存在しない種目を参照 | 409 |
| `SYNC_TOKEN`設定時にトークン不一致 | 401 |

### `GET /users`

ログイン(ユーザー選択)画面用。論理削除済みを除いたユーザー一覧を返す。

### `GET /health`

起動確認用。`{"status":"ok"}`を返す。認証は不要。

## 同期の仕組み

| 仕組み | 内容 |
| --- | --- |
| 衝突解決 | Last Write Wins。`updated_at`(端末が書いた時刻)が新しい方を採用し、**同時刻ならサーバー側**を残す |
| 取得位置 | `server_seq`(サーバー内部の連番)。端末の時計がずれていても取りこぼさない。`cursor`として返す |
| 負けた変更 | 採用しなかった行はサーバー側の値をレスポンスに必ず含め、端末の古い値を上書きさせる |
| 削除 | 物理削除せず`deletedAt`を伝える。削除済みの行も同期で返す |
| 子テーブル | `folder_exercises`と`set_logs`はidを持たないので、親に`exerciseIds` / `sets`として埋め込み、丸ごと入れ替える |
| ユーザー一覧 | 家族で共有するため、`userId`で絞らず全員分をやり取りする |

### 自己ベストの扱い

アプリは自己ベストを更新するたびに新しいidで作り直す(`INSERT OR REPLACE`)。
そのため同じ(種目, 種別)に別idの行が送られてくることがあり、サーバーは
`UNIQUE(exercise_id, type)`と同じ粒度でも既存行を探して置き換える。
アプリ側も受信時は`INSERT OR REPLACE`で適用すること。

## 構成

```
server/
  src/
    index.ts        起動(listen・シグナル処理)
    app.ts          Expressアプリの組み立て(テストから直接起動できるようlistenしない)
    config.ts       環境変数
    db/
      open.ts       SQLiteを開く
      schema.ts     テーブル定義(アプリ側と同じ + server_seq)
    routes/
      sync.ts       POST /sync
      users.ts      GET /users
    sync/
      types.ts      リクエスト・レスポンスの型
      validate.ts   JSONの検証
      service.ts    差分の適用(Last Write Wins)と取得
  test/             node:test による動作確認
```
