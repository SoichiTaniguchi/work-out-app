import { Router } from "express";
import type { Database } from "better-sqlite3";

interface UserRow {
  id: string;
  name: string;
}

export function createUsersRouter(db: Database): Router {
  const router = Router();

  // ログイン(ユーザー選択)画面用。初回起動でまだ同期していない端末が
  // 「誰がいるか」だけを知るために使う。論理削除済みは返さない。
  router.get("/users", (_req, res) => {
    const rows = db
      .prepare("SELECT id, name FROM users WHERE deleted_at IS NULL ORDER BY name ASC;")
      .all() as UserRow[];

    res.json({ users: rows });
  });

  return router;
}
