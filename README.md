# 筋トレ記録アプリ (work-out-app)

種目と記録項目を自由に設定できる、家族で共有する筋トレ記録アプリ。
React Native (Expo) 製のiOSアプリと、NAS上で動く同期サーバーからなる。

既存の筋トレ記録アプリは種目のマスタが固定されていることが多い。
**種目設定の自由度の高さ**がこのアプリの価値。

## できること

- **種目を自由に作る** — 種目名・部位・器具を自分で決める。記録する項目も種目ごとに選べる
  (重量・回数・時間・距離・RPEの組み合わせ)
- **部位別のプリセットから選ぶ** — 9部位・61種目。自分で足した種目もプリセットに並ぶ
- **プログラム(フォルダ)にまとめる** — 「胸の日」のようにまとめ、ドラッグで並び替え。
  1つの種目を複数のプログラムに入れられる。まるごとコピーしてテンプレートにもできる
- **記録する** — 前回の値が薄く表示され、差分だけ入力できる。レスタイマーは
  バックグラウンドでも通知が来る。セットにチェックを入れた時点で保存される
- **振り返る** — 種目ごとの折れ線グラフ、自己ベスト(最高重量・最高回数・ボリューム)、
  その日の完了サマリー
- **家族で使い分ける** — ユーザーを選んで切り替える。データはユーザーごとに完全に独立
- **NASに同期する** — 端末のデータをNASのサーバーと差分同期する。
  圏外でも記録でき、繋がったときに自動で同期される

## 使い方

### アプリを開く

iPhoneの **Expo Go** で、NAS上の開発サーバーを開く。

1. iPhoneで **Tailscale** をオンにする
2. Expo Goを開き、「Enter URL manually」に次を入力する

   ```
   exp://100.98.40.63:8081
   ```

一度開けば履歴に残るので、以降はタップするだけ。
アプリはNASから配信されているため、**PCを起動しておく必要はない**。

> ホーム画面にアイコンを置く方法もあるが、それにはApple Developer Program(年$99)が必要。
> 選択肢の比較は[docs/development.md](docs/development.md#アプリとして配布する)にまとめてある。

### NASの接続先を設定する

記録は端末内に保存され、NASのサーバーと同期される。接続先は**設定画面**で変更できる。

| 状況 | 接続先 |
| --- | --- |
| Tailscaleを使う(推奨。自宅でも外出先でも同じ) | `http://100.98.40.63:3000` |
| 自宅のWi-Fiだけで使う | `http://192.168.0.20:3000` |

同期されるタイミングは3つ。

| タイミング | 内容 |
| --- | --- |
| ホーム画面を開いた直後(ユーザー選択後に1回) | 自動。失敗しても操作は止まらない |
| 「今日のトレーニングを終了」 | 自動。ジムで記録した分を帰宅前に送る |
| 設定画面の「今すぐ同期」 | 手動。結果と失敗理由をその場に表示する |

**同期できない場所でも記録は普通に取れる。** 失敗は記録され、次に繋がったときにやり直される。

### 外出先から使う(Tailscale)

NASは自宅LAN内にあるため、外から届かせるにはTailscaleで同じプライベートネットワークに入る。
ルーターのポート開放もDDNSも不要で、サーバーをインターネットに露出させずに済む。

1. [tailscale.com](https://tailscale.com/)でアカウントを作る(Google等でサインイン)
2. NAS: パッケージセンターで **Tailscale** をインストール → 開く → 表示されたURLを承認する
3. iPhone: App Storeで **Tailscale** を入れて同じアカウントでログイン → 接続をオンにする
4. NASのTailscaleアドレスを確認する(NASのSSHで `sudo tailscale ip -4`、または
   [管理画面](https://login.tailscale.com/admin/machines))
5. アプリの設定画面 → 接続先を `http://<そのアドレス>:3000` にする

**このアドレスは自宅のWi-Fi内でも使える**(Tailscaleは同じLAN内なら直接通信する)ので、
接続先はこれ1つにしておけば自宅でも外出先でも同じように同期できる。

QuickConnectは使えない。DSMと純正パッケージを中継する仕組みで、自前のコンテナのポートは
対象外のため。Synology VPN Serverを採らなかった理由は[docs/spec.md](docs/spec.md)に記録した。

## 開発環境のセットアップ

**Node.js v20系(LTS)を使う。** SDK 57のツールチェーンはNode 20系で動作確認済み。
Node 22/24系では`expo config`などがエラーメッセージ無しでクラッシュすることがある。

```bash
nvm use 20        # .nvmrc があるのでバージョン指定は不要
npm install
npx expo start --go
```

ターミナルに出るQRコードをExpo Goで読み取ると、PCのMetroに接続して確認できる
(iPhoneとPCが同じネットワークにあること)。

- Windowsでは[nvm-windows](https://github.com/coreybutler/nvm-windows/releases)を推奨。
  `C:\Program Files\nodejs`に単独インストールされたNode.jsが残っていると、PATHの優先順位で
  そちらが使われることがある(`where node`で確認)
- `--go`を付けるのは、このプロジェクトが`expo-dev-client`を含んでおり、付けないと
  Expo Goが読めない専用スキームのQRコードになるため
- `npm install`で大量の`deprecated`警告が出るのは正常。**`npm audit fix --force`は実行しない**
  (ExpoとReact Navigationのバージョンの組み合わせが壊れる)。確認は`npx expo install --check`

同期サーバーを手元で動かす手順は[server/README.md](server/README.md)にある。

## フォルダ構成

```
App.tsx                   エントリーポイント(NavigationContainer)
src/
  navigation/             画面遷移(仕様書の画面遷移図に対応)
  screens/                各画面(ワイヤーフレームに対応)
  components/             画面をまたいで使う部品(グラフなど)
  db/                     ローカルDB(SQLite)の読み書き
  sync/                   NASサーバーとの差分同期
  constants/              プリセット種目・記録項目の定義
  utils/ , timers/        表示の整形、レスタイマー
  native/                 Dynamic Island(ActivityKit)連携用ブリッジ(要ネイティブ実装)
  theme/                  配色トークン
  types/                  DB設計(仕様書)に対応する型定義
server/                   NAS上のDockerで動かす同期用APIサーバー(別パッケージ)
scripts/deploy-nas.sh     NASへのデプロイ処理
```

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| [docs/spec.md](docs/spec.md) | 仕様書。画面・データ設計・同期アーキテクチャ |
| [docs/development.md](docs/development.md) | 開発の進め方(Issue運用・PR・CI・自動デプロイ)、実装状況 |
| [docs/troubleshooting.md](docs/troubleshooting.md) | 詰まったときの原因と対処 |
| [server/README.md](server/README.md) | 同期サーバーの構築手順・API・同期の仕組み |

やることは[Issues](https://github.com/SoichiTaniguchi/work-out-app/issues)で管理している。
