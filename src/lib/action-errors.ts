type RedirectLikeError = Error & {
  digest?: string;
};

export function rethrowIfRedirectError(error: unknown) {
  if (
    error instanceof Error &&
    typeof (error as RedirectLikeError).digest === "string" &&
    (error as RedirectLikeError).digest?.startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }
}
