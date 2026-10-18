# 開発の進め方

使っていて気づいたことをIssueに溜めて、ある程度たまったらまとめて直す。

アプリの使い方・セットアップは[README](../README.md)、仕様は[spec.md](spec.md)、
詰まったときは[troubleshooting.md](troubleshooting.md)を参照。

## 流れ

```
Issueを立てる → ブランチを切る → 実装 → PR → CI → Squash and merge → NASへ自動デプロイ
```

1. **気づいたらIssueを立てる** — スマホのGitHubアプリからでよい。1〜2行で十分
2. **着手するときにブランチを切る** — `feature/<内容>` または `fix/<内容>`
3. **Pull Requestを出す** — mainへ直接pushしない
4. **CIが自動で走る** — アプリの型チェックと、サーバーのテスト
5. **Squash and mergeする** — マージするとNASへ自動デプロイされる

## Issue

テンプレートは`.github/ISSUE_TEMPLATE/`にある。スマホから書く前提で短くしてあるので、
思いついたことをそのまま書けばよい。

| ラベル | 用途 |
| --- | --- |
| `改善` | 使い勝手をよくする |
| `不具合` | 期待どおりに動かない |
| `デザイン` | 見た目・文字サイズ・配色 |
| `同期` | NAS同期・サーバー連携 |
| `サーバー` | `server/`配下 |
| `保留` | 今はやらない |

やることはIssueだけで管理する。READMEや仕様書に「次にやること」を書かない
(二重管理になり、片方が必ず古くなるため)。

## Claudeに任せる(@claude)

Issueの本文・タイトル・コメント、またはPRのレビューコメントに`@claude`と書くと、
GitHub上でClaude(`.github/workflows/claude.yml`)が動く。

- **Issueで頼む** — 例: 「@claude この改善を実装して」。Claudeがブランチを切って実装・pushし、
  PRを作るためのリンクをIssueにコメントする。リンクからPRを作るとCIが走る
- **PRで頼む** — レビューコメントに「@claude ここを直して」と書くと、そのPRのブランチに修正をpushする
- 反応するのはリポジトリのオーナー・共同編集者の書き込みだけ
- GitHub上のClaudeはNASやiPhoneには触れない。実機での確認は手元で行う
- PRのマージは今までどおり自分で行う(mainのルールでPR・CIが必須になっている)

### 初回のセットアップ

