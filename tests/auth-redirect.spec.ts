import { expect, test } from "@playwright/test";
import { safeNextPath } from "@/lib/auth/safe-next-path";

const origin = "https://sportmatch-zzp.vercel.app/auth/confirm";

const permitted = [
  [null, "/dashboard"],
  ["", "/dashboard"],
  ["/", "/"],
  ["/dashboard", "/dashboard"],
  ["/organisatie/opdrachten?location=test#resultaten", "/organisatie/opdrachten?location=test#resultaten"],
  ["/wachtwoord-instellen?mode=recovery", "/wachtwoord-instellen?mode=recovery"],
  ["/%20test", "/%20test"],
] as const;

for (const [value, expected] of permitted) {
  test(`authredirect staat interne route toe: ${String(value)}`, () => {
    expect(safeNextPath(value, origin)).toBe(expected);
  });
}

const blocked = [
  "https://example.org",
  "http://example.org",
  "javascript:alert(1)",
  "data:text/html,hi",
  "example.org/path",
  "//example.org/route",
  "///example.org/route",
  "/\\example.org/route",
  "/dashboard\\example.org",
  "/%5cexample.org",
  "/%2f%2fexample.org",
  "/%252f%252fexample.org",
  "/%255cexample.org",
  "/%0aLocation:%20https://example.org",
  "/%0d%0aLocation:%20https://example.org",
  "/%ZZ",
] as const;

for (const value of blocked) {
  test(`authredirect blokkeert onveilige route: ${value}`, () => {
    expect(safeNextPath(value, origin)).toBe("/dashboard");
  });
}

test("authredirect valideert gedecodeerde next-parameter uit een e-maillink", () => {
  const source = new URL(origin);
  source.searchParams.set("next", "//example.org/phishing");
  expect(safeNextPath(source.searchParams.get("next"), source.href)).toBe("/dashboard");
});

test("verlopen bevestigingslink blijft op lokale login", async ({ request }) => {
  const response = await request.get("/auth/confirm?next=https%3A%2F%2Fexample.org", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  const location = response.headers()["location"];
  expect(new URL(location).pathname).toBe("/login");
  expect(new URL(location).searchParams.get("fout")).toBe("link-verlopen");
});
