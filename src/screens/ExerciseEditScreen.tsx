import React, { useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { RecordFieldType } from "@/types";

type Props = NativeStackScreenProps<RootStackParamList, "ExerciseEdit">;

const FIELD_OPTIONS: { key: RecordFieldType; label: string }[] = [
  { key: "weight", label: "重量" },
  { key: "reps", label: "回数" },
  { key: "time", label: "時間" },
  { key: "distance", label: "距離" },
  { key: "rpe", label: "RPE" },
];

export default function ExerciseEditScreen({ navigation, route }: Props) {
  const isEdit = !!route.params?.exerciseId;
  const [name, setName] = useState(isEdit ? "ベンチプレス" : "");
  const [equipment, setEquipment] = useState(isEdit ? "バーベル" : "");
  const [fields, setFields] = useState<Set<RecordFieldType>>(new Set(["weight", "reps"]));

  const toggleField = (key: RecordFieldType) => {
    setFields((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>{isEdit ? "種目を編集" : "種目を追加"}</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.save}>保存</Text>
        </Pressable>
      </View>

      <View style={styles.form}>
        <View>
          <Text style={styles.label}>種目名</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例: ベンチプレス" />
        </View>
        <View>
          <Text style={styles.label}>使用器具</Text>
          <TextInput style={styles.input} value={equipment} onChangeText={setEquipment} placeholder="例: バーベル" />
        </View>
        <View>
          <Text style={styles.label}>記録する項目(複数選択可)</Text>
          {FIELD_OPTIONS.map((opt) => (
            <Pressable key={opt.key} style={styles.checkRow} onPress={() => toggleField(opt.key)}>
              <View style={[styles.checkbox, fields.has(opt.key) && styles.checkboxOn]}>
                {fields.has(opt.key) && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  close: { fontSize: 18, color: colors.textPrimary },
  title: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  save: { fontSize: 14, fontWeight: "700", color: colors.link },
  form: { padding: 20, gap: 18 },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: "#fff", fontSize: 13 },
  checkLabel: { fontSize: 14, color: colors.textPrimary },
});
