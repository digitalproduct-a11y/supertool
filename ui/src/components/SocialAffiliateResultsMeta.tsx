import type { SocialAffiliateGenerationResult } from '../types'

const TONE_LABELS: Record<string, string> = {
  'problem-solution': 'Problem–Solution',
  'soft-sell': 'Soft Sell',
  'hard-sell': 'Hard Sell',
  'casual-rojak': 'Casual / Rojak',
  'friendly-recommendation': 'Friendly Recommendation',
}

interface SocialAffiliateResultsMetaProps {
  data: SocialAffiliateGenerationResult
}

export function SocialAffiliateResultsMeta({ data }: SocialAffiliateResultsMetaProps) {
  const metaItems = [
    { label: 'Product Name', value: data.productName },
    { label: 'Shopee Link', value: data.affiliateLink },
    { label: 'Content Angle', value: data.angle },
    { label: 'Target Audience', value: data.targetAudience },
    { label: 'Tone', value: TONE_LABELS[data.tone] || data.tone },
  ]

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {metaItems.map((item) => (
        <div key={item.label}>
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">{item.label}</p>
          <p className="text-sm text-neutral-800 break-words">{item.value}</p>
        </div>
      ))}
    </div>
  )
}
