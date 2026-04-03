import { describe, expect, test } from "vitest";

import { rethrowIfRedirectError } from "@/src/lib/action-errors";

describe("rethrowIfRedirectError", () => {
  test("rethrows next redirect errors instead of converting them to user-facing errors", () => {
    const redirectError = Object.assign(new Error("redirect"), {
      digest: "NEXT_REDIRECT;replace;/runs/123;303;",
    });

    expect(() => rethrowIfRedirectError(redirectError)).toThrow(redirectError);
  });

  test("ignores normal errors", () => {
    expect(() => rethrowIfRedirectError(new Error("regular failure"))).not.toThrow();
  });
});
