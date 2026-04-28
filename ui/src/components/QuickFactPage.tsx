import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from '@tabler/icons-react'
import { BRANDS, type BrandName } from '../constants/brands'
import type { QuickFactResult, QuickFactItem } from '../types'
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
  const navigate = useNavigate()
  const [pageState, setPageState] = useState<PageState>('idle')
  const [url, setUrl] = useState('')
  const [brand, setBrand] = useState<BrandName | ''>('')
  const [result, setResult] = useState<QuickFactResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Editable content fields
  const [title, setTitle] = useState('')
  const [committedTitle, setCommittedTitle] = useState('')
  const [facts, setFacts] = useState<QuickFactItem[]>([])
  const [committedFacts, setCommittedFacts] = useState<QuickFactItem[]>([])
  const [keyPhrase, setKeyPhrase] = useState('')
  const [committedKeyPhrase, setCommittedKeyPhrase] = useState('')
  const [caption, setCaption] = useState('')

  // UI state
  const [copied, setCopied] = useState(false)
  const [scheduleState, setScheduleState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle')
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Derive preview URL from committed values
  let previewImageUrl = result?.imageUrl ?? ''
  if (result) {
    previewImageUrl = updateTitleInImageUrl(previewImageUrl, result.title, committedTitle)
    for (let i = 0; i < committedFacts.length; i++) {
      previewImageUrl = updateFactInImageUrl(previewImageUrl, i, result.facts[i]?.header ?? '', committedFacts[i]?.header ?? '')
      previewImageUrl = updateFactInImageUrl(previewImageUrl, i, result.facts[i]?.body ?? '', committedFacts[i]?.body ?? '')
    }
    previewImageUrl = updateFactInImageUrl(previewImageUrl, -1, result.keyPhrase, committedKeyPhrase)
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
      setKeyPhrase(res.keyPhrase)
      setCommittedKeyPhrase(res.keyPhrase)
      setCaption(res.caption)
      setPageState('result')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPageState('error')
    }
  }

  async function handleSchedule(scheduledFor: string, passcode: string) {
    if (!result) return
    setScheduleState('posting')
    const finalPasscode = passcode || getCredentials(result.brand.toLowerCase()) || ''
    const response = await callZernioWebhook(previewImageUrl, caption, result.brand, scheduledFor, finalPasscode)
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

  function updateFact(index: number, field: 'header' | 'body', value: string) {
    setFacts(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }

  return (
    <main className="pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-5xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-neutral-100 rounded-lg transition text-neutral-600 hover:text-neutral-950"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">Quick Fact Generator</h1>
          </div>
          <p className="text-neutral-500 mt-1 text-sm ml-11">Turn any article into a key-facts photo post for Facebook</p>
          <div className="mt-3 h-[3px] rounded-full animate-stripe-grow" style={{ background: 'linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)' }} />
        </div>

        {/* Input form — idle and error states */}
        {(pageState === 'idle' || pageState === 'error') && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Article URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && url.trim() && brand) void handleGenerate() }}
                  placeholder="https://www.astroawani.com/..."
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Brand</label>
                <div className="relative">
                  <select
                    value={brand}
                    onChange={e => setBrand(e.target.value as BrandName)}
                    className="w-full px-3 py-2.5 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition bg-white appearance-none cursor-pointer"
                  >
                    <option value="">Select a brand...</option>
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
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
          </div>
        )}

        {/* Skeleton loader — two-column */}
        {pageState === 'loading' && (
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start animate-pulse">
            <div>
              <div className="aspect-[4/5] rounded-2xl bg-gray-200 w-full" />
              <div className="h-10 bg-gray-200 rounded-xl mt-3" />
            </div>
            <div className="space-y-5 pt-1">
              <div className="h-4 bg-gray-200 rounded w-16" />
              <div className="h-10 bg-gray-200 rounded-xl w-full" />
              <div className="h-4 bg-gray-200 rounded w-20 mt-2" />
              <div className="space-y-3">
                {[1,2,3].map(n => (
                  <div key={n} className="bg-gray-100 rounded-xl p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/5" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                  </div>
                ))}
              </div>
              <div className="h-4 bg-gray-200 rounded w-24 mt-2" />
              <div className="h-28 bg-gray-200 rounded-xl" />
              <div className="h-12 bg-gray-200 rounded-xl" />
            </div>
          </div>
        )}

        {/* Result — two-column layout */}
        {pageState === 'result' && result && (
          <>
            {showScheduleModal && createPortal(
              <ScheduleModal
                brand={result.brand}
                hasCredentials={!!getCredentials(result.brand.toLowerCase())}
                isPosting={scheduleState === 'posting'}
                onConfirm={(sf, passcode) => void handleSchedule(sf, passcode ?? '')}
                onClose={() => setShowScheduleModal(false)}
              />,
              document.body
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">

              {/* Left: image preview + caption + actions */}
              <div className="lg:self-start lg:sticky lg:top-6">
                <div className="bg-neutral-50 rounded-2xl overflow-hidden border border-gray-200 aspect-[4/5] w-full shadow-[0_2px_24px_rgba(0,0,0,0.07)]">
                  <img
                    src={previewImageUrl}
                    alt="Quick fact post preview"
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = '' }}
                  />
                </div>

                {/* Caption */}
                <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-4 mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Caption</p>
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
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent font-sans leading-relaxed transition"
                  />
                </div>

                {/* Action buttons */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 rounded-xl text-sm font-medium transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Image
                  </button>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    disabled={scheduleState === 'posting'}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition"
                  >
                    {scheduleState === 'posting' ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Scheduling…
                      </>
                    ) : 'Schedule on FB'}
                  </button>
                </div>

                {/* Post-schedule feedback */}
                {scheduleState === 'done' && (
                  <div className="mt-3">
                    <button
                      onClick={handleReset}
                      className="text-sm text-neutral-500 hover:text-neutral-900 transition"
                    >
                      ← Generate another
                    </button>
                  </div>
                )}
                {scheduleState === 'error' && (
                  <p className="text-xs text-red-500 mt-2">✗ Failed to schedule. Try again.</p>
                )}
              </div>

              {/* Right: editable fields */}
              <div className="space-y-5">

                {/* Title */}
                <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Title</p>
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

                {/* Key facts */}
                <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Key Facts</p>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {facts.map((fact, i) => (
                      <div key={i} className="px-5 py-4 flex gap-4 items-start">
                        <span className="text-xl font-black text-red-600 leading-none mt-0.5 w-8 flex-shrink-0 tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={fact.header}
                            onChange={e => updateFact(i, 'header', e.target.value)}
                            onBlur={() => setCommittedFacts(facts.map(f => ({ ...f })))}
                            placeholder="HEADER LABEL"
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition text-neutral-800"
                          />
                          <input
                            type="text"
                            value={fact.body}
                            onChange={e => updateFact(i, 'body', e.target.value)}
                            onBlur={() => setCommittedFacts(facts.map(f => ({ ...f })))}
                            placeholder="Fact body text..."
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition text-neutral-600"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key phrase (bottom bar) */}
                <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Bottom Bar</p>
                  </div>
                  <input
                    type="text"
                    value={keyPhrase}
                    onChange={e => setKeyPhrase(e.target.value)}
                    onBlur={() => setCommittedKeyPhrase(keyPhrase)}
                    placeholder="LALUAN KRITIKAL: SELAT HORMUZ"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition"
                  />
                </div>


              </div>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
