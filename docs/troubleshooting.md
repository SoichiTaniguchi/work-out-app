# トラブルシューティング

同じ問題を繰り返し調査しなくて済むよう、**原因と対処をセットで**残す。
詰まったことがあればここに追記する。

## Metroがバンドル中にクラッシュし、iPhoneが`Could not connect to development server`になる

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

## NAS(Synology)でサーバーのコンテナが起動直後に落ちる

`docker compose ps`が`Restarting (1)`になり、ログに
`SQLITE_CANTOPEN: unable to open database file`が出る場合、DSMの共有フォルダのACLで
マウント先が読み取り専用になっている。`chown`や`chmod 777`では解決しない。
原因と対処は`../server/README.md`の「共有フォルダのACLに合わせてコンテナの実行ユーザーを決める」を参照。

## 自動デプロイの起動確認だけが失敗する(`sync server did not come back`)

デプロイ本体(コピー・`npm ci`・再起動)は成功しているのに、最後の確認だけ落ちる。

**self-hosted runnerはコンテナの中で動いているため、`localhost`がrunner自身を指す。**
NASのホスト側で公開されているポートには届かない。

ホストのネットワークに入ったコンテナから確認する。

```bash
docker run --rm --network host node:22-bookworm-slim \
  node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1))"
```

`scripts/deploy-nas.sh`の`wait_for`はこの形にしてある。
同じ理由で、runnerの中から直接NASのサービスを叩くコマンドは書かないこと。

## NASのファイルが突然rootのものになり、コンテナが書き込めなくなる

`npm error code EACCES` / `permission denied, rmdir '/app/node_modules/.bin'` のように、
これまで書けていた場所に書けなくなる。確認すると配置先が root 所有に変わっている。

```
$ ls -lnd . node_modules
drwxr-xr-x  1    0   0 ...    ← root所有
dr-xr-xr-x+ 1 1026 100 ...    ← 書き込み不可

$ synoacltool -get .
(synoacltool.c, 596)It's Linux mode    ← ACLが消えている

$ synoacltool -get node_modules
[0] user:root:allow:rwxp-DaARWc--:fd-- (level:1)   ← rootだけが書ける(親から継承)
```

**rootで`tar -x`するとアーカイブ側の所有者とパーミッションがディレクトリに適用され、
Synologyの共有フォルダのACLが消える。** 消えたACLは子へ継承されるので、
tarで除外していたディレクトリまで巻き込まれて書けなくなる。

対処(配置先を作り直す):

```bash
cd /volume1/docker
sudo rm -rf work-out-app/node_modules work-out-app/.container-home
sudo chown -R 1026:100 work-out-app
sudo chmod -R u+rwX work-out-app
```

予防として、rootで展開するときは必ず`--no-same-owner --no-same-permissions`を付ける
(`scripts/deploy-nas.sh`はそうしてある)。

## NASへのファイル転送で`subsystem request failed on channel 0`

OpenSSH 9以降の`scp`は内部でSFTPを使うが、DSMは既定でSFTPが無効なため失敗する。
`-O`(大文字のオー)を付けて旧来の方式に戻す。

```powershell
scp -O $env:TEMP\work-out-app-full.tar <ユーザー名>@192.168.0.20:/volume1/docker/
```

