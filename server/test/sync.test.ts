import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  ALICE,
  changes,
  dailyLog,
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
      dailyLogs: [dailyLog("dl1", "2026-10-18", 68.4, T1, { condition: 4, bowelMoved: true })],
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

  it("体重・体調・排便の記録が2台目に届く", async () => {
    await seed(server.baseUrl);

    const { body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({}),
    });

    const log = body.changes.dailyLogs[0];
    assert.equal(log?.date, "2026-10-18");
    assert.equal(log?.weight, 68.4);
    assert.equal(log?.condition, 4);
    assert.equal(log?.bowelMoved, true, "排便のあり/なしが真偽値のまま往復する");
  });

  it("未入力の項目はnullのまま往復する", async () => {
    await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({
        users: [user(ALICE, "そーいち", T1)],
        // 体重だけ入れて、体調と排便は未入力
        dailyLogs: [dailyLog("dl1", "2026-10-20", 68.0, T1)],
      }),
    });

    const { body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({}),
    });

    const log = body.changes.dailyLogs[0];
    assert.equal(log?.weight, 68.0);
    assert.equal(log?.condition, null);
    assert.equal(log?.bowelMoved, null, "未入力は0ではなくnullで戻る");
  });

  it("同じ日の記録を2台が別idで作っても1日1行に保たれる", async () => {
    await seed(server.baseUrl);

    // 2台目が同じ日(2026-10-18)を別のidで、あとから記録した
    const { status, body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({
        dailyLogs: [dailyLog("dl2", "2026-10-18", 68.9, T2, { condition: 2 })],
      }),
    });

    assert.equal(status, 200);
    const rows = server.db
      .prepare("SELECT id, weight FROM daily_logs WHERE user_id = ? AND date = ?;")
      .all(ALICE, "2026-10-18") as { id: string; weight: number }[];
    assert.equal(rows.length, 1, "同じ日の行が2つ残らない");
    assert.equal(rows[0]?.id, "dl2");
    assert.equal(rows[0]?.weight, 68.9);
    assert.equal(body.changes.dailyLogs.length, 1);
  });

  it("同じ日に古い記録が届いたらサーバー側の行を返す(Last Write Wins)", async () => {
    const cursor = await seed(server.baseUrl);

    // 2台目が、同じ日の古い記録を別idで送ってきた
    const { body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({
        dailyLogs: [dailyLog("dl2", "2026-10-18", 70.0, "2026-10-18T09:00:00.000Z")],
      }),
    });

    assert.equal(
      body.changes.dailyLogs[0]?.id,
      "dl1",
      "採用しなかったので、サーバー側の行を返して端末の古い値を上書きさせる"
    );
    assert.equal(body.changes.dailyLogs[0]?.weight, 68.4);
  });

  it("日次記録の論理削除が相手の端末に伝わる", async () => {
    const cursor = await seed(server.baseUrl);

    await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({
        dailyLogs: [dailyLog("dl1", "2026-10-18", 68.4, T3, { deletedAt: T3 })],
      }),
    });

    const { body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: cursor,
      changes: changes({}),
    });

    assert.equal(body.changes.dailyLogs[0]?.deletedAt, T3);
  });

  it("2台が同じ日の違う項目を記録しても、先に入れた項目が消えない", async () => {
    // 1台目: 朝に体重だけ記録して同期した
    await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({
        users: [user(ALICE, "そーいち", T1)],
        dailyLogs: [dailyLog("dlA", "2026-10-26", 68.4, "2026-10-26T07:00:00.000Z")],
      }),
    });

    // 2台目: 1台目の分を受け取る前に、夜に体調だけ記録した(その端末では体重はnull)
    const { body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({
        dailyLogs: [
          dailyLog("dlB", "2026-10-26", null, "2026-10-26T22:00:00.000Z", { condition: 4 }),
        ],
      }),
    });

    const log = body.changes.dailyLogs.find((row) => row.date === "2026-10-26");
    assert.equal(log?.weight, 68.4, "朝に入れた体重が夜の記録で消えない");
    assert.equal(log?.condition, 4, "夜に入れた体調も残る");

    const rows = server.db
      .prepare("SELECT COUNT(*) as count FROM daily_logs WHERE user_id = ? AND date = ?;")
      .get(ALICE, "2026-10-26") as { count: number };
    assert.equal(rows.count, 1, "1日1行のまま");
  });

  it("あとから入れ直した値は上書きする", async () => {
    await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({
        users: [user(ALICE, "そーいち", T1)],
        dailyLogs: [dailyLog("dlA", "2026-10-26", 68.4, T1, { condition: 4, bowelMoved: true })],
      }),
    });

    // 同じ端末で測り直した。未入力ではなく入れ直した値なので、新しい方を採用する
    const { body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({
        dailyLogs: [dailyLog("dlA", "2026-10-26", 67.9, T2, { condition: 2, bowelMoved: false })],
      }),
    });

    const log = body.changes.dailyLogs.find((row) => row.date === "2026-10-26");
    assert.equal(log?.weight, 67.9);
    assert.equal(log?.condition, 2);
    assert.equal(log?.bowelMoved, false, "排便の「なし」は未入力と区別して上書きされる");
  });

  it("他のユーザーの日次記録は書き換えられない", async () => {
    await seed(server.baseUrl);

    const { status, body } = await postSync(server.baseUrl, {
      userId: ALICE,
      since: null,
      changes: changes({
        dailyLogs: [{ ...dailyLog("dl9", "2026-10-19", 68.0, T2), userId: "u2" }],
      }),
    });

    // 持ち主違いはデータの不整合なので、形の誤り(400)ではなく409で返す
    assert.equal(status, 409);
    assert.match(body.error ?? "", /another user/);
  });

  it("体調が1〜5の外なら400で返す", async () => {
    await seed(server.baseUrl);

    for (const condition of [0, 6, 2.5]) {
      const { status, body } = await postSync(server.baseUrl, {
        userId: ALICE,
        since: null,
        changes: changes({
          dailyLogs: [dailyLog("dl9", "2026-10-19", 68.0, T2, { condition })],
        }),
      });

      assert.equal(status, 400, `体調 ${condition} は受け付けない`);
      assert.match(body.error ?? "", /condition/);
    }
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
