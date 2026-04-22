import { useState } from 'react'
import type { TrendingTopic } from '../hooks/useEngagementPhotos'

const POST_TYPES = [
  { id: 'challenge', label: 'Challenge' },
  { id: 'debate', label: 'Debate' },
  { id: 'prediction', label: 'Prediction' },
  { id: 'rate_it', label: 'Rate It' },
  { id: 'this_or_that', label: 'This or That' },
  { id: 'stat_drop', label: 'Stat Drop' },
  { id: 'agree_or_disagree', label: 'Agree or Disagree' },
  { id: 'quote', label: 'Quote' },
]

interface TopicSelection {
  topicId: string
  postType: string
}

interface TrendingTopicsSelectorProps {
  topics: TrendingTopic[]
  isLoading: boolean
  onGenerate: (selections: TopicSelection[]) => void
}

export default function TrendingTopicsSelector({ topics, isLoading, onGenerate }: TrendingTopicsSelectorProps) {
  const [selections, setSelections] = useState<Record<string, TopicSelection>>({})
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())

  const handleTopicToggle = (topicId: string) => {
    const newSelections = { ...selections }
    if (newSelections[topicId]) {
      delete newSelections[topicId]
    } else {
      newSelections[topicId] = { topicId, postType: '' }
    }
    setSelections(newSelections)
  }

  const handleTypeChange = (topicId: string, postType: string) => {
    setSelections({
      ...selections,
      [topicId]: { topicId, postType },
    })
  }

  const handleExpand = (topicId: string) => {
    const newExpanded = new Set(expandedTopics)
    newExpanded.add(topicId)
    setExpandedTopics(newExpanded)
  }

  const handleGenerate = () => {
    const selectedList = Object.values(selections)
    if (selectedList.length === 0) {
      alert('Please select at least one topic')
      return
    }
    if (selectedList.some((s) => !s.postType)) {
      alert('Please select a post type for each topic')
      return
    }
    onGenerate(selectedList)
  }

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-950 mb-2">Select Topics & Formats</h2>
        <p className="text-sm text-neutral-600">
          Check the topics you want to create posts for, then select a post format (Challenge, Debate, etc.) for each one. When ready, click Generate Posts.
        </p>
      </div>

      {/* Topics with Post Types */}
      <div className="rounded-lg border border-neutral-200 overflow-hidden">
          {/* Header */}
          <div className="grid gap-4 bg-neutral-50 px-4 py-3 border-b border-neutral-200" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase text-neutral-600">Topic</span>
            </div>
            <div className="text-xs font-semibold uppercase text-neutral-600">Post Format</div>
          </div>

          {/* Topics List */}
          <div className="max-h-[500px] overflow-y-auto">
            {topics.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-neutral-500">No topics available</p>
              </div>
            ) : (
              topics.map((topic, idx) => {
                const isSelected = !!selections[topic.id]
                return (
                  <div
                    key={topic.id}
                    className={`grid gap-4 items-start px-4 py-4 border-b border-neutral-100 transition ${
                      isSelected ? 'bg-neutral-50' : 'hover:bg-neutral-50/50'
                    } ${idx === topics.length - 1 ? 'border-b-0' : ''}`}
                    style={{ gridTemplateColumns: '2fr 1fr' }}
                  >
                    {/* Checkbox & Topic Info */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTopicToggle(topic.id)}
                        className="mt-1 w-4 h-4 rounded border-neutral-300 text-neutral-950 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-950">{topic.title}</p>
                        <p className={`text-xs text-neutral-500 mt-1 ${expandedTopics.has(topic.id) ? '' : 'line-clamp-3'}`}>
                          {topic.content}
                        </p>
                        {!expandedTopics.has(topic.id) && topic.content.length > 200 && (
                          <button
                            onClick={() => handleExpand(topic.id)}
                            className="text-xs text-neutral-600 hover:text-neutral-950 font-medium mt-1 transition"
                          >
                            Show more
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Post Type Dropdown */}
                    <div>
                      <select
                        value={selections[topic.id]?.postType || ''}
                        onChange={(e) => handleTypeChange(topic.id, e.target.value)}
                        disabled={!isSelected || isLoading}
                        className="w-full px-3 py-2 pr-8 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white appearance-none cursor-pointer transition disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed"
                      >
                        <option value="">Select post format...</option>
                        {POST_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
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

      {Object.keys(selections).length > 0 && (
        <p className="text-xs text-neutral-500 mt-2">{Object.keys(selections).length} topic(s) selected</p>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={Object.keys(selections).length === 0 || Object.values(selections).some((s) => !s.postType) || isLoading}
        className="w-full px-4 py-3 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
      >
        {isLoading ? 'Generating Posts...' : 'Generate Posts'}
      </button>
    </div>
  )
}
