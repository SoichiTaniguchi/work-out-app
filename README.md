# 筋トレ記録アプリ (work-out-app)

「筋トレ記録アプリ 仕様書」に基づく React Native (Expo) プロジェクトの初期スケルトンです。

## 動作環境

- **Expo SDK: 57系** (2026年9月にSDK 51から移行済み。詳細は下記「SDK 51→57 移行」を参照)
- **Node.js: v20系(LTS)を使用してください。** SDK 57のツールチェーンでもNode 20系で動作確認済みです。Node 22/24系では`expo config`コマンドなどが原因不明のまま(エラーメッセージ無しで)クラッシュすることがあります。
  - Windows環境では[nvm-windows](https://github.com/coreybutler/nvm-windows/releases)を使ってバージョン管理することを推奨します。
    ```bash
    nvm install 20
    nvm use 20
    ```
  - PCに `C:\Program Files\nodejs` など、nvmとは別に単独インストールされたNode.jsが残っていると、PATHの優先順位次第でそちらが使われてしまうことがあります(`where node`で確認)。単独インストール版は事前にアンインストールしておいてください。
  - このリポジトリには`.nvmrc`を置いてあるので、フォルダ内で`nvm use`と打つだけで自動的に20系に切り替わります。

## セットアップ

### 開発方針: 当面はExpo Go(無料)で進める

iOS実機での継続的なテストには本来 **Dev Client** (`expo-dev-client`) + **EAS Build** の
クラウドビルドが必要ですが、これにはApple Developer Program(年間$99)への登録が必須です。
Dynamic Island機能(ネイティブモジュールが必要)が絡まない開発・確認は、当面 **Expo Go**
(無料・App Storeからインストール)で進める方針とします。

```bash
# Node.jsのバージョンを合わせる
nvm use 20

# 依存パッケージのインストール
npm install

# Metroサーバーを起動(Expo Go向け)
npx expo start
```

ターミナルに表示されるQRコードを、iPhoneにインストールした**Expo Go**アプリのカメラで
読み取れば、画面遷移やUIを実機で確認できます(同じWi-Fiに接続していること)。

> **注意:** このプロジェクトは依存パッケージに`expo-dev-client`を含んでいるため、
> `npx expo start`だけだと自動的に「Dev Client向け」の接続モードになり、
> `exp+work-out-app://...`のようなExpo Goが認識できない専用スキームのQRコードが
> 表示されてしまうことがあります。その場合は明示的にExpo Go向けモードで起動してください。
>
> ```bash
> npx expo start --go
> ```
>
> こうすると通常の`exp://192.168.x.x:8081`形式のURL・QRコードになり、Expo Goで読み取れます。

Dynamic Island機能(`src/native/RestTimerActivity.ts`)はExpo Go上ではネイティブモジュールが
存在しないため何も起きず、コンソールに警告が出るだけで安全に動作します(アプリはクラッシュしません)。

### Dev Client / EAS Build(Apple Developer Program登録後、将来使う手順)

Apple Developer Programに登録し、実機に本格インストールしてDynamic Island機能まで
含めて確認したくなったら、以下の手順に進みます(現時点では未実施)。

```bash
# eas-cliをグローバルインストール(毎回 npx eas-cli@latest と打たなくて済む)
npm install -g eas-cli

# EASにログイン(要Expoアカウント)
eas login

# EASプロジェクトとの連携(完了済み。app.json の extra.eas.projectId で紐付いています)
eas init --id 4fbcf2c0-4451-4880-b965-df90130f6020

# iOS向けのビルド設定を生成(初回のみ、"iOS" を選択)
eas build:configure

# 開発用Dev Clientをクラウドビルド(iOS、要Apple Developer Programアカウント)
eas build --profile development --platform ios
```

ビルドが終わるとインストール用リンク(またはTestFlight)が発行されるので、
実機にインストール後、以下でMetroサーバーを起動して接続します。

```bash
npx expo start --dev-client
```

### npm installの警告について

`npm install`実行時に大量の`deprecated`警告や脆弱性(vulnerabilities)の指摘が出ますが、
Expo/React Native系プロジェクトでは正常な範囲です。**`npm audit fix --force`は実行しないでください。**
Expo/React Navigation関連パッケージのバージョンの組み合わせが崩れ、ビルドできなくなることがあります。
Expoが管理するパッケージのバージョン確認には代わりに以下を使います。

```bash
npx expo install --check
```

## Git / GitHub

- リポジトリは `work-out-app` という名前でGitHubに登録済み
- SSH鍵を`ed25519`で作成し、GitHubに登録して認証(`ssh -T git@github.com`で確認可能)
- `.gitignore`で`node_modules/`・`.expo/`・`ios/`・`android/`などを除外済み

## フォルダ構成

```
.nvmrc                    このプロジェクトで使うNode.jsバージョン(20)を指定
App.tsx                    エントリーポイント(NavigationContainer)
src/
  navigation/             画面遷移(仕様書の画面遷移図に対応)
  screens/                各画面(ワイヤーフレームに対応)
  native/                 Dynamic Island(ActivityKit)連携用ブリッジ(要ネイティブ実装)
  theme/                  配色トークン
  types/                  DB設計(仕様書)に対応する型定義
server/                   NAS上のDockerで動かす同期用APIサーバー(別パッケージ。server/README.md参照)
```

## 現状の実装状況

- [x] GitHubリポジトリ作成・SSH認証設定
- [x] Node.jsバージョンの統一(v20系)
- [x] Expo/EASプロジェクトの作成・連携(`eas init`完了)
- [x] iOS向け`eas build:configure`実施(EAS Build自体はApple Developer Program未登録のため保留中)
- [ ] Dev Clientのクラウドビルド(`eas build --profile development --platform ios`) — Apple Developer Program登録後に実施
- [x] Expo Goでの開発・確認フローに切り替え(当面はこちらで進める)
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
- [x] 設定画面(ユーザー名の変更、ユーザー切り替え、バージョン情報)。NAS接続設定・
      手動同期の行はNAS連携の実装時に追加する
- [x] 完了サマリー画面(種目一覧の「今日のトレーニングを終了」から、その日の種目数・
      セット数・負荷量・更新した自己ベスト・種目別の記録を表示)
- [x] NAS同期の土台(全テーブルの`updated_at`・論理削除`deleted_at`、削除の伝播と
      読み出しフィルタ)。画面の見た目・操作は変わらない
- [x] NAS上の同期用APIサーバー(`server/`。Express + SQLite、`POST /sync`で
      Last Write Winsの差分同期、Docker対応)。起動方法とAPIは`server/README.md`
- [x] アプリ側の同期処理(起動時の自動同期・記録終了時の同期・設定画面の手動同期。
      オフライン時は失敗を記録して次の機会にやり直す)
- [x] 設定画面のNAS接続設定(接続先の変更・今すぐ同期・最終同期日時)
- [ ] `src/native/RestTimerActivity.ts` はJS側インターフェースのみ。実際に
      Dynamic Islandへ表示するには、Swiftで書いたLive Activities
      (ActivityKit)のネイティブモジュールを別途実装し、Expo Config Plugin
      または `expo prebuild` で生成されるiOSプロジェクトに組み込む必要があります。
- [ ] デザイン調整(文字サイズなど)— 機能が一通り揃ってから着手する方針

## 次のステップ(候補)

1. 設定画面のNAS接続先の入力を書きやすくする(現状は素のテキスト入力で、URLを手打ちするのが
   つらい。履歴からの選択、`http://`の補完、QRコード読み取りなどを検討)
2. (Apple Developer Program登録後)Dev Clientのクラウドビルド → Dynamic Island用ネイティブモジュール(Swift/ActivityKit)の実装
3. デザイン調整(文字サイズなど)

## NAS同期

サーバーはNAS上のDockerで動いている(構築手順・API・同期の仕組みは`server/README.md`)。
アプリ側は`src/sync/`にあり、次のタイミングで同期する。

| タイミング | 内容 |
| --- | --- |
| ホーム画面を開いた直後(ユーザー選択後に1回) | 自動。失敗しても画面は止めない |
| 「今日のトレーニングを終了」 | 自動。ジムで記録した分を帰宅前に送る |
| 設定画面の「今すぐ同期」 | 手動。結果と失敗理由をその場に表示する |

接続先の初期値は`http://192.168.0.20:3000`(`src/db/appSettings.ts`)で、設定画面から変更できる。

### 外出先からの同期(Tailscale)

同期できない場所でも記録は普通に取れる(失敗を記録して次の機会にやり直す)ため、外出先からの同期は
必須ではない。常時同期したい場合はTailscaleでNASとiPhoneを同じプライベートネットワークに入れる。
ルーターのポート開放もDDNSも不要で、APIをインターネットに露出させずに済む。

1. [tailscale.com](https://tailscale.com/)でアカウントを作る(Google等でサインイン)
2. NAS: パッケージセンターで **Tailscale** を検索してインストール → 開く → ログインして
   表示されたURLを承認する
3. iPhone: App Storeで **Tailscale** を入れて同じアカウントでログイン → 接続をオンにする
4. NASのTailscaleアドレス(`100.x.y.z`)を確認する。NASのSSHで:
   ```bash
   sudo tailscale ip -4
   ```
   (Tailscaleの管理画面 [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines) でも見られる)
5. アプリの設定画面 → 接続先を `http://100.x.y.z:3000` に変更する

**このアドレスは自宅のWi-Fi内でも使える**(Tailscaleは同じLAN内なら直接通信する)ので、
接続先はこれ1つにしておけば自宅でも外出先でも同じように同期できる。

なお、Synology純正の選択肢を採らなかった理由は`docs/spec.md`の「今後決めること・オープン課題」に記録した。

iOSでLAN内のサーバーに繋ぐには「ローカルネットワーク」の許可が必要。Expo GoはMetroとの通信で
既に許可を取っているためそのまま動くが、将来Dev Client / EAS Buildで自前のアプリにする場合は
`app.json`に`NSLocalNetworkUsageDescription`と、HTTP(非HTTPS)を使うためのATS設定が必要になる。

## PCなしでアプリを使う(NAS上のMetro + Expo Go)

Expo GoはMetro(開発サーバー)が無いと動かないため、普段使いするにはPCを起動しておく必要がある。
これを避けるため、**MetroをNASのDockerで常駐させ、iPhoneからTailscale経由で繋いでいる**。
PCは不要で、外出先からも使える。

有料のApple Developer Program($99/年)を払わずに済ませるための構成で、代わりに
ホーム画面アイコンは作れず、起動はExpo Goからになる。他の選択肢との比較は
「アプリとして配布する」を参照。

### 起動手順

コードを更新したときも同じ手順で入れ替える(`CI=1`のためファイル変更の自動反映はない)。

```powershell
# 1. PC: Git管理下のファイルだけを固めて転送
cd C:\Users\astro\Develop\work-out-app
git archive --format=tar -o $env:TEMP\work-out-app-full.tar HEAD
scp -O $env:TEMP\work-out-app-full.tar HomeProtector@192.168.0.20:/volume1/docker/
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

iPhoneのExpo Goで「Enter URL manually」に `exp://100.98.40.63:8081` を入力する。
一度開けば履歴に残るので、以降はタップするだけ。Tailscaleはオンにしておくこと。

### 引数と環境変数の理由

| 指定 | 理由 |
| --- | --- |
| `--network host` | Tailscaleのインターフェース(`100.x.y.z`)でも8081番を受けるため |
| `REACT_NATIVE_PACKAGER_HOSTNAME` | これが無いとExpo GoがNASのLAN側アドレスを見に行き、外出先から繋がらない |
| `CI=1` | 付けないとExpo CLIが「ログインしますか」の対話プロンプトを出し、バックグラウンドのコンテナでは延々ループする。代償としてwatchが無効になる |
| `HOME=/tmp` | `~/.expo`への書き込みがNAS共有フォルダのACLと相性が悪く、renameがENOENTで失敗する。コンテナ内部に逃がす |
| `--group-add 101` | DSMのACL対策(`server/README.md`と同じ理由) |
| `--max-workers 1` | NASのメモリが1.7GBしかないため。既定ではコア数(4)だけワーカーが立ち、メモリ不足になる |

### つまずきどころ

- **Expo Goで「not signed in to Expo CLI」と出る** — iPhoneのExpo Goがログイン済みなのに、NAS側のCLIが匿名のため。Expo Goからログアウトすれば解決する。アカウントを保ちたい場合は
  [アクセストークン](https://expo.dev/settings/access-tokens)を作り、`-e EXPO_TOKEN=...` をコンテナに渡す
- **`Cannot find module '.../ws/index.js'`** — `npm install`が途中で失敗して`node_modules`が不完全。`npm ci`で作り直す
- **npmが`/.npm`に書けないと言う** — コンテナ内にそのuidのホームが無いため。`HOME`を書き込める場所に指定する

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

## SDK 51→57 移行(2026年9月実施)

iPhone側のExpo Goアプリは常に最新SDKのみに対応しており(App Store版は自動更新されるため)、
プロジェクト側のSDKが古いままだと`Project is incompatible with this version of Expo Go`という
エラーで起動できなくなる。今回Expo Goが57系になっていたため、プロジェクトもSDK 57へ上げた。

同じ状況になった場合の手順:

```bash
# 1. Node.jsのバージョンを合わせる
nvm use 20

# 2. 万一に備えてコミットしておく
git add -A
git commit -m "before upgrading expo sdk"

# 3. Expo本体を目的のSDK系列に上げる(例: 57系)
npx expo install expo@^57.0.0

# 4. 依存パッケージの「期待バージョン」を確認
npx expo install --fix
```

`expo install --fix`は依存関係の解決(特に`react`・`react-native`・`@types/react`まわり)で
`ERESOLVE`エラーを起こして失敗することがある。その場合は、表示された「expected version」を
`package.json`に直接書き込んでから、クリーンインストールし直すのが確実。

```bash
# node_modules・ロックファイル・Expoキャッシュを削除(Git BashなのでUnix形式のコマンドを使う。
# Windowsのcmd用rmdir/delは使えない)
rm -rf node_modules package-lock.json .expo
npm cache clean --force
npm install

# それでもERESOLVEで失敗する場合
npm install --legacy-peer-deps

# 整合性チェック
npx expo-doctor
```

移行時に実際に発生した問題と対処:

- **`app.json`の`splash`プロパティでスキーマエラー**: 新しいExpo設定スキーマでは
  トップレベルの`splash`が廃止されているため削除した(スプラッシュ画面はデフォルト動作に任せる)。
- **`assets/icon.png`が存在せずスキーマエラー**: `icon`に指定したパスのファイルが実際には
  作られていなかった。1024×1024のPNGを用意して配置した。
- **`metro.config.js`が存在しなかった**: Expoプロジェクトには本来必須のファイルだが、
  このプロジェクトには元々無かった。以下の内容で作成した。
  ```js
  // metro.config.js
  const { getDefaultConfig } = require('expo/metro-config');
  module.exports = getDefaultConfig(__dirname);
  ```
- **`Metro has encountered an error: Cannot read properties of undefined (reading 'transformFile')`**:
  症状としては謎のエラーだが、原因は`babel-preset-expo`が`package.json`に入っておらず
  `node_modules`に存在しなかったこと。Metro起動時にトランスフォーマーの初期化が失敗しているのに、
  その失敗が握りつぶされて実際にファイルを変換しようとした瞬間に上記のエラーとして表面化する、
  という分かりにくい壊れ方をする。ターミナルのログを起動直後まで遡ると
  `Failed to construct transformer:  Error: Cannot find module 'babel-preset-expo'`という
  本当の原因が出ている。対処は以下。
  ```bash
  npx expo install babel-preset-expo
  ```
  `babel.config.js`が無ければ以下も作成する。
  ```js
  module.exports = function (api) {
    api.cache(true);
    return {
      presets: ['babel-preset-expo'],
    };
  };
  ```
  修正後は必ずキャッシュクリアして再起動する(`npx expo start --go -c`)。

## トラブルシューティング

### Metroがバンドル中にクラッシュし、iPhoneが`Could not connect to development server`になる

ターミナルに`FATAL ERROR: Zone Allocation failed - process out of memory`が出て
Metroのプロセスごと終了している状態。8081番を誰も待ち受けなくなるため、iPhoneからは
「開発サーバーに繋がらない」と見える。

物理メモリに空きがあっても起きる。**ページファイル(仮想メモリ)が無効**だとコミット可能な
メモリの上限が物理メモリと同じになり、**Docker DesktopのVM(`vmmem`/`vmmemWSL`で5〜6GB)**が
動いていると上限に張り付いてメモリを確保できなくなるため。

確認(PowerShell):

```powershell
$os = Get-CimInstance Win32_OperatingSystem
"Commit free : {0:N1} GB" -f ($os.FreeVirtualMemory/1MB)   # 1GB台なら危険
Get-Process -Name '*vmmem*' | Select-Object ProcessName, @{N='CommitGB';E={[math]::Round($_.PrivateMemorySize64/1GB,2)}}
```

対処:

1. Docker Desktopを終了する(タスクトレイ → Quit Docker Desktop)。**その後に**`wsl --shutdown`を実行する。
   順番が逆だとDocker DesktopがVMを立て直すので効かない
2. 根本対処としてページファイルを有効にする(システムのプロパティ → 詳細設定 → パフォーマンス →
   詳細設定 → 仮想メモリ → 「自動的に管理する」。再起動が必要)

同期サーバーはNAS上で動いているので、開発中にPCのDocker Desktopを起動しておく必要はない。

### NAS(Synology)でサーバーのコンテナが起動直後に落ちる

`docker compose ps`が`Restarting (1)`になり、ログに
`SQLITE_CANTOPEN: unable to open database file`が出る場合、DSMの共有フォルダのACLで
マウント先が読み取り専用になっている。`chown`や`chmod 777`では解決しない。
原因と対処は`server/README.md`の「共有フォルダのACLに合わせてコンテナの実行ユーザーを決める」を参照。

### iPhoneでQRコード読み取り後、`http://127.0.0.1:8081/...`が開けない

パソコン側でMetroが正しいLAN(Wi-Fi)のIPアドレスを検出できず、`127.0.0.1`(パソコン自身を指す
アドレス)のままQRコードに埋め込んでしまっている状態。Docker DesktopやWSL2、VPNなどで
仮想ネットワークアダプタが複数あると起きやすい。

```bash
# トンネルモードで起動(同じWi-Fiである必要がなくなり確実)
npx expo start --go --tunnel
```

または、Wi-FiのIPv4アドレス(`ipconfig`で確認できる`192.168.x.x`)を明示的に指定する。

```bash
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.x
npx expo start --go
```

### `eas build:configure` や `expo config --json` がエラーメッセージ無しでクラッシュする

- Node.jsのバージョンを確認(`node -v`)。20系以外なら`nvm use 20`で切り替え、`where node`で
  意図しないNode.jsが優先されていないか確認する
- `app.json`の`plugins`に、対応する設定プラグインを持たないパッケージ名を書いていないか確認する
  (例: `expo-sqlite`はこのバージョンでは`plugins`に書く必要が無く、書くとクラッシュの原因になった)

### `git push`で`Permission denied (publickey)`

SSH鍵がGitHubに登録されていないことが原因。`ssh-keygen`で鍵を作成しGitHubに登録するか、
リモートURLをHTTPS(`git remote set-url origin https://github.com/...`)に変更しPersonal Access Tokenで認証する

### `npx eas ...`で`could not determine executable to run`

パッケージ名は`eas`ではなく`eas-cli`。`npx eas-cli@latest ...`と書くか、
`npm install -g eas-cli`でグローバルインストールしてから`eas ...`と打つ
