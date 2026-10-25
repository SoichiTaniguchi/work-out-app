import Constants from "expo-constants";

// PRのプレビュー(NASの8082番、scripts/preview-nas.sh)として配信されているときだけ、
// app.json の extra.previewPr にPR番号が入る。本番(8081番)では常に null。
//
// Expo Goは本番とプレビューを同じプロジェクトとして扱い、端末内のデータを共有してしまう。
// テストの記録が本番に混ざらないよう、プレビューではデータベースを分け、同期もしない。
const previewPr = Constants.expoConfig?.extra?.previewPr;

export const PREVIEW_PR: number | null = typeof previewPr === "number" ? previewPr : null;

export const IS_PREVIEW = PREVIEW_PR !== null;

export const DATABASE_NAME = IS_PREVIEW ? "workout-preview.db" : "workout.db";
