import { NativeModules, Platform } from "react-native";

/**
 * 仕様書「レスタイマー・Dynamic Island仕様」に対応するブリッジ。
 *
 * iOS側は Live Activities (ActivityKit) を使うSwiftネイティブモジュールを
 * 別途実装する必要がある(Expo Dev Client + Config Plugin、または
 * react-native-live-activity 等のライブラリを想定)。
 * ここではJS側のインターフェースのみ定義し、ネイティブ実装が無い場合は
 * 何もしないフォールバックにしている。
 *
 * 終了時のアラーム音は expo-notifications 等でローカル通知をスケジュールし、
 * サウンド付きで発火させることで、イヤホン接続時もiOSの通知音声ルーティング
 * に従って再生される想定。
 */

interface StartRestTimerParams {
  exerciseName: string;
  durationSeconds: number;
}

// TODO: ネイティブモジュール(Swift/ActivityKit)実装後にリンクする
const { RestTimerActivityModule } = NativeModules as {
  RestTimerActivityModule?: {
    start: (exerciseName: string, durationSeconds: number) => void;
    end: () => void;
  };
};

export function startRestTimerActivity({ exerciseName, durationSeconds }: StartRestTimerParams) {
  if (Platform.OS !== "ios") return;
  if (!RestTimerActivityModule) {
    console.warn("[RestTimerActivity] ネイティブモジュール未実装: Live Activityは開始されません");
    return;
  }
  RestTimerActivityModule.start(exerciseName, durationSeconds);
}

export function endRestTimerActivity() {
  if (Platform.OS !== "ios") return;
  RestTimerActivityModule?.end();
}
