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

```bash
cd server
docker compose up -d --build
docker compose logs -f
```

- DBファイルは `server/data/` をコンテナの `/data` にマウントして永続化する。
  NASのHyper Backupでこのフォルダを対象にしておけばバックアップになる。
- コンテナは`node`ユーザー(uid 1000)で動くため、マウント先のフォルダに書き込めないときは
  NAS側で `chown -R 1000:1000 data` するか、`docker-compose.yml` に `user:` を足す。
- 外出先からはSynology VPN Serverで自宅LANに入ってから同じアドレスにアクセスする
  (アプリ側の接続先を切り替えない)。

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
