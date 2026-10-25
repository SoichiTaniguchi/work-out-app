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

// 保存する数値。未入力と、数値として完成していない入力("68." など)は null。
export function parseWeightInput(input: string): number | null {
  if (input === "" || input.endsWith(".")) return null;
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// 保存済みの体重を入力欄の文字列に戻す。
export function formatWeightInput(weight: number | null | undefined): string {
  return weight === null || weight === undefined ? "" : weight.toFixed(1);
}
