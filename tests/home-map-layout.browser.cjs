const {
  chromium,
  expect,
} = require("../../vox-web/node_modules/@playwright/test");
(async () => {
  const browser = await chromium.launch({
    args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 700, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `${process.env.VOX_LAYOUT_TEST_URL || "http://127.0.0.1:1421"}/screenshots.html?screen=home`,
    );
    const sidebar = page.locator('[data-slot="sidebar-container"]');
    await expect(sidebar).toBeVisible();
    const map = page.locator(".vox-map-host");
    await expect(map.locator("canvas")).toBeAttached({ timeout: 30000 });
    const canvas = await map.locator("canvas").elementHandle();
    for (const width of [700, 1100, 760, 900, 600, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(sidebar).toBeVisible();
      await expect
        .poll(async () =>
          map.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const canvas = el.querySelector("canvas");
            return Math.abs(canvas.width / devicePixelRatio - rect.width);
          }),
        )
        .toBeLessThanOrEqual(2);
      const [s, m, inset] = await Promise.all([
        sidebar.boundingBox(),
        map.boundingBox(),
        page.locator('[data-slot="sidebar-inset"]').boundingBox(),
      ]);
      expect(Math.abs(m.x - (s.x + s.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(m.width - inset.width)).toBeLessThanOrEqual(1);
      expect(m.width).toBeGreaterThan(0);
      expect(
        await canvas.evaluate(
          (el) => el === document.querySelector(".vox-map-host canvas"),
        ),
      ).toBe(true);
    }
    await page
      .getByRole("button", { name: "Toggle Sidebar", exact: true })
      .click();
    await expect
      .poll(async () => (await sidebar.boundingBox()).width)
      .toBeLessThan(80);
    await page
      .getByRole("button", { name: "Toggle Sidebar", exact: true })
      .click();
    await expect
      .poll(async () => (await sidebar.boundingBox()).width)
      .toBeGreaterThan(150);
    await page.waitForFunction(
      () => {
        const pin = document.querySelector(".vox-hud-marker");
        return pin && getComputedStyle(pin).visibility === "visible";
      },
      null,
      { timeout: 30000 },
    );
    const fs = require("node:fs/promises");
    const output = require("node:path").resolve(
      __dirname,
      "../artifacts/home-map-layout",
    );
    await fs.mkdir(output, { recursive: true });
    await page.screenshot({ path: output + "/wide.png" });
    await page.setViewportSize({ width: 700, height: 900 });
    await page.screenshot({ path: output + "/narrow.png" });
    // Observe the canvas at the same pre-paint boundary as layout changes,
    // rather than waiting for a later screenshot to hide a stretched frame.
    const mismatches = await page.evaluate(async () => {
      const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]');
      const host = document.querySelector(".vox-map-host");
      const canvas = host.querySelector("canvas");
      const mismatches = [];
      const observer = new ResizeObserver(() => {
        const actual = canvas.width / devicePixelRatio;
        const expected = host.clientWidth;
        if (Math.abs(actual - expected) > 2)
          mismatches.push({ actual, expected });
      });
      observer.observe(host);
      for (const width of [180, 230, 300, 350, 260, 200, 256]) {
        wrapper.style.setProperty("--sidebar-width", width + "px");
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      observer.disconnect();
      return mismatches;
    });
    expect(mismatches).toEqual([]);
    const sharp = require("../../vox-web/node_modules/sharp");
    for (const width of [1000, 740, 1100, 620]) {
      await page.setViewportSize({ width, height: 900 });
      const bounds = await map.boundingBox();
      const frame = await page.screenshot({
        clip: { x: Math.ceil(bounds.x) + 10, y: 200, width: 150, height: 400 },
      });
      const stats = await sharp(frame).stats();
      expect(stats.channels.some((channel) => channel.stdev > 3)).toBe(true);
    }

    expect(errors).toEqual([]);
    console.log(
      "PASS: sidebar stays available below 768px; map fills adjacent flex pane; canvas survives resizing and sidebar toggle",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
