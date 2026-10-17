import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { Database } from "better-sqlite3";
import { createSyncRouter } from "./routes/sync.js";
import { createUsersRouter } from "./routes/users.js";

export interface AppOptions {
  db: Database;
  /** 設定されていればBearerトークンを要求する。未設定なら認証なし。 */
  syncToken?: string | undefined;
}

// テストから起動できるよう、listenはせずExpressアプリだけを組み立てる。
export function createApp({ db, syncToken }: AppOptions): Express {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  if (syncToken) {
    app.use(requireBearerToken(syncToken));
  }

  app.use(createUsersRouter(db));
  app.use(createSyncRouter(db));

  app.use(handleJsonParseError);

  return app;
}

function requireBearerToken(expected: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.get("authorization");
    if (header !== `Bearer ${expected}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}

// express.jsonが投げるパースエラーを、HTMLのスタックトレースではなくJSONで返す。
function handleJsonParseError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "invalid JSON body" });
    return;
  }
  next(err);
}
