import { afterEach, describe, expect, test, vi } from "vitest";

import { fetchWebsiteHtml } from "@/src/lib/web-fetch";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("fetchWebsiteHtml", () => {
  test("retries with browser-like headers after a 403 response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("blocked", {
          status: 403,
        }),
      )
      .mockResolvedValueOnce(
        new Response("<html><body>ok</body></html>", {
          status: 200,
        }),
      );

    global.fetch = fetchMock as typeof fetch;

    const html = await fetchWebsiteHtml("https://luvicdental.com/");

    expect(html).toContain("<body>ok</body>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        "user-agent": expect.stringContaining("EkosSalesAgent"),
      }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        "user-agent": expect.stringContaining("Mozilla/5.0"),
      }),
    });
  });
});
