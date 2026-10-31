import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, test } from "@playwright/test";

test("navigatielinks bevatten geen geneste links of buttons in de broncode", () => {
  const failures: string[] = [];
  const root = path.resolve("src");
  function scan(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(file);
        continue;
      }
      if (!file.endsWith(".tsx")) continue;
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(node: ts.Node, inLink: boolean) {
        const element = ts.isJsxElement(node)
          ? node.openingElement
          : ts.isJsxSelfClosingElement(node)
            ? node
            : null;
        const name = element?.tagName.getText(source);
        const isLink = name === "Link" || name === "a";
        if (inLink && (isLink || name === "button" || name === "Button")) {
          failures.push(
            `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
          );
        }
        ts.forEachChild(node, (child) => visit(child, inLink || isLink));
      }
      visit(source, false);
    }
  }
  scan(root);
  expect(failures).toEqual([]);
});

test("een gestylede navigatielink heeft één tabstop en werkt met Enter", async ({
  page,
}) => {
  await page.goto("/");
  const cta = page
    .getByRole("link", { name: "Start als sportschool", exact: true })
    .first();
  await expect(
    cta.locator("button, a, input, select, textarea, [tabindex]"),
  ).toHaveCount(0);
  await cta.focus();
  await expect(cta).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cta).not.toBeFocused();
  await cta.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/registreren?rol=organisatie");
  await expect(
    page.getByRole("button", { name: "Gratis account aanmaken" }),
  ).toBeVisible();
});
