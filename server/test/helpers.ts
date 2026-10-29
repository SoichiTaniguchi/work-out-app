import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Database } from "better-sqlite3";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/open.js";
import {
  emptyChanges,
  type SyncChanges,
  type SyncDailyLog,
  type SyncExercise,
  type SyncFolder,
  type SyncPersonalRecord,
  type SyncResponse,
  type SyncUser,
  type SyncWorkoutLog,
} from "../src/sync/types.js";

export interface TestServer {
  db: Database;
  baseUrl: string;
  close: () => Promise<void>;
}

// テストごとにインメモリDBの使い捨てサーバーを立てる。
export async function startTestServer(options: { syncToken?: string } = {}): Promise<TestServer> {
  const db = openDatabase(":memory:");
  const server = createApp({ db, syncToken: options.syncToken }).listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = server.address() as AddressInfo;

  return {
    db,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          db.close();
          resolve();
        });
      }),
  };
}

export function changes(partial: Partial<SyncChanges>): SyncChanges {
  return { ...emptyChanges(), ...partial };
}

export interface SyncResult {
  status: number;
  body: SyncResponse & { error?: string };
}

export async function postSync(
  baseUrl: string,
  body: unknown,
  init: { token?: string } = {}
): Promise<SyncResult> {
  const response = await fetch(`${baseUrl}/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

  return { status: response.status, body: (await response.json()) as SyncResult["body"] };
}

export const ALICE = "u1";

export function user(
  id: string,
  name: string,
  updatedAt: string,
  deletedAt: string | null = null
): SyncUser {
  return { id, name, updatedAt, deletedAt };
}

export function exercise(
  id: string,
  name: string,
  updatedAt: string,
  deletedAt: string | null = null
): SyncExercise {
  return {
    id,
    userId: ALICE,
    name,
    bodyParts: ["胸"],
    equipment: "バーベル",
    fieldDefinition: ["weight", "reps"],
    updatedAt,
    deletedAt,
  };
}

export function folder(
  id: string,
  name: string,
  exerciseIds: string[],
  updatedAt: string,
  deletedAt: string | null = null
): SyncFolder {
  return { id, userId: ALICE, name, order: 0, exerciseIds, updatedAt, deletedAt };
}

export function workoutLog(
  id: string,
  exerciseId: string,
  updatedAt: string,
  sets: { weight: number; reps: number }[],
  deletedAt: string | null = null
): SyncWorkoutLog {
  return {
    id,
    exerciseId,
    date: "2026-10-18T09:00:00.000Z",
    completed: true,
    sets,
    updatedAt,
    deletedAt,
  };
}

export function personalRecord(
  id: string,
  exerciseId: string,
  value: number,
  updatedAt: string,
  deletedAt: string | null = null
): SyncPersonalRecord {
  return {
    id,
    exerciseId,
    type: "maxWeight",
    value,
    achievedAt: updatedAt,
    updatedAt,
    deletedAt,
  };
}

export function dailyLog(
  id: string,
  date: string,
  weight: number | null,
  updatedAt: string,
  options: { condition?: number | null; bowelMoved?: boolean | null; deletedAt?: string | null } = {}
): SyncDailyLog {
  return {
    id,
    userId: ALICE,
    date,
    weight,
    condition: options.condition ?? null,
    bowelMoved: options.bowelMoved ?? null,
    updatedAt,
    deletedAt: options.deletedAt ?? null,
  };
}
