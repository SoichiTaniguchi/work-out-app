import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { getUser, updateUser } from "@/db/users";
import { getSyncSettings, setSetting, type SyncSettings } from "@/db/appSettings";
import { runSync } from "@/sync/runSync";
import { formatDateTime } from "@/utils/recordFormat";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const db = useSQLiteContext();

  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");

  const [sync, setSync] = useState<SyncSettings | null>(null);
  const [editingUrl, setEditingUrl] = useState(false);
  const [draftUrl, setDraftUrl] = useState("");
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    const [user, syncSettings] = await Promise.all([getUser(db, userId), getSyncSettings(db)]);
    setName(user?.name ?? "");
    setSync(syncSettings);
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

  const startEditingUrl = () => {
    setDraftUrl(sync?.serverUrl ?? "");
    setEditingUrl(true);
  };

  const saveUrl = async () => {
    const value = draftUrl.trim();
    if (!/^https?:\/\/.+/.test(value)) {
      Alert.alert("入力エラー", "http:// または https:// から始まるアドレスを入力してください。");
      return;
    }
    await setSetting(db, "serverUrl", value);
    setEditingUrl(false);
    await reload();
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const result = await runSync(db, userId);
      Alert.alert("同期しました", `送信 ${result.sent}件 / 受信 ${result.received}件`);
    } catch (error) {
      Alert.alert("同期できませんでした", error instanceof Error ? error.message : String(error));
    } finally {
      setSyncing(false);
      await reload();
    }
  };

  const syncStatus = (): string => {
    if (syncing) return "同期中...";
    if (sync?.lastSyncError) return "失敗";
    if (sync?.lastSyncedAt) return formatDateTime(sync.lastSyncedAt);
    return "まだ同期していません";
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

      <Text style={styles.sectionTitle}>NAS同期</Text>

      {editingUrl ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={draftUrl}
            onChangeText={setDraftUrl}
            placeholder="http://192.168.0.20:3000"
            onSubmitEditing={saveUrl}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
          />
          <Pressable style={styles.saveButton} onPress={saveUrl}>
            <Text style={styles.saveButtonText}>保存</Text>
          </Pressable>
          <Pressable onPress={() => setEditingUrl(false)}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.row} onPress={startEditingUrl}>
          <Text style={styles.label}>接続先</Text>
          <Text style={styles.value} numberOfLines={1}>
            {sync?.serverUrl ?? ""} ✎
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.row} onPress={syncNow} disabled={syncing}>
        <Text style={[styles.label, syncing && { color: colors.textFaint }]}>今すぐ同期</Text>
        <Text style={styles.value}>{syncing ? "..." : "›"}</Text>
      </Pressable>

      <View style={styles.row}>
        <Text style={styles.label}>最終同期</Text>
        <Text style={[styles.value, sync?.lastSyncError ? { color: colors.danger } : null]}>
          {syncStatus()}
        </Text>
      </View>

      {sync?.lastSyncError && !syncing && (
        <Text style={styles.errorNote}>{sync.lastSyncError}</Text>
      )}

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
  value: { fontSize: 13, color: colors.textMuted, flexShrink: 1, textAlign: "right" },
  sectionTitle: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  errorNote: {
    fontSize: 12,
    color: colors.danger,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
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
