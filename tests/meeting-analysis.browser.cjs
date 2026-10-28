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
    await page.getByRole("button", { name: /Product planning/ }).click();
    await page.getByRole("tab", { name: "Your notes" }).click();
    await page
      .getByRole("textbox", { name: "Your notes" })
      .fill("Keep my handwritten draft.");
    await page.getByRole("tab", { name: "Summary", exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.meetingFixture.analysisCalls),
      0,
    );
    await expect(page.getByText(/Audio stays local/)).toBeVisible();
    await page
      .getByRole("button", { name: "Generate with cloud text", exact: true })
      .click();
    await expect(
      page.getByText(
        "The team agreed to focus on reliable local recording and durable notes.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Owner uncertain")).toBeVisible();
    await page.getByText("Evidence", { exact: true }).first().click();
    await expect(page.getByText("Microphone · 0:00")).toBeVisible();
    await page.evaluate(() => (window.meetingFixture.failAnalysis = true));
    await page
      .getByRole("button", { name: "Regenerate with cloud text" })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Cloud text analysis unavailable",
    );
    await expect(
      page.getByText("Bring a short proposal", { exact: true }),
    ).toBeVisible();
    await page.evaluate(() => (window.meetingFixture.failPromotion = true));
    await page.getByRole("button", { name: "Add to my tasks" }).click();
    await expect(
      page.getByRole("button", { name: "Retry saving approved task" }),
    ).toBeVisible();
    await page.evaluate(() => {
      window.meetingFixture.failPromotion = false;
      window.meetingFixture.failAnalysis = false;
      window.meetingFixture.suggestedDeadline = true;
    });
    await page
      .getByRole("button", { name: "Regenerate with cloud text" })
      .click();
    await expect(page.getByText(/Owner uncertain · No deadline/)).toBeVisible();
    await page.evaluate(() => {
      window.meetingFixture.omitActions = true;
    });
    await page
      .getByRole("button", { name: "Regenerate with cloud text" })
      .click();
    await page.getByRole("tab", { name: "Your notes" }).click();
    await page.getByRole("tab", { name: "Summary", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Retry saving approved task" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Retry saving approved task" })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry saving approved task" }),
    ).toHaveCount(0);
    await page.evaluate(() => {
      window.meetingFixture.failAnalysis = false;
      window.meetingFixture.omitActions = false;
    });
    await page
      .getByRole("button", { name: "Regenerate with cloud text" })
      .click();
    await expect(page.getByText("Added previously to Timeline")).toBeVisible();
    assert.equal(
      await page.evaluate(() => window.meetingFixture.promotionCalls),
      1,
    );
    await page.getByRole("tab", { name: "Your notes" }).click();
    await expect(page.getByRole("textbox", { name: "Your notes" })).toHaveValue(
      "Keep my handwritten draft.",
    );
    await page.getByRole("tab", { name: "Summary", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "/tmp/vox-meeting-summary.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS explicit text consent, evidence, failure preservation, approval retry, regeneration deduplication, draft preservation, narrow layout",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