1. リポジトリに[Claude GitHub App](https://github.com/apps/claude)をインストールする
2. 手元のターミナルで`claude setup-token`を実行し、表示されたトークンをリポジトリの
   Settings → Secrets and variables → Actions に`CLAUDE_CODE_OAUTH_TOKEN`という名前で登録する

(Claude Codeの`/install-github-app`コマンドでも1と2をまとめて設定できる。その場合は
ワークフローのPRも作られるが、`claude.yml`は既にあるので閉じてよい)

## コミット規約

```
<type>(<scope>): <subject> (#issue番号)
```

```
fix(sync): complete the scheme when the server URL has none (#12)

URLを毎回手打ちするのが面倒で、http:// を忘れると保存できなかった。
スキームが無ければ http:// を補って保存する。

Closes #12
```

**件名は英語、本文は日本語。** 件名はConventional Commitsの慣習に合わせ、
「なぜそうしたか」は本文に日本語で書く。

### type

| type | 使うとき |
| --- | --- |
| `feat` | 機能の追加 |
| `fix` | 不具合の修正 |
| `refactor` | 挙動を変えない内部の整理 |
| `perf` | 速度・メモリの改善 |
| `test` | テストの追加・修正 |
| `docs` | ドキュメントだけの変更 |
| `ci` | ワークフロー・デプロイ・ビルド設定 |
| `chore` | 依存パッケージの更新など、上記に当てはまらない雑務 |
| `style` | 整形のみ(挙動もロジックも変えない) |

### scope

変更した場所を示す。プロジェクト全体にまたがるときは省略する。

| scope | 範囲 |
| --- | --- |
| `app` | 画面・UI(`src/screens`、`src/components`) |
| `db` | ローカルDB(`src/db`) |
| `sync` | 同期処理(`src/sync`) |
| `server` | 同期サーバー(`server/`) |
| `deps` | 依存パッケージ |

### subject

- 動詞の原形で始める(`add` / `fix` / `remove` / `move` / `rename`)
- 現在形。文末にピリオドを付けない
- 50文字以内を目安

### 粒度

**1コミット = 1つの意図。** 10ファイル・500行を超えるときは分割を検討する。
分けきれない場合は `refactor(db): migrate to soft delete (part 1/3) (#15)` のように
part を添えて理由が追えるようにする。

### Issue番号

ブランチ内の各コミットには件名の末尾に`(#12)`を付ける。
そのIssueを完了させるコミットの本文に`Closes #12`と書くとマージ時に自動で閉じる。

**PRのタイトルには番号を付けない。** Squashすると GitHub が`(#PR番号)`を自動で足すため、
書くと`(#12) (#1)`と二重になる。Issueとの紐づけはPR本文の`Closes #12`で行う。

## PRとマージ

**Squash and mergeで統一する。** PR 1本がmain上の1コミットになる。
例外的にブランチ内のコミットの区切りを残したいときだけ Rebase and merge を使う。

このため**PRは小さく、1目的に保つ**。大きな機能は複数のPRに分ける。
1ブランチに5コミット積むような作り方はしない(squashで区切りが消えるため)。

**PRのタイトルがそのままコミットの件名になる**(末尾にGitHubが`(#1)`を付ける)ので、
コミット規約と同じ形式(`<type>(<scope>): <subject>`、英語)で書く。番号は付けない。
コミットの本文は各コミットのメッセージがそのまま入る。

## CI

`.github/workflows/ci.yml`。PRとmainへのpushで動く。

| ジョブ | 内容 |
| --- | --- |
| アプリ | `npx tsc --noEmit` |
| サーバー | `npm run typecheck` と `npm test` |

手元で同じものを流すには:

```bash
npx tsc --noEmit
cd server && npm run typecheck && npm test
```

## NASへの自動デプロイ

mainが更新されると、NAS上のアプリとサーバーが自動で入れ替わる。
アプリはExpo Goが起動のたびにMetroからコードを取りに行くので、
**次にアプリを開いた時点で新しくなる**。

```
PRをマージ
  → CI(GitHubのランナー): 型チェック・テスト
  → 成功したら Deploy to NAS(NAS上のself-hosted runner)
      1. scripts/deploy-nas.sh がコードを /volume1/docker/work-out-app に配置
      2. package-lock.json が変わっていれば npm ci
      3. Metroコンテナを再起動
      4. 同期サーバーを docker compose up -d --build
      5. /health と /status で起動を確認
```

**CIが失敗した場合はデプロイしない**(`workflow_run`でCIの結果を待っている)。
GitHub Actionsのランナーはクラウド上にありNASへ到達できないため、デプロイだけは
NAS上のself-hosted runnerで動かしている。NASのポートを開ける必要はない
(ランナーがGitHubへ外向きに接続する)。

手元で直接動かすこともできる:

```bash
sudo bash scripts/deploy-nas.sh /path/to/checkout
```

更新しないもの(NAS固有・実データのため):

- `server/data/` — 同期サーバーのDB
- `server/docker-compose.override.yml` — このNAS用の実行ユーザー設定
- `node_modules/`、`.container-home/`

## NAS上のMetroの構築・更新

アプリはNASのDockerで動くMetroから配信している(背景と選択の経緯は「アプリとして配布する」)。
**mainにマージすれば自動で更新される**ので、通常は以下の手動手順は不要。
NASを作り直すときや、自動デプロイが動かないときに使う。

```powershell
# 1. PC: Git管理下のファイルだけを固めて転送
cd C:\Users\astro\Develop\work-out-app
git archive --format=tar -o $env:TEMP\work-out-app-full.tar HEAD
scp -O $env:TEMP\work-out-app-full.tar <ユーザー名>@192.168.0.20:/volume1/docker/
```

```bash
# 2. NAS: 展開
cd /volume1/docker
tar -xf work-out-app-full.tar -C work-out-app && rm work-out-app-full.tar
cd work-out-app

# 3. 依存パッケージ(package-lock.jsonが変わったときだけ。10分ほどかかる)
sudo docker run --rm -v "$(pwd)":/app -w /app \
  -u $(id -u):$(id -g) --group-add 101 \
  -e HOME=/app/.container-home \
  node:20-bookworm-slim npm ci

# 4. Metroを常駐させる
sudo docker rm -f workout-metro 2>/dev/null
sudo docker run -dit --name workout-metro --network host --restart unless-stopped \
  -v "$(pwd)":/app -w /app \
  -u $(id -u):$(id -g) --group-add 101 \
  -e HOME=/tmp \
  -e CI=1 \
  -e REACT_NATIVE_PACKAGER_HOSTNAME=100.98.40.63 \
  node:20-bookworm-slim npx expo start --go --max-workers 1

sudo docker logs -f workout-metro    # Waiting on http://localhost:8081 が出れば成功
```

### 引数と環境変数の理由

| 指定 | 理由 |
| --- | --- |
| `--network host` | Tailscaleのインターフェース(`100.x.y.z`)でも8081番を受けるため |
| `REACT_NATIVE_PACKAGER_HOSTNAME` | これが無いとExpo GoがNASのLAN側アドレスを見に行き、外出先から繋がらない |
| `CI=1` | 付けないとExpo CLIが「ログインしますか」の対話プロンプトを出し、バックグラウンドのコンテナでは延々ループする。代償としてwatchが無効になる |
| `HOME=/tmp` | `~/.expo`への書き込みがNAS共有フォルダのACLと相性が悪く、renameがENOENTで失敗する。コンテナ内部に逃がす |
| `--group-add 101` | DSMのACL対策(`../server/README.md`と同じ理由) |
| `--max-workers 1` | NASのメモリが1.7GBしかないため。既定ではコア数(4)だけワーカーが立ち、メモリ不足になる |

詰まったときは[troubleshooting.md](troubleshooting.md)を参照。

### 実測値(DS423+ / メモリ1.7GB / 4コア)

| 処理 | 時間 |
| --- | --- |
| `npm ci` | 3分 |
| 初回バンドル(1605モジュール) | 62秒 |

メモリは`--max-workers 1`で足りているが余裕は少ない。増やすならDS423+はSO-DIMMを1枚足して
最大6GBにできる。

## アプリとして配布する

Expo Goから卒業して「普通のアプリ」にする場合の選択肢。2026年10月時点の整理。

| | NASでMetro(現在) | Web(PWA) | Macでビルド | Apple Developer Program |
| --- | --- | --- | --- | --- |
| 費用 | 0 | 0 | 0 | 年$99 |
| ホーム画面アイコン | ✗ | ○ | ○ | ○ |
| レスタイマーの通知 | ○ | ✗ | ○ | ○ |
| 有効期限 | なし | なし | 7日ごとに再インストール | 1年(更新可) |
| 家族の端末へ配布 | ○ | ○ | △(各端末をMacに繋ぐ) | ○(TestFlight) |
| Dynamic Island | ✗ | ✗ | △ | ○ |

- **Expo Go + EAS Updateは不可。** EAS Updateはdevelopment build以降が対象で、Expo Goは開発サーバーが必須
- **AltStore等のサイドロードも、署名済み`.ipa`が要るためWindowsだけでは不可**
- Macがあれば無料のApple ID(Free Provisioning)で実機インストールできるが、証明書が7日で切れる
- 週1回の再インストールが煩わしくなったときがApple Developer Programを検討するタイミング

### Dev Client / EAS Build(Apple Developer Program登録後に使う手順)

Apple Developer Programに登録し、実機に本格インストールしてDynamic Island機能まで
含めて確認したくなったら以下に進む(現時点では未実施)。

```bash
# eas-cliをグローバルインストール(毎回 npx eas-cli@latest と打たなくて済む)
npm install -g eas-cli

# EASにログイン(要Expoアカウント)
eas login

# EASプロジェクトとの連携(完了済み。app.json の extra.eas.projectId で紐付いている)
eas init --id 4fbcf2c0-4451-4880-b965-df90130f6020

# iOS向けのビルド設定を生成(初回のみ、"iOS" を選択)
eas build:configure

# 開発用Dev Clientをクラウドビルド(iOS、要Apple Developer Programアカウント)
eas build --profile development --platform ios
```

ビルドが終わるとインストール用リンク(またはTestFlight)が発行されるので、
実機にインストール後、`npx expo start --dev-client`で接続する。

このとき、NASへHTTPで繋ぐために`app.json`へ`NSLocalNetworkUsageDescription`と
ATS(App Transport Security)の設定を足す必要がある。Expo GoはMetroとの通信で既に
ローカルネットワークの許可を取っているため今は不要だが、自前のアプリにすると必要になる。

## 現状の実装状況

- [x] GitHubリポジトリ作成・SSH認証設定
- [x] Node.jsバージョンの統一(v20系)
- [x] Expo/EASプロジェクトの作成・連携(`eas init`完了)
- [x] iOS向け`eas build:configure`実施(EAS Build自体はApple Developer Program未登録のため保留中)
- [ ] Dev Clientのクラウドビルド — Apple Developer Program登録後に実施
- [x] Expo Goでの開発・確認フローに切り替え
- [x] 画面遷移・レイアウトはワイヤーフレーム通りに配置
- [x] `expo-sqlite`によるローカルDB(users / folders / exercises / folder_exercises /
      workout_logs / set_logs / personal_records)
- [x] 種目管理(種目のCRUD、記録項目のカスタマイズ、ドラッグ並び替え、
      フォルダ/プログラム分け、フォルダのテンプレート化)
- [x] 部位別のプリセット種目(9部位・61種目)から選んで追加。部位はピル選択式で、
      ユーザー独自の部位(例: 腕を二頭/三頭に分ける)も追加できる
- [x] トレーニング記録画面(記録項目に応じた動的入力、前回値の自動表示・差分入力、
      レスタイマー+ローカル通知、保存時の自己ベスト判定)
- [x] 履歴・グラフ画面(SVG折れ線グラフ、種目の記録項目に応じた指標切り替え、自己ベスト表示)
- [x] ホーム画面(プログラム一覧、今週の記録、直近の自己ベスト)
- [x] 認証(ユーザー選択のみ・パスワードなし)— ユーザーの追加・リネーム・削除に対応
- [x] 設定画面(ユーザー名の変更、ユーザー切り替え、バージョン情報)
- [x] 完了サマリー画面(その日の種目数・セット数・負荷量・更新した自己ベスト・種目別の記録)
- [x] NAS同期の土台(全テーブルの`updated_at`・論理削除`deleted_at`、削除の伝播と読み出しフィルタ)
- [x] NAS上の同期用APIサーバー(`server/`。Express + SQLite、`POST /sync`で
      Last Write Winsの差分同期、Docker対応)
- [x] アプリ側の同期処理(起動時・記録終了時・手動。オフライン時は次の機会にやり直す)
- [x] 設定画面のNAS接続設定(接続先の変更・今すぐ同期・最終同期日時)
- [x] NAS上のMetroによる、PCなしでの利用(Tailscale経由で外出先からも)
- [x] GitHub Issue運用・CI・mainマージ時のNASへの自動デプロイ
- [ ] `src/native/RestTimerActivity.ts` はJS側インターフェースのみ。実際に
      Dynamic Islandへ表示するには、Swiftで書いたLive Activities(ActivityKit)の
      ネイティブモジュールを別途実装し、Expo Config Pluginまたは`expo prebuild`で
      生成されるiOSプロジェクトに組み込む必要がある
- [ ] デザイン調整(文字サイズなど)

## Git / GitHub

- リポジトリは `work-out-app` という名前でGitHubに登録済み(public)
- SSH鍵を`ed25519`で作成し、GitHubに登録して認証(`ssh -T git@github.com`で確認可能)
- `.gitignore`で`node_modules/`・`.expo/`・`ios/`・`android/`などを除外済み
- `gh`(GitHub CLI)を使うとIssueとPRの操作ができる(`winget install GitHub.cli`)

## ドキュメントの置き場所

迷ったときの判断基準。**同じことを2箇所に書かない。**

| ファイル | 読む人 | 内容 |
| --- | --- | --- |
| `README.md` | 使う人 | 概要、セットアップ、起動方法、NAS接続先の設定 |
| `docs/development.md` | 開発する人 | この文書。開発の流れ、CI、デプロイ |
| `docs/spec.md` | 開発する人 | 仕様。実装が仕様と食い違うときは必ず確認してから進める |
| `docs/troubleshooting.md` | 詰まった人 | 原因と対処をセットで残す |
| `server/README.md` | サーバーを触る人 | サーバーの構築手順・API・同期の仕組み |
| `CLAUDE.md` | Claude Code | このプロジェクトでの約束事 |
