/**
 * Activity tracking utility for super-tool
 * Sends events to n8n analytics webhook and updates local Kult stats
 */

function getSessionId(): string {
  const KEY = 'kult_session_id'
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
  }
  return id
}

let _logKultEvent: ((e: { toolId: string; toolLabel: string; brand?: string }) => void) | null = null

export function setKultLogger(fn: typeof _logKultEvent) {
  _logKultEvent = fn
}

export interface AnalyticsEvent {
  event_type: 'page_visit' | 'form_submitted' | 'asset_generated' | 'generation_failed'
  tool_id: string
  tool_label: string
  brand?: string
  error_message?: string
}

export function trackEvent(event: AnalyticsEvent): void {
  const payload = {
    ...event,
    timestamp: new Date().toISOString(),
    session_id: getSessionId(),
  }

  const url = import.meta.env.VITE_ANALYTICS_WEBHOOK_URL
  if (url) {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  if (event.event_type === 'asset_generated' && _logKultEvent) {
    _logKultEvent({
      toolId: event.tool_id,
      toolLabel: event.tool_label,
      brand: event.brand,
    })
  }
}
