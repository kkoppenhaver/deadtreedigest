// Source detection: URL hostname first, DOM fingerprints for platforms that
// hide behind custom domains (Substack).

export function detectSource(url, html) {
  if (url) {
    let host;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    if (host === "twitter.com" || host === "x.com" || host.endsWith(".twitter.com")) return "twitter";
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
    if (host.endsWith(".substack.com")) return "substack";
  }
  if (html) {
    if (html.includes("substackcdn.com") || html.includes('name="generator" content="Substack"')) {
      return "substack";
    }
  }
  return "generic";
}
