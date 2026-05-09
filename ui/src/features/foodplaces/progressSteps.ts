import type { ProgressStep } from '../carousel/CarouselProgressSteps'

export const FOOD_PLACES_PROGRESS_STEPS: readonly ProgressStep[] = [
  { label: 'Checking your brand', subtitle: 'Confirming brand voice and settings', duration: 4000 },
  { label: 'Querying Google Places', subtitle: 'Finding spots near your location', duration: 8000 },
  { label: 'Filtering results', subtitle: 'Halal, dish match, and quality filters', duration: 6000 },
  { label: 'Tier-ranking spots', subtitle: 'Picking the top picks', duration: 6000 },
  { label: 'Writing cover title', subtitle: 'Crafting a brand-voiced headline', duration: 8000 },
  { label: 'Drafting caption', subtitle: 'Composing the FB post copy', duration: 8000 },
] as const
