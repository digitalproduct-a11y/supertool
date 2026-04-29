import { useState } from 'react'
import type { PrimeTalkTopic, TopicAngleSelection } from '../types'
import { PRIME_TALK_ANGLES } from '../constants/primeTalkAngles'

interface PrimeTalkAngleSelectorProps {
  topics: PrimeTalkTopic[]
  isLoading: boolean
  onGenerate: (selections: TopicAngleSelection[]) => void
}

export default function PrimeTalkAngleSelector({ topics, isLoading, onGenerate }: PrimeTalkAngleSelectorProps) {
  const [selections, setSelections] = useState<Record<string, TopicAngleSelection>>({})
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())

  const handleTopicToggle = (topic: PrimeTalkTopic) => {
    const next = { ...selections }
    if (next[topic.id]) {
      delete next[topic.id]
    } else {
      next[topic.id] = {
        topicId: topic.id,
        topicTitle: topic.title,
        topicSummary: topic.summary,
        angleId: 0,
        angleLabel: '',
      }
    }
    setSelections(next)
  }

  const handleAngleChange = (topicId: string, angleId: number) => {
    const angle = PRIME_TALK_ANGLES.find((a) => a.id === angleId)
    if (!angle) return
    setSelections({
      ...selections,
      [topicId]: {
        ...selections[topicId],
        angleId,
        angleLabel: angle.label,
      },
    })
  }

  const handleExpand = (topicId: string) => {
    const next = new Set(expandedTopics)
    next.add(topicId)
    setExpandedTopics(next)
  }

  const selectedList = Object.values(selections)
  const canGenerate = selectedList.length > 0 && selectedList.every((s) => s.angleId > 0)

  const handleGenerate = () => {
    if (!canGenerate) return
    onGenerate(selectedList)
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-950 mb-2">Select Topics & Formats</h2>
        <p className="text-sm text-neutral-600">
          Check the topics you want to create posts for, then select an engagement angle for each one. When ready, click Generate Posts.
        </p>
      </div>

      {/* Topics + Angle table */}
      <div className="rounded-lg border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="grid gap-4 bg-neutral-50 px-4 py-3 border-b border-neutral-200" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase text-neutral-600">Topic</span>
          </div>
          <div className="text-xs font-semibold uppercase text-neutral-600">Post Format</div>
        </div>

        {/* Rows */}
        <div className="max-h-[500px] overflow-y-auto">
          {topics.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-neutral-500">No topics available</p>
            </div>
          ) : (
            topics.map((topic, idx) => {
              const isSelected = !!selections[topic.id]
              const isExpanded = expandedTopics.has(topic.id)
              // Use per-topic suitable angles
              const topicAngles = PRIME_TALK_ANGLES.filter((a) => topic.suitable_angle_ids.includes(a.id))
              return (
                <div
                  key={topic.id}
                  className={`grid gap-4 items-start px-4 py-4 border-b border-neutral-100 transition ${
                    isSelected ? 'bg-neutral-50' : 'hover:bg-neutral-50/50'
                  } ${idx === topics.length - 1 ? 'border-b-0' : ''}`}
                  style={{ gridTemplateColumns: '2fr 1fr' }}
                >
                  {/* Checkbox + topic info */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTopicToggle(topic)}
                      className="mt-1 w-4 h-4 rounded border-neutral-300 text-neutral-950 cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-950">{topic.title}</p>
                      {topic.summary && (
                        <p className={`text-xs text-neutral-500 mt-1 ${isExpanded ? '' : 'line-clamp-3'}`}>
                          {topic.summary}
                        </p>
                      )}
                      {!isExpanded && topic.summary && topic.summary.length > 160 && (
                        <button
                          onClick={() => handleExpand(topic.id)}
                          className="text-xs text-neutral-600 hover:text-neutral-950 font-medium mt-1 transition"
                        >
                          Show more
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Angle dropdown — only shows angles suitable for this topic */}
                  <div>
                    <select
                      value={selections[topic.id]?.angleId || ''}
                      onChange={(e) => handleAngleChange(topic.id, Number(e.target.value))}
                      disabled={!isSelected || isLoading}
                      className="w-full px-3 py-2 pr-8 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed"
                    >
                      <option value="">Select angle...</option>
                      {topicAngles.map((angle) => (
                        <option key={angle.id} value={angle.id}>
                          {angle.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {selectedList.length > 0 && (
        <p className="text-xs text-neutral-500">{selectedList.length} topic(s) selected</p>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate || isLoading}
        className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
      >
        {isLoading ? 'Generating Posts...' : 'Generate Posts'}
      </button>
    </div>
  )
}
