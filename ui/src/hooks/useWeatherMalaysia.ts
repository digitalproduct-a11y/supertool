import { useState, useCallback, useRef } from "react";
import type { NationalSummary } from "../features/weather/weatherDataAdapter";
import { getBrandFontUse, getBrandLanguage } from "../constants/brands";
import { getDayName } from "../utils/dayNames";

export type { NationalSummary } from "../features/weather/weatherDataAdapter";

export interface WeatherPost {
  id: string;
  state: string;
  location_id: string;
  date: string;
  day: string;
  morning_forecast: string;
  afternoon_forecast: string;
  night_forecast: string;
  // n8n is responsible for trimming this to the V2b short form. Until the
  // workflow is updated, the canvas falls back to client-side trimming.
  summary_forecast: string;
  summary_when: string;
  min_temp: number;
  max_temp: number;
  // Pre-computed average ((min+max)/2) emitted by n8n. Frontend falls back to
  // client-side derivation when absent.
  avg_temp?: number;
  // Optional — emitted by the n8n trimming Code node. Frontend reads this
  // directly when present, otherwise derives via resolveCondition().
  icon_key?: "sun" | "rain" | "thunder" | "haze";
  translated_summary_forecast?: string;
  translated_summary_when?: string;
  imageUrl: string;
  caption: string;
}

interface WeatherResponse {
  success: true;
  posts: WeatherPost[];
  // Brand display font name from the Brand Tone & Voice data table.
  font_use?: string;
  // Brand hex color from the Brand Tone & Voice data table (e.g. "#FF3FBF").
  brand_color?: string;
  // Optional national summary surfaced by the n8n workflow for the Single Post
  // hero block. Absent during initial rollout — adapter has a derived fallback.
  national_summary?: NationalSummary;
}

interface WeatherError {
  success: false;
  message: string;
}

type WeatherResult = WeatherResponse | WeatherError;

// Module-level cache keyed on brand+date
let cachedResult: {
  key: string;
  posts: WeatherPost[];
  fontUse: string | null;
  brandColor: string | null;
  nationalSummary: NationalSummary | null;
} | null = null;

function getTodayMYT(brand: string): { date: string; day: string } {
  const now = new Date();
  const myt = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }),
  );
  const date = myt.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const day = getDayName(myt.getDay(), getBrandLanguage(brand));
  return { date, day };
}

export function useWeatherMalaysia() {
  const [posts, setPosts] = useState<WeatherPost[]>(
    cachedResult?.posts ?? [],
  );
  const [fontUse, setFontUse] = useState<string | null>(
    cachedResult?.fontUse ?? null,
  );
  const [brandColor, setBrandColor] = useState<string | null>(
    cachedResult?.brandColor ?? null,
  );
  const [nationalSummary, setNationalSummary] = useState<NationalSummary | null>(
    cachedResult?.nationalSummary ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (brand: string, mode: "grouped" | "individual" | "single" = "grouped"): Promise<WeatherPost[]> => {
    const webhookUrl = import.meta.env.VITE_WEATHER_WEBHOOK_URL as
      | string
      | undefined;
    if (!webhookUrl) {
      setError("Weather webhook URL not configured.");
      return [];
    }

    const { date, day } = getTodayMYT(brand);
    const cacheKey = `${brand}:${date}:${mode}`;

    if (cachedResult?.key === cacheKey) {
      setPosts(cachedResult.posts);
      setFontUse(cachedResult.fontUse);
      setBrandColor(cachedResult.brandColor);
      setNationalSummary(cachedResult.nationalSummary);
      return cachedResult.posts;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);

    setIsLoading(true);
    setError(null);
    setPosts([]);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, day, brand, mode }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setError(`Weather service error (${res.status}). Please try again.`);
        return [];
      }

      const text = await res.text();
      if (!text) {
        setError("Weather service returned an empty response. Please try again.");
        return [];
      }

      let data: WeatherResult;
      try {
        data = JSON.parse(text) as WeatherResult;
      } catch {
        setError("Weather service returned an invalid response. Please try again.");
        return [];
      }

      if (controller.signal.aborted) return [];

      if (data.success) {
        // Ensure every post has a caption — fallback to generic if empty.
        // Also override `day` with the brand-language label since n8n always
        // emits the Malay day name regardless of what we send.
        const brandLang = getBrandLanguage(brand);
        const postsWithCaptions = data.posts.map((p) => {
          const [yr, mo, dy] = (p.date || "").split("-").map(Number);
          const localDay =
            yr && mo && dy
              ? getDayName(new Date(yr, mo - 1, dy).getDay(), brandLang)
              : p.day;
          return {
            ...p,
            day: localDay,
            caption:
              p.caption ||
              `${p.state}: ${p.summary_forecast} (${p.summary_when}). Suhu ${p.min_temp}°C–${p.max_temp}°C.`,
          };
        });
        // Prefer the value returned by n8n; fall back to the local
        // BRAND_FONT_USE map so canvases still get the correct brand font
        // when a workflow forgets to include it.
        const resolvedFontUse = data.font_use || getBrandFontUse(brand);
        const resolvedBrandColor = data.brand_color || null;
        const resolvedNational = data.national_summary ?? null;
        cachedResult = {
          key: cacheKey,
          posts: postsWithCaptions,
          fontUse: resolvedFontUse,
          brandColor: resolvedBrandColor,
          nationalSummary: resolvedNational,
        };
        setPosts(postsWithCaptions);
        setFontUse(resolvedFontUse);
        setBrandColor(resolvedBrandColor);
        setNationalSummary(resolvedNational);
        return postsWithCaptions;
      } else {
        setError(data.message || "Failed to generate weather posts.");
        return [];
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Request timed out. Please try again.");
        return [];
      }
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please try again.",
      );
      return [];
    } finally {
      clearTimeout(timeoutId);
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  return {
    posts,
    setPosts,
    fontUse,
    brandColor,
    nationalSummary,
    isLoading,
    error,
    generate,
  };
}
