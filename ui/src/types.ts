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

// Shopee Article Generator types
export type ArticleState =
  | 'idle'
  | 'processing_products'
  | 'angle_selection'
  | 'generating_article'
  | 'review_draft'
  | 'revising_article'
  | 'thumbnail_prompt'
  | 'generating_thumbnail'
  | 'thumbnail_result'
  | 'revising_thumbnail'
  | 'done'
  | 'error'

export interface ContentAngle {
  title: string
  category: string
  game_plan: string
}

export interface ProductSummary {
  name: string
  price: string
  rating: string
  affiliateLink: string
  imageUrl: string
}

export interface ArticleContext {
  brand: string
  articleTitle: string
  productName: string
  imageUrl: string
  productFeatures: string
}

export interface ArticleGeneratorState {
  state: ArticleState
  products: ProductSummary[]
  angles: ContentAngle[]
  context: ArticleContext | null
  articleHtml: string
  articleTitle: string
  thumbnailPrompt: string
  thumbnailUrl: string
  errorMessage: string
}

export interface ProcessProductsResponse {
  success: true
  products: ProductSummary[]
  angles: ContentAngle[]
  context: ArticleContext
}

export interface GenerateArticleResponse {
  success: true
  article_html: string
  article_title: string
  context: ArticleContext
}

export interface PrepareThumbnailResponse {
  success: true
  prompt: string
  context: ArticleContext
}

export interface GenerateThumbnailResponse {
  success: true
  thumbnail_url: string
}

export interface ReviseThumbnailResponse {
  success: true
  thumbnail_url: string
  prompt: string
}

export interface ArticleError {
  success: false
  error: 'execution_error' | 'validation_error'
  message: string
}

export type ArticleResponse =
  | ProcessProductsResponse
  | GenerateArticleResponse
  | PrepareThumbnailResponse
  | GenerateThumbnailResponse
  | ReviseThumbnailResponse
  | ArticleError
