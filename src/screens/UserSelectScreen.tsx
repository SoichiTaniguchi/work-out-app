import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { User } from "@/types";
import { createUser, deleteUser, listUsers } from "@/db/users";

type Props = NativeStackScreenProps<RootStackParamList, "UserSelect">;

export default function UserSelectScreen({ navigation }: Props) {
  const db = useSQLiteContext();

  const [users, setUsers] = useState<User[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const reload = useCallback(async () => {
    setUsers(await listUsers(db));
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", reload);
    return unsubscribe;
  }, [navigation, reload]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      setAdding(false);
      setNewName("");
      return;
    }
    await createUser(db, name);
    setNewName("");
    setAdding(false);
    await reload();
  };

  const confirmDelete = (user: User) => {
    Alert.alert(
      "ユーザーを削除",
      `「${user.name}」を削除しますか?\nこのユーザーのプログラム・種目・記録が全て削除されます。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            await deleteUser(db, user.id);
            await reload();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>筋トレ記録</Text>
      <Text style={styles.subtitle}>利用するユーザーを選んでください</Text>

      <View style={styles.list}>
        {users.length === 0 && !adding && (
          <Text style={styles.empty}>ユーザーがいません。下のボタンから追加してください。</Text>
        )}

        {users.map((user) => (
          <Pressable
            key={user.id}
            style={styles.card}
            onPress={() => navigation.replace("Home", { userId: user.id })}
          >
            <View style={styles.avatar} />
            <Text style={styles.userName}>{user.name}</Text>
            <Pressable hitSlop={8} onPress={() => confirmDelete(user)}>
              <Text style={styles.deleteIcon}>🗑</Text>
            </Pressable>
          </Pressable>
        ))}

        {adding ? (
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="名前を入力"
              onSubmitEditing={handleAdd}
              returnKeyType="done"
              autoFocus
            />
            <Pressable style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addButtonText}>追加</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addCard} onPress={() => setAdding(true)}>
            <Text style={styles.addText}>+ ユーザーを追加</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.note}>パスワード不要・タップして切替</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: {
    alignItems: "center",
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 32,
    flexGrow: 1,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: -20 },
  list: { width: "100%", gap: 12 },
  empty: { fontSize: 13, color: colors.textFaint, textAlign: "center", paddingVertical: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.borderStrong },
  userName: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  deleteIcon: { fontSize: 16, color: colors.textMuted },
  addCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    borderRadius: 12,
  },
  addText: { color: colors.textMuted, fontSize: 14 },
  addRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  addButton: {
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  note: { marginTop: "auto", fontSize: 11, color: colors.textFaint },
});
