import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { startRestTimerActivity, endRestTimerActivity } from "@/native/RestTimerActivity";

type Props = NativeStackScreenProps<RootStackParamList, "Record">;

interface SetRow {
  weight: string;
  reps: string;
  done: boolean;
}

export default function RecordScreen({ navigation }: Props) {
  // TODO: exerciseId から前回記録・記録項目定義をDBから取得する
  const [sets, setSets] = useState<SetRow[]>([
    { weight: "60", reps: "10", done: true },
    { weight: "60", reps: "9", done: true },
    { weight: "60", reps: "", done: false },
  ]);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);

  const completeSet = (index: number) => {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, done: true } : s)));
    // 休憩タイマー開始: アプリを閉じてもDynamic Island/ロック画面で継続表示させる
    const seconds = 90;
    setRestSeconds(seconds);
    startRestTimerActivity({
      exerciseName: "ベンチプレス",
      durationSeconds: seconds,
    });
  };

  const finishExercise = () => {
    endRestTimerActivity();
    navigation.navigate("Home", { userId: "u1" });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>ベンチプレス</Text>
      </View>

      <Text style={styles.lastRecord}>前回: 60kg × 10回 × 3set（9/18）</Text>

      <View style={styles.sets}>
        <View style={styles.setHeaderRow}>
          <Text style={styles.setHeaderCell}>SET</Text>
          <Text style={styles.setHeaderCell}>重量(kg)</Text>
          <Text style={styles.setHeaderCell}>回数</Text>
          <View style={{ width: 32 }} />
        </View>
        {sets.map((set, i) => (
          <View key={i} style={styles.setRow}>
            <Text style={styles.setIndex}>{i + 1}</Text>
            <Text style={styles.setInput}>{set.weight}</Text>
            <Text style={styles.setInput}>{set.reps || "-"}</Text>
            <Pressable
              style={[styles.checkButton, set.done && styles.checkButtonDone]}
              onPress={() => completeSet(i)}
            >
              {set.done && <Text style={styles.checkMark}>✓</Text>}
            </Pressable>
          </View>
        ))}
      </View>

      {restSeconds !== null && (
        <View style={styles.restBar}>
          <Text style={styles.restLabel}>休憩中</Text>
          <Text style={styles.restTime}>{Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}</Text>
          <Pressable onPress={() => setRestSeconds(null)}>
            <Text style={styles.restSkip}>スキップ</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.finishButton} onPress={finishExercise}>
        <Text style={styles.finishButtonText}>この種目を完了</Text>
      </Pressable>
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
  lastRecord: { padding: 14, paddingHorizontal: 20, backgroundColor: colors.surface, fontSize: 12, color: colors.textSecondary },
  sets: { padding: 20, gap: 10, flex: 1 },
  setHeaderRow: { flexDirection: "row", gap: 8 },
  setHeaderCell: { flex: 1, fontSize: 11, color: colors.textMuted },
  setRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  setIndex: { width: 36, textAlign: "center", fontSize: 13, color: colors.textPrimary },
  setInput: {
    flex: 1,
    textAlign: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.textPrimary,
  },
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
  checkMark: { color: "#fff", fontSize: 12 },
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
