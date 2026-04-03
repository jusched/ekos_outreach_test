import { describe, expect, test } from "vitest";

import { decryptSecret, encryptSecret } from "@/src/lib/crypto";

describe("token encryption", () => {
  test("round-trips sensitive values with the configured app secret", () => {
    const encrypted = encryptSecret("refresh-token-123", "test-secret-key");

    expect(encrypted).not.toContain("refresh-token-123");
    expect(decryptSecret(encrypted, "test-secret-key")).toBe("refresh-token-123");
  });
});
