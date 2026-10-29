// 体重の数字キーパッド入力。画面から切り離して単体で確かめられるようにしている。

// 整数3桁・小数1桁(例: 168.4)まで受け付ける。
const MAX_INT_DIGITS = 3;
const MAX_DECIMALS = 1;

export type WeightKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "."
  | "del";

export const WEIGHT_KEYS: WeightKey[] = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del",
];

// 入力中の文字列に1キー分を足す。入れられないキーは元の値を返す。
export function applyWeightKey(current: string, key: WeightKey): string {
  if (key === "del") return current.slice(0, -1);

  if (key === ".") {
    // 小数点は数字の後に1つだけ
    if (current === "" || current.includes(".")) return current;
    return current + ".";
  }

  const next = current + key;
  const [intPart = "", decimalPart] = next.split(".");

  // "00" や "012" のような先頭の余分な0を防ぐ
  if (intPart.length > 1 && intPart.startsWith("0")) return current;
  if (intPart.length > MAX_INT_DIGITS) return current;
  if (decimalPart !== undefined && decimalPart.length > MAX_DECIMALS) return current;

  return next;
}

// 打ち間違いを保存しないための範囲。人の体重として現実的な幅にしている。
export const MIN_WEIGHT = 20;
export const MAX_WEIGHT = 300;

// 保存する数値。未入力・未完成の入力("68." など)・範囲外は null を返す。
export function parseWeightInput(input: string): number | null {
  if (input === "" || input.endsWith(".")) return null;
  const value = Number(input);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_WEIGHT || value > MAX_WEIGHT) return null;
  return value;
}

// 入力はあるのに保存できない理由。未入力のときは null(そのまま保存してよい)。
export function weightInputError(input: string): string | null {
  if (input === "") return null;
  if (input.endsWith(".")) return "小数点のあとに数字を入れてください";
  const value = Number(input);
  if (!Number.isFinite(value)) return "数字を入れてください";
  if (value < MIN_WEIGHT || value > MAX_WEIGHT) {
    return `${MIN_WEIGHT}〜${MAX_WEIGHT}kg の範囲で入れてください`;
  }
  return null;
}

// 保存済みの体重を入力欄の文字列に戻す。
export function formatWeightInput(weight: number | null | undefined): string {
  return weight === null || weight === undefined ? "" : weight.toFixed(1);
}
