import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { Exercise } from "@/types";
import { useFolderExercises } from "@/hooks/useFolderExercises";
import { getFolder } from "@/db/folders";
import {
  getLastWorkoutLog,
  listWorkoutLogsOnDay,
  listWorkoutLogsSince,
  markWorkoutLogCompleted,
} from "@/db/logs";
import CollapsibleCalendar from "@/components/CollapsibleCalendar";
import { dayRangeIso, formatDateLabel, startOfTodayIso, todayKey } from "@/utils/dateRange";
import { formatDate, formatSetSummary } from "@/utils/recordFormat";
import { runSyncQuietly } from "@/sync/runSync";

type Props = NativeStackScreenProps<RootStackParamList, "ExerciseList">;

const FIELD_LABELS: Record<string, string> = {
  weight: "重量",
  reps: "回数",
  time: "時間",
  distance: "距離",
  rpe: "RPE",
};

export default function ExerciseListScreen({ navigation, route }: Props) {
  const { folderId } = route.params;
  const db = useSQLiteContext();
  // 記録する日。ホームで選んだ日を引き継ぎ、ここでも週表示で切り替えられる。
  const [dateKey, setDateKey] = useState(route.params.date ?? todayKey());
  const isToday = dateKey === todayKey();
  const [folderName, setFolderName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [dayStatus, setDayStatus] = useState<
    Record<string, { sets: number; completed: boolean; summary: string }>
  >({});
  // 記録がない種目の参考表示用に、選択日より前の最新の記録
  const [previous, setPrevious] = useState<Record<string, string>>({});
  const { exercises, reload, reorder, deletePermanently } = useFolderExercises(folderId);

  const reloadDay = useCallback(async () => {
    if (!userId) return;
    const logs = await listWorkoutLogsOnDay(db, userId, dateKey);
    const status: Record<string, { sets: number; completed: boolean; summary: string }> = {};
    for (const log of logs) {
      const current = status[log.exerciseId];
      const summary = log.sets.map((set) => formatSetSummary(set, log.fieldDefinition)).join(" / ");
      status[log.exerciseId] = {
        sets: (current?.sets ?? 0) + log.sets.length,
        completed: (current?.completed ?? false) || log.completed,
        summary: current ? current.summary + " / " + summary : summary,
      };
    }
    setDayStatus(status);
  }, [db, userId, dateKey]);

  useEffect(() => {
    reloadDay();
  }, [reloadDay]);

  // 前回の日付と最初のセットを参考表示する。選んだ日より前の記録だけを見る。
  useEffect(() => {
    const dayStart = dayRangeIso(dateKey).startIso;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        exercises.map(async (exercise) => {
          const last = await getLastWorkoutLog(db, exercise.id, dayStart);
          const first = last?.sets[0];
          return [
            exercise.id,
            last && first
              ? "前回 " + formatDate(last.date) + " " + formatSetSummary(first, exercise.fieldDefinition)
              : "",
          ] as const;
        })
      );
      if (!cancelled) setPrevious(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, exercises, dateKey]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      reload();
      reloadDay();
    });
    return unsubscribe;
  }, [navigation, reload, reloadDay]);

  useEffect(() => {
    getFolder(db, folderId).then((folder) => {
      setFolderName(folder?.name ?? "");
      setUserId(folder?.userId ?? null);
    });
  }, [db, folderId]);

  // 「この種目を完了」を押し忘れたまま実施中になっている種目は、ここでまとめて完了にできる
  const finishWorkout = async () => {
    if (!userId) return;
    const logs = await listWorkoutLogsSince(db, userId, startOfTodayIso());
    const pending = logs.filter((log) => !log.completed);

    if (pending.length === 0) {
      navigation.navigate("Summary", { userId });
      // サマリーはローカルを見るので待たない。帰宅前にNASへ反映しておくための同期。
      void runSyncQuietly(db, userId);
      return;
    }

    Alert.alert(
      "実施中の種目があります",
      `${pending.map((log) => log.exerciseName).join("、")} を完了にして終了しますか?`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "完了にして終了",
          onPress: async () => {
            for (const log of pending) {
              await markWorkoutLogCompleted(db, log.id);
            }
            await reloadDay();
            navigation.navigate("Summary", { userId });
            void runSyncQuietly(db, userId);
          },
        },
      ]
    );
  };

  const confirmDelete = (exercise: Exercise) => {
    Alert.alert("種目を削除", `「${exercise.name}」を削除しますか?(全てのプログラムから削除されます)`, [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => deletePermanently(exercise.id) },
    ]);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Exercise>) => {
    const status = dayStatus[item.id];
    const done = status?.completed ?? false;
    const inProgress = !!status && !done;
    return (
    <Pressable
      style={[
        styles.row,
        isActive && styles.rowActive,
        inProgress && styles.rowInProgress,
        done && styles.rowDone,
      ]}
      onPress={() => navigation.navigate("Record", { exerciseId: item.id, date: dateKey })}
    >
      <Pressable onPressIn={drag} hitSlop={8}>
        <Text style={styles.handle}>≡</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.exerciseName}>
          {done && <Text style={styles.doneMark}>✓ </Text>}
          {inProgress && <Text style={styles.inProgressMark}>● </Text>}
          {item.name}
        </Text>
        <View style={styles.tags}>
          {[...item.bodyParts, item.equipment].filter(Boolean).map((t) => (
            <Text key={t} style={styles.tag}>{t}</Text>
          ))}
        </View>
        <Text
          style={[styles.last, inProgress && styles.lastInProgress, done && styles.lastDone]}
        >
          {status
            ? `${status.sets}セット${done ? "完了" : "記録中"}: ${status.summary}`
            : previous[item.id] ||
              `記録項目: ${item.fieldDefinition.map((f) => FIELD_LABELS[f]).join(" × ")}`}
        </Text>
      </View>
      {!status && <Text style={styles.plus}>＋</Text>}
      <Pressable
        style={styles.iconButton}
        hitSlop={8}
        onPress={() => navigation.navigate("ExerciseEdit", { exerciseId: item.id, folderId })}
      >
        <Text style={styles.iconText}>✎</Text>
      </Pressable>
      <Pressable
        style={styles.iconButton}
        hitSlop={8}
        onPress={() => navigation.navigate("History", { exerciseId: item.id })}
      >
        <Text style={styles.iconText}>📈</Text>
      </Pressable>
      <Pressable style={styles.iconButton} hitSlop={8} onPress={() => confirmDelete(item)}>
        <Text style={styles.iconText}>🗑</Text>
      </Pressable>
    </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>{folderName}</Text>
          <Text style={styles.dateHeading}>{formatDateLabel(dateKey)}の記録</Text>
        </View>
      </View>
      {userId && (
        <View style={styles.calendar}>
          <CollapsibleCalendar
            userId={userId}
            selected={dateKey}
            onSelect={setDateKey}
            expandable={false}
          />
        </View>
      )}

      <DraggableFlatList
        // ライブラリは内部のFlatListを高さ未指定のViewで包むため、flex:1を渡さないと
        // 種目が増えたときにリストが画面より伸び、下のフッターが画面外に出る。
        containerStyle={{ flex: 1 }}
        contentContainerStyle={styles.list}
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => reorder(data.map((e) => e.id))}
        ListEmptyComponent={<Text style={styles.empty}>まだ種目がありません</Text>}
      />

      <View style={styles.footer}>
        <Pressable
          style={styles.addRow}
          onPress={() => navigation.navigate("ExercisePicker", { folderId })}
        >
          <Text style={styles.addText}>+ 種目を追加</Text>
        </Pressable>

        {userId && isToday && (
          <Pressable style={styles.finishRow} onPress={finishWorkout}>
            <Text style={styles.finishText}>今日のトレーニングを終了</Text>
          </Pressable>
        )}
      </View>
    </View>
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
  back: { fontSize: 18, color: colors.textPrimary },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  dateHeading: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  calendar: { paddingHorizontal: 20, paddingTop: 12 },
  plus: { fontSize: 20, color: colors.link, paddingHorizontal: 4 },
  list: { padding: 20, gap: 10 },
  // Pinned below the list so the buttons stay reachable with many exercises.
  footer: {
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.background,
  },
  rowActive: { borderColor: colors.borderStrong },
  rowDone: { borderColor: colors.success, backgroundColor: colors.surface },
  rowInProgress: { borderColor: colors.warning },
  doneMark: { color: colors.success, fontWeight: "700" },
  inProgressMark: { color: colors.warning, fontWeight: "700" },
  handle: { color: colors.textFaint, width: 16 },
  exerciseName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: {
    backgroundColor: colors.border,
    borderRadius: 6,
    color: colors.textSecondary,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  last: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  lastDone: { color: colors.success },
  lastInProgress: { color: colors.warning },
  iconButton: { paddingHorizontal: 4 },
  iconText: { fontSize: 16, color: colors.textMuted },
  empty: { textAlign: "center", color: colors.textFaint, fontSize: 13, paddingVertical: 20 },
  addRow: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    borderRadius: 12,
  },
  addText: { color: colors.textMuted, fontSize: 14 },
  finishRow: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginTop: 10,
    backgroundColor: colors.accent,
    borderRadius: 12,
  },
  finishText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
