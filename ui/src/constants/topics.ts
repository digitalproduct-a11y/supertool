import type { TopicConfig } from '../types'

const SHARED_TEMPLATE_IMAGES: [string, string, string] = [
  'https://res.cloudinary.com/dymmqtqyg/image/upload/v1775189927/epl-post-challenge_1_byvuse.jpg',
  'https://res.cloudinary.com/dymmqtqyg/image/upload/v1775199810/epl-post-debate_sqjs6z.jpg',
  'https://res.cloudinary.com/dymmqtqyg/image/upload/v1775199812/epl-post-quiz_c1piip.jpg',
]

export const TOPIC_CONFIGS: Record<string, TopicConfig> = {
  epl: {
    id: 'epl',
    label: 'EPL',
    trendingTopicsWebhookEnvVar: 'VITE_ENGAGEMENT_TRENDING_TOPICS_WEBHOOK_URL',
    webhookEnvVar: 'VITE_EPL_IDEA_GENERATION_WEBHOOK_URL',
    uploadPresetEnvVar: 'VITE_CLOUDINARY_EPL_UPLOAD_PRESET',
    templateImages: SHARED_TEMPLATE_IMAGES,
    loadingSteps: ['Scanning latest EPL news', 'Curating top stories', 'Generating 5 post ideas'],
    loadingQuotes: ['VAR checking the vibes...', 'Consulting the dugout...', 'Asking the fans...', 'Reading the match report...'],
    downloadPrefix: 'epl-post',
  },
  ucl: {
    id: 'ucl',
    label: 'Champions League',
    trendingTopicsWebhookEnvVar: 'VITE_UCL_TRENDING_TOPICS_WEBHOOK_URL',
    webhookEnvVar: 'VITE_UCL_IDEA_GENERATION_WEBHOOK_URL',
    uploadPresetEnvVar: 'VITE_CLOUDINARY_UCL_UPLOAD_PRESET',
    templateImages: SHARED_TEMPLATE_IMAGES,
    loadingSteps: ['Scanning latest UCL news', 'Curating top stories', 'Generating 5 post ideas'],
    loadingQuotes: ['Checking VAR in UEFA HQ...', 'Consulting the dugout...', 'Asking the ultras...', 'Reading the match report...'],
    downloadPrefix: 'ucl-post',
  },
}
