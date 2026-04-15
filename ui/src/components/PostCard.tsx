import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconUpload } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'
import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
import { updateTitleInImageUrl } from '../utils/cloudinary'
import ImageUploadModal from './ImageUploadModal'
import { ScheduleModal } from './ScheduleModal'
import { getCredentials, saveCredentials, clearCredentials } from '../utils/fbCredentials'
import type { ScheduledPost, SchedulePostPayload } from '../types'

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
  return (
    <div className="flex justify-center">
      <span className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-700">
        Not scheduled yet
      </span>
    </div>
  )
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: ScheduledPost
  onSchedule: (payload: SchedulePostPayload) => Promise<boolean>
}

export function PostCard({ post, onSchedule: _onSchedule }: PostCardProps) {
  const [editTitle, setEditTitle] = useState(post.title)
  const [committedTitle, setCommittedTitle] = useState(post.title)
  const [editCaption, setEditCaption] = useState(post.caption)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<'idle' | 'done' | 'error'>('idle')

  // Cloudinary preview URL — only updates when user commits title (on blur)
  const previewPublicId = uploadedPublicId ?? post.photoPublicId
  // Step 1: handle photo swap; also tries fonts-pattern title replacement
  const urlWithPhoto = buildCloudinaryUrl(previewPublicId, committedTitle, post.imageUrl)
  // Step 2: robust title replacement (handles all brand URL formats incl. Chinese chars)
  const previewUrl = updateTitleInImageUrl(urlWithPhoto, post.title ?? '', committedTitle)

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleImageSelected(photo: { url: string; publicId: string }) {
    setUploadedPublicId(photo.publicId)
    toast.success('Image uploaded!')
  }


  async function handleDownload() {
    try {
      const res = await fetch(previewUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `astro-ulagam-${post.date}-${Date.now()}.jpg`
      a.click()
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
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_ai_image_url: previewUrl,
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

      {showImageUploadModal && (
        <ImageUploadModal
          onSelect={handleImageSelected}
          onClose={() => setShowImageUploadModal(false)}
        />
      )}

      <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] overflow-hidden flex flex-col">

        {/* Image preview */}
        <div className="relative w-full" style={{ aspectRatio: '4/5' }}>
          <img
            src={previewUrl}
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

          {/* Edit mode: upload */}
          <div>
            <button
              onClick={() => setShowImageUploadModal(true)}
              className="w-full py-2 rounded-lg text-sm font-medium border border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition flex items-center justify-center gap-2"
            >
              <IconUpload className="w-4 h-4" />
              Upload custom image
            </button>
          </div>

          {/* Edit mode: headline */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Headline{' '}
              <span className={`${editTitle.length > 80 ? 'text-red-500' : 'text-neutral-400'}`}>
                ({editTitle.length}/80)
              </span>
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => setCommittedTitle(editTitle)}
              maxLength={100}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              placeholder="Post headline"
            />
          </div>

          {/* Edit mode: caption */}
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

          {/* Action buttons */}
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition"
              >
                Download image
              </button>
              <button
                onClick={handleScheduleClick}
                disabled={isPosting}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50"
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
            </div>
            {scheduleStatus === 'done' && (
              <div className="text-center space-y-1">
                <p className="text-xs text-green-600">✓ Scheduled on Facebook</p>
                <p className="text-xs text-neutral-400">
                  To view or delete your scheduled post, check{' '}
                  <Link to="/post-queue" className="text-neutral-600 underline hover:text-neutral-900 transition-colors">
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
