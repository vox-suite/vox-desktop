const { chromium } = require("../../../vox-web/node_modules/@playwright/test");
const sharp = require("../../../vox-web/node_modules/sharp");
const path = require("node:path");
const out = path.resolve(__dirname, "../../../vox-web/public/shots/android-home-map.jpg");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    timezoneId: "America/Los_Angeles",
    locale: "en-US",
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-12T19:00:00Z"));
  await page.goto("http://localhost:1420/screenshots.html?screen=home", {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Alex Morgan", { exact: true }).waitFor();
  await page.waitForFunction(() =>
    document.querySelector(".vox-hud-marker__label")?.textContent?.includes("Computer History Museum"),
  );
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")]
      .map((c, i) => ({ i, r: c.getBoundingClientRect() }))
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
    const pin = document.querySelector(".vox-hud-marker__target").getBoundingClientRect();
    const big = canvases[0];
    return {
      index: big.i,
      x: big.r.x,
      y: big.r.y,
      w: big.r.width,
      h: big.r.height,
      pinX: pin.x + pin.width / 2,
      pinY: pin.y + pin.height / 2,
    };
  });
  const png = await page.locator("canvas").nth(info.index).screenshot({
    animations: "disabled",
    style: ".vox-hud-marker, .vox-hud-marker *, .maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl { visibility: hidden !important; }",
  });
  const meta = await sharp(png).metadata();
  const cropW = Math.round((meta.height * 608) / 1320);
  const pinPx = Math.round((info.pinX - info.x) * 2);
  const left = Math.max(0, Math.min(meta.width - cropW, pinPx - Math.round(cropW * 0.5)));
  await sharp(png)
    .extract({ left, top: 0, width: cropW, height: meta.height })
    .resize({ width: 760 })
    .jpeg({ quality: 76, mozjpeg: true })
    .toFile(out);
  console.log("map", meta.width, meta.height, "crop", left, cropW, "pin", info.pinX, info.pinY);
  await browser.close();
})();
