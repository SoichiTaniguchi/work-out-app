import type { SyncRequest, SyncResponse } from "@/sync/types";

// NASが居ない場所(ジムなど)では繋がらないのが普通なので、長く待たずに諦める。
const TIMEOUT_MS = 10000;

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncError";
  }
}

export async function postSync(
  serverUrl: string,
  token: string | null,
  request: SyncRequest
): Promise<SyncResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${trimTrailingSlash(serverUrl)}/sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (error) {
    // 圏外・NASの電源断・アドレス間違いはどれもここに来る
    throw new SyncError(
      controller.signal.aborted
        ? "サーバーに接続できませんでした(タイムアウト)"
        : `サーバーに接続できませんでした(${String(error)})`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new SyncError(`サーバーがエラーを返しました(${response.status}: ${await readError(response)})`);
  }

  return (await response.json()) as SyncResponse;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "詳細不明";
  } catch {
    return "詳細不明";
  }
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
