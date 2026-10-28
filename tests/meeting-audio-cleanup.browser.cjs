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
    await page.evaluate(() => {
      const m = window.meetingFixture.records.get(
        "00000000-0000-4000-8000-000000000001",
      );
      m.audio_cleanup_pending = true;
      m.audio_available = false;
      window.meetingFixture.failCleanup = true;
      window.recordingFixture.ready = false;
    });
    await page.getByRole("button", { name: /Product planning/ }).click();
    await expect(
      page.getByText(
        "Transcript saved. Temporary audio cleanup needs a retry.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Transcribe local audio", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Your notes" }).click();
    await page
      .getByRole("textbox", { name: "Your notes" })
      .fill("Preserve this unsaved note.");
    await page.getByRole("button", { name: "Retry audio cleanup" }).click();
    await expect(page.getByRole("alert")).toContainText("cleanup failed");
    await expect(page.getByRole("textbox", { name: "Your notes" })).toHaveValue(
      "Preserve this unsaved note.",
    );
    await page.evaluate(() => (window.meetingFixture.failCleanup = false));
    await page.getByRole("button", { name: "Retry audio cleanup" }).click();
    await expect(
      page.getByText(
        "No local audio retained. Your transcript and notes remain.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Your notes" })).toHaveValue(
      "Preserve this unsaved note.",
    );
    await page.getByRole("tab", { name: "Transcript", exact: true }).click();
    await expect(page.getByText("I’ll bring a short proposal")).toBeVisible();
    assert.deepEqual(errors, []);
    console.log(
      "PASS pending cleanup, failure/retry without a model, draft/transcript preservation and hidden ASR action",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
