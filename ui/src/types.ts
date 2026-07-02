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
  is_competitor?: boolean
  // For partial regenerations — pass through existing values
  imageUrl?: string
  caption?: string
  title?: string
  subtitle?: string
  category?: string
}

export interface WorkflowResult {
  success: true
  imageUrl: string
  caption: string
  title: string
  subtitle?: string
  originalTitle: string
  brand: string
  category?: string
  cloudinary_url?: string
  cloudinary_public_id?: string
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
  trendingTopicsWebhookEnvVar?: string
  webhookEnvVar: string
  uploadPresetEnvVar: string
  templateImages: [string, string, string]
  loadingSteps: [string, string, string]
  loadingQuotes: string[]
  loadingIcon?: string
  downloadPrefix: string
  // When true, IdeaCard renders the preview client-side via fabric.js instead of
  // building a Cloudinary transformation URL. Cloudinary upload happens lazily
  // at schedule-time only.
  useFabricCanvas?: boolean
  // Canvas-based rendering (Fabric) instead of Cloudinary URL (motogp/badminton topics)
  useCanvas?: boolean
  // Dedicated photos webhook + fixed cache/upload tag (e.g. 'Badminton', 'MotoGP')
  photosWebhookEnvVar?: string
  photosCacheKey?: string
  // Text field limits
  headlineLimit?: number
  subtitleLimit?: number
  captionLimit?: number
  // Optional per-topic copy overrides. Defaults match EPL/UCL (sports voice).
  introDescription?: string     // Short description shown on the intro card
  pageSubtitle?: string         // Hero subtitle under the page title
  loadingEmoji?: string         // Emoji shown on loading panels (default ⚽)
  fetchingTitle?: string        // e.g. "Fetching Trending News" / "Fetching Entertainment News"
  fetchingSubtext?: string      // small grey line under fetchingTitle
  fetchButtonIdle?: string      // Brand-stage CTA, idle state
  fetchButtonBusy?: string      // Brand-stage CTA, in-flight state
  personLabel?: string          // IdeaCard label, e.g. "Reference player" or "Reference celebrity"
  // Post-type options shown in TrendingTopicsSelector. IDs MUST match what the
  // downstream Generate Posts workflow expects — sending an unknown id makes
  // the LLM emit `type: "skip"` and the user gets no cards back.
  postTypes?: Array<{ id: string; label: string }>
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
export type PostFormat = string
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
  post_type?: string
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

// Article to Photo Carousels tool types
export interface CarouselImage {
  id: string
  src: string
  alt: string
  type: 'hero' | 'pexels' | 'article'
  photographer?: string
  overlays: unknown[]
  imageTitle?: string
}

export interface CarouselResult {
  success: true
  title: string
  originalTitle: string
  brand: string
  caption: string
  images: CarouselImage[]
  articleImages: string[]   // raw image URLs extracted from article body by n8n
}

export interface CarouselError {
  success: false
  error: 'brand_invalid' | 'link_invalid' | 'execution_error'
  message: string
}

export type CarouselResponse = CarouselResult | CarouselError

export const CAROUSEL_PROGRESS_STEPS = [
  { label: 'Checking your brand', subtitle: 'Confirming brand voice and settings', duration: 6000 },
  { label: 'Reading the article', subtitle: 'Pulling the story and key details', duration: 8000 },
  { label: 'Designing main image', subtitle: 'Composing the primary visual', duration: 10000 },
  { label: 'Finding carousel photos', subtitle: 'Searching for related images', duration: 8000 },
  { label: 'Applying brand layouts', subtitle: 'Styling carousel thumbnails', duration: 10000 },
  { label: 'Writing the caption', subtitle: 'Crafting your post copy', duration: 10000 },
] as const

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
  cloudinary_url?: string         // raw background photo URL (no overlays)
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

// Zernio Scheduled Queue types
export interface ZernioPlatformEntry {
  platform: string
  accountId?: {
    _id: string
    platform: string
    username?: string
    displayName?: string
    isActive?: boolean
  }
  status?: string
  platformPostUrl?: string
}

export interface ZernioPost {
  _id: string
  status: 'scheduled'
  title?: string
  content: string
  scheduledFor: string     // ISO 8601
  timezone?: string
  platforms: ZernioPlatformEntry[]
  tags?: string[]
  createdAt: string
  updatedAt?: string
}

export interface ZernioPagination {
  page: number
  limit: number
  total: number
  pages: number
}

export interface ZernioPostsResponse {
  posts: ZernioPost[]
  pagination: ZernioPagination
}

// Social Affiliate Posting tool types
export type SocialAffiliateState = 'idle' | 'loading' | 'success' | 'error'

export interface SocialAffiliateFormData {
  productName: string
  affiliateLink: string
  angle: string
  targetAudience: string
  tone: string
  brand: string
}

export interface SocialAffiliateThreadPost {
  postNumber: number
  title: string
  content: string
}

export interface SocialAffiliateThreadsResult {
  contentLabel: string
  posts: SocialAffiliateThreadPost[]
}

export interface SocialAffiliateFacebookResult {
  contentLabel: string
  paragraphs: string[]
  fullText: string
}

export interface SocialAffiliateGenerationResult {
  sessionId: string
  createdAt: string
  productName: string
  affiliateLink: string
  affiliateLinkGenerated?: string
  angle: string
  targetAudience: string
  tone: string
  threads: SocialAffiliateThreadsResult
  facebook: SocialAffiliateFacebookResult
  thumbnailUrl?: string
}

// Quick Fact Generator tool types
export interface QuickFactItem {
  header: string
  body: string
}

export interface QuickFactResult {
  success: true
  imageUrl: string
  sectionLabel: string
  title: string
  facts: QuickFactItem[]
  keyPhrase: string
  caption: string
  brand: string
  cloudinary_url?: string
}

// CMS Quick Fact carousel (workflow uYavn7y5GXBezjkw). Unlike QuickFactResult
// (the legacy single-image tool) the n8n workflow now returns DATA only — the
// 4–6 slide carousel is rendered client-side with Fabric.js. `category` is the
// brand's language family ('Chinese' | 'Malay' | 'English') and drives fonts +
// date/source formatting; `heroPublicId` is a CORS-safe Cloudinary id used as
// the cover hero so canvas export (toDataURL) isn't tainted.
export interface QuickFactData {
  title: string
  sectionLabel: string
  keyPhrase: string
  caption: string
  summary: string
  facts: QuickFactItem[]
  heroPublicId: string
  heroUrl: string
  brand: string
  brandHex: string
  logoPublicId: string
  fontUse: string
  category: string
  language: string
}

export interface QuickFactError {
  success: false
  message: string
}

export type QuickFactResponse = QuickFactResult | QuickFactError

// TV Script to Post types
export interface PrimeTalkTopic {
  id: string
  title: string
  summary: string
  suitable_angle_ids: number[]
}

export interface PrimeTalkAnalysisResponse {
  success: true
  topics: PrimeTalkTopic[]
  script_analysis: Record<string, unknown>
}

export interface PrimeTalkAnalysisError {
  success: false
  message: string
}

export type PrimeTalkAnalysisResult = PrimeTalkAnalysisResponse | PrimeTalkAnalysisError

export interface TopicAngleSelection {
  topicId: string
  topicTitle: string
  topicSummary: string
  angleId: number
  angleLabel: string
}

export interface PrimeTalkGenerateRequest {
  script_analysis: Record<string, unknown>
  selections: TopicAngleSelection[]
  brand: 'hotspot'
}
