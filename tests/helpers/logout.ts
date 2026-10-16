import type { Page } from "@playwright/test";

export async function logout(page: Page) {
  const more = page.getByRole("button", { name: "Meer navigatie", exact: true });
  if (await more.isVisible() && await more.getAttribute("aria-expanded") !== "true") {
    await more.click();
  }
  await page.getByRole("button", { name: "Uitloggen", exact: true }).click();
  await page.waitForURL(/\/$/);
}
