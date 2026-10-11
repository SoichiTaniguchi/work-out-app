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
import { listWorkoutLogsSince, markWorkoutLogCompleted } from "@/db/logs";
import { startOfTodayIso } from "@/utils/dateRange";

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
  const [folderName, setFolderName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [todayStatus, setTodayStatus] = useState<
    Record<string, { sets: number; completed: boolean }>
  >({});
  const { exercises, reload, reorder, deletePermanently } = useFolderExercises(folderId);

  const reloadToday = useCallback(async () => {
    if (!userId) return;
    const logs = await listWorkoutLogsSince(db, userId, startOfTodayIso());
    const status: Record<string, { sets: number; completed: boolean }> = {};
    for (const log of logs) {
      const current = status[log.exerciseId];
      status[log.exerciseId] = {
        sets: (current?.sets ?? 0) + log.sets.length,
        completed: (current?.completed ?? false) || log.completed,
      };
    }
    setTodayStatus(status);
  }, [db, userId]);

  useEffect(() => {
    reloadToday();
  }, [reloadToday]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      reload();
      reloadToday();
    });
    return unsubscribe;
  }, [navigation, reload, reloadToday]);

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
      return;
    }

    Alert.alert(
      "実施中の種目があります",
      `${pending.map((log) => log.exerciseName).join("、")} が実施中です(「この種目を完了」を押していません)。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "そのまま終了",
          onPress: () => navigation.navigate("Summary", { userId }),
        },
        {
          text: "すべて完了にする",
          onPress: async () => {
            for (const log of pending) {
              await markWorkoutLogCompleted(db, log.id);
            }
            await reloadToday();
            navigation.navigate("Summary", { userId });
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
    const status = todayStatus[item.id];
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
      onPress={() => navigation.navigate("Record", { exerciseId: item.id })}
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
          {done
            ? `今日 ${status!.sets}セット完了(タップで追加)`
            : inProgress
              ? `今日 ${status!.sets}セット記録中(タップで続ける)`
              : `記録項目: ${item.fieldDefinition.map((f) => FIELD_LABELS[f]).join(" × ")}`}
        </Text>
      </View>
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
        <Text style={styles.title}>{folderName}</Text>
      </View>

      <DraggableFlatList
        contentContainerStyle={styles.list}
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => reorder(data.map((e) => e.id))}
        ListEmptyComponent={<Text style={styles.empty}>まだ種目がありません</Text>}
        ListFooterComponent={
          <>
            <Pressable
              style={styles.addRow}
              onPress={() => navigation.navigate("ExercisePicker", { folderId })}
            >
              <Text style={styles.addText}>+ 種目を追加</Text>
            </Pressable>

            {userId && (
              <Pressable style={styles.finishRow} onPress={finishWorkout}>
                <Text style={styles.finishText}>今日のトレーニングを終了</Text>
              </Pressable>
            )}
          </>
        }
      />
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
  list: { padding: 20, gap: 10 },
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
    marginTop: 8,
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
