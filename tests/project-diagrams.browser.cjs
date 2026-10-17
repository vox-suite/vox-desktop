const {
  chromium,
  expect,
} = require("../../vox-web/node_modules/@playwright/test");
const fs = require("node:fs/promises");
const output = require("node:path").resolve(
  __dirname,
  "../artifacts/diagram-library",
);
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "light",
      timezoneId: "America/Los_Angeles",
      locale: "en-US",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const demo = () =>
      page.evaluate(async () => {
        const { diagramDemo } =
          await import("/src/screenshots/project-diagrams.ts");
        return JSON.parse(JSON.stringify(diagramDemo));
      });
    await page.goto(
      `${process.env.DIAGRAM_TEST_URL || "http://127.0.0.1:1420"}/screenshots.html?screen=project-diagrams&save-error=1`,
    );
    await expect(
      page.getByRole("heading", { name: "Diagrams", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Open diagram/ }),
    ).toHaveCount(2);
    if ((await demo()).renders !== 0)
      throw new Error("Library rendered a diagram before selection");
    await page.screenshot({ path: output + "/library-light.png" });
    await page
      .getByRole("button", {
        name: "Open diagram Place search architecture",
        exact: true,
      })
      .click();
    await expect(page.locator(".project-diagram-scene svg")).toBeVisible();
    await page.screenshot({ path: output + "/canvas-light.png" });
    await page.getByRole("button", { name: /v\s*2\s*of\s*2/ }).click();
    await page.getByRole("menuitem", { name: /v1/ }).click();
    await expect(
      page.getByRole("heading", { name: "Place search overview", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Diagrams", exact: true }).click();
    await page.getByRole("tab", { name: "Sources", exact: true }).click();
    await page.getByRole("tab", { name: "Canvas", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Diagrams", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Project context", exact: true })
      .click();
    await expect(page.locator(".project-context-card").first()).toBeVisible();
    await page.getByRole("button", { name: "Diagrams", exact: true }).click();
    await page
      .getByLabel("Ask about your project")
      .fill("How does place search work?");
    await page
      .getByRole("button", { name: "Draw diagram", exact: true })
      .click();
    await expect(page.getByText("Draft · unsaved new diagram")).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const title = page.getByLabel("Diagram title", { exact: true });
    await expect(title).toHaveValue("Place search request flow");
    await expect(title).toBeFocused();
    await title.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Draft · unsaved new diagram")).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(title).toBeFocused();
    await title.press("Tab");
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Cancel", exact: true })
      .press("Shift+Tab");
    await expect(title).toBeFocused();
    await title.fill("   ");
    await expect(
      page.getByRole("button", { name: "Save diagram", exact: true }),
    ).toBeDisabled();
    await title.fill("How place search works");
    await page.screenshot({ path: output + "/save-title-light.png" });
    await title.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#diagram-save-error")).toContainText("503");
    if (
      !(await page.evaluate(() =>
        localStorage.getItem("vox.project-draft.peninsula-app"),
      ))
    )
      throw new Error("Failed save discarded draft");
    await page
      .getByRole("button", { name: "Save diagram", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "How place search works",
        exact: true,
      }),
    ).toBeVisible();
    let saved = (await demo()).project.data.messages.at(-1).flow;
    if (
      saved.title !== "How place search works" ||
      saved.diagram.meta.title !== saved.title
    )
      throw new Error("Saved/export title mismatch");
    await page.getByRole("button", { name: "Diagrams", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Open diagram/ }),
    ).toHaveCount(3);
    await page
      .getByRole("button", {
        name: "Delete diagram Saved places architecture",
        exact: true,
      })
      .click();
    await page.screenshot({ path: output + "/delete-dialog-light.png" });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Open diagram/ }),
    ).toHaveCount(3);
    await page
      .getByRole("button", {
        name: "Delete diagram Saved places architecture",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Delete diagram", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Open diagram/ }),
    ).toHaveCount(2);
    await page
      .getByRole("button", {
        name: "Open diagram Place search architecture",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Ask about your project")
      .fill("Show the cache interaction");
    await page
      .getByRole("button", { name: "Draw diagram", exact: true })
      .click();
    await expect(page.getByText("Draft · unsaved changes")).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await title.fill("Place search architecture revised");
    await page
      .getByRole("button", { name: "Save diagram", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /v\s*3\s*of\s*3/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete diagram", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete diagram", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Open diagram/ }),
    ).toHaveCount(1);
    if (
      (await demo()).project.data.messages.some(
        (m) => m.diagram_id === "search",
      )
    )
      throw new Error("Older versions survived deletion");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1024, height: 850 });
    await page.screenshot({ path: output + "/library-dark-compact.png" });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error("Page overflows");
    await page
      .getByRole("button", {
        name: "Delete diagram How place search works",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete diagram", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "No saved diagrams yet", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: output + "/empty-dark.png" });
    await page.goto(
      `${process.env.DIAGRAM_TEST_URL || "http://127.0.0.1:1420"}/screenshots.html?screen=project-diagrams&save-error=1`,
    );
    await page
      .getByRole("button", {
        name: "Delete diagram Place search architecture",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete diagram", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "503",
    );
    await expect(
      page.getByRole("button", { name: /Open diagram/, includeHidden: true }),
    ).toHaveCount(2);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    if (errors.length) throw new Error(errors.join("\n"));
    await fs.writeFile(
      output + "/verification.json",
      JSON.stringify(
        {
          passed: true,
          checks: [
            "list first without render",
            "explicit open/back",
            "Canvas reentry",
            "version history",
            "model title prefill",
            "blank title blocked",
            "failed save preserves draft",
            "title persisted into IR",
            "cancel/delete",
            "versioned update",
            "delete all versions",
            "dark compact layout",
            "empty state",
            "failed delete retains diagrams",
          ],
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log("Diagram library browser checks passed");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
