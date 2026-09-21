import React, { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { Exercise } from "@/types";
import { createFolder, deleteFolder, getFolder, updateFolder } from "@/db/folders";
import { listExercisesByUser } from "@/db/exercises";
import { useFolderExercises } from "@/hooks/useFolderExercises";

type Props = NativeStackScreenProps<RootStackParamList, "FolderEdit">;

export default function FolderEditScreen({ navigation, route }: Props) {
  const { folderId, userId } = route.params;
  const db = useSQLiteContext();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderId ?? null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (folderId) {
      getFolder(db, folderId).then((folder) => setName(folder?.name ?? ""));
    }
  }, [db, folderId]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("入力エラー", "プログラム名を入力してください。");
      return;
    }

    if (currentFolderId) {
      await updateFolder(db, currentFolderId, { name: name.trim() });
      navigation.goBack();
    } else {
      const created = await createFolder(db, { userId, name: name.trim() });
      setCurrentFolderId(created.id);
    }
  };

  const handleDelete = () => {
    if (!currentFolderId) return;
    Alert.alert("プログラムを削除", `「${name}」を削除しますか?`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          await deleteFolder(db, currentFolderId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>{currentFolderId ? "プログラムを編集" : "新しいプログラム"}</Text>
        <Pressable onPress={handleSave}>
          <Text style={styles.save}>{currentFolderId ? "保存" : "作成"}</Text>
        </Pressable>
      </View>

      <View style={styles.form}>
        <View>
          <Text style={styles.label}>プログラム名</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例: 背中の日" />
        </View>

        {currentFolderId ? (
          <FolderExercisesSection
            folderId={currentFolderId}
            userId={userId}
            navigation={navigation}
          />
        ) : (
          <Text style={styles.hint}>先にプログラム名を保存すると種目を追加できます</Text>
        )}

        {currentFolderId && (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>このプログラムを削除</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function FolderExercisesSection({
  folderId,
  userId,
  navigation,
}: {
  folderId: string;
  userId: string;
  navigation: Props["navigation"];
}) {
  const { exercises, reload, reorder, removeFromFolder, addExisting } = useFolderExercises(folderId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState<Exercise[]>([]);
  const db = useSQLiteContext();

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", reload);
    return unsubscribe;
  }, [navigation, reload]);

  const openPicker = async () => {
    const all = await listExercisesByUser(db, userId);
    const attachedIds = new Set(exercises.map((e) => e.id));
    setCandidates(all.filter((e) => !attachedIds.has(e.id)));
    setPickerOpen(true);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Exercise>) => (
    <View style={[styles.exerciseRow, isActive && styles.exerciseRowActive]}>
      <Pressable onPressIn={drag} hitSlop={8}>
        <Text style={styles.handle}>≡</Text>
      </Pressable>
      <Text style={styles.exerciseName}>{item.name}</Text>
      <Pressable onPress={() => removeFromFolder(item.id)} hitSlop={8}>
        <Text style={styles.remove}>✕</Text>
      </Pressable>
    </View>
  );

  return (
    <View>
      <Text style={styles.label}>含める種目(既存から選択・並び替え可)</Text>
      <DraggableFlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => reorder(data.map((e) => e.id))}
        scrollEnabled={false}
        contentContainerStyle={{ gap: 10 }}
      />

      {pickerOpen && (
        <View style={styles.picker}>
          {candidates.map((c) => (
            <Pressable
              key={c.id}
              style={styles.pickerRow}
              onPress={async () => {
                await addExisting(c.id);
                setCandidates((prev) => prev.filter((e) => e.id !== c.id));
              }}
            >
              <Text style={styles.pickerRowText}>{c.name}</Text>
              <Text style={styles.pickerRowAdd}>+ 追加</Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.pickerRow}
            onPress={() => navigation.navigate("ExerciseEdit", { folderId })}
          >
            <Text style={styles.pickerRowText}>+ 新規作成</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.addRow} onPress={() => (pickerOpen ? setPickerOpen(false) : openPicker())}>
        <Text style={styles.addText}>
          {pickerOpen ? "閉じる" : "+ 種目を追加(新規 or 既存から選択)"}
        </Text>
      </Pressable>
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
  form: { padding: 20, gap: 12 },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.textFaint },
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
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.background,
  },
  exerciseRowActive: { borderColor: colors.borderStrong },
  handle: { color: colors.textFaint },
  exerciseName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  remove: { color: colors.textFaint },
  picker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginTop: 8,
    overflow: "hidden",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  pickerRowText: { fontSize: 14, color: colors.textPrimary },
  pickerRowAdd: { fontSize: 12, color: colors.link, fontWeight: "600" },
  addRow: {
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    borderRadius: 10,
    marginTop: 8,
  },
  addText: { color: colors.textMuted, fontSize: 13 },
  deleteButton: { alignItems: "center", paddingVertical: 12 },
  deleteButtonText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
});
