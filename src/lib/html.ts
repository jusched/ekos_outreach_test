import * as cheerio from "cheerio";

import { pageEvidenceSchema, type PageEvidence } from "@/src/schemas/research";

const HIGH_SIGNAL_PATTERNS = [
  /about/i,
  /services?/i,
  /treatments?/i,
  /care/i,
  /team/i,
  /providers?/i,
  /insurance/i,
  /booking/i,
  /appointment/i,
];

const LOW_SIGNAL_PATTERNS = [/privacy/i, /terms/i, /policy/i, /hipaa/i];

function collapseWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function extractWebsiteEvidence(pageUrl: string, html: string): PageEvidence {
  const $ = cheerio.load(html);

  $("script, style, noscript").remove();

  const text = collapseWhitespace($("body").text());

  return pageEvidenceSchema.parse({
    pageUrl: new URL(pageUrl).toString(),
    text,
  });
}

export function selectHighSignalLinks(
  baseUrl: string,
  html: string,
  limit = 2,
): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const scoredLinks = new Map<string, number>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const label = collapseWhitespace($(element).text());
    if (!href) {
      return;
    }

    try {
      const url = new URL(href, base);
      if (url.hostname !== base.hostname) {
        return;
      }

      const candidate = `${label} ${url.pathname}`;
      const highSignalHits = HIGH_SIGNAL_PATTERNS.filter((pattern) =>
        pattern.test(candidate),
      ).length;
      const lowSignalHits = LOW_SIGNAL_PATTERNS.filter((pattern) =>
        pattern.test(candidate),
      ).length;
      const score = highSignalHits * 10 - lowSignalHits * 10;

      if (score > 0) {
        scoredLinks.set(url.toString(), Math.max(score, scoredLinks.get(url.toString()) ?? 0));
      }
    } catch {
      return;
    }
  });

  return [...scoredLinks.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([url]) => url);
}
