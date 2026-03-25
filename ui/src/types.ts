export type AppState = 'idle' | 'loading' | 'result' | 'error' | 'approved'
export type WorkflowMode = 'own_brand' | 'cross_brand'
export type TitleMode = 'original' | 'ai' | 'custom'
export type CaptionTitleMode = 'original' | 'ai'
export type WorkflowOperation = 'full' | 'image_only' | 'caption_only'

export interface WorkflowRequest {
  url: string
  brand: string
  mode: WorkflowMode
  title_mode: TitleMode
  custom_title?: string
  caption_title_mode: CaptionTitleMode
  operation?: WorkflowOperation
  // For partial regenerations — pass through existing values
  imageUrl?: string
  caption?: string
  title?: string
}

export interface WorkflowResult {
  success: true
  imageUrl: string
  caption: string
  title: string
  originalTitle: string
  brand: string
}

export interface WorkflowError {
  success: false
  error: 'brand_invalid' | 'link_invalid' | 'execution_error'
  message: string
}

export type WorkflowResponse = WorkflowResult | WorkflowError

export interface HistoryItem {
  id: string
  timestamp: Date
  brand: string
  title: string
  imageUrl: string
  caption: string
}

export const PROGRESS_STEPS = [
  { label: 'Checking your brand', subtitle: 'Confirming brand voice and settings', duration: 6000 },
  { label: 'Reading the article', subtitle: 'Pulling the story and key details', duration: 8000 },
  { label: 'Designing your image', subtitle: 'Composing the visual layout', duration: 10000 },
  { label: 'Writing the caption', subtitle: 'Crafting your post copy', duration: 10000 },
] as const

// Shopee Affiliate Links tool types
export type AffiliateLinksState = 'idle' | 'loading' | 'result' | 'error'

export interface BrandsListResponse {
  brands: string[]
}

export interface AffiliateLinksResult {
  success: true
  filename: string
}

export interface AffiliateLinksError {
  success: false
  message: string
}

export type AffiliateLinksResponse = AffiliateLinksResult | AffiliateLinksError
