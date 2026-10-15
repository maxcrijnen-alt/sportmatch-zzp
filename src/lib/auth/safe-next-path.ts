function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

/** Resolve auth destinations without permitting external redirects. */
export function safeAuthRedirect(value: string | null, requestUrl: string): URL {
  const origin = new URL(requestUrl).origin;
  const fallback = new URL("/dashboard", origin);
  if (
    !value || !value.startsWith("/") || value.startsWith("//") ||
    value.includes("\\") || containsControlCharacter(value)
  ) {
    return fallback;
  }

  try {
    const target = new URL(value, origin);
    if (target.origin !== origin || /%(?![\da-f]{2})/i.test(target.pathname)) return fallback;

    // Inspect encoded path variants without decoding the actual destination or
    // its query/fragment. Each pass shortens escapes, including nested %25.
    let path = target.pathname;
    for (;;) {
      if (path.startsWith("//") || path.includes("\\") || containsControlCharacter(path)) {
        return fallback;
      }
      const normalized = new URL(path, origin);
      if (normalized.origin !== origin || normalized.pathname.startsWith("//")) {
        return fallback;
      }
      const decoded = path.replace(/%([\da-f]{2})/gi, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      );
      if (decoded === path) return target;
      path = decoded;
    }
  } catch {
    return fallback;
  }
}
