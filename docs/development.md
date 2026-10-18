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

## コミット

Conventional Commits(`feat:` `fix:` `docs:` `refactor:` `test:` `ci:`)に揃える。
1コミット=1つの意図。

Issueに紐づくものは件名に`(#12)`を付け、そのIssueを完了させるコミットの本文に
`Closes #12`と書く。マージ時にIssueが自動で閉じる。

```
fix: 接続先の入力でhttp://を補完する (#12)

URLを毎回手打ちするのが面倒で、スキームを忘れると保存できなかった。
スキームが無ければhttp://を補って保存する。

Closes #12
```

## PRとマージ

**Squash and mergeで統一する。** PR 1本がmain上の1コミットになる。
例外的にブランチ内のコミットの区切りを残したいときだけ Rebase and merge を使う。

このため**PRは小さく、1目的に保つ**。大きな機能は複数のPRに分ける。
1ブランチに5コミット積むような作り方はしない(squashで区切りが消えるため)。

**PRのタイトルがそのままコミットの件名になる**(末尾にGitHubが`(#1)`を付ける)ので、
Conventional Commitsの形式で書く。本文には各コミットのメッセージが入る。

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
