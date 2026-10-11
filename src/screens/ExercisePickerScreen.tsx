import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { Exercise } from "@/types";
import {
  addExerciseToFolder,
  createExercise,
  listExercisesByFolder,
  listExercisesByUser,
} from "@/db/exercises";
import { getFolder } from "@/db/folders";
import { FIELD_CONFIG } from "@/constants/recordFields";
import { PRESET_GROUPS, type PresetExercise } from "@/constants/presetExercises";

type Props = NativeStackScreenProps<RootStackParamList, "ExercisePicker">;

function fieldSummary(preset: PresetExercise): string {
  return preset.fieldDefinition.map((f) => FIELD_CONFIG[f].label).join(" × ");
}

export default function ExercisePickerScreen({ navigation, route }: Props) {
  const { folderId } = route.params;
  const db = useSQLiteContext();

  const [userId, setUserId] = useState<string | null>(null);
  const [attached, setAttached] = useState<Exercise[]>([]);
  const [ownExercises, setOwnExercises] = useState<Exercise[]>([]);

  const reload = useCallback(async () => {
    const folder = await getFolder(db, folderId);
    if (!folder) return;
    const [inFolder, all] = await Promise.all([
      listExercisesByFolder(db, folderId),
      listExercisesByUser(db, folder.userId),
    ]);
    setUserId(folder.userId);
    setAttached(inFolder);
    setOwnExercises(all);
  }, [db, folderId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", reload);
    return unsubscribe;
  }, [navigation, reload]);

  const attachedNames = new Set(attached.map((e) => e.name));
  const candidates = ownExercises.filter((e) => !attached.some((a) => a.id === e.id));

  const addExisting = async (exerciseId: string) => {
    await addExerciseToFolder(db, folderId, exerciseId);
    await reload();
  };

  const addPreset = async (preset: PresetExercise) => {
    if (!userId) return;
    await createExercise(
      db,
      {
        userId,
        name: preset.name,
        bodyParts: preset.bodyParts,
        equipment: preset.equipment,
        fieldDefinition: preset.fieldDefinition,
      },
      { folderId }
    );
    await reload();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>種目を追加</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          style={styles.manualRow}
          onPress={() => navigation.navigate("ExerciseEdit", { folderId })}
        >
          <Text style={styles.manualText}>+ 自分で入力して作成</Text>
        </Pressable>

        {candidates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>自分の種目から選ぶ</Text>
            {candidates.map((exercise) => (
              <Pressable
                key={exercise.id}
                style={styles.row}
                onPress={() => addExisting(exercise.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{exercise.name}</Text>
                  <Text style={styles.rowMeta}>
                    {exercise.fieldDefinition.map((f) => FIELD_CONFIG[f].label).join(" × ")}
                  </Text>
                </View>
                <Text style={styles.rowAdd}>+ 追加</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プリセットから追加</Text>
          {PRESET_GROUPS.map((group) => (
            <View key={group.bodyPart} style={styles.group}>
              <Text style={styles.groupTitle}>{group.bodyPart}</Text>
              {group.exercises.map((preset) => {
                const alreadyAdded = attachedNames.has(preset.name);
                return (
                  <Pressable
                    key={preset.name}
                    style={[styles.row, alreadyAdded && styles.rowDisabled]}
                    disabled={alreadyAdded}
                    onPress={() => addPreset(preset)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, alreadyAdded && styles.rowNameDisabled]}>
                        {preset.name}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {preset.equipment} · {fieldSummary(preset)}
                      </Text>
                    </View>
                    <Text style={alreadyAdded ? styles.rowAdded : styles.rowAdd}>
                      {alreadyAdded ? "追加済み" : "+ 追加"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
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
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  manualRow: {
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    borderRadius: 10,
  },
  manualText: { color: colors.link, fontSize: 14, fontWeight: "600" },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  group: { gap: 6, marginTop: 4 },
  groupTitle: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowDisabled: { backgroundColor: colors.surface, borderColor: colors.surface },
  rowName: { fontSize: 14, color: colors.textPrimary },
  rowNameDisabled: { color: colors.textFaint },
  rowMeta: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  rowAdd: { fontSize: 12, color: colors.link, fontWeight: "600" },
  rowAdded: { fontSize: 12, color: colors.textFaint },
});
