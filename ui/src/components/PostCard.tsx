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

// ─── Schedule modal ───────────────────────────────────────────────────────────

function ScheduleModal({
  onClose,
}: {
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-neutral-950 mb-1">Feature Coming Soon!</h3>
          <p className="text-sm text-neutral-500">Facebook scheduling will be available soon. Check back later.</p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: ScheduledPost
  onSchedule: (payload: SchedulePostPayload) => Promise<boolean>
}

export function PostCard({ post, onSchedule: _onSchedule }: PostCardProps) {
  // Note: onSchedule callback is prepared for future scheduling functionality
  const [editTitle, setEditTitle] = useState(post.title)
  const [committedTitle, setCommittedTitle] = useState(post.title)
  const [editCaption, setEditCaption] = useState(post.caption)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)

  // Cloudinary preview URL — only updates when user commits title (on blur)
  const previewPublicId = uploadedPublicId ?? post.photoPublicId
  const previewUrl = buildCloudinaryUrl(previewPublicId, committedTitle, post.imageUrl)

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {showScheduleModal && (
        <ScheduleModal
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
                onClick={() => setShowScheduleModal(true)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-neutral-950 text-white hover:bg-neutral-800 transition"
              >
                Schedule on FB
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
