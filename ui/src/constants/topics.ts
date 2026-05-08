import type { TopicConfig } from "../types";

const SHARED_TEMPLATE_IMAGES: [string, string, string] = [
  "https://res.cloudinary.com/dymmqtqyg/image/upload/v1775189927/epl-post-challenge_1_byvuse.jpg",
  "https://res.cloudinary.com/dymmqtqyg/image/upload/v1775199810/epl-post-debate_sqjs6z.jpg",
  "https://res.cloudinary.com/dymmqtqyg/image/upload/v1775199812/epl-post-quiz_c1piip.jpg",
];

export const TOPIC_CONFIGS: Record<string, TopicConfig> = {
  epl: {
    id: "epl",
    label: "EPL",
    trendingTopicsWebhookEnvVar: "VITE_ENGAGEMENT_TRENDING_TOPICS_WEBHOOK_URL",
    webhookEnvVar: "VITE_EPL_IDEA_GENERATION_WEBHOOK_URL",
    uploadPresetEnvVar: "VITE_CLOUDINARY_EPL_UPLOAD_PRESET",
    templateImages: SHARED_TEMPLATE_IMAGES,
    loadingSteps: [
      "Scanning latest EPL news",
      "Curating top stories",
      "Generating 5 post ideas",
    ],
    loadingQuotes: [
      "VAR checking the vibes...",
      "Consulting the dugout...",
      "Asking the fans...",
      "Reading the match report...",
    ],
    downloadPrefix: "epl-post",
  },
  ucl: {
    id: "ucl",
    label: "Champions League",
    trendingTopicsWebhookEnvVar: "VITE_UCL_TRENDING_TOPICS_WEBHOOK_URL",
    webhookEnvVar: "VITE_UCL_IDEA_GENERATION_WEBHOOK_URL",
    uploadPresetEnvVar: "VITE_CLOUDINARY_UCL_UPLOAD_PRESET",
    templateImages: SHARED_TEMPLATE_IMAGES,
    loadingSteps: [
      "Scanning latest UCL news",
      "Curating top stories",
      "Generating 5 post ideas",
    ],
    loadingQuotes: [
      "Checking VAR in UEFA HQ...",
      "Consulting the dugout...",
      "Asking the ultras...",
      "Reading the match report...",
    ],
    downloadPrefix: "ucl-post",
  },
  "gempak-entertainment": {
    id: "gempak-entertainment",
    label: "Entertainment",
    trendingTopicsWebhookEnvVar: "VITE_GEMPAK_ENT_FETCH_IDEAS_WEBHOOK_URL",
    webhookEnvVar: "VITE_GEMPAK_ENT_GENERATE_POSTS_WEBHOOK_URL",
    uploadPresetEnvVar: "VITE_CLOUDINARY_GEMPAK_ENT_UPLOAD_PRESET",
    templateImages: SHARED_TEMPLATE_IMAGES,
    loadingSteps: [
      "Scanning entertainment news",
      "Curating top stories",
      "Refining captions with AI",
    ],
    loadingQuotes: [
      "Browsing the latest gossip...",
      "Asking the showbiz insiders...",
      "Reading the headlines...",
      "Polishing the punchlines...",
    ],
    downloadPrefix: "gempak-ent-post",
    useFabricCanvas: true,
    pageSubtitle:
      "Create engaging entertainment posts featuring Malaysian celebrities and influencers",
    loadingEmoji: "🎤",
    fetchingTitle: "Fetching Entertainment News",
    fetchingSubtext:
      "Scanning Malay entertainment feeds and curating stories...",
    fetchButtonIdle: "Get Trending Topics",
    fetchButtonBusy: "Fetching Trending Topics...",
    personLabel: "Reference celebrity",
    // IDs must match the Gempak Generate Posts LLM prompt formats —
    // sending anything else makes the LLM emit `type: "skip"`.
    postTypes: [
      { id: "viral-reaction", label: "Viral Reaction" },
      { id: "caption-this", label: "Caption This" },
      { id: "relationship-yes-no", label: "Couple Support" },
      { id: "hot-take", label: "Hot Take" },
      { id: "celeb-quotes", label: "Celebrity Quote" },
      { id: "rate-it", label: "Rate It" },
    ],
  },
};
