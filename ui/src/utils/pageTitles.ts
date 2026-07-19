const DEFAULT_TITLE = 'KULT Digital Kit'

const FEATURE_TITLES: Record<string, string> = {
  'home': 'Home',
  'article-to-social': 'Article to Social',
  'article-to-fb': 'Article to FB Photos',
  'article-to-carousel': 'Article to Carousel',
  'engagement-posts/clip-to-carousel': 'Clip to Carousel',
  'news-feed': 'News Feed',
  'affiliate-links': 'Affiliate Links',
  'affiliate-article-editor': 'Affiliate Article Editor',
  'engagement-posts': 'Engagement Posts',
  'engagement-posts/epl': 'EPL Photos',
  'engagement-posts/ucl': 'UCL Photos',
  'engagement-posts/malay-entertainment': 'Malay Entertainment Photos',
  'engagement-posts/badminton': 'Badminton Photos',
  'engagement-posts/motogp': 'MotoGP Photos',
  'engagement-posts/worldcup': 'World Cup Photos',
  'engagement-posts/latest-currency-rate': 'Latest Currency Rate',
  'engagement-posts/latest-fuel-price': 'Latest Fuel Price',
  'engagement-posts/klci-index': 'KLCI Index',
  'engagement-posts/on-this-day-malaysia': 'On This Day Malaysia',
  'engagement-posts/weather-malaysia': 'Weather Malaysia',
  'engagement-posts/quote': 'Quote',
  'engagement-posts/didyouknow': 'Did You Know',
  'engagement-photos/prime-talk': 'Prime Talk',
  'shopee-top-products': 'Shopee Top Products',
  'post-queue': 'Post Queue',
  'social-affiliate-posting': 'Social Affiliate Posting',
  'quick-fact': 'Quick Fact',
  'dashboard': 'Dashboard',
  'weekly-report': 'Weekly Report',
  'youtube-dashboard': 'YouTube Dashboard',
}

export function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Select Brand'
  if (pathname.startsWith('/start')) return 'Get Started'

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2) return DEFAULT_TITLE

  const featurePath = segments.slice(1).join('/')
  return FEATURE_TITLES[featurePath] ?? DEFAULT_TITLE
}
