// 環境変数の読み取りはここに集約する。Dockerではdocker-compose.ymlから渡す。
export interface ServerConfig {
  port: number;
  databasePath: string;
  /** 設定するとAuthorizationヘッダ(Bearer)が必須になる。未設定なら認証なし(LAN/VPN内前提)。 */
  syncToken: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer: ${env.PORT}`);
  }

  return {
    port,
    databasePath: env.DATABASE_PATH ?? "./data/work-out-app.db",
    syncToken: env.SYNC_TOKEN === "" ? undefined : env.SYNC_TOKEN,
  };
}
