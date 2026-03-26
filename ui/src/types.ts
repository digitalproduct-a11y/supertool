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

// Article Generator tool types
export type ArticleGeneratorStep = 'input' | 'processing' | 'angle-selection' | 'writing' | 'article' | 'thumbnail-choice' | 'thumbnail-prompt' | 'thumbnail-result'

export interface BrandVoice {
  language: string
  tone: string
  voice: string
  writing_style: string
  hook_style: string
  audience_focus: string
  article_voice_guide: string
  brand_hex: string
}

export interface Product {
  cleanProductName: string
  imageUrl: string
  priceMin: number
  ratingStar: number
  sales: number
  shopName: string
  affiliateLink: string
  productFeatures: string
}

export interface SuggestedAngle {
  id: number
  title: string
  description: string
}

export interface ArticleIntakeResponse {
  brand_voice: BrandVoice
  products: Product[]
  suggested_angles: SuggestedAngle[]
  overall_theme: string
}

export interface ArticleGenerateResponse {
  article_html: string
  article_title: string
}

export interface ThumbnailPromptResponse {
  image_prompt: string
}

export interface ThumbnailGenerateResponse {
  thumbnail_url: string
}

export interface ArticleGeneratorState {
  step: ArticleGeneratorStep
  brand: string
  links: string[]
  brandVoice?: BrandVoice
  products?: Product[]
  suggestedAngles?: SuggestedAngle[]
  overallTheme?: string
  selectedAngle?: number
  customAngle?: string
  articleHtml?: string
  articleTitle?: string
  imagePrompt?: string
  thumbnailUrl?: string
  isLoading: boolean
  error?: string
}
