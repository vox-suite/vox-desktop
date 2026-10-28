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
    const setup = page.getByRole("dialog", {
      name: "Local speech recognition",
    });
    await setup.getByText("Use existing local files", { exact: true }).click();
    await setup
      .getByRole("button", { name: "Choose engine and model files" })
      .click();
    await expect(setup.getByRole("status")).toHaveText("Local speech is ready");
    await setup.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      bar.getByRole("button", { name: "Speech settings" }),
    ).toBeVisible();
    await bar
      .getByRole("button", { name: "Record meeting", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "including other apps and notifications",
    );
    await page.getByLabel("Recording title").fill("Offline planning");
    await page.evaluate(() => (window.recordingFixture.failStart = true));
    await page.getByRole("button", { name: "Start local recording" }).click();
    await expect(bar.getByRole("alert")).toContainText(
      "Microphone permission denied",
    );
    await page.evaluate(() => (window.recordingFixture.failStart = false));
    await bar
      .getByRole("button", { name: "Record meeting", exact: true })
      .click();
    await page.getByLabel("Recording title").fill("Offline planning");
    await page.getByRole("button", { name: "Start local recording" }).click();
    await expect(bar.getByRole("status")).toContainText("Recording locally");
    await expect(
      page.getByRole("button", { name: /Offline planning/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Offline planning/ }).click();
    await page.getByRole("tab", { name: "Your notes" }).click();
    await page
      .getByRole("textbox", { name: "Your notes" })
      .fill("Keep my live meeting draft.");
    await page.evaluate(() => (window.recordingFixture.failStop = true));
    await bar.getByRole("button", { name: "Stop recording" }).click();
    await expect(bar.getByRole("alert")).toContainText("retry");
    await page.evaluate(() => (window.recordingFixture.failStop = false));
    await bar.getByRole("button", { name: "Stop recording" }).click();
    await expect(bar.getByRole("status")).toContainText(
      "Recording saved locally",
    );
    await expect(page.getByRole("textbox", { name: "Your notes" })).toHaveValue(
      "Keep my live meeting draft.",
    );
    await page
      .getByRole("button", { name: "Transcribe local audio", exact: true })
      .click();
    await expect(bar.getByRole("status")).toContainText(
      "Transcript saved locally",
    );
    await expect(page.getByRole("textbox", { name: "Your notes" })).toHaveValue(
      "Keep my live meeting draft.",
    );
    await page.getByRole("tab", { name: "Transcript", exact: true }).click();
    await expect(
      page.getByText("Local speech recognition completed."),
    ).toBeVisible();
    await expect(
      page.getByText(
        "No local audio retained. Your transcript and notes remain.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Transcribe local audio", exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 780 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({ path: "/tmp/vox-recording-controls.png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS model setup, notice, permission errors, start/status, stop retry, narrow layout",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
