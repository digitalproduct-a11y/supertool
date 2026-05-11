import type { BrandLanguage } from "../constants/brands";

export const MALAY_DAYS = [
  "Ahad",
  "Isnin",
  "Selasa",
  "Rabu",
  "Khamis",
  "Jumaat",
  "Sabtu",
] as const;

export const ENGLISH_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const CHINESE_DAYS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
] as const;

export function getDayName(weekday: number, lang: BrandLanguage): string {
  const idx = ((weekday % 7) + 7) % 7;
  if (lang === "EN") return ENGLISH_DAYS[idx];
  if (lang === "ZH") return CHINESE_DAYS[idx];
  return MALAY_DAYS[idx];
}
