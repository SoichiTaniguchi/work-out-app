import React, { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { RecordFieldType } from "@/types";
import { createExercise, deleteExercise, getExercise, updateExercise } from "@/db/exercises";
import { getFolder } from "@/db/folders";
import { BODY_PARTS } from "@/constants/presetExercises";

type Props = NativeStackScreenProps<RootStackParamList, "ExerciseEdit">;

const FIELD_OPTIONS: { key: RecordFieldType; label: string }[] = [
  { key: "weight", label: "重量" },
  { key: "reps", label: "回数" },
  { key: "time", label: "時間" },
  { key: "distance", label: "距離" },
  { key: "rpe", label: "RPE" },
];

export default function ExerciseEditScreen({ navigation, route }: Props) {
  const { exerciseId, duplicateFromId, folderId, initialBodyPart } = route.params ?? {};
  const isEdit = !!exerciseId;
  const db = useSQLiteContext();

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bodyParts, setBodyParts] = useState<string[]>(initialBodyPart ? [initialBodyPart] : []);
  const [equipment, setEquipment] = useState("");
  const [fields, setFields] = useState<Set<RecordFieldType>>(new Set(["weight", "reps"]));

  useEffect(() => {
    (async () => {
      if (exerciseId) {
        const exercise = await getExercise(db, exerciseId);
        if (exercise) {
          setUserId(exercise.userId);
          setName(exercise.name);
          setBodyParts(exercise.bodyParts);
          setEquipment(exercise.equipment);
          setFields(new Set(exercise.fieldDefinition));
        }
      } else if (duplicateFromId) {
        const source = await getExercise(db, duplicateFromId);
        if (source) {
          setUserId(source.userId);
          setName(`${source.name} のコピー`);
          setBodyParts(source.bodyParts);
          setEquipment(source.equipment);
          setFields(new Set(source.fieldDefinition));
        }
      } else if (folderId) {
        const folder = await getFolder(db, folderId);
        setUserId(folder?.userId ?? null);
      }
      setReady(true);
    })();
  }, [db, exerciseId, duplicateFromId, folderId]);

  const toggleBodyPart = (part: string) => {
    setBodyParts((prev) =>
      prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
    );
  };

  const toggleField = (key: RecordFieldType) => {
    setFields((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim() || !userId || fields.size === 0) {
      Alert.alert("入力エラー", "種目名と記録項目(1つ以上)を入力してください。");
      return;
    }

    const input = {
      userId,
      name: name.trim(),
      bodyParts,
      equipment: equipment.trim(),
      fieldDefinition: FIELD_OPTIONS.map((o) => o.key).filter((k) => fields.has(k)),
    };

    if (isEdit && exerciseId) {
      await updateExercise(db, exerciseId, input);
    } else {
      await createExercise(db, input, { folderId });
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    if (!exerciseId) return;
    Alert.alert("種目を削除", `「${name}」を削除しますか?(全てのプログラムから削除されます)`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          await deleteExercise(db, exerciseId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!ready) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>{isEdit ? "種目を編集" : "種目を追加"}</Text>
        <Pressable onPress={handleSave}>
          <Text style={styles.save}>保存</Text>
        </Pressable>
      </View>

      <View style={styles.form}>
        <View>
          <Text style={styles.label}>種目名</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例: ベンチプレス" />
        </View>

        <View>
          <Text style={styles.label}>部位(複数選択可)</Text>
          <View style={styles.pillRow}>
            {BODY_PARTS.map((part) => {
              const selected = bodyParts.includes(part);
              return (
                <Pressable
                  key={part}
                  style={[styles.pill, selected && styles.pillSelected]}
                  onPress={() => toggleBodyPart(part)}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{part}</Text>
                </Pressable>
              );
            })}
          </View>
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

        {isEdit && (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>この種目を削除</Text>
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
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { fontSize: 13, color: colors.textSecondary },
  pillTextSelected: { color: "#fff", fontWeight: "600" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: "#fff", fontSize: 13 },
  checkLabel: { fontSize: 14, color: colors.textPrimary },
  deleteButton: { alignItems: "center", paddingVertical: 12 },
  deleteButtonText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
});
