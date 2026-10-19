const {
  chromium,
  expect,
} = require("../../vox-web/node_modules/@playwright/test");
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto(
      `${process.env.DIAGRAM_TEST_URL || "http://127.0.0.1:1420"}/screenshots.html?screen=project-diagrams&generation-test=1`,
    );
    await page
      .getByRole("button", {
        name: "Open diagram Place search architecture",
        exact: true,
      })
      .click();
    await expect(page.locator(".project-diagram-scene svg")).toBeVisible();
    const headerHeight = await page
      .locator(".project-architecture > .project-flow-header")
      .evaluate((el) => el.getBoundingClientRect().height);
    if (headerHeight > 52) throw Error(`Header too tall: ${headerHeight}`);
    await page.locator('[data-node-id="web"]').click();
    await expect(page.locator('[data-node-id="web"]')).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(page.locator('[data-node-id="db"]')).toHaveCSS(
      "opacity",
      "0.18",
    );
    await expect(page.locator('path[data-edge-from="web"]')).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(page.locator('path[data-edge-to="maps"]')).toHaveCSS(
      "opacity",
      "0.18",
    );
    const details = page.locator("details.project-flow-inspector");
    await expect(details).not.toHaveAttribute("open");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open");
    await expect(
      details.getByText("Source references", { exact: true }),
    ).toBeVisible();
    await details.locator("summary").press("Enter");
    await expect(details).not.toHaveAttribute("open");
    await page.screenshot({ path: "artifacts/diagram-library/node-focus.png" });
    // Toggle, SVG background, Escape and the explicit control all clear focus.
    await page.locator('[data-node-id="web"]').click();
    await expect(page.locator('[data-node-id="db"]')).toHaveCSS("opacity", "1");
    await expect(
      page.getByRole("button", { name: "Clear focus", exact: true }),
    ).toHaveCount(0);
    await page.locator('[data-node-id="web"]').click();
    await page
      .getByRole("button", { name: "Clear focus", exact: true })
      .click();
    await expect(page.locator('[data-node-id="db"]')).toHaveCSS("opacity", "1");
    await page.locator('[data-node-id="web"]').click();
    await page.locator('[data-node-id="web"]').press("Escape");
    await expect(page.locator('[data-node-id="db"]')).toHaveCSS("opacity", "1");
    await page.locator('[data-node-id="web"]').click();
    await page
      .locator(".project-diagram-scene svg")
      .click({ position: { x: 4, y: 4 } });
    await expect(page.locator('[data-node-id="db"]')).toHaveCSS("opacity", "1");

    await page.evaluate(() => {
      window.originalScene = document.querySelector(".project-diagram-scene");
      window.originalViewport = document.querySelector(".react-flow__viewport");
    });
    await page
      .getByLabel("Ask about your project")
      .fill("Explain the request flow");
    await page
      .getByRole("button", { name: "Update diagram", exact: true })
      .click();
    await expect(
      page.getByLabel("Agent activity", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Generating diagram…", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".project-generation-glow")).toHaveCount(0);
    const activity = page.getByLabel("Agent activity", { exact: true });
    await expect(activity).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(activity).toHaveCSS("border-top-width", "0px");
    await expect(activity).toHaveCSS("pointer-events", "none");
    const layers = await page.evaluate(() => ({
      activity: Number(
        getComputedStyle(document.querySelector(".project-agent-activity"))
          .zIndex,
      ),
      diagram: Number(
        getComputedStyle(
          document.querySelector(".project-architecture-stage > .react-flow"),
        ).zIndex,
      ),
      host: getComputedStyle(document.querySelector(".project-diagram-scene"))
        .backgroundColor,
      fade: getComputedStyle(document.querySelector(".project-agent-activity"))
        .maskImage,
    }));
    if (layers.activity >= layers.diagram)
      throw Error("Activity is above diagram content");
    if (layers.host !== "rgba(0, 0, 0, 0)" || layers.fade === "none")
      throw Error("Transparent/fading activity layer is missing");

    await expect(
      page.locator(".project-generation-atmosphere"),
    ).toHaveAttribute("data-active", "true");
    await expect(page.locator(".project-generation-atmosphere")).toHaveCSS(
      "opacity",
      "1",
    );

    await expect(page.locator(".project-diagram-scene svg")).toBeVisible();
    await page.screenshot({
      path: "artifacts/diagram-library/generating-light.png",
    });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await expect(page.locator(".project-atmosphere-blue")).toHaveCSS(
      "animation-name",
      "none",
    );

    await expect(
      page.locator(".project-agent-activity .animate-spin"),
    ).toHaveCSS("animation-duration", "6s");
    await page.screenshot({
      path: "artifacts/diagram-library/generating-dark.png",
    });

    await expect(page.locator(".project-generation-glow")).toHaveCount(0);
    await expect(page.locator(".project-draft-badge")).toHaveText("Draft");
    await expect(page.locator(".project-diagram-scene svg")).toBeVisible();
    if (
      !(await page.evaluate(
        () =>
          window.originalScene ===
            document.querySelector(".project-diagram-scene") &&
          window.originalViewport ===
            document.querySelector(".react-flow__viewport"),
      ))
    )
      throw Error("Canvas remounted");
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    // A fresh project view starts in the library: first creation must stream too.
    await page.reload();
    await page
      .getByLabel("Ask about your project")
      .fill("Draw the place search flow");
    await page
      .getByRole("button", { name: "Draw diagram", exact: true })
      .click();
    await expect(
      page.getByLabel("Agent activity", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".project-diagram-scene svg")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Stop", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".project-explanation")).toHaveCount(0);
    await page.screenshot({
      path: "artifacts/diagram-library/first-generation-stream.png",
    });
    await expect(page.locator(".project-generation-glow")).toHaveCount(0);
    console.log(
      "Compact header, node/edge focus, collapsed evidence, first-create streaming and stable handoff passed",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
