export type WeatherIconKey = "sun" | "rain" | "thunder" | "haze";

export interface MetMapping {
  // BM short label rendered on the canvas (per design transcript)
  trimmed: string;
  iconKey: WeatherIconKey;
}

export const WEATHER_CONDITION_MAP: Record<string, MetMapping> = {
  Berjerebu: { trimmed: "Berjerebu", iconKey: "haze" },
  "Tiada hujan": { trimmed: "Tiada hujan", iconKey: "sun" },
  Hujan: { trimmed: "Hujan", iconKey: "rain" },
  "Hujan di beberapa tempat": {
    trimmed: "Hujan di beberapa tempat",
    iconKey: "rain",
  },
  "Hujan di satu dua tempat": {
    trimmed: "Hujan di satu dua tempat",
    iconKey: "rain",
  },
  "Hujan di satu dua tempat di kawasan pantai": {
    trimmed: "Hujan di pantai",
    iconKey: "rain",
  },
  "Hujan di satu dua tempat di kawasan pedalaman": {
    trimmed: "Hujan di pedalaman",
    iconKey: "rain",
  },
  "Ribut petir": { trimmed: "Ribut petir", iconKey: "thunder" },
  "Ribut petir di beberapa tempat": {
    trimmed: "Ribut petir di beberapa tempat",
    iconKey: "thunder",
  },
  "Ribut petir di beberapa tempat di kawasan pedalaman": {
    trimmed: "Ribut petir di pedalaman",
    iconKey: "thunder",
  },
  "Ribut petir di satu dua tempat": {
    trimmed: "Ribut petir di satu dua tempat",
    iconKey: "thunder",
  },
  "Ribut petir di satu dua tempat di kawasan pantai": {
    trimmed: "Ribut petir di pantai",
    iconKey: "thunder",
  },
  "Ribut petir di satu dua tempat di kawasan pedalaman": {
    trimmed: "Ribut petir di pedalaman",
    iconKey: "thunder",
  },
};

const SUBSTRING_FALLBACKS: Array<{ contains: string; iconKey: WeatherIconKey }> = [
  { contains: "jerebu", iconKey: "haze" },
  { contains: "tiada hujan", iconKey: "sun" },
  { contains: "ribut", iconKey: "thunder" },
  { contains: "hujan", iconKey: "rain" },
];

export function resolveCondition(raw: string): MetMapping {
  const trimmedKey = raw.trim();
  const exact = WEATHER_CONDITION_MAP[trimmedKey];
  if (exact) return exact;

  const lower = trimmedKey.toLowerCase();
  for (const rule of SUBSTRING_FALLBACKS) {
    if (lower.includes(rule.contains)) {
      return { trimmed: trimmedKey, iconKey: rule.iconKey };
    }
  }

  // Unknown condition — degrade gracefully with neutral icon, keep raw text.
  if (trimmedKey) {
    console.warn(`[weather] Unknown summary_forecast: "${trimmedKey}"`);
  }
  return { trimmed: trimmedKey, iconKey: "sun" };
}

export const WEATHER_ICON_PATHS: Record<WeatherIconKey, string> = {
  sun: "/weather-icons/Sunny.png",
  rain: "/weather-icons/Rainy.png",
  thunder: "/weather-icons/Thunderstorm.png",
  haze: "/weather-icons/Haze.png",
};

export const STATE_SHORT_NAMES: Record<string, string> = {
  "Pulau Pinang": "P. Pinang",
  "Negeri Sembilan": "N. Sembilan",
  "WP Kuala Lumpur": "Kuala Lumpur",
  "WP Putrajaya": "Putrajaya",
  "WP Labuan": "Labuan",
};

export function shortenState(state: string): string {
  return STATE_SHORT_NAMES[state] ?? state;
}
