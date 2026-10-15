/**
 * Validates post-confirmation redirects, including nested URL encoding.
 *
 * Only root-relative URLs on this application's origin may be followed.
 * Unsafe and malformed inputs always land on the authenticated dashboard.
 */
export function safeNextPath(value: string | null, requestUrl: string): string {
  const fallback = "/dashboard";
  if (!value || !value.startsWith("/")) return fallback;

  // Inspect decoded variants as well as the original input to reject encoded
  // protocol-relative URLs, backslashes and control characters.
  let inspected = value;
  for (let pass = 0; pass < 5; pass++) {
    if (
      !inspected.startsWith("/") ||
      inspected.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(inspected)
    ) {
      return fallback;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(inspected);
    } catch {
      return fallback;
    }
    if (decoded === inspected) break;
    inspected = decoded;
  }

  try {
    const origin = new URL(requestUrl).origin;
    const target = new URL(value, origin);
    if (target.origin !== origin || !["http:", "https:"].includes(target.protocol)) {
      return fallback;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
