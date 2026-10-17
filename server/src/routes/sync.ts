import { Router } from "express";
import type { Database } from "better-sqlite3";
import { applySync } from "../sync/service.js";
import { ValidationError, parseSyncRequest } from "../sync/validate.js";

export function createSyncRouter(db: Database): Router {
  const router = Router();

  // 差分同期。ローカルの変更を送り、前回のcursor以降のサーバー側の変更を受け取る。
  router.post("/sync", (req, res) => {
    let request;
    try {
      request = parseSyncRequest(req.body);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }

    try {
      res.json(applySync(db, request));
    } catch (error) {
      // 持ち主の違う行や、存在しない種目にぶら下がる記録はデータの不整合なので、
      // 500ではなく原因の分かる409で返す。
      if (error instanceof ValidationError) {
        res.status(409).json({ error: error.message });
        return;
      }
      if (isForeignKeyError(error)) {
        res.status(409).json({ error: "changes reference a row that does not exist on the server" });
        return;
      }
      throw error;
    }
  });

  return router;
}

function isForeignKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("SQLITE_CONSTRAINT")
  );
}
