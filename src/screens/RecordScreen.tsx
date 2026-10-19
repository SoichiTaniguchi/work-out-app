import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  AppState,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { Exercise, PersonalRecordType, RecordFieldType, SetLog, WorkoutLog } from "@/types";
import { getExercise } from "@/db/exercises";
import {
  getLastWorkoutLog,
  getWorkoutLogSince,
  createWorkoutLog,
  replaceWorkoutLogSets,
  markWorkoutLogCompleted,
} from "@/db/logs";
import { evaluateAndSavePersonalRecords } from "@/db/personalRecords";
import { startRestTimerActivity, endRestTimerActivity } from "@/native/RestTimerActivity";
import { scheduleRestEndNotification, cancelRestEndNotification } from "@/timers/restTimer";
import { FIELD_CONFIG, PR_LABELS } from "@/constants/recordFields";
import { startOfTodayIso } from "@/utils/dateRange";

type Props = NativeStackScreenProps<RootStackParamList, "Record">;

const REST_DURATION_SECONDS = 90;
const DEFAULT_SET_COUNT = 3;

interface SetRowState {
  values: Partial<Record<RecordFieldType, string>>;
  done: boolean;
  // 今日の記録から復元した行。空欄は「記録されていない項目」なので前回値で埋めない。
  recorded?: boolean;
  // 前回値で埋めただけで、まだ触っていない行。入力扱いにしない(未完了表示・離脱警告・記録対象外)。
  prefilled?: boolean;
}

function toValues(set: SetLog | undefined, fields: RecordFieldType[]): SetRowState["values"] {
  const values: SetRowState["values"] = {};
  if (!set) return values;
  for (const field of fields) {
    const value = set[FIELD_CONFIG[field].key];
    if (value !== undefined) values[field] = String(value);
  }
  return values;
}

// 前回の同じセット番号の値、無ければ直前のセットの値で埋めた行を作る
function buildPrefilledRow(
  index: number,
  last: WorkoutLog | null,
  fields: RecordFieldType[],
  previousRow?: SetRowState
): SetRowState {
  const values = last?.sets[index]
    ? toValues(last.sets[index], fields)
    : previousRow
      ? { ...previousRow.values }
      : {};
  return { values, done: false, prefilled: Object.keys(values).length > 0 };
}

