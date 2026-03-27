import { useState, useCallback } from 'react'

export interface KultEvent {
  toolId: string
  toolLabel: string
  brand?: string
  timestamp: number
}

const STORAGE_KEY = 'kult_events'
const MAX_EVENTS = 500

function loadEvents(): KultEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as KultEvent[]) : []
  } catch {
    return []
  }
}

function saveEvents(events: KultEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // storage full — ignore
  }
}

function toDateStr(ts: number) {
  return new Date(ts).toDateString()
}

function computeStreak(events: KultEvent[]): number {
  if (events.length === 0) return 0
  const today = toDateStr(Date.now())
  const days = [...new Set(events.map((e) => toDateStr(e.timestamp)))].sort().reverse()
  if (days[0] !== today) return 0
  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const curr = new Date(days[i])
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)
    if (Math.round(diff) === 1) streak++
    else break
  }
  return streak
}

function computeTopBrand(events: KultEvent[]): string | null {
  const counts: Record<string, number> = {}
  for (const e of events) {
    if (e.brand) counts[e.brand] = (counts[e.brand] ?? 0) + 1
  }
  const entries = Object.entries(counts)
  if (entries.length === 0) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

export function useKultStats() {
  const [events, setEvents] = useState<KultEvent[]>(loadEvents)

  const logEvent = useCallback((event: Omit<KultEvent, 'timestamp'>) => {
    setEvents((prev) => {
      const next = [{ ...event, timestamp: Date.now() }, ...prev].slice(0, MAX_EVENTS)
      saveEvents(next)
      return next
    })
  }, [])

  const todayStr = toDateStr(Date.now())
  const todayCount = events.filter((e) => toDateStr(e.timestamp) === todayStr).length
  const streak = computeStreak(events)
  const topBrand = computeTopBrand(events)

  // Last 3 distinct tools used (by most recent event per tool)
  const seenTools = new Set<string>()
  const recentTools: KultEvent[] = []
  for (const e of events) {
    if (!seenTools.has(e.toolId) && recentTools.length < 3) {
      seenTools.add(e.toolId)
      recentTools.push(e)
    }
  }

  return { todayCount, streak, topBrand, recentTools, logEvent }
}
