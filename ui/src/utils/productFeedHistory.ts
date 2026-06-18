import { useEffect, useState } from 'react'

// Session-scoped store of generated Product Feed files. Module-level singleton
// (same pattern as useToast) so the list survives react-router route changes.
// The blob object URLs are held here too; they live as long as the document
// does, so a full page reload clears everything — which matches "this session".

export interface FeedHistoryItem {
  id: string
  filename: string
  url: string
  partner: string
  merchants: string[]
  total: number
  counts?: Record<string, number>
  createdAt: number
}

const MAX_ITEMS = 10

let items: FeedHistoryItem[] = []
const listeners: ((items: FeedHistoryItem[]) => void)[] = []

function notify() {
  listeners.forEach((l) => l([...items]))
}

export function addFeedFile(item: Omit<FeedHistoryItem, 'id' | 'createdAt'>): string {
  const entry: FeedHistoryItem = { ...item, id: crypto.randomUUID(), createdAt: Date.now() }
  const next = [entry, ...items]
  // Evict + revoke anything beyond the cap so blob URLs don't pile up.
  const evicted = next.slice(MAX_ITEMS)
  evicted.forEach((e) => window.URL.revokeObjectURL(e.url))
  items = next.slice(0, MAX_ITEMS)
  notify()
  return entry.id
}

export function removeFeedFile(id: string): void {
  const target = items.find((i) => i.id === id)
  if (target) window.URL.revokeObjectURL(target.url)
  items = items.filter((i) => i.id !== id)
  notify()
}

export function useFeedHistory(): FeedHistoryItem[] {
  const [current, setCurrent] = useState<FeedHistoryItem[]>([...items])

  useEffect(() => {
    listeners.push(setCurrent)
    return () => {
      const idx = listeners.indexOf(setCurrent)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return current
}
