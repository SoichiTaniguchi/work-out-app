// アプリ側(src/utils/dateRange.ts)の日付ヘルパーのテスト。
// アプリにはテスト基盤がないため、純粋関数だけサーバーの tsx --test で確認する。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  dayRangeIso,
  formatDateLabel,
  localDateKey,
  monthRangeIso,
  monthWeeks,
  noonIso,
  weekKeys,
} from "../../src/utils/dateRange.js";

describe("dayRangeIso", () => {
  it("ローカルの0時〜翌0時を返す", () => {
    const { startIso, endIso } = dayRangeIso("2026-10-21");
    assert.equal(startIso, new Date(2026, 9, 21).toISOString());
    assert.equal(endIso, new Date(2026, 9, 22).toISOString());
  });

  it("月末・年末でも翌日が正しい", () => {
    assert.equal(dayRangeIso("2026-10-31").endIso, new Date(2026, 10, 1).toISOString());
    assert.equal(dayRangeIso("2026-12-31").endIso, new Date(2027, 0, 1).toISOString());
  });
});

describe("monthRangeIso", () => {
  it("月初〜翌月初を返す(monthは0始まり)", () => {
    const { startIso, endIso } = monthRangeIso(2026, 11);
    assert.equal(startIso, new Date(2026, 11, 1).toISOString());
    assert.equal(endIso, new Date(2027, 0, 1).toISOString());
  });
});

describe("noonIso", () => {
  it("その日のローカル正午を返す", () => {
    const noon = new Date(noonIso("2026-10-21"));
    assert.equal(localDateKey(noon), "2026-10-21");
    assert.equal(noon.getHours(), 12);
  });
});

describe("addDays", () => {
  it("月・年をまたいで加減算できる", () => {
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2027-01-01", -1), "2026-12-31");
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  });
});

describe("weekKeys", () => {
  it("月曜始まりの7日分を返す", () => {
    // 2026-10-21 は水曜
    assert.deepEqual(weekKeys("2026-10-21"), [
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("日曜は前の月曜から始まる週に入る", () => {
    assert.equal(weekKeys("2026-10-25")[0], "2026-10-19");
  });
});

describe("monthWeeks", () => {
  it("7日×N週に揃え、月の全日を含む", () => {
    const weeks = monthWeeks(2026, 9);
    assert.ok(weeks.every((week) => week.length === 7));
    const days = weeks.flat();
    assert.ok(days.includes("2026-10-01"));
    assert.ok(days.includes("2026-10-31"));
    assert.equal(days[0], "2026-09-28");
  });
});

describe("formatDateLabel", () => {
  it("月日と曜日を返す", () => {
    assert.equal(formatDateLabel("2026-10-21"), "10月21日(水)");
    assert.equal(formatDateLabel("2026-10-24"), "10月24日(土)");
  });
});
