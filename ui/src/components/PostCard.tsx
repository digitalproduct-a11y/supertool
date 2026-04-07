import { useState, useRef } from 'react'
import { toast } from '../hooks/useToast'
import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
import type { ScheduledPost, SchedulePostPayload } from '../types'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ post }: { post: ScheduledPost }) {
  if (post.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        Error
      </span>
    )
  }
  if (post.status === 'scheduled' && post.scheduled_time) {
    const dt = new Date(post.scheduled_time)
    const formatted = dt.toLocaleString('en-MY', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Scheduled · {formatted}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 inline-block" />
      Pending
    </span>
  )
}

// ─── Schedule modal ───────────────────────────────────────────────────────────

function ScheduleModal({
  onConfirm,
  onClose,
  isSubmitting,
}: {
  onConfirm: (isoTime: string) => void
  onClose: () => void
  isSubmitting: boolean
}) {
  const [scheduledFor, setScheduledFor] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
        <h3 className="font-semibold text-neutral-950 mb-1">Schedule to Facebook</h3>
        <p className="text-sm text-neutral-500 mb-4">Pick a date and time for this post to go live.</p>
        <input
          type="datetime-local"
          value={scheduledFor}
          onChange={e => setScheduledFor(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => scheduledFor && onConfirm(new Date(scheduledFor).toISOString())}
            disabled={!scheduledFor || isSubmitting}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Scheduling…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: ScheduledPost
  onSchedule: (payload: SchedulePostPayload) => Promise<boolean>
}

export function PostCard({ post, onSchedule }: PostCardProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editTitle, setEditTitle] = useState(post.title)
  const [editCaption, setEditCaption] = useState(post.caption)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Real-time Cloudinary preview URL — updates as user edits title
  const previewPublicId = uploadedPublicId ?? post.photoPublicId
  const previewUrl = mode === 'edit' ? buildCloudinaryUrl(previewPublicId, editTitle) : post.imageUrl

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleEdit() {
    setEditTitle(post.title)
    setEditCaption(post.caption)
    setUploadedPublicId(null)
    setMode('edit')
  }

  function handleCancel() {
    setEditTitle(post.title)
    setEditCaption(post.caption)
    setUploadedPublicId(null)
    setMode('view')
  }

  async function handleUploadImage(file: File) {
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_ASTRO_ULAGAM_UPLOAD_PRESET as
      | string
      | undefined
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
    if (!uploadPreset || !cloudName) {
      toast.error('Upload is not configured.')
      return
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', uploadPreset)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.public_id) {
        setUploadedPublicId(data.public_id)
      } else {
        toast.error('Upload failed.')
      }
    } catch {
      toast.error('Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleScheduleConfirm(isoTime: string) {
    setIsScheduling(true)
    const ok = await onSchedule({
      postId: post.id,
      scheduledTime: isoTime,
      platform: 'facebook',
    })
    setIsScheduling(false)
    if (ok) {
      setShowScheduleModal(false)
      toast.success('Post scheduled!')
    } else {
      toast.error('Failed to schedule. Please try again.')
    }
  }

  async function handleDownload() {
    try {
      const res = await fetch(post.imageUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `astro-ulagam-${post.date}-${Date.now()}.jpg`
      a.click()
    } catch {
      toast.error('Download failed.')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {showScheduleModal && (
        <ScheduleModal
          onConfirm={handleScheduleConfirm}
          onClose={() => setShowScheduleModal(false)}
          isSubmitting={isScheduling}
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
          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-sm font-medium">Uploading…</span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-4 flex flex-col gap-3 flex-1">

          {/* Status */}
          <StatusBadge post={post} />

          {mode === 'view' ? (
            <>
              {/* View mode: read-only text */}
              <div>
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-0.5">
                  Headline
                </p>
                <p className="text-sm font-medium text-neutral-900 leading-snug">{post.title}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-0.5">
                  Caption
                </p>
                <p className="text-sm text-neutral-600 line-clamp-3">{post.caption}</p>
              </div>

              {/* View mode: actions */}
              <div className="flex flex-col gap-2 mt-auto pt-2">
                {post.status === 'pending' && (
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="w-full py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
                  >
                    Schedule to FB
                  </button>
                )}
                {post.status === 'scheduled' && (
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="w-full py-2 rounded-lg text-sm font-semibold border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition"
                  >
                    Reschedule
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition"
                  >
                    Download
                  </button>
                  <button
                    onClick={handleEdit}
                    className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Edit mode: upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleUploadImage(e.target.files[0])}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full py-2 rounded-lg text-sm font-medium border border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition disabled:opacity-40"
                >
                  {isUploading ? 'Uploading…' : uploadedPublicId ? '✓ New image selected' : 'Upload custom image'}
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

              {/* Edit mode: buttons */}
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={true}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition disabled:opacity-40"
                  title="Edits are live previews only - no save button"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
