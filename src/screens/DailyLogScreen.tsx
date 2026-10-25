import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { getDailyLog, getLatestWeightBefore, saveDailyLog } from "@/db/dailyLogs";
import { formatDateLabel } from "@/utils/dateRange";

type Props = NativeStackScreenProps<RootStackParamList, "DailyLog">;

const WEIGHT_STEP = 0.1;
const CONDITION_LABELS = ["とても悪い", "悪い", "ふつう", "良い", "とても良い"];
const FALLBACK_WEIGHT = 60;

// 体重は小数1桁で扱う(浮動小数点の誤差を表示に出さない)
function roundWeight(value: number): number {
  return Math.round(value * 10) / 10;
}

export default function DailyLogScreen({ navigation, route }: Props) {
  const { userId, date } = route.params;
  const db = useSQLiteContext();

  const [loaded, setLoaded] = useState(false);
  // null は「未入力」。前回値は表示にだけ使い、触るまで保存対象にしない(差分入力と同じ扱い)。
  const [weight, setWeight] = useState<number | null>(null);
  const [previousWeight, setPreviousWeight] = useState<number | null>(null);
  const [condition, setCondition] = useState<number | null>(null);
  const [bowelMoved, setBowelMoved] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [current, previous] = await Promise.all([
        getDailyLog(db, userId, date),
        getLatestWeightBefore(db, userId, date),
      ]);
      if (cancelled) return;
      setWeight(current?.weight ?? null);
      setCondition(current?.condition ?? null);
      setBowelMoved(current?.bowelMoved ?? null);
      setPreviousWeight(previous);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, date]);

  // 未入力のまま ± を押したときは前回値(無ければ既定値)から始める
  function stepWeight(delta: number) {
    const base = weight ?? previousWeight ?? FALLBACK_WEIGHT;
    setWeight(roundWeight(Math.max(0, base + delta)));
  }

  async function save() {
    await saveDailyLog(db, userId, date, {
      weight,
      condition,
      bowelMoved,
    });
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>✕</Text>
        </Pressable>
        <Text style={styles.title}>体重・体調・排便</Text>
        <View style={{ width: 18 }} />
      </View>
      <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 体重 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>体重</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepButton} onPress={() => stepWeight(-WEIGHT_STEP)} hitSlop={8}>
              <Text style={styles.stepText}>−0.1</Text>
            </Pressable>
            <View style={styles.valueBox}>
              {weight !== null ? (
                <Text style={styles.valueText}>{weight.toFixed(1)} kg</Text>
              ) : (
                <Text style={styles.placeholderText}>
                  {previousWeight !== null ? `前回 ${previousWeight.toFixed(1)} kg` : "未入力"}
                </Text>
              )}
            </View>
            <Pressable style={styles.stepButton} onPress={() => stepWeight(WEIGHT_STEP)} hitSlop={8}>
              <Text style={styles.stepText}>+0.1</Text>
            </Pressable>
          </View>
        </View>

        {/* 体調 5段階 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>体調</Text>
          <View style={styles.conditionRow}>
            {CONDITION_LABELS.map((label, index) => {
              const level = index + 1;
              const selected = condition === level;
              return (
                <Pressable
                  key={level}
                  style={[styles.conditionButton, selected && styles.conditionButtonSelected]}
                  onPress={() => setCondition(level)}
                >
                  <Text style={[styles.conditionNumber, selected && styles.selectedText]}>{level}</Text>
                  <Text style={[styles.conditionLabel, selected && styles.selectedText]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 排便 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>排便</Text>
          <View style={styles.segment}>
            <Pressable
              style={[styles.segmentItem, bowelMoved === true && styles.segmentItemSelected]}
              onPress={() => setBowelMoved(true)}
            >
              <Text style={[styles.segmentText, bowelMoved === true && styles.selectedText]}>あり</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentItem, bowelMoved === false && styles.segmentItemSelected]}
              onPress={() => setBowelMoved(false)}
            >
              <Text style={[styles.segmentText, bowelMoved === false && styles.selectedText]}>なし</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.hint}>
          触った項目だけが保存されます。前回の体重は表示のみで、保存はされません。
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.saveButton} onPress={save} disabled={!loaded}>
          <Text style={styles.saveButtonText}>保存</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  back: { fontSize: 18, color: colors.textSecondary },
  title: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  dateLabel: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 20, marginBottom: 8 },
  content: { padding: 20, gap: 24 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepButton: {
    width: 64,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
  valueBox: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, fontVariant: ["tabular-nums"] },
  placeholderText: { fontSize: 14, color: colors.textFaint },
  conditionRow: { flexDirection: "row", gap: 6 },
  conditionButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 8,
    alignItems: "center",
    gap: 2,
  },
  conditionButtonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  conditionNumber: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  conditionLabel: { fontSize: 9, color: colors.textMuted },
  selectedText: { color: "#ffffff" },
  segment: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: "hidden",
  },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 10 },
  segmentItemSelected: { backgroundColor: colors.accent },
  segmentText: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  footer: { padding: 20, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
