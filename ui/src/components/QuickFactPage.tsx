import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BRANDS, type BrandName } from '../constants/brands'
import type { QuickFactResult } from '../types'
import { toast } from '../hooks/useToast'
import { updateTitleInImageUrl, updateFactInImageUrl } from '../utils/cloudinary'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'

type PageState = 'idle' | 'loading' | 'result' | 'error'

async function callQuickFactWebhook(
  url: string,
  brand: string,
): Promise<QuickFactResult | { success: false; message: string }> {
  const webhookUrl = (import.meta.env.VITE_QUICK_FACT_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) throw new Error('VITE_QUICK_FACT_WEBHOOK_URL is not configured')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, brand }),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!text.trim()) throw new Error('Empty response from server')
    return JSON.parse(text) as QuickFactResult | { success: false; message: string }
  } finally {
    clearTimeout(timeout)
  }
}

async function callZernioWebhook(
  imageUrl: string,
  caption: string,
  brand: string,
  scheduledFor: string | undefined,
  passcode: string,
): Promise<{ success: boolean; message: string; status?: string }> {
  const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
  if (!webhookUrl) return { success: false, message: 'Webhook not configured.' }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fb_ai_image_url: imageUrl,
        fb_ai_caption: caption,
        brand: brand.toLowerCase(),
        ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        passcode,
      }),
    })
    const data = await res.json() as { success?: boolean; status?: string; message?: string }
    if (data.status === 'AUTH_ERROR') {
      clearCredentials(brand.toLowerCase())
      return { success: false, message: data.message ?? 'Invalid passcode.', status: 'AUTH_ERROR' }
    }
    if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
      saveCredentials(brand.toLowerCase(), passcode)
      return { success: true, message: data.message ?? 'Scheduled!' }
    }
    return { success: false, message: data.message ?? 'Something went wrong.' }
  } catch {
    return { success: false, message: 'Network error. Please try again.' }
  }
}

