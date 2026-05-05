import type { WeatherPost } from "../../hooks/useWeatherMalaysia";
import {
  resolveCondition,
  shortenState,
  type WeatherIconKey,
} from "./weatherConditionMap";

export interface NationalSummary {
  headline: string;
  caption: string;
  hero_icon_key: WeatherIconKey;
  // Min across all states' min_temp; max across all states' max_temp.
  // Computed server-side in n8n; frontend falls back to client-side derivation
  // until the workflow is updated.
  national_min?: number;
  national_max?: number;
  // Localised "Ramalan Malaysia" / "Malaysia Forecast" / "马来西亚天气" eyebrow.
  eyebrow?: string;
  // Localised "Suhu Nasional" / "National Temp" / "全国气温" label.
  temp_label?: string;
  // ms | en | zh — used by the canvas to swap header eyebrow text.
  language?: "ms" | "en" | "zh";
}

export interface CanvasStateCell {
  id: string;
  state: string;
  shortName: string;
  when: string;
  iconKey: WeatherIconKey;
  trimmedLabel: string;
  min: number;
  max: number;
  avg: number;
}

export interface CanvasHeroData {
  eyebrow: string;
  title: string;
  caption: string;
  // Pre-formatted "23° – 36°" string (or "—°" when unavailable).
  tempRange: string;
  // Localised "Suhu Nasional" / "National Temp" / "全国气温".
  tempLabel: string;
  iconKey: WeatherIconKey;
}

export interface CanvasViewModel {
  date: string;
  day: string;
  hero: CanvasHeroData;
  cells: CanvasStateCell[];
}

function dominantIconKey(cells: CanvasStateCell[]): WeatherIconKey {
  const counts: Record<WeatherIconKey, number> = {
    sun: 0,
    rain: 0,
    thunder: 0,
    haze: 0,
  };
  for (const c of cells) counts[c.iconKey]++;
  let best: WeatherIconKey = "sun";
  let bestCount = -1;
  for (const k of Object.keys(counts) as WeatherIconKey[]) {
    if (counts[k] > bestCount) {
      best = k;
      bestCount = counts[k];
    }
  }
  return best;
}

function fallbackHeadline(iconKey: WeatherIconKey): string {
  switch (iconKey) {
    case "thunder":
      return "Ribut Petir Menyeluruh";
    case "rain":
      return "Hujan di Kebanyakan Negeri";
    case "haze":
      return "Jerebu Menyeluruh";
    case "sun":
    default:
      return "Cuaca Cerah";
  }
}

function fallbackCaption(iconKey: WeatherIconKey): string {
  switch (iconKey) {
    case "thunder":
      return "Sebahagian besar negeri dijangka mengalami ribut petir terutamanya pada waktu petang.";
    case "rain":
      return "Hujan dijangka di kebanyakan negeri sepanjang hari.";
    case "haze":
      return "Jerebu dijangka di kebanyakan kawasan dengan kualiti udara yang berkurangan.";
    case "sun":
    default:
      return "Cuaca cerah dijangka di kebanyakan negeri sepanjang hari.";
  }
}

export function adaptWeatherToCanvas(
  posts: WeatherPost[],
  national?: NationalSummary | null,
): CanvasViewModel {
  // Prefer per-post `icon_key` from n8n. Fall back to client-side substring
  // resolution when the field is absent (n8n trimming/keying not yet shipped).
  const cells: CanvasStateCell[] = posts.map((p) => {
    const apiIconKey = p.icon_key;
    const fallback = resolveCondition(p.summary_forecast || "");
    const iconKey = apiIconKey ?? fallback.iconKey;
    // When n8n owns trimming, summary_forecast is already short. Otherwise the
    // fallback table emits the short BM form.
    const trimmedLabel = apiIconKey ? p.summary_forecast : fallback.trimmed;
    const min = Number.isFinite(p.min_temp) ? p.min_temp : 0;
    const max = Number.isFinite(p.max_temp) ? p.max_temp : 0;
    const avg = Number.isFinite(p.avg_temp)
      ? (p.avg_temp as number)
      : Math.round((min + max) / 2);
    return {
      id: p.id,
      state: p.state,
      shortName: shortenState(p.state),
      when: p.summary_when || "",
      iconKey,
      trimmedLabel,
      min,
      max,
      avg,
    };
  });

  // National min/max. Prefer n8n values; otherwise compute client-side.
  const apiMin = national?.national_min;
  const apiMax = national?.national_max;
  const haveCells = cells.length > 0;
  const derivedMin = haveCells ? Math.min(...cells.map((c) => c.min)) : null;
  const derivedMax = haveCells ? Math.max(...cells.map((c) => c.max)) : null;
  const minVal = apiMin ?? derivedMin;
  const maxVal = apiMax ?? derivedMax;
  const tempRange =
    minVal != null && maxVal != null ? `${minVal}° – ${maxVal}°` : "—°";

  const heroIcon = national?.hero_icon_key ?? dominantIconKey(cells);
  const hero: CanvasHeroData = {
    eyebrow: national?.eyebrow ?? "Ramalan Malaysia",
    title: national?.headline ?? fallbackHeadline(heroIcon),
    caption: national?.caption ?? fallbackCaption(heroIcon),
    tempRange,
    tempLabel: national?.temp_label ?? "Suhu Nasional",
    iconKey: heroIcon,
  };

  const first = posts[0];
  return {
    date: first?.date ?? "",
    day: first?.day ?? "",
    hero,
    cells,
  };
}
