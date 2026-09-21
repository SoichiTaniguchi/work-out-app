import * as Notifications from "expo-notifications";

/**
 * レスタイマー終了時のローカル通知(音付き)をラップする。
 * アプリを閉じても休憩終了が分かるようにするための最小実装で、
 * Dynamic Island(Live Activities)は別途 src/native/RestTimerActivity.ts 側で対応する。
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleRestEndNotification(
  exerciseName: string,
  durationSeconds: number
): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) {
    console.warn("[restTimer] 通知の権限がないため休憩終了通知はスケジュールされません");
    return null;
  }

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "休憩終了",
        body: `${exerciseName} の次のセットを始めましょう`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + durationSeconds * 1000),
      },
    });
  } catch (error) {
    console.warn("[restTimer] 通知のスケジュールに失敗しました", error);
    return null;
  }
}

export async function cancelRestEndNotification(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
