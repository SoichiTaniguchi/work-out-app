# 筋トレ記録アプリ (work-out-app)

「筋トレ記録アプリ 仕様書」に基づく React Native (Expo) プロジェクトの初期スケルトンです。

## セットアップ

Windows機のためiOS実機ビルド・シミュレータ実行はできません。開発中の動作確認はExpo Goでは
なく **Dev Client** (`expo-dev-client`) と **EAS Build** のクラウドビルドを使います
(Dynamic Island用のネイティブモジュールを含むため、Expo Goでは動作しません)。

```bash
# 依存パッケージのインストール
npm install

# EASにログイン(初回のみ、要Expoアカウント)
npx eas login

# EAS設定ファイルを生成(初回のみ)
npx eas build:configure

# 開発用Dev Clientをクラウドビルド(iOS)
npx eas build --profile development --platform ios
```

ビルドが終わるとインストール用リンク(またはTestFlight)が発行されるので、
実機にインストール後、以下でMetroサーバーを起動して接続します。

```bash
npx expo start --dev-client
```

## フォルダ構成

```
App.tsx                  エントリーポイント(NavigationContainer)
src/
  navigation/             画面遷移(仕様書の画面遷移図に対応)
  screens/                各画面(ワイヤーフレームに対応)
  native/                 Dynamic Island(ActivityKit)連携用ブリッジ(要ネイティブ実装)
  theme/                  配色トークン
  types/                  DB設計(仕様書)に対応する型定義
```

## 現状の実装状況

- 画面遷移・レイアウトはワイヤーフレーム通りに配置済み(ダミーデータ表示)
- SQLite / API連携、認証(ユーザー選択)、同期処理は未実装(TODOコメントを参照)
- `src/native/RestTimerActivity.ts` はJS側インターフェースのみ。実際に
  Dynamic Islandへ表示するには、Swiftで書いたLive Activities
  (ActivityKit)のネイティブモジュールを別途実装し、Expo Config Plugin
  または `expo prebuild` で生成されるiOSプロジェクトに組み込む必要があります。
- レスタイマー終了時のアラーム音は `expo-notifications` 等でローカル通知を
  スケジュールする方式を想定していますが未実装です。

## 次のステップ(候補)

1. `expo-sqlite` を使ったローカルDB(仕様書のテーブル定義通り)の実装
2. NAS上のAPIサーバー(Node.js + Express)とのHTTP通信・オフライン差分同期
3. Dynamic Island用ネイティブモジュール(Swift/ActivityKit)の実装
4. 認証(ユーザー選択のみ・パスワードなし)のローカル永続化
