import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useBrandPath } from '../hooks/useBrandNavigate'
import { IconUpload, IconDownload } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'
import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
import { updateTitleInImageUrl } from '../utils/cloudinary'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'
import { trackButtonClick } from '../utils/analytics'
import type { ScheduledPost, SchedulePostPayload } from '../types'
import { FabricCropPicker } from '../features/photo/FabricCropPicker'

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim()
  const uploadPreset = (import.meta.env.VITE_CLOUDINARY_TEMP_UPLOADS_PRESET as string | undefined)?.trim()
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary configuration missing')
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = await res.json() as { public_id: string }
  return data.public_id
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ post }: { post: ScheduledPost }) {
  if (post.status === 'scheduled' && post.scheduled_time) {
    const dt = new Date(post.scheduled_time)
    const formatted = dt.toLocaleString('en-MY', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    return (
      <div className="flex justify-center">
        <span className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700">
          Scheduled · {formatted}
        </span>
      </div>
    )
  }
  return null
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: ScheduledPost
  onSchedule: (payload: SchedulePostPayload) => Promise<boolean>
}

export function PostCard({ post, onSchedule: _onSchedule }: PostCardProps) {
  const postQueuePath = useBrandPath('/post-queue')
  const [editTitle, setEditTitle] = useState(post.title)
  const [committedTitle, setCommittedTitle] = useState(post.title)
  const [editCaption, setEditCaption] = useState(post.caption)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [showCropPicker, setShowCropPicker] = useState(false)
  const [appliedCropRegion, setAppliedCropRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [cropLoading, setCropLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim() ?? 'dymmqtqyg'

  // Cloudinary preview URL — only updates when user commits title (on blur)
  const previewPublicId = uploadedPublicId ?? post.photoPublicId
  const urlWithPhoto = buildCloudinaryUrl(previewPublicId, committedTitle, post.imageUrl)
  const previewUrl = updateTitleInImageUrl(urlWithPhoto, post.title ?? '', committedTitle)

  // Apply crop region to the current previewUrl so title changes are always reflected
  const displayUrl = appliedCropRegion
    ? previewUrl.replace(
        /c_fill,g_[^,/]+,w_(\d+),h_(\d+)/,
        `c_crop,x_${Math.round(appliedCropRegion.x)},y_${Math.round(appliedCropRegion.y)},w_${Math.round(appliedCropRegion.width)},h_${Math.round(appliedCropRegion.height)}/c_fill,g_center,w_$1,h_$2`
      )
    : previewUrl

  // Crop source: use uploaded image (raw, no overlays) when available, else original
  const cropSourceUrl = uploadedPublicId
    ? `https://res.cloudinary.com/${cloudName}/image/upload/${uploadedPublicId}`
    : post.cloudinary_url ?? null

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLoading(true)
    try {
      const publicId = await uploadToCloudinary(file)
      setUploadedPublicId(publicId)
      setAppliedCropRegion(null)
      toast.success('Image uploaded!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadLoading(false)
      e.target.value = ''
    }
  }

  function handleCropDone(cropRegion: { x: number; y: number; width: number; height: number }) {
    if (!cropSourceUrl) return
    setCropLoading(true)
    setAppliedCropRegion(cropRegion)
    setShowCropPicker(false)
    setCropLoading(false)
    toast.success('Crop adjusted!')
  }

  async function handleDownload() {
    trackButtonClick('download_image')
    try {
      const res = await fetch(displayUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${post.brand.toLowerCase().replace(/\s+/g, '-')}-${post.date}-${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error('Download failed.')
    }
  }

  function handleScheduleClick() {
    setShowScheduleModal(true)
  }

  async function handleConfirmSchedule(scheduledFor: string, passcode?: string) {
    const brand = post.brand.toLowerCase()
    const resolvedPasscode = passcode ?? getCredentials(brand)?.passcode
    if (!resolvedPasscode) { setShowScheduleModal(false); return }
    const webhookUrl = (import.meta.env.VITE_POST_DRAFT_WEBHOOK_URL as string | undefined)?.trim()
    if (!webhookUrl) { toast.error('Webhook not configured.'); return }
    setIsPosting(true)
    try {
      const finalPublicId = uploadedPublicId ?? post.photoPublicId
      const finalUrlWithPhoto = buildCloudinaryUrl(finalPublicId, editTitle, post.imageUrl)
      const latestUrl = updateTitleInImageUrl(finalUrlWithPhoto, post.title ?? '', editTitle)
      const finalImageUrl = appliedCropRegion
        ? latestUrl.replace(
            /c_fill,g_[^,/]+,w_(\d+),h_(\d+)/,
            `c_crop,x_${Math.round(appliedCropRegion.x)},y_${Math.round(appliedCropRegion.y)},w_${Math.round(appliedCropRegion.width)},h_${Math.round(appliedCropRegion.height)}/c_fill,g_center,w_$1,h_$2`
          )
        : latestUrl
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url: finalImageUrl,
          fb_ai_caption: editCaption,
          brand,
          ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
          passcode: resolvedPasscode,
        }),
      })
      const data = await res.json() as { success?: boolean; status?: string; message?: string }
      if (data.status === 'AUTH_ERROR') {
        clearCredentials(brand)
        setShowScheduleModal(false)
        toast.error('Invalid passcode. Please try again.')
        setScheduleStatus('error')
      } else if (data.status === 'BRAND_ERROR') {
        toast.error(data.message ?? 'Brand not permitted.')
        setShowScheduleModal(false)
      } else if (data.success === true || data.status === 'SUCCESS' || data.status === 'DRAFT_SAVED') {
        saveCredentials(brand, resolvedPasscode)
        setScheduleStatus('done')
        setShowScheduleModal(false)
        toast.success('Scheduled on Facebook!')
      } else {
        setScheduleStatus('error')
        toast.error(data.message ?? "Couldn't post. Please try again.")
      }
    } catch {
      setScheduleStatus('error')
      toast.error('Network error. Please try again.')
    } finally {
      setIsPosting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {showScheduleModal && (
        <ScheduleModal
          brand={post.brand}
          hasCredentials={!!getCredentials(post.brand.toLowerCase())}
          isPosting={isPosting}
          onConfirm={handleConfirmSchedule}
          onClose={() => setShowScheduleModal(false)}
        />
      )}

      {showCropPicker && cropSourceUrl && createPortal(
        <FabricCropPicker
          sourceImageUrl={cropSourceUrl}
          aspectRatio={1080 / 1350}
          onDone={handleCropDone}
          onCancel={() => setShowCropPicker(false)}
        />,
        document.body
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col">

        {/* Image preview */}
        <div className="relative w-full" style={{ aspectRatio: '4/5' }}>
          <img
            src={displayUrl}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Card body */}
        <div className="p-4 flex flex-col gap-3 flex-1">

          {/* Article link */}
          <a
            href={post.articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-500 hover:text-neutral-700 underline text-center"
          >
            See original article
          </a>

          {/* Status */}
          <StatusBadge post={post} />

          {/* Row 1: Adjust Image */}
          {cropSourceUrl && (
            <button
              onClick={() => { setShowCropPicker(true); trackButtonClick('adjust_image'); }}
              disabled={cropLoading}
              className="w-full py-2 rounded-lg text-sm font-medium border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {cropLoading ? 'Adjusting...' : 'Adjust Image'}
            </button>
          )}

          {/* Row 2: Upload Custom Image | Download Image */}
          <div className="flex gap-2">
            <button
              onClick={() => { fileInputRef.current?.click(); trackButtonClick('upload_custom_image'); }}
              disabled={uploadLoading}
              className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <IconUpload className="w-3.5 h-3.5" />
              {uploadLoading ? 'Uploading…' : 'Upload Image'}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-neutral-950 text-white hover:bg-neutral-800 transition flex items-center justify-center gap-1.5"
            >
              <IconDownload className="w-3.5 h-3.5" />
              Download
            </button>
          </div>

          {/* Image Title */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Image Title{' '}
              <span className={`${editTitle.trim().split(/\s+/).filter(Boolean).length > 15 ? 'text-red-500' : 'text-neutral-400'}`}>
                ({editTitle.trim().split(/\s+/).filter(Boolean).length} words)
              </span>
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => setCommittedTitle(editTitle)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              placeholder="Post image title"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Caption{' '}
              <span className={`${editCaption.length > 600 ? 'text-red-500' : 'text-neutral-400'}`}>
                ({editCaption.length}/600)
              </span>
            </label>
            <textarea
              value={editCaption}
              onChange={e => setEditCaption(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              placeholder="Facebook caption"
            />
          </div>

          {/* Schedule on FB */}
          <div className="flex flex-col gap-2 mt-auto">
            <button
              onClick={handleScheduleClick}
              disabled={isPosting}
              className="w-full py-2 rounded-lg text-sm font-semibold transition bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {isPosting ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Scheduling…
                </span>
              ) : 'Schedule on FB'}
            </button>
            {scheduleStatus === 'done' && (
              <div className="text-center space-y-1">
                <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
                <p className="text-xs text-neutral-400">
                  To view or delete your scheduled post, check{' '}
                  <Link to={postQueuePath} className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
                    here
                  </Link>.
                </p>
              </div>
            )}
            {scheduleStatus === 'error' && (
              <p className="text-xs text-red-500 text-center">✗ Failed to schedule. Try again.</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
