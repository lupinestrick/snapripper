export function extractDomain(url: string): string {
  if (!url) return "unknown";
  if (url.startsWith("about:") || url.startsWith("chrome:") || url.startsWith("moz-extension:")) {
    return url.split("/")[0] || url;
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "other";
  }
}

export function isExemptUrl(url: string, pinned?: boolean): boolean {
  if (pinned) return true;
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.startsWith("about:") ||
    lower.startsWith("chrome:") ||
    lower.startsWith("moz-extension:") ||
    lower.startsWith("view-source:") ||
    lower.startsWith("edge:") ||
    lower.startsWith("brave:") ||
    lower.startsWith("javascript:")
  );
}

export function cleanUrlForAI(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "ref",
      "source",
      "spm",
      "from",
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));
    
    const cleanPath = parsed.pathname.length > 50 ? parsed.pathname.substring(0, 50) + "..." : parsed.pathname;
    return `${parsed.hostname.replace(/^www\./, "")}${cleanPath === "/" ? "" : cleanPath}`;
  } catch {
    return url.substring(0, 60);
  }
}

export function getFaviconUrl(url: string, customFavIcon?: string): string {
  if (customFavIcon && customFavIcon.startsWith("http")) return customFavIcon;
  const domain = extractDomain(url);
  if (domain === "unknown" || domain.startsWith("about:")) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}
