const { chromium } = require("../../../vox-web/node_modules/@playwright/test");
const sharp = require("../../../vox-web/node_modules/sharp");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const output = path.resolve(__dirname, "../../artifacts/screenshots");
const shots = [
  ["timeline-day", "day"],
  ["timeline-month", "month"],
  ["event-detail", "detail"],
  ["voice-filter", "filter"],
  ["connected-apps", "apps"],
  ["insights", "insights"],
  ["plans", "plans"],
  ["project", "project"],
  ["home", "home"],
];
(async () => {
  await fs.mkdir(path.join(output, "cropped"), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    timezoneId: "America/Los_Angeles",
    locale: "en-US",
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-12T19:00:00Z"));
  const manifest = [];
  try {
    for (const [file, screen] of shots) {
      await page.goto(
        `http://localhost:1420/screenshots.html?screen=${screen}`,
        { waitUntil: "domcontentloaded" },
      );
      await page.getByText("Alex Morgan", { exact: true }).waitFor();
      if (["day", "detail"].includes(screen)) {
        await page
          .getByRole("button")
          .filter({ hasText: "Sony WH-1000XM5 headphones" })
          .nth(2)
          .waitFor();
        await page.evaluate(() => {
          const scroller = [...document.querySelectorAll("div")].find(
            (el) =>
              el.scrollWidth > 8000 &&
              getComputedStyle(el).overflowX === "auto",
          );
          if (!scroller) throw new Error("Day scroller missing");
          scroller.scrollLeft = 3200 + 40 + (5 * 1600) / 24;
        });
      }
      if (screen === "month") {
        await page.getByRole("tab", { name: "Month", exact: true }).click();
        // August 2026 naturally needs six full weeks, using the real Month component.
        await page.getByTitle("Previous", { exact: true }).click();
        await page.getByTitle("Previous", { exact: true }).click();
        await page.getByText("August 2026", { exact: true }).waitFor();
        await page.waitForFunction(
          () =>
            document.querySelectorAll("[data-original-month] .grid-cols-7")[1]
              ?.children.length === 42,
        );
      }
      if (screen === "month")
        assert.equal(
          await page.locator("[data-original-month] button[title]").count(),
          126,
        );
      if (screen === "detail") {
        await page.locator('[data-span-panel="true"]').waitFor();
        const box = await page
          .locator('[data-span-panel="true"]')
          .boundingBox();
        assert(
          box.x >= 1400 &&
            box.x + box.width <= 1920 &&
            box.y >= 0 &&
            box.y + box.height <= 1080,
        );
        assert(await page.getByText("Gmail", { exact: true }).isVisible());
      }
      if (screen === "filter") {
        await page.getByText("$299.99", { exact: true }).waitFor();
        assert.equal(await page.locator(".capture-amount").count(), 7);
      }
      if (screen === "apps") {
        await page.getByText("Gmail", { exact: true }).waitFor();
        await page.waitForFunction(
          () => document.querySelectorAll(".capture-switches").length === 8,
        );
        assert.equal(
          await page.locator(".capture-switches input:checked").count(),
          14,
        );
      }
      if (screen === "insights") {
        await page
          .getByText("$595 this week · $676 previous week · 12% less", {
            exact: true,
          })
          .waitFor();
        await page.waitForFunction(
          () => document.querySelectorAll(".pulse-chart").length === 4,
        );
      }
      if (screen === "plans") {
        await page
          .getByText("Your finished Saturday plan", { exact: true })
          .waitFor();
        await page.waitForTimeout(1000);
        await page.locator(".react-flow__controls-zoomout").click();
        await page.locator(".react-flow__controls-zoomout").click();
        await page.waitForTimeout(700);
        for (const box of await page
          .locator(".space-workflow-node")
          .evaluateAll((els) =>
            els.map((el) => {
              const b = el.getBoundingClientRect();
              return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
            }),
          ))
          assert(
            box.x >= 256 &&
              box.right <= 1920 &&
              box.y >= 64 &&
              box.bottom < 950,
            "Plan node clipped",
          );
        assert(
          await page
            .getByPlaceholder("Share your vision or next instruction…")
            .isVisible(),
        );
      }
      if (screen === "project") {
        await page.getByText("Context", { exact: true }).waitFor();
        await page.getByText("React web client", { exact: true }).waitFor();
      }
      if (screen === "home") {
        await page.waitForFunction(() =>
          document
            .querySelector(".vox-hud-marker__label")
            ?.textContent?.includes("Computer History Museum"),
        );
        await page.waitForTimeout(5000);
        await page.locator(".vox-hud-marker__target").hover();
        await page.waitForTimeout(1000);
      }
      await page.mouse.move(1850, 1050);
      await page.waitForTimeout(1000);
      const png = await page.screenshot({ animations: "disabled" });
      const target = path.join(output, file + ".webp");
      await sharp(png).webp({ quality: 92 }).toFile(target);
      if (screen !== "home") {
        const crop =
          screen === "detail"
            ? { left: 1100, top: 0, width: 820, height: 1080 }
            : screen === "day"
              ? { left: 256, top: 0, width: 1664, height: 420 }
              : screen === "filter"
                ? { left: 256, top: 0, width: 1664, height: 660 }
                : { left: 256, top: 0, width: 1664, height: 1080 };
        await sharp(png)
          .extract(
            Object.fromEntries(
              Object.entries(crop).map(([key, value]) => [key, value * 2]),
            ),
          )
          .webp({ quality: 92 })
          .toFile(path.join(output, "cropped", file + ".webp"));
      }
      manifest.push({
        file: file + ".webp",
        screen,
        width: 3840,
        height: 2160,
        timezone: "America/Los_Angeles",
        dummyData: true,
      });
      console.log("Captured " + file + ".webp");
    }
    assert.deepEqual(errors, [], "Browser runtime errors");
    await fs.writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          capturedWith:
            "Chromium frontend served by local Tauri/Vite dev server",
          files: manifest,
        },
        null,
        2,
      ),
    );
    const tiles = await Promise.all(
      shots.map(async ([file], index) => ({
        input: await sharp(path.join(output, file + ".webp"))
          .resize(640, 360)
          .png()
          .toBuffer(),
        left: (index % 3) * 640,
        top: Math.floor(index / 3) * 360,
      })),
    );
    await sharp({
      create: { width: 1920, height: 1080, channels: 3, background: "#111" },
    })
      .composite(tiles)
      .png()
      .toFile(path.join(output, "contact-sheet.png"));
    console.log("Verified 9 captures with no browser runtime errors.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
