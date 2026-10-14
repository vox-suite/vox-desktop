const { chromium } = require("../../../vox-web/node_modules/@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const output = path.resolve(__dirname, "../../../vox-web/public/replicas");
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
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

async function prepare(page, screen) {
  if (["day", "detail"].includes(screen)) {
    await page
      .getByRole("button")
      .filter({ hasText: "Sony WH-1000XM5 headphones" })
      .nth(2)
      .waitFor();
    await page.evaluate(() => {
      const scroller = [...document.querySelectorAll("div")].find(
        (el) =>
          el.scrollWidth > 8000 && getComputedStyle(el).overflowX === "auto",
      );
      if (!scroller) throw new Error("Day scroller missing");
      scroller.scrollLeft = 3200 + 40 + (5 * 1600) / 24;
    });
  }
  if (screen === "month") {
    await page.getByRole("tab", { name: "Month", exact: true }).click();
    await page.getByTitle("Previous", { exact: true }).click();
    await page.getByTitle("Previous", { exact: true }).click();
    await page.getByText("August 2026", { exact: true }).waitFor();
    await page.waitForFunction(
      () =>
        document.querySelectorAll("[data-original-month] .grid-cols-7")[1]
          ?.children.length === 42,
    );
  }
  if (screen === "detail") {
    await page.locator('[data-span-panel="true"]').waitFor();
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const panel = document.querySelector('[data-span-panel="true"]');
      Object.assign(panel.style, {
        top: "16px",
        right: "16px",
        bottom: "16px",
        height: "auto",
        width: "560px",
        maxWidth: "none",
        borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.12)",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      });
    });
    await page.waitForTimeout(500);
  }
  if (screen === "filter") await page.getByText("$299.99", { exact: true }).waitFor();
  if (screen === "apps") {
    await page.getByText("Gmail", { exact: true }).first().waitFor();
    await page.waitForFunction(
      () => document.querySelectorAll(".capture-switches").length === 8,
    );
  }
  if (screen === "insights") {
    await page
      .getByText("$595 this week · $676 previous week · 12% less", { exact: true })
      .waitFor();
    await page.waitForFunction(
      () => document.querySelectorAll(".pulse-chart").length === 4,
    );
  }
  if (screen === "plans") {
    await page.getByText("Your finished Saturday plan", { exact: true }).waitFor();
    await page.waitForTimeout(1000);
    await page.locator(".react-flow__controls-zoomout").click();
    await page.locator(".react-flow__controls-zoomout").click();
    await page.waitForTimeout(700);
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
}

async function freezeCanvases(page, screen) {
  const canvases = page.locator("canvas");
  const count = await canvases.count();
  for (let i = 0; i < count; i++) {
    const canvas = canvases.nth(i);
    const box = await canvas.boundingBox();
    if (!box || box.width < 16 || box.height < 16) continue;
    const big = box.width > 400 || box.height > 400;
    if (big && screen !== "home" && screen !== "plans") continue;
    const shot = big
      ? await canvas.screenshot({ type: "jpeg", quality: screen === "plans" ? 55 : 70, scale: "css", animations: "disabled" })
      : await canvas.screenshot({ type: "png", animations: "disabled" });
    const mime = big ? "image/jpeg" : "image/png";
    await canvas.evaluate(
      (el, data) => {
        el.dataset.replica = data;
      },
      `data:${mime};base64,${shot.toString("base64")}`,
    );
  }
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const script = await fs.readFile(path.join(__dirname, "dom-to-svg.js"), "utf8");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    timezoneId: "America/Los_Angeles",
    locale: "en-US",
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-12T19:00:00Z"));
  try {
    for (const [file, screen] of shots) {
      if (only && !only.includes(screen)) continue;
      await page.goto(`http://localhost:1420/screenshots.html?screen=${screen}`, {
        waitUntil: "domcontentloaded",
      });
      await page.getByText("Alex Morgan", { exact: true }).waitFor();
      await prepare(page, screen);
      await freezeCanvases(page, screen);
      await page.evaluate(script);
      const svg = await page.evaluate((name) => window.domToSvg(name), file);
      await fs.writeFile(path.join(output, file + ".svg"), svg);
      console.log(`Exported ${file}.svg (${Math.round(svg.length / 1024)} KB)`);
    }
  } finally {
    await browser.close();
  }
})();
