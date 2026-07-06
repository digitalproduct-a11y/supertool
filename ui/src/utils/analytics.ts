const GA_ID = 'G-G4HMHMBB5K';

declare function gtag(...args: unknown[]): void;

export function trackPageView(path: string, brandSlug: string) {
  if (typeof gtag === 'undefined') return;
  gtag('config', GA_ID, {
    page_path: path,
    brand_slug: brandSlug,
  });
}

export function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export function trackToolSubmit(toolName: string, brandSlug: string, sourceDomain?: string) {
  if (typeof gtag === 'undefined') return;
  gtag('event', 'tool_used', {
    tool_name: toolName,
    brand_slug: brandSlug,
    ...(sourceDomain ? { source_domain: sourceDomain } : {}),
  });
}

export function trackPostScheduled(toolName: string, brandSlug: string) {
  if (typeof gtag === 'undefined') return;
  gtag('event', 'post_scheduled', {
    tool_name: toolName,
    brand_slug: brandSlug,
  });
}

export function trackButtonClick(action: 'adjust_image' | 'download_image' | 'upload_custom_image' | 'caption_copied' | 'election_schedule_fb') {
  if (typeof gtag === 'undefined') return;
  const [, brandSlug, ...toolParts] = window.location.pathname.split('/');
  gtag('event', 'button_click', {
    action,
    tool_name: toolParts.join('/') || 'unknown',
    brand_slug: brandSlug ?? 'unknown',
  });
}

export function trackHomeToolClick(toolLabel: string, toolPath: string) {
  if (typeof gtag === 'undefined') return;
  const [, brandSlug] = window.location.pathname.split('/');
  gtag('event', 'home_tool_click', {
    tool_label: toolLabel,
    tool_path: toolPath,
    brand_slug: brandSlug ?? 'unknown',
  });
}
