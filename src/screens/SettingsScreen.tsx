import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { getUser, updateUser } from "@/db/users";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const db = useSQLiteContext();

  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");

  const reload = useCallback(async () => {
    const user = await getUser(db, userId);
    setName(user?.name ?? "");
  }, [db, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const startEditing = () => {
    setDraftName(name);
    setEditing(true);
  };

  const saveName = async () => {
    const value = draftName.trim();
    if (!value) {
      Alert.alert("入力エラー", "名前を入力してください。");
      return;
    }
    await updateUser(db, userId, { name: value });
    setEditing(false);
    await reload();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>設定</Text>
      </View>

      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={draftName}
            onChangeText={setDraftName}
            placeholder="名前を入力"
            onSubmitEditing={saveName}
            returnKeyType="done"
            autoFocus
          />
          <Pressable style={styles.saveButton} onPress={saveName}>
            <Text style={styles.saveButtonText}>保存</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(false)}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.row} onPress={startEditing}>
          <Text style={styles.label}>ユーザー名</Text>
          <Text style={styles.value}>{name} ✎</Text>
        </Pressable>
      )}

      <Pressable style={styles.row} onPress={() => navigation.replace("UserSelect")}>
        <Text style={styles.label}>ユーザー切り替え</Text>
        <Text style={styles.value}>›</Text>
      </Pressable>

      <View style={styles.row}>
        <Text style={styles.label}>バージョン情報</Text>
        <Text style={[styles.value, { color: colors.textFaint }]}>v0.1.0</Text>
      </View>
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
  },
  back: { fontSize: 18, color: colors.textPrimary },
  title: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 14, color: colors.textPrimary },
  value: { fontSize: 13, color: colors.textMuted },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  saveButton: {
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  saveButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  cancelText: { fontSize: 13, color: colors.textMuted },
});