export default function RecordScreen({ navigation, route }: Props) {
  const { exerciseId } = route.params;
  const db = useSQLiteContext();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [lastLog, setLastLog] = useState<WorkoutLog | null>(null);
  const [sets, setSets] = useState<SetRowState[]>([]);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);

  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restEndAtRef = useRef<number | null>(null);
  const notificationIdRef = useRef<string | null>(null);
  // 今日すでに記録済みならそのレコードに追記する。セット完了ごとに保存するので、
  // 連続でチェックしても二重に作らないよう ref で持つ。
  const todayLogIdRef = useRef<string | null>(null);
  // 完了ボタン経由の離脱では beforeRemove の確認を出さない
  const leavingAfterSaveRef = useRef(false);

  useEffect(() => {
    (async () => {
      const todayStart = startOfTodayIso();
      const [ex, last, today] = await Promise.all([
        getExercise(db, exerciseId),
        getLastWorkoutLog(db, exerciseId, todayStart),
        getWorkoutLogSince(db, exerciseId, todayStart),
      ]);

      setExercise(ex);
      setLastLog(last);
      todayLogIdRef.current = today?.id ?? null;

      if (today) {
        // 今日の分は完了済みセットとして復元し、続きを入力できるよう空行を1つ足す
        const recorded: SetRowState[] = today.sets.map((set) => ({
          values: Object.fromEntries(
            (ex?.fieldDefinition ?? [])
              .map((field) => [field, set[FIELD_CONFIG[field].key]] as const)
              .filter(([, value]) => value !== undefined)
              .map(([field, value]) => [field, String(value)])
          ),
          done: true,
          recorded: true,
        }));
        setSets([
          ...recorded,
          buildPrefilledRow(recorded.length, last, ex?.fieldDefinition ?? [], recorded[recorded.length - 1]),
        ]);
      } else {
        const initialCount = last ? last.sets.length : DEFAULT_SET_COUNT;
        const rows: SetRowState[] = [];
        for (let i = 0; i < initialCount; i++) {
          rows.push(buildPrefilledRow(i, last, ex?.fieldDefinition ?? [], rows[i - 1]));
        }
        setSets(rows);
      }
    })();
  }, [db, exerciseId]);

  const clearRestTimer = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    restEndAtRef.current = null;
    setRestSeconds(null);
    cancelRestEndNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    endRestTimerActivity();
  }, []);

  useEffect(() => clearRestTimer, [clearRestTimer]);

  // 残り時間は「終了予定時刻 - 現在時刻」から毎回計算する。バックグラウンド中は
  // setIntervalがOSに一時停止されるため、単純にカウントダウンする実装だと復帰後に
  // 表示がずれる(止まっていた分だけ多く残っているように見える)。
  const tickRestTimer = useCallback(() => {
    const endAt = restEndAtRef.current;
    if (endAt === null) return;

    const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    setRestSeconds(remaining);

    if (remaining <= 0) {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
      restEndAtRef.current = null;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tickRestTimer();
    });
    return () => subscription.remove();
  }, [tickRestTimer]);

  const startRestTimer = useCallback(() => {
    clearRestTimer();
    restEndAtRef.current = Date.now() + REST_DURATION_SECONDS * 1000;
    setRestSeconds(REST_DURATION_SECONDS);
    restIntervalRef.current = setInterval(tickRestTimer, 1000);

    const exerciseName = exercise?.name ?? "";
    scheduleRestEndNotification(exerciseName, REST_DURATION_SECONDS).then((id) => {
      notificationIdRef.current = id;
    });
    startRestTimerActivity({ exerciseName, durationSeconds: REST_DURATION_SECONDS });
  }, [clearRestTimer, tickRestTimer, exercise]);

  const setFieldValue = (index: number, field: RecordFieldType, text: string) => {
    setSets((prev) =>
      prev.map((row, i) => (i === index ? { ...row, values: { ...row.values, [field]: text }, prefilled: false } : row))
    );
  };

  const stepField = (index: number, field: RecordFieldType, delta: number) => {
    const config = FIELD_CONFIG[field];
    setSets((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const previousValue = lastLog?.sets[index]?.[config.key];
        const current = row.values[field];
        const base = current && current.trim() !== "" ? Number(current) : previousValue ?? 0;
        const next = Math.max(0, (Number.isNaN(base) ? 0 : base) + delta);
        return { ...row, values: { ...row.values, [field]: String(next) }, prefilled: false };
      })
    );
  };

  // チェック済み、または何か入力されている行を記録対象にする。
  // チェックを忘れたまま完了しても入力が捨てられないようにするため。
  const hasInput = (row: SetRowState) =>
    !row.prefilled &&
    (exercise?.fieldDefinition ?? []).some((field) => (row.values[field] ?? "").trim() !== "");

  const buildSets = (rows: SetRowState[]): SetLog[] => {
    if (!exercise) return [];
    return rows
      .map((row, originalIndex) => {
        if (!row.done && !hasInput(row)) return null;
        const set: SetLog = {};
        for (const field of exercise.fieldDefinition) {
          const config = FIELD_CONFIG[field];
          const raw = row.values[field];
          const previousValue = lastLog?.sets[originalIndex]?.[config.key];
          let value: number | undefined;
          if (raw !== undefined && raw.trim() !== "") {
            const parsed = Number(raw);
            value = Number.isNaN(parsed) ? undefined : parsed;
          } else if (!row.recorded) {
            value = previousValue;
          }
          if (value !== undefined) {
            (set as Record<string, number>)[config.key] = value;
          }
        }
        return set;
      })
      .filter((s): s is SetLog => s !== null);
  };

  const persist = async (rows: SetRowState[]): Promise<SetLog[]> => {
    const resolved = buildSets(rows);
    if (resolved.length === 0) return resolved;

    if (todayLogIdRef.current) {
      await replaceWorkoutLogSets(db, todayLogIdRef.current, resolved);
    } else {
      const created = await createWorkoutLog(
        db,
        exerciseId,
        new Date().toISOString(),
        resolved
      );
      todayLogIdRef.current = created.id;
    }
    return resolved;
  };

  const completeSet = async (index: number) => {
    if (sets[index]?.done) return;
    const nextSets = sets.map((row, i) => (i === index ? { ...row, done: true } : row));
    setSets(nextSets);
    await persist(nextSets);
    startRestTimer();
  };

  const addSet = () => {
    setSets((prev) => [
      ...prev,
      buildPrefilledRow(prev.length, lastLog, exercise?.fieldDefinition ?? [], prev[prev.length - 1]),
    ]);
  };

  const handleFinish = async () => {
    if (!exercise) return;

    clearRestTimer();
    const resolvedSets = await persist(sets);
    leavingAfterSaveRef.current = true;

    if (resolvedSets.length === 0) {
      navigation.goBack();
      return;
    }

    if (todayLogIdRef.current) {
      await markWorkoutLogCompleted(db, todayLogIdRef.current);
    }
    const newRecords = await evaluateAndSavePersonalRecords(db, exerciseId, resolvedSets);

    if (newRecords.length > 0) {
      const labels = newRecords.map((r) => PR_LABELS[r.type]).join("・");
      Alert.alert("自己ベスト更新!", `${labels} を更新しました`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  // チェック済みの行は即保存されているので、未保存なのは「未チェックだが入力がある」行だけ
  const unsavedRows = sets.filter((row) => !row.done && hasInput(row)).length;

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (leavingAfterSaveRef.current || unsavedRows === 0) return;
      e.preventDefault();
      Alert.alert(
        "未記録の入力があります",
        `チェックの入っていないセットが${unsavedRows}件あります。`,
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "破棄して戻る",
            style: "destructive",
            onPress: () => {
              leavingAfterSaveRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: "記録して戻る",
            onPress: async () => {
              await persist(sets);
              leavingAfterSaveRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, unsavedRows, sets]);

  if (!exercise) {
    return <View style={styles.container} />;
  }

  const fields = exercise.fieldDefinition;
  const pendingSetCount = buildSets(sets).length;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>{exercise.name}</Text>
        <Pressable
          style={styles.historyLink}
          onPress={() => navigation.navigate("History", { exerciseId })}
        >
          <Text style={styles.historyLinkText}>履歴</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.setsScroll}
        contentContainerStyle={styles.sets}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.setHeaderRow}>
          <Text style={[styles.setHeaderCell, { width: 36 }]}>SET</Text>
          {fields.map((f) => (
            <Text key={f} style={styles.setHeaderCell}>{FIELD_CONFIG[f].label}</Text>
          ))}
          <View style={{ width: 32 }} />
        </View>

        {sets.map((row, i) => {
          const previous = lastLog?.sets[i];
          const pending = !row.done && hasInput(row);
          return (
            <View key={i} style={styles.setRow}>
              <View style={styles.setIndexCell}>
                <Text style={styles.setIndex}>{i + 1}</Text>
                {pending && <Text style={styles.pendingMark}>未完了</Text>}
              </View>
              {fields.map((field) => {
                const config = FIELD_CONFIG[field];
                const previousValue = previous?.[config.key];
                return (
                  <View key={field} style={styles.fieldCell}>
                    <TextInput
                      style={styles.setInput}
                      value={row.values[field] ?? ""}
                      onChangeText={(text) => setFieldValue(i, field, text)}
                      placeholder={previousValue !== undefined ? String(previousValue) : "-"}
                      keyboardType="numeric"
                      editable={!row.done}
                    />
                    {config.step !== undefined && !row.done && (
                      <View style={styles.stepperRow}>
                        <Pressable onPress={() => stepField(i, field, -config.step!)} hitSlop={6}>
                          <Text style={styles.stepperText}>-{config.step}</Text>
                        </Pressable>
                        <Pressable onPress={() => stepField(i, field, config.step!)} hitSlop={6}>
                          <Text style={styles.stepperText}>+{config.step}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
              <Pressable
                style={[
                  styles.checkButton,
                  row.done && styles.checkButtonDone,
                  pending && styles.checkButtonPending,
                ]}
                onPress={() => completeSet(i)}
              >
                {row.done && <Text style={styles.checkMark}>✓</Text>}
              </Pressable>
            </View>
          );
        })}

        <Pressable style={styles.addSetRow} onPress={addSet}>
          <Text style={styles.addSetText}>+ セット追加</Text>
        </Pressable>
      </ScrollView>

      {restSeconds !== null && (
        <View style={styles.restBar}>
          <Text style={styles.restLabel}>休憩中</Text>
          <Text style={styles.restTime}>
            {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
          </Text>
          <Pressable onPress={clearRestTimer}>
            <Text style={styles.restSkip}>スキップ</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.finishButton} onPress={handleFinish}>
        <Text style={styles.finishButtonText}>
          {pendingSetCount > 0
            ? `${pendingSetCount}セットを記録して完了`
            : "記録せずに戻る"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  historyLink: { marginLeft: "auto" },
  historyLinkText: { fontSize: 13, color: colors.link, fontWeight: "600" },
  back: { fontSize: 18, color: colors.textPrimary },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  setsScroll: { flex: 1 },
  sets: { padding: 20, gap: 10 },
  setHeaderRow: { flexDirection: "row", gap: 8 },
  setHeaderCell: { flex: 1, fontSize: 11, color: colors.textMuted },
  setRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  setIndexCell: { width: 36, alignItems: "center" },
  setIndex: { fontSize: 13, color: colors.textPrimary },
  pendingMark: { fontSize: 9, color: colors.warning },
  fieldCell: { flex: 1, gap: 4 },
  setInput: {
    textAlign: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.textPrimary,
  },
  stepperRow: { flexDirection: "row", justifyContent: "space-between" },
  stepperText: { fontSize: 10, color: colors.link },
  checkButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkButtonDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkButtonPending: { borderColor: colors.warning, borderWidth: 2 },
  checkMark: { color: "#fff", fontSize: 12 },
  addSetRow: { alignItems: "center", paddingVertical: 10 },
  addSetText: { color: colors.textMuted, fontSize: 13 },
  restBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  restLabel: { color: "#fff", fontSize: 13 },
  restTime: { color: "#fff", fontSize: 20, fontWeight: "700" },
  restSkip: { color: "#d4d4d8", fontSize: 12 },
  finishButton: {
    margin: 20,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  finishButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
