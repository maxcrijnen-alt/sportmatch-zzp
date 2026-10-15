import { expect, test } from "@playwright/test";
import { safeAuthRedirect } from "@/lib/auth/safe-next-path";

const origin = "https://sportmatch.example";
const requestUrl = `${origin}/auth/confirm?token_hash=example&type=recovery`;
const valid = [
  "/", "/dashboard", "/wachtwoord-herstellen",
  "/organisatie/kandidaten?job=123#poule",
  "/organisatie/opdrachten?location=test#resultaten",
  "/wachtwoord-instellen?mode=recovery", "/%20test",
  "/opdrachten/../dashboard?tab=agenda#vandaag",
  "/zoeken/hi%20daar?q=caf%C3%A9&ratio=100%25",
  "/zoeken/caf%C3%A9", "/zoeken/100%25",
  "/dashboard?next=https%3A%2F%2Fexample.com&path=%252F%255C#details",
];
const invalid = [
  null, "", "dashboard", "../dashboard", "?next=/dashboard", "#dashboard",
  "https://evil.example", "http://evil.example", `${origin}/dashboard`,
  "javascript:alert(1)", "data:text/html,example",
  "//evil.example", "///evil.example", "//user:password@evil.example", "//sportmatch.example/dashboard",
  "/\\evil.example", "\\\\evil.example", "/dashboard\\..\\evil.example",
  "/foo/..//evil.example", "/.//evil.example", "/%2e%2e//evil.example",
  "/foo/%2e%2e//evil.example", "/%2f/evil.example", "/%2F%2fevil.example",
  "/%252f%252fevil.example", "/%25%32%66/evil.example",
  "/%5cevil.example", "/%255Cevil.example", "/%25%35%63evil.example",
  "/foo/%252e%252e//evil.example", "/%00evil.example", "/%250devil.example",
  "/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\u0000evil.example",
  "/%09/evil.example", " /dashboard", "/%ZZ",
  "/%0aLocation:%20https://example.org", "/%0d%0aLocation:%20https://example.org",
];

for (const value of valid) {
  test(`auth redirect behoudt ${value}`, () => {
    expect(safeAuthRedirect(value, requestUrl).href).toBe(new URL(value, origin).href);
  });
}
for (const [index, value] of invalid.entries()) {
  test(`auth redirect weigert onveilige variant ${index + 1}: ${JSON.stringify(value)}`, () => {
    expect(safeAuthRedirect(value, requestUrl).href).toBe(`${origin}/dashboard`);
  });
}

for (const encoded of [
  "%2F%2Fevil.example", "%2F%5Cevil.example", "%2F%252Fevil.example",
  "%2Ffoo%2F..%2F%2Fevil.example", "%2F%2509%2Fevil.example",
]) {
  test(`auth redirect controleert query-decoding van ${encoded}`, () => {
    const url = new URL(`${requestUrl}&next=${encoded}`);
    expect(safeAuthRedirect(url.searchParams.get("next"), url.href).href).toBe(`${origin}/dashboard`);
  });
}

test("verlopen bevestigingslink blijft op lokale login", async ({ request, baseURL }) => {
  const response = await request.get("/auth/confirm?next=https%3A%2F%2Fexample.org", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe(new URL("/login?fout=link-verlopen", baseURL).href);
});
