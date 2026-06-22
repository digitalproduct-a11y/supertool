import { useState, useEffect, useRef, useCallback } from "react";
import type { SeatResult } from "../features/election/types";

// Polls the same-origin election proxy (/api/election-results) on an interval
// and exposes the live seat list. The upstream feed updates ~every second; we
// poll every POLL_MS (humans don't perceive faster) and also pause polling when
// the tab is hidden. A manual refresh() forces an immediate re-fetch.

const POLL_MS = 15_000;

// Module-level cache so re-entering the tool shows the last data instantly.
let cachedSeats: SeatResult[] | null = null;
let cachedAt: number | null = null;

function feedUrl(season?: number): string {
  return season ? `/api/election-results?season=${season}` : "/api/election-results";
}

export interface UseElectionResults {
  seats: SeatResult[];
  lastUpdated: number | null;
  isLoading: boolean;
  isLive: boolean;
  error: string | null;
  refresh: () => void;
}

export function useElectionResults(season?: number): UseElectionResults {
  const [seats, setSeats] = useState<SeatResult[]>(cachedSeats ?? []);
  const [lastUpdated, setLastUpdated] = useState<number | null>(cachedAt);
  const [isLoading, setIsLoading] = useState(cachedSeats === null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(feedUrl(season), { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Feed responded ${res.status}`);
      const data = (await res.json()) as SeatResult[];
      if (!Array.isArray(data)) throw new Error("Unexpected feed shape");
      cachedSeats = data;
      cachedAt = Date.now();
      setSeats(data);
      setLastUpdated(cachedAt);
      setIsLive(true);
      setError(null);
    } catch (e) {
      setIsLive(false);
      setError(e instanceof Error ? e.message : "Failed to load results");
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, [season]);

  useEffect(() => {
    fetchOnce();
    let timer = window.setInterval(fetchOnce, POLL_MS);

    const onVisibility = () => {
      if (document.hidden) {
        window.clearInterval(timer);
      } else {
        fetchOnce();
        timer = window.setInterval(fetchOnce, POLL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchOnce]);

  const refresh = useCallback(() => {
    setIsLoading(seats.length === 0);
    fetchOnce();
  }, [fetchOnce, seats.length]);

  return { seats, lastUpdated, isLoading, isLive, error, refresh };
}
