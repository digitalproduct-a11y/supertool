import { msalInstance } from '../auth/msalConfig'
import { extractDomain } from '../utils/analytics'

const LOG_URL = (import.meta.env.VITE_HISTORY_LOG_WEBHOOK_URL as string | undefined)?.trim()
const FETCH_URL = (import.meta.env.VITE_HISTORY_FETCH_WEBHOOK_URL as string | undefined)?.trim()

export type HistoryEventType = 'generated' | 'scheduled' | 'error' | 'downloaded'

export interface HistoryEventInput {
  eventType: HistoryEventType
  brand: string
  toolPostType: string          // photo | carousel | quickfact | quote | cms | history_export | election
  sourcePage: string            // article_to_social | cms | history_log | election
  articleUrl?: string
  title?: string
  caption?: string
  imageUrl?: string
  scheduledFor?: string
  editedFields?: string[]
  status: 'success' | 'error'
  errorMessage?: string
}

export interface HistoryRow {
  event_id: string
  server_time: string
  client_time: string
  event_type: string
  user_email: string
  user_name: string
  brand: string
  tool_post_type: string
  source_page: string
  article_url: string
  source_domain: string
  title: string
  caption: string
  image_url: string
  scheduled_for: string
  edited_fields: string
  status: string
  error_message: string
}

function getCurrentUser(): { email: string; name: string } {
  try {
    const acct = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]
    return { email: acct?.username ?? '', name: acct?.name ?? '' }
  } catch {
    return { email: '', name: '' }
  }
}

/** Fire-and-forget usage logging. Never throws, never blocks the UI. */
export function logHistoryEvent(input: HistoryEventInput): void {
  if (!LOG_URL) return
  const { email, name } = getCurrentUser()
  const payload = {
    event_id: crypto.randomUUID(),
    client_time: new Date().toISOString(),
    event_type: input.eventType,
    user_email: email,
    user_name: name,
    brand: input.brand,
    tool_post_type: input.toolPostType,
    source_page: input.sourcePage,
    article_url: input.articleUrl ?? '',
    source_domain: input.articleUrl ? extractDomain(input.articleUrl) ?? '' : '',
    title: input.title ?? '',
    caption: input.caption ?? '',
    image_url: input.imageUrl ?? '',
    scheduled_for: input.scheduledFor ?? '',
    edited_fields: (input.editedFields ?? []).join(','),
    status: input.status,
    error_message: input.errorMessage ?? '',
  }
  try {
    void fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* swallow — logging must never disrupt UX */ })
  } catch { /* ignore */ }
}

export interface FetchHistoryParams {
  mode: 'view' | 'download'
  from?: string        // yyyy-mm-dd
  to?: string          // yyyy-mm-dd
  passcode?: string
  isAdmin?: boolean
}

export interface FetchHistoryResult {
  status: 'OK' | 'AUTH_ERROR' | 'ERROR'
  rows: HistoryRow[]
  message?: string
}

export async function fetchHistory(brand: string, params: FetchHistoryParams): Promise<FetchHistoryResult> {
  if (!FETCH_URL) return { status: 'ERROR', rows: [], message: 'History fetch webhook not configured' }
  try {
    const res = await fetch(FETCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand,                       // original case; n8n matches case-insensitively
        mode: params.mode,
        from: params.from ?? '',
        to: params.to ?? '',
        passcode: params.passcode ?? '',
        is_admin: params.isAdmin ?? false,
      }),
    })
    if (!res.ok) return { status: 'ERROR', rows: [], message: `HTTP ${res.status}` }
    const data = await res.json() as { status?: string; rows?: HistoryRow[]; message?: string }
    if (data.status === 'AUTH_ERROR') return { status: 'AUTH_ERROR', rows: [], message: data.message ?? 'Invalid passcode.' }
    return { status: 'OK', rows: data.rows ?? [], message: data.message }
  } catch {
    return { status: 'ERROR', rows: [], message: 'Network error. Please try again.' }
  }
}
