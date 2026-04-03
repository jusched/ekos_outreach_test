import { describe, expect, test } from "vitest";

import { buildDraftMessage } from "@/src/lib/gmail";

describe("gmail draft payload", () => {
  test("builds a base64url-encoded MIME email for Gmail drafts", () => {
    const raw = buildDraftMessage({
      to: "rep@example.com",
      subject: "Intro for Bright Smile Dental",
      body: "Hi Dr. Lee,\n\nI noticed your online booking flow.\n\nBest,\nAlex",
    });

    const decoded = Buffer.from(raw, "base64url").toString("utf8");

    expect(decoded).toContain("To: rep@example.com");
    expect(decoded).toContain("Subject: Intro for Bright Smile Dental");
    expect(decoded).toContain("Hi Dr. Lee,");
  });
});
