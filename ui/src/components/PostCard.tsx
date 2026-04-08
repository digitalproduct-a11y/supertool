import { useState } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { toast } from '../hooks/useToast'
import { buildCloudinaryUrl } from '../hooks/useScheduledPosts'
import ImageUploadModal from './ImageUploadModal'
import type { ScheduledPost, SchedulePostPayload } from '../types'

// ─── Status badge ─────────────────────────────────────────────────────────────

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
        <span className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
          Scheduled · {formatted}
        </span>
      </div>
    )
  }
  if (post.status === 'published') {
    return (
      <div className="flex justify-center">
        <span className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700">
          Published
        </span>
      </div>
    )
  }
  if (post.status === 'failed') {
    return (
      <div className="flex justify-center">
        <span className="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700">
          Failed
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

// ─── Action modal ───────────────────────────────────────────────────────────

interface ActionModalProps {
  post: ScheduledPost
  onClose: () => void
  onAction: (payload: SchedulePostPayload) => Promise<boolean>
}

function ActionModal({ post, onClose, onAction }: ActionModalProps) {
  const [selectedDateTime, setSelectedDateTime] = useState<string>(
    post.status === 'scheduled' && post.scheduled_time
      ? new Date(post.scheduled_time).toISOString().slice(0, 16)
      : getDefaultDateTime()
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  function getDefaultDateTime(): string {
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15)
    now.setSeconds(0)
    return now.toISOString().slice(0, 16)
  }

  async function handleAction(action: SchedulePostPayload['action']) {
    if ((action === 'schedule' || action === 'reschedule') && !selectedDateTime) {
      toast.error('Please select a date and time')
      return
    }

    setIsSubmitting(true)
    const payload: SchedulePostPayload = {
      postId: post.id,
      action,
      scheduledTime: selectedDateTime || undefined,
      platform: 'facebook',
    }

    const success = await onAction(payload)
    setIsSubmitting(false)

    if (success) {
      toast.success(
        action === 'publish_now'
          ? 'Post published!'
          : action === 'schedule'
            ? 'Post scheduled!'
            : action === 'reschedule'
              ? 'Schedule updated!'
              : 'Schedule removed!'
      )
      onClose()
    } else {
      toast.error('Action failed. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full space-y-6 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-neutral-950">
              {post.status === 'scheduled' ? 'Reschedule Post' : 'Schedule Post'}
            </h3>
            <p className="text-xs text-neutral-500 mt-1">{post.title}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 text-xl leading-none">
            ×
          </button>
        </div>

        {/* DateTime Picker */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-2">Schedule Date & Time</label>
          <input
            type="datetime-local"
            value={selectedDateTime}
            onChange={(e) => setSelectedDateTime(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {post.status === 'pending' && (
            <>
              <button
                onClick={() => handleAction('schedule')}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Scheduling...' : 'Schedule'}
              </button>
              <button
                onClick={() => handleAction('publish_now')}
                disabled={isSubmitting}
                className="w-full py-2 rounded-lg text-sm font-medium border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Posting...' : 'Post Now'}
              </button>
            </>
          )}

          {post.status === 'scheduled' && (
            <>
              <button
                onClick={() => handleAction('reschedule')}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Updating...' : 'Update Schedule'}
              </button>
              <button
                onClick={() => handleAction('remove_schedule')}
                disabled={isSubmitting}
                className="w-full py-2 rounded-lg text-sm font-medium border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Removing...' : 'Remove Schedule'}
              </button>
            </>
          )}

          {post.status === 'failed' && (
            <button
              onClick={() => handleAction('schedule')}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Retrying...' : 'Retry'}
            </button>
          )}
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
  const [editTitle, setEditTitle] = useState(post.title)
  const [editCaption, setEditCaption] = useState(post.caption)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)

  // Real-time Cloudinary preview URL — updates as user edits title
  const previewPublicId = uploadedPublicId ?? post.photoPublicId
  const previewUrl = buildCloudinaryUrl(previewPublicId, editTitle, post.imageUrl)

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
      a.download = `${post.brand}-${post.date}-${Date.now()}.jpg`
      a.click()
    } catch {
      toast.error('Download failed.')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {showActionModal && (
        <ActionModal post={post} onClose={() => setShowActionModal(false)} onAction={onSchedule} />
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
              onChange={(e) => setEditTitle(e.target.value)}
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
              onChange={(e) => setEditCaption(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              placeholder="Facebook caption"
            />
          </div>

          {/* Action buttons — changes based on status */}
          <div className="flex flex-col gap-2 mt-auto">
            {post.status === 'published' && (
              <p className="text-xs text-neutral-500 text-center py-2">Post published to Facebook</p>
            )}

            {(post.status === 'pending' || post.status === 'scheduled' || post.status === 'failed') && (
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50 transition"
                >
                  Download image
                </button>
                <button
                  onClick={() => setShowActionModal(true)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
                >
                  {post.status === 'pending' && 'Schedule'}
                  {post.status === 'scheduled' && 'Edit Schedule'}
                  {post.status === 'failed' && 'Retry'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
