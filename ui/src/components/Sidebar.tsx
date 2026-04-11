import { useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import {
  IconHome,
  IconPhoto,
  IconCarouselHorizontal,
  IconTrendingUp,
  IconLink,
  IconFileText,
  IconLayoutSidebar,
  IconHeart,
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
  | "shopee-top-products"
  | "scheduled-posts"
  | "photo-carousel";

interface NavItem {
  id: ToolId | string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}

interface SidebarProps {
  activeTool?: ToolId;
  onToolChange?: (id: ToolId) => void;
  isCollapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
}

const navSections: { section: string | null; items: NavItem[] }[] = [
  {
    section: null,
    items: [{ id: "home", label: "Home", icon: IconHome }],
  },
  {
    section: "Social",
    items: [
      { id: "fb-post", label: "Article to FB Photos", icon: IconPhoto },
      {
        id: "trending-news",
        label: "Trending News to FB Photos",
        icon: IconTrendingUp,
      },
      { id: "engagement-posts", label: "Engagement Posts", icon: IconHeart },
      {
        id: "scheduled-posts",
        label: "Schedule Trending News",
        icon: IconCalendar,
      },
      {
        id: "photo-carousel",
        label: "Article to Photo Carousels",
        icon: IconCarouselHorizontal,
      },
    ],
  },
  {
    section: "Affiliate",
    items: [
      {
        id: "shopee-top-products",
        label: "Shopee Top Products",
        icon: IconShoppingBag,
      },
      {
        id: "affiliate-links",
        label: "Shopee Affiliate Links",
        icon: IconLink,
      },
      {
        id: "article-generator",
        label: "Affiliate Article Editor",
        icon: IconFileText,
      },
    ],
  },
];

const TOOL_NAMES: Record<ToolId, string> = {
  home: "KULT Digital Kit",
  "fb-post": "Article to FB Photos",
  "photo-carousel": "Article to Photo Carousels",
  "trending-news": "Trending News to FB Photos",
  "affiliate-links": "Shopee Affiliate Links",
  "article-generator": "Affiliate Article Editor",
  "engagement-posts": "Engagement Posts",
  "engagement-photos": "EPL Engagement Posts",
  "shopee-top-products": "Shopee Top Products",
  "scheduled-posts": "Schedule Trending News",
};

const floatingBtnClass =
  "fixed top-4 left-4 z-50 p-2 rounded-lg bg-zinc-900 text-neutral-500 hover:text-neutral-200 hover:bg-white/8 transition-all duration-300";

export function Sidebar({
  activeTool = "home",
  onToolChange,
  isCollapsed,
  onCollapsedChange,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
    onCollapsedChange(false);
  };
  const handleClose = () => {
    setIsOpen(false);
    onCollapsedChange(true);
  };

  const handleToolClick = (toolId: ToolId) => {
    onToolChange?.(toolId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating reopen button — mobile */}
      <button
        onClick={handleOpen}
        aria-label="Open navigation"
        className={`md:hidden ${floatingBtnClass} ${!isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <IconLayoutSidebar className="w-5 h-5" />
      </button>

      {/* Floating reopen button — desktop */}
      <button
        onClick={handleOpen}
        aria-label="Open navigation"
        className={`hidden md:flex ${floatingBtnClass} ${isCollapsed ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <IconLayoutSidebar className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <aside
        aria-label="Main navigation"
        className={`${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed left-0 top-0 h-screen glass-sidebar z-40 flex flex-col overflow-hidden
        transition-transform duration-300 md:transition-[width] md:duration-300 w-60 ${isCollapsed ? "md:w-0" : "md:w-60"}`}
      >
        <div className="w-60 flex flex-col h-full">
          {/* Header */}
          <div className="px-5 py-6 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-white tracking-tight">
              <span className="glitch-text" data-text="KULT Digital Kit">
                KULT Digital Kit
              </span>
            </span>
            <button
              onClick={handleClose}
              aria-label="Collapse sidebar"
              className="flex items-center justify-center w-7 h-7 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/8 transition-colors"
            >
              <IconLayoutSidebar className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {navSections.map((group, i) => (
              <div key={i} className={i > 0 ? "mt-4" : ""}>
                {group.section && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                    {group.section}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((tool) => {
                    const Icon = tool.icon;
                    if (tool.comingSoon) {
                      return (
                        <div
                          key={tool.label}
                          className="px-3 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2.5 text-neutral-500 cursor-default"
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">{tool.label}</span>
                          <span className="text-[10px] font-semibold text-yellow-600/80 bg-yellow-500/10 rounded px-1.5 py-0.5">
                            Soon
                          </span>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleToolClick(tool.id as ToolId)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2.5 ${
                          activeTool === tool.id
                            ? "bg-white/20 text-white shadow-[0_1px_4px_rgba(255,255,255,0.08)]"
                            : "text-neutral-300 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {tool.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="mx-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-1" />
          <div className="px-3 pb-4 pt-2 space-y-0.5">
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium text-neutral-300 hover:bg-white/8 hover:text-white transition-colors flex items-center gap-2.5"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Send feedback
            </button>
            <p className="px-3 pt-2 text-[11px] text-neutral-400">
              Made with ♥ by Digital team
            </p>
          </div>
        </div>
      </aside>

      {showFeedback &&
        createPortal(
          <FeedbackModal
            activeTool={activeTool}
            onClose={() => setShowFeedback(false)}
          />,
          document.body,
        )}
    </>
  );
}

function FeedbackModal({
  activeTool,
  onClose,
}: {
  activeTool: ToolId;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailError = emailTouched && email.trim() && !isValidEmail;

  const handleSubmit = async () => {
    const webhookUrl = import.meta.env.VITE_FEEDBACK_WEBHOOK_URL as
      | string
      | undefined;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            feedback,
            tool: TOOL_NAMES[activeTool],
          }),
        });
      } catch {
        /* fail silently */
      }
    }
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-slide-up">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              {submitted ? "Feedback received!" : "Send Feedback"}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {submitted
                ? "We'll review it and be in touch soon."
                : "We'd love to hear what's on your mind."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {submitted ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-neutral-950 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                  style={{
                    strokeDasharray: 30,
                    strokeDashoffset: 30,
                    animation:
                      "draw-check 0.4s cubic-bezier(0.25,1,0.5,1) 0.15s forwards",
                  }}
                />
              </svg>
            </div>
            <p className="text-xs text-neutral-500">Thanks, {name}!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sarah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent placeholder:text-neutral-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Work Email
              </label>
              <input
                type="email"
                placeholder="you@astro.com.my"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-neutral-400 ${
                  emailError
                    ? "border-red-300 focus:ring-red-400"
                    : "border-neutral-200 focus:ring-neutral-900"
                }`}
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-500">
                  Please enter a valid email address
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Feedback
              </label>
              <textarea
                placeholder="What's working well? What could be better? Any bugs?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent placeholder:text-neutral-400 resize-none"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || !isValidEmail || !feedback.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-neutral-950 hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send Feedback
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
