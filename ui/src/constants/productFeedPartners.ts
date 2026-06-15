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

// The combined Excel is always capped at this many rows, fairly (round-robin)
// split across the selected brands. One brand selected = its full 1000.
// Editors get a brand's complete feed by selecting just that brand.
export const COMBINED_TOTAL = 1000
