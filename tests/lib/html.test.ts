import { describe, expect, test } from "vitest";

import { extractWebsiteEvidence, selectHighSignalLinks } from "@/src/lib/html";

describe("html extraction", () => {
  test("extracts visible text and strips scripts and styles", () => {
    const html = `
      <html>
        <head>
          <style>.hidden { color: red; }</style>
          <script>console.log("ignore me")</script>
        </head>
        <body>
          <h1>Bright Smile Dental</h1>
          <p>We offer implants, cleanings, and cosmetic dentistry.</p>
        </body>
      </html>
    `;

    const evidence = extractWebsiteEvidence("https://example.com", html);

    expect(evidence.pageUrl).toBe("https://example.com/");
    expect(evidence.text).toContain("Bright Smile Dental");
    expect(evidence.text).toContain("implants, cleanings, and cosmetic dentistry");
    expect(evidence.text).not.toContain("ignore me");
    expect(evidence.text).not.toContain("hidden");
  });

  test("keeps only same-domain high-signal links and caps additional pages", () => {
    const html = `
      <body>
        <a href="/about">About Us</a>
        <a href="/services">Services</a>
        <a href="/contact">Contact</a>
        <a href="https://other.example.com/about">External</a>
        <a href="/privacy">Privacy Policy</a>
      </body>
    `;

    const links = selectHighSignalLinks("https://clinic.example.com", html, 2);

    expect(links).toEqual([
      "https://clinic.example.com/about",
      "https://clinic.example.com/services",
    ]);
  });
});
