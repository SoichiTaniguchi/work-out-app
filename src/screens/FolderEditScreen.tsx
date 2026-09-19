import React, { useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "FolderEdit">;

export default function FolderEditScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  // TODO: 選択済み種目一覧・並び替えはドラッグ可能なリストで実装する
  const [exercises] = useState(["懸垂", "ラットプルダウン"]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>新しいプログラム</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.save}>保存</Text>
        </Pressable>
      </View>

      <View style={styles.form}>
        <View>
          <Text style={styles.label}>プログラム名</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例: 背中の日" />
        </View>

        <Text style={styles.label}>含める種目(既存から選択・並び替え可)</Text>
        {exercises.map((ex) => (
          <View key={ex} style={styles.exerciseRow}>
            <Text style={styles.handle}>≡</Text>
            <Text style={styles.exerciseName}>{ex}</Text>
            <Text style={styles.remove}>✕</Text>
          </View>
        ))}
        <Pressable style={styles.addRow}>
          <Text style={styles.addText}>+ 種目を追加(新規 or 既存から選択)</Text>
        </Pressable>
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
  form: { padding: 20, gap: 12 },
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
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
  },
  handle: { color: colors.textFaint },
  exerciseName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  remove: { color: colors.textFaint },
  addRow: {
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    borderRadius: 10,
  },
  addText: { color: colors.textMuted, fontSize: 13 },
});
