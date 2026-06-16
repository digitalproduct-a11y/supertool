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
