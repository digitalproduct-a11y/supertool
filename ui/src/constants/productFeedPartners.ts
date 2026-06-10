// Partners and their merchants for the Product Feed Generator.
// Default partner is ChineseAN; more partners can be added here later.

export interface FeedPartner {
  id: string
  label: string
  merchants: string[]
}

export const PARTNERS: FeedPartner[] = [
  {
    id: 'chineseAN',
    label: 'ChineseAN',
    merchants: ['PUMA MY', 'Adidas MY', 'Trip.com (Flights & Hotels)'],
  },
]

export const COUNT_PRESETS = [50, 100, 150, 200] as const
export const DEFAULT_COUNT = 100
export const MAX_PER_MERCHANT = 1000
// Combined product cap across all selected merchants. Keeps the synchronous
// webhook response under the ~100s platform timeout (mirrors COMBINED_MAX in n8n).
export const COMBINED_MAX = 600
