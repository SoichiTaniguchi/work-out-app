import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/open.js";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const app = createApp({ db, syncToken: config.syncToken });

const server = app.listen(config.port, () => {
  console.log(`work-out-app server listening on port ${config.port}`);
  console.log(`database: ${config.databasePath}`);
  if (!config.syncToken) {
    console.log("SYNC_TOKEN is not set: running without authentication");
  }
});

// Dockerのstop(SIGTERM)でSQLiteをきちんと閉じる。
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
