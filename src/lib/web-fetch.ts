import { logMessage } from "@/src/lib/logger";

const browserLikeUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

async function fetchWithHeaders(url: string, userAgent: string) {
  return await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "upgrade-insecure-requests": "1",
    },
    signal: AbortSignal.timeout(10000),
    redirect: "follow",
  });
}

export async function fetchWebsiteHtml(url: string) {
  let response = await fetchWithHeaders(
    url,
    "EkosSalesAgent/1.0 (+https://localhost) research bot for local operator review",
  );

  if (response.status === 403) {
    logMessage("warn", "Website fetch returned 403. Retrying with browser-like headers.", {
      url,
    });
    response = await fetchWithHeaders(url, browserLikeUserAgent);
  }

  if (!response.ok) {
    logMessage("warn", "Website fetch failed.", {
      url,
      status: response.status,
    });
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return await response.text();
}
