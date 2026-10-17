import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  ALICE,
  changes,
  exercise,
  folder,
  personalRecord,
  postSync,
  startTestServer,
  user,
  workoutLog,
  type TestServer,
} from "./helpers.js";

const T1 = "2026-10-18T10:00:00.000Z";
const T2 = "2026-10-18T11:00:00.000Z";
const T3 = "2026-10-18T12:00:00.000Z";

// 1台目が一通りのデータを送った状態を作る。
async function seed(baseUrl: string): Promise<number> {
  const { status, body } = await postSync(baseUrl, {
    userId: ALICE,
    since: null,
    changes: changes({
      users: [user(ALICE, "そーいち", T1)],
      exercises: [exercise("ex1", "ベンチプレス", T1)],
      folders: [folder("fd1", "胸の日", ["ex1"], T1)],
      workoutLogs: [workoutLog("wl1", "ex1", T1, [{ weight: 60, reps: 10 }])],
      personalRecords: [personalRecord("pr1", "ex1", 60, T1)],
    }),
  });

  assert.equal(status, 200);
  return body.cursor;
}

describe("POST /sync", () => {
  // テストごとにDBを作り直し、前のテストのデータを持ち越さない。
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it("受け取った変更を保存し、2台目に初回同期で全部渡す", async () => {
    const cursor = await seed(server.baseUrl);
    assert.equal(cursor, 1);

    const { body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({}),
    });

    assert.equal(body.cursor, 1, "送る変更が無ければcursorは進まない");
    assert.deepEqual(
      body.changes.exercises.map((e) => e.name),
      ["ベンチプレス"]
    );
    assert.deepEqual(body.changes.folders[0]?.exerciseIds, ["ex1"], "フォルダの中身も一緒に届く");
    assert.deepEqual(
      body.changes.workoutLogs[0]?.sets.map((s) => [s.weight, s.reps]),
      [[60, 10]],
      "セットも記録と一緒に届く"
    );
    assert.equal(body.changes.personalRecords[0]?.value, 60);
  });

  it("前回のcursor以降の変更だけを返す", async () => {
    const cursor = await seed(server.baseUrl);

    const { body: unchanged } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({}),
    });
    assert.equal(unchanged.changes.exercises.length, 0, "更新が無ければ何も返らない");

    await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({ exercises: [exercise("ex1", "ベンチプレス(改)", T2)] }),
    });

    const { body: updated } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({}),
    });
    assert.deepEqual(
      updated.changes.exercises.map((e) => e.name),
      ["ベンチプレス(改)"]
    );
  });

  it("古い更新は採用せず、サーバー側の新しい行を返す(Last Write Wins)", async () => {
    const cursor = await seed(server.baseUrl);

    await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({ exercises: [exercise("ex1", "新しい名前", T3)] }),
    });

    // 別の端末が、それより古い更新を送ってくる
    const { body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({ exercises: [exercise("ex1", "古い名前", T2)] }),
    });

    assert.deepEqual(
      body.changes.exercises.map((e) => e.name),
      ["新しい名前"],
      "採用しなかった行はサーバー側の値を返して端末を直させる"
    );
    const stored = server.db.prepare("SELECT name FROM exercises WHERE id = 'ex1';").get() as {
      name: string;
    };
    assert.equal(stored.name, "新しい名前");
  });

  it("論理削除が相手の端末に伝わる", async () => {
    const cursor = await seed(server.baseUrl);

    await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({ exercises: [exercise("ex1", "ベンチプレス", T2, T2)] }),
    });

    const { body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({}),
    });

    assert.equal(body.changes.exercises[0]?.deletedAt, T2, "削除済みの行も返す(消したと伝える)");
  });

  it("削除したフォルダの所属リンクは残さない", async () => {
    const cursor = await seed(server.baseUrl);

    await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({ folders: [folder("fd1", "胸の日", ["ex1"], T2, T2)] }),
    });

    const links = server.db
      .prepare("SELECT * FROM folder_exercises WHERE folder_id = 'fd1';")
      .all();
    assert.equal(links.length, 0);
  });

  it("自己ベストが別idで作り直されても1種目1種別に保たれる", async () => {
    const cursor = await seed(server.baseUrl);

    await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({ personalRecords: [personalRecord("pr2", "ex1", 70, T2)] }),
    });

    const rows = server.db
      .prepare("SELECT id, value FROM personal_records WHERE exercise_id = 'ex1';")
      .all() as { id: string; value: number }[];
    assert.deepEqual(rows, [{ id: "pr2", value: 70 }], "古いidの行は置き換わる");
  });

  it("他のユーザーの種目は書き換えられない", async () => {
    await seed(server.baseUrl);

    const { status, body } = await postSync(server.baseUrl, {
      userId: "u2",
      since: null,
      changes: changes({ exercises: [exercise("ex1", "乗っ取り", T3)] }),
    });

    assert.equal(status, 409);
    assert.match(body.error ?? "", /another user/);
  });

  it("存在しない種目にぶら下がる記録は受け付けない", async () => {
    await seed(server.baseUrl);

    const { status } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({ workoutLogs: [workoutLog("wl9", "ex-unknown", T2, [])] }),
    });

    assert.equal(status, 409);
  });

  it("形の違うリクエストは400で理由を返す", async () => {
    const missingUser = await postSync(server.baseUrl, { since: null, changes: changes({}) });
    assert.equal(missingUser.status, 400);
    assert.match(missingUser.body.error ?? "", /body\.userId/);

    const brokenRow = await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: { exercises: [{ id: "ex9", name: "項目なし", userId: ALICE, updatedAt: T1 }] },
    });
    assert.equal(brokenRow.status, 400);
    assert.match(brokenRow.body.error ?? "", /fieldDefinition/);

    const brokenJson = await postSync(server.baseUrl, "{");
    assert.equal(brokenJson.status, 400);
  });
});

describe("SYNC_TOKEN", () => {
  it("設定されていればトークン無しのリクエストを拒否する", async () => {
    const server = await startTestServer({ syncToken: "secret" });
    try {
      const withoutToken = await postSync(server.baseUrl, {
        userId: ALICE,
        since: null,
        changes: changes({}),
      });
      assert.equal(withoutToken.status, 401);

      const withToken = await postSync(
        server.baseUrl,
        { userId: ALICE, since: null, changes: changes({}) },
        { token: "secret" }
      );
      assert.equal(withToken.status, 200);
    } finally {
      await server.close();
    }
  });
});
