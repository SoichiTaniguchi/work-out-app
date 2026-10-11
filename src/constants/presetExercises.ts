import type { RecordFieldType } from "@/types";

// 仕様書「マスターデータはある程度用意しておき、そこにない場合はユーザーが自由に作成・編集できる」に対応。
// DBには入れず、選ばれた時点で createExercise でユーザーの種目として実体化する。
export interface PresetExercise {
  name: string;
  bodyParts: string[];
  equipment: string;
  fieldDefinition: RecordFieldType[];
}

const WEIGHT_REPS: RecordFieldType[] = ["weight", "reps"];
const REPS_ONLY: RecordFieldType[] = ["reps"];
const TIME_ONLY: RecordFieldType[] = ["time"];
const DISTANCE_TIME: RecordFieldType[] = ["distance", "time"];

export const PRESET_GROUPS: { bodyPart: string; exercises: PresetExercise[] }[] = [
  {
    bodyPart: "胸",
    exercises: [
      { name: "ベンチプレス", bodyParts: ["胸"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "インクラインベンチプレス", bodyParts: ["胸"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "ダンベルベンチプレス", bodyParts: ["胸"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "ダンベルフライ", bodyParts: ["胸"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "チェストプレス", bodyParts: ["胸"], equipment: "マシン", fieldDefinition: WEIGHT_REPS },
      { name: "ケーブルクロスオーバー", bodyParts: ["胸"], equipment: "ケーブル", fieldDefinition: WEIGHT_REPS },
      { name: "腕立て伏せ", bodyParts: ["胸"], equipment: "自重", fieldDefinition: REPS_ONLY },
      { name: "ディップス", bodyParts: ["胸", "腕"], equipment: "自重", fieldDefinition: REPS_ONLY },
    ],
  },
  {
    bodyPart: "背中",
    exercises: [
      { name: "デッドリフト", bodyParts: ["背中", "脚"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "ベントオーバーロウ", bodyParts: ["背中"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "ラットプルダウン", bodyParts: ["背中"], equipment: "マシン", fieldDefinition: WEIGHT_REPS },
      { name: "シーテッドロウ", bodyParts: ["背中"], equipment: "マシン", fieldDefinition: WEIGHT_REPS },
      { name: "ダンベルロウ", bodyParts: ["背中"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "懸垂", bodyParts: ["背中"], equipment: "自重", fieldDefinition: REPS_ONLY },
      { name: "バックエクステンション", bodyParts: ["背中"], equipment: "自重", fieldDefinition: REPS_ONLY },
    ],
  },
  {
    bodyPart: "肩",
    exercises: [
      { name: "ショルダープレス", bodyParts: ["肩"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "バーベルショルダープレス", bodyParts: ["肩"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "サイドレイズ", bodyParts: ["肩"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "フロントレイズ", bodyParts: ["肩"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "リアレイズ", bodyParts: ["肩"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "アップライトロウ", bodyParts: ["肩"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "シュラッグ", bodyParts: ["肩"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
    ],
  },
  {
    bodyPart: "腕",
    exercises: [
      { name: "バーベルカール", bodyParts: ["腕"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "ダンベルカール", bodyParts: ["腕"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "ハンマーカール", bodyParts: ["腕"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "プリーチャーカール", bodyParts: ["腕"], equipment: "マシン", fieldDefinition: WEIGHT_REPS },
      { name: "トライセプスエクステンション", bodyParts: ["腕"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "ケーブルプレスダウン", bodyParts: ["腕"], equipment: "ケーブル", fieldDefinition: WEIGHT_REPS },
      { name: "ナローベンチプレス", bodyParts: ["腕", "胸"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "リストカール", bodyParts: ["腕"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
    ],
  },
  {
    bodyPart: "脚",
    exercises: [
      { name: "スクワット", bodyParts: ["脚"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "レッグプレス", bodyParts: ["脚"], equipment: "マシン", fieldDefinition: WEIGHT_REPS },
      { name: "レッグエクステンション", bodyParts: ["脚"], equipment: "マシン", fieldDefinition: WEIGHT_REPS },
      { name: "レッグカール", bodyParts: ["脚"], equipment: "マシン", fieldDefinition: WEIGHT_REPS },
      { name: "ランジ", bodyParts: ["脚", "尻"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "ブルガリアンスクワット", bodyParts: ["脚", "尻"], equipment: "ダンベル", fieldDefinition: WEIGHT_REPS },
      { name: "カーフレイズ", bodyParts: ["脚"], equipment: "マシン", fieldDefinition: WEIGHT_REPS },
      { name: "自重スクワット", bodyParts: ["脚"], equipment: "自重", fieldDefinition: REPS_ONLY },
    ],
  },
  {
    bodyPart: "尻",
    exercises: [
      { name: "ヒップスラスト", bodyParts: ["尻"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "ルーマニアンデッドリフト", bodyParts: ["尻", "脚"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "アブダクション", bodyParts: ["尻"], equipment: "マシン", fieldDefinition: WEIGHT_REPS },
      { name: "ヒップエクステンション", bodyParts: ["尻"], equipment: "自重", fieldDefinition: REPS_ONLY },
      { name: "グルートブリッジ", bodyParts: ["尻"], equipment: "自重", fieldDefinition: REPS_ONLY },
    ],
  },
  {
    bodyPart: "腹",
    exercises: [
      { name: "クランチ", bodyParts: ["腹"], equipment: "自重", fieldDefinition: REPS_ONLY },
      { name: "シットアップ", bodyParts: ["腹"], equipment: "自重", fieldDefinition: REPS_ONLY },
      { name: "レッグレイズ", bodyParts: ["腹"], equipment: "自重", fieldDefinition: REPS_ONLY },
      { name: "アブローラー", bodyParts: ["腹"], equipment: "器具", fieldDefinition: REPS_ONLY },
      { name: "プランク", bodyParts: ["腹"], equipment: "自重", fieldDefinition: TIME_ONLY },
      { name: "サイドプランク", bodyParts: ["腹"], equipment: "自重", fieldDefinition: TIME_ONLY },
      { name: "ロシアンツイスト", bodyParts: ["腹"], equipment: "自重", fieldDefinition: REPS_ONLY },
    ],
  },
  {
    bodyPart: "全身",
    exercises: [
      { name: "クリーン", bodyParts: ["全身"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "スナッチ", bodyParts: ["全身"], equipment: "バーベル", fieldDefinition: WEIGHT_REPS },
      { name: "ケトルベルスイング", bodyParts: ["全身"], equipment: "ケトルベル", fieldDefinition: WEIGHT_REPS },
      { name: "バーピー", bodyParts: ["全身"], equipment: "自重", fieldDefinition: REPS_ONLY },
      { name: "マウンテンクライマー", bodyParts: ["全身"], equipment: "自重", fieldDefinition: TIME_ONLY },
    ],
  },
  {
    bodyPart: "有酸素",
    exercises: [
      { name: "ランニング", bodyParts: ["有酸素"], equipment: "なし", fieldDefinition: DISTANCE_TIME },
      { name: "トレッドミル", bodyParts: ["有酸素"], equipment: "マシン", fieldDefinition: DISTANCE_TIME },
      { name: "エアロバイク", bodyParts: ["有酸素"], equipment: "マシン", fieldDefinition: DISTANCE_TIME },
      { name: "ローイング", bodyParts: ["有酸素"], equipment: "マシン", fieldDefinition: DISTANCE_TIME },
      { name: "縄跳び", bodyParts: ["有酸素"], equipment: "縄跳び", fieldDefinition: TIME_ONLY },
      { name: "ウォーキング", bodyParts: ["有酸素"], equipment: "なし", fieldDefinition: DISTANCE_TIME },
    ],
  },
];
