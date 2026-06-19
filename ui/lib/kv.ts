import { kv } from '@vercel/kv'
import LZString from 'lz-string'

export type SnapshotType = 'meta' | 'youtube'

function snapshotKey(type: SnapshotType): string {
  return `dashboard:${type}:current`
}

const STATUS_KEY = 'dashboard:status'

export interface SnapshotStatus {
  last_run_at: string
  last_meta_rows: number
  last_youtube_rows: number
  last_status: 'ok' | 'failed'
  last_error?: string
}

// Stored payload is LZString-compressed JSON to fit within Upstash's per-value cap.
export async function readSnapshot<T>(type: SnapshotType): Promise<T | null> {
  const compressed = await kv.get<string>(snapshotKey(type))
  if (!compressed) return null
  const json = LZString.decompressFromUTF16(compressed)
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

export async function readSnapshotStatus(): Promise<SnapshotStatus | null> {
  return (await kv.get<SnapshotStatus>(STATUS_KEY)) ?? null
}
