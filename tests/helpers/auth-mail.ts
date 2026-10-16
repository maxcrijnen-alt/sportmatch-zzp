import { expect, type APIRequestContext } from "@playwright/test";

// Tokens and test keys stay in the disposable stack; never query real inboxes.
export async function authMailLink(request: APIRequestContext, email: string, baseURL: string, type: "email" | "recovery") {
  const mailpit = new URL(process.env.LOCAL_MAILPIT_URL!);
  if (mailpit.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(mailpit.hostname)) {
    throw new Error("Only the isolated local Mailpit is allowed.");
  }
  let messageId = "";
  await expect.poll(async () => {
    const response = await request.get(new URL(`/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, mailpit).href);
    expect(response.ok()).toBe(true);
    const result = await response.json() as { messages: { ID: string }[] };
    messageId = result.messages[0]?.ID ?? "";
    return Boolean(messageId);
  }, { timeout: 15_000, intervals: [250, 500, 1000] }).toBe(true);
  const response = await request.get(new URL(`/api/v1/message/${messageId}`, mailpit).href);
  expect(response.ok()).toBe(true);
  const mail = await response.json() as { HTML: string };
  const href = mail.HTML.match(/href="([^"]+)"/)?.[1].replace(/&amp;/g, "&");
  expect(href).toBeTruthy();
  const link = new URL(href!);
  expect(link.origin).toBe(new URL(baseURL).origin);
  expect(link.pathname).toBe("/auth/confirm");
  expect(link.searchParams.get("type")).toBe(type);
  return link;
}
