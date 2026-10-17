import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALICE, changes, postSync, startTestServer, user } from "./helpers.js";

const T1 = "2026-10-18T10:00:00.000Z";
const T2 = "2026-10-18T11:00:00.000Z";

describe("GET /users", () => {
  it("同期済みのユーザーを返し、削除済みは除く", async () => {
    const server = await startTestServer();
    try {
      await postSync(server.baseUrl, {
        userId: ALICE,
        since: null,
        changes: changes({
          users: [user(ALICE, "そーいち", T1), user("u2", "お父さん", T1, T2)],
        }),
      });

      const response = await fetch(`${server.baseUrl}/users`);
      const body = (await response.json()) as { users: { id: string; name: string }[] };

      assert.equal(response.status, 200);
      assert.deepEqual(body.users, [{ id: ALICE, name: "そーいち" }]);
    } finally {
      await server.close();
    }
  });
});

describe("GET /health", () => {
  it("起動確認用に200を返す", async () => {
    const server = await startTestServer();
    try {
      const response = await fetch(`${server.baseUrl}/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "ok" });
    } finally {
      await server.close();
    }
  });
});
