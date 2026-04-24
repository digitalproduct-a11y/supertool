import { useState, useCallback, useRef } from "react";

export interface WeatherPost {
  id: string;
  state: string;
  location_id: string;
  date: string;
  day: string;
  morning_forecast: string;
  afternoon_forecast: string;
  night_forecast: string;
  summary_forecast: string;
  summary_when: string;
  min_temp: number;
  max_temp: number;
  translated_summary_forecast?: string;
  translated_summary_when?: string;
  imageUrl: string;
  caption: string;
}

interface WeatherResponse {
  success: true;
  posts: WeatherPost[];
}

interface WeatherError {
  success: false;
  message: string;
}

type WeatherResult = WeatherResponse | WeatherError;

const MALAY_DAYS = [
  "Ahad",
  "Isnin",
  "Selasa",
  "Rabu",
  "Khamis",
  "Jumaat",
  "Sabtu",
] as const;

// Module-level cache keyed on brand+date
let cachedResult: { key: string; posts: WeatherPost[] } | null = null;

function getTodayMYT(): { date: string; day: string } {
  const now = new Date();
  const myt = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }),
  );
  const date = myt.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const day = MALAY_DAYS[myt.getDay()];
  return { date, day };
}

export function useWeatherMalaysia() {
  const [posts, setPosts] = useState<WeatherPost[]>(
    cachedResult?.posts ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (brand: string, mode: "single" | "individual" | "grouped" = "individual"): Promise<WeatherPost[]> => {
    const webhookUrl = import.meta.env.VITE_WEATHER_WEBHOOK_URL as
      | string
      | undefined;
    if (!webhookUrl) {
      setError("Weather webhook URL not configured.");
      return [];
    }

    const { date, day } = getTodayMYT();
    const cacheKey = `${brand}:${date}:${mode}`;

    if (cachedResult?.key === cacheKey) {
      setPosts(cachedResult.posts);
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
        body: JSON.stringify({ date, day, brand, mode: mode === "grouped" ? "single" : mode }),
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
        // Ensure every post has a caption — fallback to generic if empty
        const postsWithCaptions = data.posts.map((p) => ({
          ...p,
          caption:
            p.caption ||
            `${p.state}: ${p.summary_forecast} (${p.summary_when}). Suhu ${p.min_temp}°C–${p.max_temp}°C.`,
        }));
        cachedResult = { key: cacheKey, posts: postsWithCaptions };
        setPosts(postsWithCaptions);
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

  return { posts, setPosts, isLoading, error, generate };
}
