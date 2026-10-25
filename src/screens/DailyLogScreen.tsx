import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, conditionTint } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { getDailyLog, getLatestWeightBefore, saveDailyLog } from "@/db/dailyLogs";
import { formatDateLabel } from "@/utils/dateRange";
import {
  applyWeightKey,
  formatWeightInput,
  parseWeightInput,
  WEIGHT_KEYS,
  weightInputError,
} from "@/utils/weightInput";

type Props = NativeStackScreenProps<RootStackParamList, "DailyLog">;

const CONDITION_LABELS = ["とても悪い", "悪い", "ふつう", "良い", "とても良い"];

export default function DailyLogScreen({ navigation, route }: Props) {
  const { userId, date } = route.params;
  const db = useSQLiteContext();

  const [loaded, setLoaded] = useState(false);
  // 体重は入力中の文字列で持つ。"" は未入力で、保存の対象にしない。
  const [weightInput, setWeightInput] = useState("");
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
      setWeightInput(formatWeightInput(current?.weight));
      setCondition(current?.condition ?? null);
      setBowelMoved(current?.bowelMoved ?? null);
      setPreviousWeight(previous);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, date]);

  // 範囲外や未完成の入力があるときは保存させない(打ち間違いをそのまま残さないため)
  const weightError = weightInputError(weightInput);

  async function save() {
    if (weightError !== null) return;
    await saveDailyLog(db, userId, date, {
      weight: parseWeightInput(weightInput),
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
        {/* 体重: 数字キーパッドで入力する */}
        <View style={styles.weightDisplay}>
          {weightInput === "" ? (
            <Text style={styles.weightPlaceholder}>-- . -</Text>
          ) : (
            <Text style={styles.weightValue}>{weightInput}</Text>
          )}
          <Text style={styles.weightUnit}>kg</Text>
        </View>

        {/* エラーと前回値は高さを固定した同じ1行に出す。出入りでキーパッドの位置を動かさないため。
            エラーは入力があるとき、前回値は未入力のときだけなので、同時には出ない。 */}
        <View style={styles.messageSlot}>
          {weightError !== null ? (
            <Text style={styles.errorText} numberOfLines={1}>
              {weightError}
            </Text>
          ) : previousWeight !== null && weightInput === "" ? (
            <Pressable
              onPress={() => setWeightInput(formatWeightInput(previousWeight))}
              hitSlop={8}
            >
              <Text style={styles.previousHint} numberOfLines={1}>
                前回 {previousWeight.toFixed(1)} kg（タップで入力）
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.keypad}>
          {WEIGHT_KEYS.map((key) => (
            <Pressable
              key={key}
              style={[styles.key, key === "." && styles.keyFn, key === "del" && styles.keyFn]}
              onPress={() => setWeightInput((prev) => applyWeightKey(prev, key))}
            >
              <Text style={[styles.keyText, (key === "." || key === "del") && styles.keyTextFn]}>
                {key === "del" ? "⌫" : key}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 体調 5段階。選んだ段階はカレンダーと同じ緑で示す */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>体調</Text>
          <View style={styles.conditionRow}>
            {CONDITION_LABELS.map((label, index) => {
              const level = index + 1;
              const selected = condition === level;
              return (
                <Pressable
                  key={level}
                  style={[
                    styles.conditionButton,
                    selected && { backgroundColor: conditionTint(level) ?? colors.surface },
                    selected && styles.conditionButtonSelected,
                  ]}
                  onPress={() => setCondition(level)}
                >
                  <Text style={styles.conditionNumber}>{level}</Text>
                  <Text style={styles.conditionLabel} numberOfLines={1}>
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

        <Text style={styles.hint}>触った項目だけが保存されます。</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, (!loaded || weightError !== null) && styles.saveButtonDisabled]}
          onPress={save}
          disabled={!loaded || weightError !== null}
        >
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
  dateLabel: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 20, marginBottom: 4 },
  content: { padding: 20, paddingTop: 8, gap: 16 },
  weightDisplay: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6 },
  weightValue: {
    fontSize: 40,
    fontWeight: "700",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  weightPlaceholder: { fontSize: 40, fontWeight: "700", color: colors.textFaint },
  weightUnit: { fontSize: 16, color: colors.textMuted },
  previousHint: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
  // 1行分の高さを常に確保しておく(中身が入れ替わってもキーパッドが動かない)
  messageSlot: { height: 20, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 12, color: colors.danger, textAlign: "center" },
  keypad: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  key: {
    width: "31%",
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  keyFn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  keyText: { fontSize: 22, fontWeight: "600", color: colors.textPrimary },
  keyTextFn: { fontSize: 18, color: colors.textSecondary, fontWeight: "500" },
  section: { gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
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
  conditionButtonSelected: { borderColor: colors.accent, borderWidth: 2 },
  conditionNumber: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  conditionLabel: { fontSize: 9, color: colors.textSecondary },
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
  hint: { fontSize: 12, color: colors.textMuted },
  footer: { padding: 20, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveButtonDisabled: { backgroundColor: colors.borderStrong },
  saveButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
