import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { Exercise, RecordFieldType } from "@/types";
import {
  addExerciseToFolder,
  createExercise,
  deleteExercise,
  listExercisesByFolder,
  listExercisesByUser,
} from "@/db/exercises";
import { getFolder } from "@/db/folders";
import { FIELD_CONFIG } from "@/constants/recordFields";
import { BODY_PARTS, PRESET_GROUPS, type PresetExercise } from "@/constants/presetExercises";

type Props = NativeStackScreenProps<RootStackParamList, "ExercisePicker">;

const OTHER = "その他";

interface Row {
  key: string;
  name: string;
  equipment: string;
  fieldDefinition: RecordFieldType[];
  // 自分の種目は削除でき、プリセットは選ぶと新規作成される
  own: Exercise | null;
  preset: PresetExercise | null;
  inFolder: boolean;
}

function fieldSummary(fields: RecordFieldType[]): string {
  return fields.map((f) => FIELD_CONFIG[f].label).join(" × ");
}

export default function ExercisePickerScreen({ navigation, route }: Props) {
  const { folderId } = route.params;
  const db = useSQLiteContext();

  const [userId, setUserId] = useState<string | null>(null);
  const [attached, setAttached] = useState<Exercise[]>([]);
  const [ownExercises, setOwnExercises] = useState<Exercise[]>([]);
  const [selectedPart, setSelectedPart] = useState(BODY_PARTS[0]);

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

  // プリセット9部位 + ユーザーが独自に付けた部位(例: 腕を二頭/三頭に分けた場合)
  const customParts = [
    ...new Set(
      ownExercises.flatMap((e) => e.bodyParts.filter((part) => !BODY_PARTS.includes(part)))
    ),
  ];
  // どのピルにも該当しない = 部位が未設定の種目だけを「その他」に寄せる
  const hasOther = ownExercises.some((e) => e.bodyParts.length === 0);
  const parts = [...BODY_PARTS, ...customParts, ...(hasOther ? [OTHER] : [])];

  const ownForPart = ownExercises.filter((e) =>
    selectedPart === OTHER ? e.bodyParts.length === 0 : e.bodyParts.includes(selectedPart)
  );
  const presetsForPart =
    PRESET_GROUPS.find((g) => g.bodyPart === selectedPart)?.exercises ?? [];

  const attachedIds = new Set(attached.map((e) => e.id));
  const ownNames = new Set(ownExercises.map((e) => e.name));

  const rows: Row[] = [
    ...ownForPart.map((exercise) => ({
      key: exercise.id,
      name: exercise.name,
      equipment: exercise.equipment,
      fieldDefinition: exercise.fieldDefinition,
      own: exercise,
      preset: null,
      inFolder: attachedIds.has(exercise.id),
    })),
    // 同名の自分の種目が既にある場合はプリセット側を出さない(二重に見えるのを避ける)
    ...presetsForPart
      .filter((preset) => !ownNames.has(preset.name))
      .map((preset) => ({
        key: `preset:${preset.name}`,
        name: preset.name,
        equipment: preset.equipment,
        fieldDefinition: preset.fieldDefinition,
        own: null,
        preset,
        inFolder: false,
      })),
  ];

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

  const confirmDelete = (exercise: Exercise) => {
    Alert.alert(
      "種目を削除",
      `「${exercise.name}」を削除しますか?(全てのプログラムと記録から削除されます)`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            await deleteExercise(db, exercise.id);
            await reload();
          },
        },
      ]
    );
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

      <View style={styles.partRow}>
        {parts.map((part) => {
          const selected = part === selectedPart;
          return (
            <Pressable
              key={part}
              style={[styles.pill, selected && styles.pillSelected]}
              onPress={() => setSelectedPart(part)}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{part}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {rows.map((row) => (
          <View key={row.key} style={[styles.row, row.inFolder && styles.rowDisabled]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowName, row.inFolder && styles.rowNameDisabled]}>
                {row.name}
                {row.own && <Text style={styles.ownBadge}> 自分の種目</Text>}
              </Text>
              <Text style={styles.rowMeta}>
                {row.equipment} · {fieldSummary(row.fieldDefinition)}
              </Text>
            </View>

            {row.own && (
              <Pressable
                hitSlop={8}
                onPress={() =>
                  navigation.navigate("ExerciseEdit", { exerciseId: row.own!.id, folderId })
                }
              >
                <Text style={styles.iconButton}>✎</Text>
              </Pressable>
            )}

            {row.own && (
              <Pressable hitSlop={8} onPress={() => confirmDelete(row.own!)}>
                <Text style={styles.iconButton}>🗑</Text>
              </Pressable>
            )}

            {row.inFolder ? (
              <Text style={styles.rowAdded}>追加済み</Text>
            ) : (
              <Pressable
                hitSlop={8}
                onPress={() => (row.own ? addExisting(row.own.id) : addPreset(row.preset!))}
              >
                <Text style={styles.rowAdd}>+ 追加</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Pressable
          style={styles.manualRow}
          onPress={() =>
            navigation.navigate("ExerciseEdit", {
              folderId,
              initialBodyPart: selectedPart === OTHER ? undefined : selectedPart,
            })
          }
        >
          <Text style={styles.manualText}>+ 自分で入力して作成</Text>
        </Pressable>
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
  partRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 20,
    paddingBottom: 12,
  },
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
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowDisabled: { backgroundColor: colors.surface, borderColor: colors.surface },
  rowName: { fontSize: 14, color: colors.textPrimary },
  rowNameDisabled: { color: colors.textFaint },
  ownBadge: { fontSize: 10, color: colors.textFaint },
  rowMeta: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  rowAdd: { fontSize: 12, color: colors.link, fontWeight: "600" },
  rowAdded: { fontSize: 12, color: colors.textFaint },
  iconButton: { fontSize: 14, color: colors.textMuted },
  manualRow: {
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    borderRadius: 10,
  },
  manualText: { color: colors.link, fontSize: 14, fontWeight: "600" },
});
