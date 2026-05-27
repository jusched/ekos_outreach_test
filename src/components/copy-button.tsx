"use client";

import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      style={{
        padding: "0.5rem 0.75rem",
        fontSize: "0.85rem",
        borderRadius: "0.5rem",
        border: "1px solid var(--accent)",
        background: copied ? "var(--good)" : "var(--accent)",
        color: "white",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        transition: "background-color 0.2s"
      }}
    >
      {copied ? "✓ Copied!" : `Copy ${label}`}
    </button>
  );
}
