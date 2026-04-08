export type AppState = 'idle' | 'loading' | 'result' | 'error' | 'approved'
export type TitleMode = 'original' | 'ai' | 'custom'
export type CaptionTitleMode = 'original' | 'ai'
export type WorkflowOperation = 'full' | 'image_only' | 'caption_only'

export interface WorkflowRequest {
  url: string
  brand: string
  title_mode: TitleMode
  custom_title?: string
  caption_title_mode: CaptionTitleMode
  operation?: WorkflowOperation
  custom_image?: string
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
export type ArticleGeneratorStep = 'input' | 'pick-angle' | 'review-article' | 'thumbnail' | 'done'

// Topic config for multi-topic engagement posts
export interface TopicConfig {
  id: string
  label: string
  webhookEnvVar: string
  uploadPresetEnvVar: string
  templateImages: [string, string, string]
  loadingSteps: [string, string, string]
  loadingQuotes: string[]
  downloadPrefix: string
}

// Engagement Photos tool types
export interface EngagementPost {
  headline: string
  subtitle: string
  caption: string
  image_url: string
}

export interface EngagementPhotosResponse {
  success: true
  posts: EngagementPost[]
}

export interface EngagementPhotosError {
  success: false
  message: string
}

export type EngagementPhotosResult = EngagementPhotosResponse | EngagementPhotosError

// Engagement Photos post formats
export type PostFormat = 'challenge' | 'debate' | 'nostalgia' | 'quiz' | 'hot_take'
export type IdeaStatus = 'draft' | 'selected' | 'rendered'

export interface Brand {
  id: string
  name: string
  language: string
  tone: string
  voice: string
  writing_style: string
  logo_url: string
}

export interface EngagementIdea {
  id: string
  type: PostFormat
  headline: string
  subtitle: string
  caption: string
  player: string
  club?: string
  photo_url: string | null
  photo_public_id: string | null
  status: IdeaStatus
  context?: string
}

export interface EngagementIdeaRequest {
  brand: string
  language: string
}

export interface EngagementIdeaResponse {
  success: true
  ideas: EngagementIdea[]
}

export interface EngagementRenderRequest {
  ideas: EngagementIdea[]
  brand_logo_url: string
  template_id: string
}

export interface EngagementRenderResponse {
  success: true
  ideas: EngagementIdea[]
}

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
  shopTypeLabel?: string
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

// Scheduled Posts tool types
export type ScheduledPostStatus = 'pending' | 'scheduled' | 'published' | 'error'

export interface ScheduledPost {
  id: string
  date: string            // YYYY-MM-DD
  brand: string
  origin: string          // e.g., 'www.astroawani.com'
  articleUrl: string
  articleTitle: string
  imageUrl: string        // full Cloudinary URL with transformations
  photoPublicId: string   // base image public ID
  title: string           // editable text overlay on image
  caption: string         // editable FB caption
  status: ScheduledPostStatus
  scheduled_time: string | null   // ISO 8601 or null
  scheduled_to: string | null     // 'facebook' or null
  error_message: string | null
}

export interface FetchScheduledPostsResponse {
  success: true
  posts: ScheduledPost[]
}

export interface UpdatePostPayload {
  postId: string
  updates: Partial<Pick<ScheduledPost, 'title' | 'caption' | 'imageUrl' | 'photoPublicId'>>
}

export interface SchedulePostPayload {
  postId: string
  scheduledTime: string   // ISO 8601
  platform: 'facebook'
}
