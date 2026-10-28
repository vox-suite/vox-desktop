const {
  chromium,
  expect,
} = require("../../vox-web/node_modules/@playwright/test");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 820 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:1432/tests/meetings-preview.html");
    const bar = page.getByRole("region", { name: "Meeting recording" });
    await bar.getByRole("button", { name: "Set up local speech" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Local speech recognition",
    });
    await expect(dialog).toContainText("148 MB download");
    await expect(dialog).toContainText(
      "It sends no meeting audio or transcript",
    );
    assert.equal(
      await page.evaluate(() => window.recordingFixture.installCalls),
      0,
    );
    await dialog.getByRole("button", { name: "Download local model" }).click();
    await expect(
      dialog.getByRole("progressbar", { name: "Speech model download" }),
    ).toHaveAttribute("value", "25000000");
    await dialog
      .getByRole("button", { name: "Continue in background" })
      .click();
    await expect(
      bar.getByRole("button", { name: "Speech setup in progress" }),
    ).toBeVisible();
    await bar.getByRole("button", { name: "Speech setup in progress" }).click();
    await dialog.getByRole("button", { name: "Cancel download" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Download cancelled");
    await page.evaluate(() => (window.recordingFixture.failInstall = true));
    await dialog.getByRole("button", { name: "Retry download" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Download connection failed",
    );
    await page.evaluate(() => (window.recordingFixture.failInstall = false));
    await dialog.getByRole("button", { name: "Retry download" }).click();
    await page.evaluate(() => {
      window.recordingFixture.modelPhase = "verifying";
      window.recordingFixture.modelBytes = 147951465;
    });
    await expect(dialog.getByRole("status")).toHaveText(
      "Verifying speech model",
    );
    await expect(
      dialog.getByRole("button", { name: "Download local model" }),
    ).toHaveCount(0);
    await page.evaluate(() => (window.recordingFixture.ready = true));
    await expect(dialog.getByRole("status")).toHaveText(
      "Local speech is ready",
    );
    await page.setViewportSize({ width: 390, height: 780 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({ path: "/tmp/vox-model-setup-ready.png" });
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    assert.deepEqual(errors, []);
    console.log(
      "PASS setup consent, progress, background, cancel/retry, verification gate, ready and narrow layout",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
