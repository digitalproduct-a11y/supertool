import {
  IconBulb,
  IconTrophy,
  IconTrendingUp,
  IconFlame,
} from "@tabler/icons-react";
import { useBrandNavigate } from "../hooks/useBrandNavigate";
import { useBrand } from "../context/BrandContext";
import { BackButton } from "../components/ds";

const BRAND_CUSTOM_ENGAGEMENT: Record<string, { label: string; path: string }[]> = {
  'Hotspot': [{ label: 'TV Script to Post', path: '/engagement-photos/prime-talk' }],
};

const TOOL_CARDS = [
  {
    title: "Fun Fact Post",
    description: "Generate trivia cards and historical 'On This Day' posts for Malaysia — branded and ready to publish.",
    gradient: "linear-gradient(135deg, #FEF1EB 0%, #FFF5F0 50%, #FFFBF8 100%)",
    icon: IconBulb,
    iconColor: "#F05A35",
    image: "/fun-fact-post-card.png",
    links: [
      { label: "Did You Know?", path: "/engagement-posts/didyouknow" },
      { label: "On This Day", path: "/engagement-posts/on-this-day-malaysia" },
    ],
  },
  {
    title: "Sports Engagement Post",
    description: "Create match-day graphics and fan engagement posts for EPL, Champions League, Badminton, and MotoGP.",
    gradient: "linear-gradient(135deg, #EEF3FF 0%, #E8EEFF 50%, #F0F4FF 100%)",
    icon: IconTrophy,
    iconColor: "#0055EE",
    image: "/sports-engagement-post-card.png",
    links: [
      { label: "EPL", path: "/engagement-posts/epl" },
      { label: "Champions League", path: "/engagement-posts/ucl" },
      { label: "Badminton", path: "/engagement-posts/badminton" },
      { label: "MotoGP", path: "/engagement-posts/motogp" },
    ],
  },
  {
    title: "Information Post",
    description: "Auto-generate daily infographics — KLCI index, currency rates, fuel prices, and weather forecasts.",
    gradient: "linear-gradient(135deg, #ECFDF5 0%, #F0FDF9 50%, #F5FEFB 100%)",
    icon: IconTrendingUp,
    iconColor: "#10B981",
    image: "/information-post-card.png",
    links: [
      { label: "KLCI Index", path: "/engagement-posts/klci-index" },
      { label: "Currency Rate", path: "/engagement-posts/latest-currency-rate" },
      { label: "Fuel Price", path: "/engagement-posts/latest-fuel-price" },
      { label: "Weather Malaysia", path: "/engagement-posts/weather-malaysia" },
      { label: "Gold Rate", path: "/engagement-posts/gold-rate" },
    ],
  },
  {
    title: "Entertainment Post",
    description: "Generate eye-catching posts for trending celebrity news, drama buzz, and pop culture moments.",
    gradient: "linear-gradient(135deg, #FFF0F7 0%, #FEF0FF 50%, #F8F0FF 100%)",
    icon: IconFlame,
    iconColor: "#FF3FBF",
    image: "/entertainment-post-card.png",
    links: [
      { label: "Malay Entertainment", path: "/engagement-posts/malay-entertainment" },
    ],
    brandSpecific: false,
  },
  {
    title: "Custom Post",
    description: "Brand-specific engagement tools tailored to your content format and audience.",
    gradient: "linear-gradient(135deg, #FEF1EB 0%, #FFF5F0 50%, #FFFBF8 100%)",
    icon: IconBulb,
    iconColor: "#F05A35",
    image: "/custom-engagement-post-card.png",
    links: [] as { label: string; path: string }[],
    sharedLinks: [
      { label: "News Poster", path: "/engagement-posts/news-poster" },
      { label: "Image Editor", path: "/engagement-posts/image-editor" },
      { label: "Clip to Carousel", path: "/engagement-posts/clip-to-carousel" },
    ] as { label: string; path: string }[],
    brandSpecific: true,
  },
];

interface EngagementPostsLandingProps {
  onSelectTopic: (id: string) => void;
}

export function EngagementPostsLanding({
  onSelectTopic: _onSelectTopic,
}: EngagementPostsLandingProps) {
  const brandNavigate = useBrandNavigate();
  const { selectedBrand, isAdmin } = useBrand();

  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <BackButton />
            <h1 className="font-display text-2xl font-semibold text-neutral-950 tracking-tight">
              Engagement posts
            </h1>
          </div>
          <p className="text-neutral-500 mt-1 text-sm">
            Create captivating social media content across different topics and
            industries.
          </p>
          <div
            className="mt-6 h-[3px] rounded-full animate-stripe-grow"
            style={{
              background:
                "linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)",
            }}
          />
        </div>

        {/* Tool cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOOL_CARDS.map((card) => {
            const Icon = card.icon;
            const brandLinks = card.brandSpecific
              ? isAdmin
                ? Object.values(BRAND_CUSTOM_ENGAGEMENT).flat()
                : (selectedBrand ? (BRAND_CUSTOM_ENGAGEMENT[selectedBrand] ?? []) : [])
              : card.links;
            const links = [...(card.sharedLinks ?? []), ...brandLinks]
              .filter((link) => link.path !== "/engagement-posts/gold-rate" || isAdmin || selectedBrand === "Astro Ulagam");
            return (
              <div
                key={card.title}
                className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden"
              >
                {/* 16:9 illustration area */}
                <div
                  className="aspect-video flex items-center justify-center overflow-hidden"
                  style={{ background: card.gradient }}
                >
                  {card.image ? (
                    <img
                      src={card.image}
                      alt={card.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon
                      className="w-12 h-12 opacity-40"
                      style={{ color: card.iconColor }}
                    />
                  )}
                </div>
                {/* Title + description */}
                <div className="px-5 pt-4 pb-2">
                  <h3 className="font-display text-base font-semibold text-neutral-950">
                    {card.title}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    {card.description}
                  </p>
                </div>
                {/* Link list */}
                <div className="pb-3">
                  {links.length > 0 ? links.map((link, i) => (
                    <button
                      key={link.path + i}
                      onClick={() => brandNavigate(link.path)}
                      className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-neutral-50 active:bg-neutral-100 transition-colors text-left"
                    >
                      <span className="text-sm text-neutral-600">
                        {link.label}
                      </span>
                      <svg
                        className="w-4 h-4 text-neutral-300 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  )) : card.brandSpecific ? (
                    <p className="px-5 py-2.5 text-sm text-neutral-300">Coming soon for your brand</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
