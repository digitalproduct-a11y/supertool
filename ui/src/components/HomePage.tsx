import type React from "react";
import {
  IconPhoto,
  IconTrendingUp,
  IconHeart,
  IconStack2,
  IconCarouselHorizontal,
  IconLink,
  IconFileText,
  IconActivity,
  IconBrain,
  IconCalendar,
  IconShoppingBag,
} from "@tabler/icons-react";

type ToolId =
  | "home"
  | "fb-post"
  | "trending-news"
  | "affiliate-links"
  | "article-generator"
  | "engagement-posts"
  | "engagement-photos"
  | "scheduled-posts"
  | "shopee-top-products"
  | "photo-carousel";

interface Tool {
  id: ToolId;
  label: string;
  description: string;
  color: string;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  comingSoon?: boolean;
}

interface Section {
  label: string;
  description: string;
  tools: Tool[];
}

const sections: Section[] = [
  {
    label: "Social",
    description:
      "Turn articles and trends into ready-to-post social platform visuals.",
    tools: [
      {
        id: "fb-post",
        label: "Article to FB Photos",
        description: "Turn any article into a Facebook image and caption",
        color: "#0055EE",
        icon: IconPhoto,
      },
      {
        id: "trending-news",
        label: "Trending News to FB Photos",
        description: "Turn trending news into Facebook-ready visuals",
        color: "#0055EE",
        icon: IconTrendingUp,
      },
      {
        id: "engagement-posts",
        label: "Engagement Photos Generator",
        description: "Create engagement-driving photo posts",
        color: "#0055EE",
        icon: IconHeart,
      },
      {
        id: "scheduled-posts",
        label: "Schedule Trending News",
        description: "Schedule trending news posts across brands",
        color: "#0055EE",
        icon: IconCalendar,
      },
      {
        id: "photo-carousel",
        label: "Article to Photo Carousels",
        description: "Transform articles into swipeable photo carousels",
        color: "#0055EE",
        icon: IconCarouselHorizontal,
      },
    ],
  },
  {
    label: "Affiliate",
    description:
      "Generate affiliate content faster and drive more commissions.",
    tools: [
      {
        id: "affiliate-links",
        label: "Shopee Affiliate Links",
        description: "Upload a file to generate Shopee affiliate links",
        color: "#F05A35",
        icon: IconLink,
      },
      {
        id: "article-generator",
        label: "Affiliate Article Editor",
        description: "Write engaging Shopee product articles from links",
        color: "#F05A35",
        icon: IconFileText,
      },
      {
        id: "shopee-top-products",
        label: "Shopee Top Products",
        description: "Discover and share top-performing Shopee products",
        color: "#F05A35",
        icon: IconShoppingBag,
      },
    ],
  },
  {
    label: "Coming Soon",
    description: "Coming soon AI tools",
    tools: [
      {
        id: "affiliate-links",
        label: "Brand Health Check",
        description: "Connect to Sporut Social and get live brand stats",
        color: "#00E5D4",
        icon: IconActivity,
        comingSoon: true,
      },
      {
        id: "affiliate-links",
        label: "Idea Agent",
        description: "AI-powered content idea generation for your brand",
        color: "#00E5D4",
        icon: IconBrain,
        comingSoon: true,
      },
      {
        id: "fb-post",
        label: "Engagement Video Editor",
        description:
          "Turns articles into short, high-engagement videos for social platforms.",
        color: "#0055EE",
        icon: IconStack2,
        comingSoon: true,
      },
      {
        id: "fb-post",
        label: "Text Post Generator",
        description:
          "Creates on-brand social captions from article content instantly.",
        color: "#0055EE",
        icon: IconStack2,
        comingSoon: true,
      },
      {
        id: "fb-post",
        label: "Trending Article Editor",
        description:
          "Rewrites trending content into optimized, publish-ready articles.",
        color: "#0055EE",
        icon: IconStack2,
        comingSoon: true,
      },
      {
        id: "affiliate-links",
        label: "Threads Affiliate Automation",
        description:
          "Converts product links into monetizable Lazada affiliate links.",
        color: "#F05A35",
        icon: IconLink,
        comingSoon: true,
      },
      {
        id: "affiliate-links",
        label: "Lazada Affiliate Link Generator",
        description: "Upload a file to generate Shopee affiliate links",
        color: "#F05A35",
        icon: IconLink,
        comingSoon: true,
      },
    ],
  },
];

interface HomePageProps {
  onToolSelect: (id: ToolId) => void;
}

export function HomePage({ onToolSelect }: HomePageProps) {
  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-12 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold text-neutral-950 tracking-tight leading-tight">
            Built to help you create faster and smarter.
          </h1>
          <p className="text-neutral-500 mt-3 text-sm max-w-md">
            Tools for content editors and social media managers. Generate posts,
            captions, and affiliate content in seconds.
          </p>
          {/* KULT gradient stripe — animated grow */}
          <div
            className="mt-6 h-[3px] rounded-full animate-stripe-grow"
            style={{
              background:
                "linear-gradient(to right, #FF3FBF, #00E5D4, #0055EE, #F05A35)",
            }}
          />
        </div>

        {/* Quick Stats & Jump Back In — hidden until production-ready */}

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section) => {
            return (
              <div key={section.label}>
                {/* Section header */}
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
                    {section.label}
                  </p>
                  {section.description && (
                    <p className="text-sm text-neutral-500 mt-0.5">
                      {section.description}
                    </p>
                  )}
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {section.tools.map((tool) => {
                    const Icon = tool.icon;

                    if (tool.comingSoon) {
                      return (
                        <div
                          key={tool.label}
                          className="glass-card rounded-xl overflow-hidden cursor-default opacity-60"
                        >
                          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                            <Icon
                              className="w-8 h-8 opacity-25"
                              style={{ color: tool.color }}
                            />
                            <span className="text-[10px] font-semibold text-yellow-700 bg-yellow-100/80 rounded px-2 py-0.5">
                              Soon
                            </span>
                          </div>
                          <div className="p-5">
                            <h2 className="font-display text-base font-semibold text-neutral-400">
                              {tool.label}
                            </h2>
                            <p className="text-xs text-neutral-300 mt-1">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={tool.label}
                        onClick={() => onToolSelect(tool.id)}
                        className="glass-card rounded-xl overflow-hidden hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.015] transition-all duration-200 text-left group"
                      >
                        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                          <Icon
                            className="w-9 h-9"
                            style={{ color: tool.color }}
                          />
                          <span className="text-neutral-300 group-hover:text-neutral-500 transition-colors">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 12h14M12 5l7 7-7 7"
                              />
                            </svg>
                          </span>
                        </div>
                        <div className="p-5">
                          <h2 className="font-display text-base font-semibold text-neutral-950">
                            {tool.label}
                          </h2>
                          <p className="text-xs text-neutral-500 mt-1">
                            {tool.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