Windowsの共有フォルダ経由(`Copy-Item ... \\192.168.0.20\docker\`)でも転送できる。

## NAS上のMetroが起動しない・Expo Goから開けない

| 症状 | 原因と対処 |
| --- | --- |
| `Cannot find module '.../ws/index.js'` | `npm install`が途中で失敗して`node_modules`が不完全。`npm ci`で作り直す |
| npmが`/.npm`に書けないと言う | コンテナ内にそのuidのホームが無い。`HOME`を書き込める場所に指定する |
| 「ログインしますか」のプロンプトが延々ループする | バックグラウンドのコンテナでは選択できない。`CI=1`で非対話にする |
| `.expo`へのrenameが`ENOENT`で失敗する | NAS共有フォルダのACLと相性が悪い。`HOME=/tmp`でコンテナ内部に逃がす |
| Expo Goで`not signed in to Expo CLI` | iPhoneのExpo Goがログイン済みなのにNAS側のCLIが匿名。Expo Goからログアウトするか、[アクセストークン](https://expo.dev/settings/access-tokens)を作って`-e EXPO_TOKEN=...`を渡す。プレビュー(8082番)は本番のMetroコンテナ(`workout-metro`)の`EXPO_TOKEN`を引き継ぐので、本番に渡してあればよい |

## iPhoneでQRコード読み取り後、`http://127.0.0.1:8081/...`が開けない

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

## `eas build:configure` や `expo config --json` がエラーメッセージ無しでクラッシュする

- Node.jsのバージョンを確認(`node -v`)。22系以外なら`nvm use 22`で切り替え、`where node`で
  意図しないNode.jsが優先されていないか確認する
- `app.json`の`plugins`に、対応する設定プラグインを持たないパッケージ名を書いていないか確認する
  (例: SDK 57では`expo-sqlite`を`plugins`に書くとクラッシュした。SDK 58では`npx expo install`が
  `expo-sqlite`と`expo-status-bar`を自動で追加し、そのままで動く)

## @claudeがPRでmainを取り込めない(`Your local changes would be overwritten`)

claude-code-actionはPRで動くとき、`CLAUDE.md`などの設定ファイルをmainの内容に差し替える
(PRのブランチ経由で指示を書き換えられないようにするための仕様)。PRのブランチの`CLAUDE.md`が
mainより古いと、差し替えた分が未コミットの変更に見え、`git merge origin/main`が中断する。
差分はmainと同じ内容なので捨ててよい。`claude.yml`で`git restore`を許可してあるので、
Claudeが捨ててから取り込む。手元で取り込む場合は普通に`git merge origin/main`すればよい。

## `git push`で`Permission denied (publickey)`

SSH鍵がGitHubに登録されていないことが原因。`ssh-keygen`で鍵を作成しGitHubに登録するか、
リモートURLをHTTPS(`git remote set-url origin https://github.com/...`)に変更しPersonal Access Tokenで認証する

## `npx eas ...`で`could not determine executable to run`

パッケージ名は`eas`ではなく`eas-cli`。`npx eas-cli@latest ...`と書くか、
`npm install -g eas-cli`でグローバルインストールしてから`eas ...`と打つ

## npm installの警告について

`npm install`実行時に大量の`deprecated`警告や脆弱性(vulnerabilities)の指摘が出るが、
Expo/React Native系プロジェクトでは正常な範囲。**`npm audit fix --force`は実行しないこと。**
Expo/React Navigation関連パッケージのバージョンの組み合わせが崩れ、ビルドできなくなる。
Expoが管理するパッケージのバージョン確認には代わりに以下を使う。

```bash
npx expo install --check
```

## Expo Goで`Project is incompatible with this version of Expo Go`(SDKの上げ方)

iPhone側のExpo Goアプリは常に最新SDKのみに対応しており(App Store版は自動更新されるため)、
プロジェクト側のSDKが古いままだと`Project is incompatible with this version of Expo Go`という
エラーで起動できなくなる。**iOSのExpo Goは古い版に戻せないので、プロジェクトのSDKを上げるしかない。**
本番もプレビューも同時に開けなくなるので、気づいたらすぐに対応する。

これまでの移行:

| 時期 | SDK | 主な変更 |
| --- | --- | --- |
| 2026年9月 | 51→57 | 下の「51→57で実際に発生した問題」を参照 |
| 2026年10月 | 57→58 | Node 22.13以上が必須に。`react-native-gesture-handler`が3系に。`react-native-worklets`が必須に |

同じ状況になった場合の手順:

```bash
# 1. Node.jsのバージョンを合わせる(新しいSDKが要求するNodeは npm view expo@^58 engines で確認)
nvm use 22

# 2. 万一に備えてコミットしておく
git add -A
git commit -m "before upgrading expo sdk"

# 3. Expo本体を目的のSDK系列に上げる(例: 58系)
npx expo install expo@^58.0.0

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

**SDKが要求するNodeのメジャーバージョンが変わったときは、NAS側も合わせる。**
`.nvmrc`(CIが使う)と`scripts/lib/nas.sh`の`NODE_IMAGE`(NASのMetroと`npm ci`が使う)を揃える。
本番のMetroコンテナは、マージ後のデプロイでイメージの違いを検知して自動で作り直される
(`EXPO_TOKEN`は古いコンテナから引き継ぐ)。

なお、プレビュー(`/preview`)はmain側のスクリプトで動くため、Nodeを上げるPR自体は
プレビューできない(古いNodeで起動して失敗する)。手元のPCで`npx expo start --go`して確認するか、
マージして本番で確認する。

51→57で実際に発生した問題と対処:

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
