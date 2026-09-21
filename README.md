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
```

## 現状の実装状況

- [x] GitHubリポジトリ作成・SSH認証設定
- [x] Node.jsバージョンの統一(v20系)
- [x] Expo/EASプロジェクトの作成・連携(`eas init`完了)
- [x] iOS向け`eas build:configure`実施(EAS Build自体はApple Developer Program未登録のため保留中)
- [ ] Dev Clientのクラウドビルド(`eas build --profile development --platform ios`) — Apple Developer Program登録後に実施
- [x] Expo Goでの開発・確認フローに切り替え(当面はこちらで進める)
- [ ] 画面遷移・レイアウトはワイヤーフレーム通りに配置済み(ダミーデータ表示のみ、実データ連携は未実装)
- [ ] SQLite / API連携、認証(ユーザー選択)、同期処理は未実装(各ファイルのTODOコメントを参照)
- [ ] `src/native/RestTimerActivity.ts` はJS側インターフェースのみ。実際に
      Dynamic Islandへ表示するには、Swiftで書いたLive Activities
      (ActivityKit)のネイティブモジュールを別途実装し、Expo Config Plugin
      または `expo prebuild` で生成されるiOSプロジェクトに組み込む必要があります。
- [ ] レスタイマー終了時のアラーム音は `expo-notifications` 等でローカル通知を
      スケジュールする方式を想定していますが未実装です。

## 次のステップ(候補)

1. `npx expo start` + Expo Goで画面遷移を実機確認する
2. `expo-sqlite` を使ったローカルDB(仕様書のテーブル定義通り)の実装
3. NAS上のAPIサーバー(Node.js + Express、Docker)とのHTTP通信・オフライン差分同期
4. 認証(ユーザー選択のみ・パスワードなし)のローカル永続化
5. (Apple Developer Program登録後)Dev Clientのクラウドビルド → Dynamic Island用ネイティブモジュール(Swift/ActivityKit)の実装

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