export function QuickFactPage() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [url, setUrl] = useState('')
  const [brand, setBrand] = useState<BrandName | ''>('')
  const [result, setResult] = useState<QuickFactResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Editable content fields
  const [title, setTitle] = useState('')
  const [committedTitle, setCommittedTitle] = useState('')
  const [facts, setFacts] = useState<string[]>([])
  const [committedFacts, setCommittedFacts] = useState<string[]>([])
  const [caption, setCaption] = useState('')

  // UI state
  const [copied, setCopied] = useState(false)
  const [scheduleState, setScheduleState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Derive preview URL from committed values (recomputed each render)
  let previewImageUrl = result?.imageUrl ?? ''
  if (result) {
    previewImageUrl = updateTitleInImageUrl(previewImageUrl, result.title, committedTitle)
    for (let i = 0; i < committedFacts.length; i++) {
      previewImageUrl = updateFactInImageUrl(previewImageUrl, i, result.facts[i] ?? '', committedFacts[i] ?? '')
    }
  }

  async function handleGenerate() {
    if (!url.trim() || !brand) return
    setPageState('loading')
    setErrorMessage('')
    try {
      const data = await callQuickFactWebhook(url.trim(), brand)
      if (!data.success) {
        setErrorMessage((data as { success: false; message: string }).message || 'Failed to generate. Please try again.')
        setPageState('error')
        return
      }
      const res = data as QuickFactResult
      setResult(res)
      setTitle(res.title)
      setCommittedTitle(res.title)
      setFacts([...res.facts])
      setCommittedFacts([...res.facts])
      setCaption(res.caption)
      setPageState('result')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPageState('error')
    }
  }

  async function handleSchedule(scheduledFor: string | undefined, passcode: string) {
    if (!result) return
    setScheduleState('posting')
    const response = await callZernioWebhook(previewImageUrl, caption, result.brand, scheduledFor, passcode)
    if (response.status === 'AUTH_ERROR') {
      setShowScheduleModal(true)
      setScheduleState('idle')
      toast.error('Invalid passcode. Please try again.')
    } else if (response.success) {
      setScheduleState('done')
      setShowScheduleModal(false)
      toast.success('Scheduled on Facebook!')
    } else {
      setScheduleState('error')
      toast.error(response.message || "Couldn't schedule. Please try again.")
    }
  }

  async function handleDownload() {
    try {
      const res = await fetch(previewImageUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `quick-fact-${result?.brand ?? 'post'}-${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(previewImageUrl, '_blank')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleReset() {
    setPageState('idle')
    setResult(null)
    setUrl('')
    setBrand('')
    setScheduleState('idle')
    setErrorMessage('')
  }

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Quick Fact Generator</h1>
          <p className="text-neutral-500 mt-1 text-sm">Turn any article into a key-facts photo post for Facebook</p>
          <div className="mt-3 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* Input form — shown in idle and error states */}
        {(pageState === 'idle' || pageState === 'error') && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Article URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.astroawani.com/..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Brand</label>
              <select
                value={brand}
                onChange={e => setBrand(e.target.value as BrandName)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition bg-white"
              >
                <option value="">Select a brand</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {pageState === 'error' && errorMessage && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={!url.trim() || !brand}
              className="w-full py-3 px-4 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition"
            >
              Generate
            </button>
          </div>
        )}

        {/* Skeleton loader */}
        {pageState === 'loading' && (
          <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 animate-pulse space-y-4">
            <div className="aspect-[4/5] rounded-xl bg-gray-200" />
            <div className="h-5 bg-gray-200 rounded-lg w-3/4" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
              <div className="h-4 bg-gray-200 rounded w-4/6" />
            </div>
            <div className="h-10 bg-gray-200 rounded-xl w-full" />
          </div>
        )}

        {/* Result panel */}
        {pageState === 'result' && result && (
          <>
            {showScheduleModal && createPortal(
              <ScheduleModal
                brand={result.brand}
                hasCredentials={!!getCredentials(result.brand.toLowerCase())}
                isPosting={scheduleState === 'posting'}
                onConfirm={(sf, passcode) => void handleSchedule(sf, passcode)}
                onClose={() => setShowScheduleModal(false)}
              />,
              document.body
            )}

            <div className="space-y-4">
              {/* Image preview */}
              <div className="bg-neutral-50 rounded-xl overflow-hidden border border-gray-200 aspect-[4/5] w-full">
                <img
                  src={previewImageUrl}
                  alt="Quick fact post preview"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = '' }}
                />
              </div>

              {/* Download */}
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>

              {/* Editable title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Title</label>
                  <span className="text-xs text-gray-400">{title.length}</span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => setCommittedTitle(title)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                />
              </div>

              {/* Editable facts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Key Facts</label>
                </div>
                <div className="space-y-2">
                  {facts.map((fact, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                      <input
                        type="text"
                        value={fact}
                        onChange={e => {
                          const updated = [...facts]
                          updated[i] = e.target.value
                          setFacts(updated)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setCommittedFacts([...facts])}
                  className="mt-2 w-full py-2 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition"
                >
                  Update Image
                </button>
              </div>

              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Caption</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{caption.length}/600</span>
                    <button onClick={handleCopy} title="Copy caption" className="text-neutral-400 hover:text-neutral-700 transition">
                      {copied
                        ? <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      }
                    </button>
                  </div>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value.slice(0, 600))}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent font-sans leading-relaxed transition"
                />
              </div>

              {/* Schedule on FB */}
              <div className="pt-2">
                <button
                  onClick={() => setShowScheduleModal(true)}
                  disabled={scheduleState === 'posting'}
                  className="w-full py-3 px-4 font-medium rounded-xl transition text-sm bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white"
                >
                  {scheduleState === 'posting' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Scheduling…
                    </span>
                  ) : 'Schedule on FB'}
                </button>
                {scheduleState === 'done' && (
                  <div className="text-center space-y-1 mt-1">
                    <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
                    <p className="text-xs text-neutral-400">
                      To view or delete your scheduled post, check{' '}
                      <Link to="/post-queue" className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
                        here
                      </Link>.
                    </p>
                  </div>
                )}
                {scheduleState === 'error' && (
                  <p className="text-xs text-red-500 text-center mt-1">✗ Failed to schedule. Try again.</p>
                )}
              </div>

              {/* Generate another */}
              <button
                onClick={handleReset}
                className="w-full py-2 px-4 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                ← Generate another
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
