const {
  chromium,
  expect,
} = require("../../vox-web/node_modules/@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const output = path.resolve(__dirname, "../artifacts/timeline-composer");
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("vox-theme", "light"));
    await page.route("**/src/screenshots/main.tsx*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      assert(source.includes("installPlatform(mock)"));
      const fixture = `window.composerSaves=[]; const originalRequest=mock.http.request; mock.http.request=async req=>{ if(req.path.endsWith('/timeline/event-types')) return [{id:'transaction',group_id:'expense',value:'transaction',label:'Transaction',state:'active',content_schema:{required:['amount','direction','is_spending'],properties:{amount:{type:'number'},direction:{type:'string',enum:['debit','credit']},is_spending:{type:'boolean'}}}},{id:'meeting',group_id:'meeting',value:'meeting',label:'Meeting',state:'active',content_schema:{required:['location'],properties:{location:{type:'string'}}}}, ...['music','gaming','visit','meal','video'].map(value=>({id:value,group_id:value,value,label:value[0].toUpperCase()+value.slice(1),state:'active',content_schema:{}}))]; if(req.path==='/v1/timeline/events' && req.method==='POST'){window.composerSaves.push(req.body); await new Promise(r=>setTimeout(r,500)); if(window.failComposerSave) throw new Error('Could not save. Try again.');return {};} return originalRequest(req);}; installPlatform(mock)`;
      await route.fulfill({
        response,
        body: source.replace("installPlatform(mock)", fixture),
      });
    });
    await page.goto("http://localhost:1420/screenshots.html?screen=day");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Add to timeline" }),
    ).toBeVisible();
    await expect(dialog.getByLabel("What happened?")).toBeFocused();

    await dialog
      .getByLabel("What happened?")
      .fill("Lunch at the farmers market");
    await dialog
      .getByLabel("Notes (optional)")
      .fill("A slow afternoon with friends in Palo Alto.");
    await dialog
      .getByLabel("Starts", { exact: true })
      .fill("2026-10-16T12:30", { timeout: 5000 });
    await dialog.getByLabel("Amount", { exact: true }).fill("24.50");
    await dialog.getByLabel(/^Direction/).selectOption("debit");
    await dialog.getByLabel("Is spending", { exact: true }).check();
    await dialog.screenshot({ path: path.join(output, "light.png") });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await dialog.screenshot({ path: path.join(output, "dark.png") });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    await dialog.getByRole("button", { name: "Add end time" }).click();
    await dialog.getByLabel("Ends", { exact: true }).fill("2026-10-16T13:30");
    await page.setViewportSize({ width: 390, height: 760 });
    await dialog.screenshot({ path: path.join(output, "mobile.png") });
    const bounds = await dialog.boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth));
    for (const input of await dialog
      .locator('input[type="datetime-local"]')
      .all()) {
      const box = await input.boundingBox();
      assert(box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width);
    }
    await dialog.getByRole("button", { name: "Remove end time" }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => {
      window.failComposerSave = true;
    });
    await dialog
      .getByRole("button", { name: "Add entry", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Adding…" }),
    ).toBeDisabled();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Could not save. Try again.",
    );
    await expect(dialog.getByLabel("What happened?")).toHaveValue(
      "Lunch at the farmers market",
    );
    await page.evaluate(() => {
      window.failComposerSave = false;
    });
    await dialog
      .getByRole("button", { name: "Add entry", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const saves = await page.evaluate(() => window.composerSaves);
    assert.equal(saves.length, 2);
    assert.deepEqual(saves[1].content, {
      amount: 24.5,
      direction: "debit",
      is_spending: true,
    });
    assert.equal(saves[1].ended_at, null);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await dialog.getByLabel("Meetings", { exact: true }).check();
    await expect(dialog.getByLabel("Location", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Amount", { exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: title focus, category switching, schema enum/boolean/number fields, optional end, light/dark/mobile screenshots, overflow, pending/error/retry, create payload, Escape, no browser errors",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
