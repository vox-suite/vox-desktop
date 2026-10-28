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
      timezoneId: "America/Los_Angeles",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:1432/tests/meetings-preview.html");
    const open = (title) =>
      page.getByRole("button", { name: new RegExp(title) }).first();
    await open("Product planning").click();
    await expect(
      page.getByRole("heading", { name: "Product planning" }),
    ).toBeVisible();
    await expect(page.getByText("I’ll bring a short proposal")).toBeVisible();
    await page
      .getByRole("button", { name: "Computer audio", exact: true })
      .click();
    await expect(page.getByText("Agreed. We should test")).toBeVisible();
    await page.getByLabel("Search transcript").fill("not-present");
    await expect(
      page.getByText("No passages match your search."),
    ).toBeVisible();
    await page.getByLabel("Search transcript").fill("");
    await page.getByRole("tab", { name: "Your notes" }).click();
    const notes = page.getByRole("textbox", { name: "Your notes" });
    await notes.fill("Draft that must survive switching.");
    await open("Design review").click();
    await open("Product planning").click();
    await page.getByRole("tab", { name: "Your notes" }).click();
    await expect(notes).toHaveValue("Draft that must survive switching.");
    await page.evaluate(() => {
      window.meetingFixture.failSave = true;
    });
    await page.getByRole("button", { name: "Save notes", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Could not save notes");
    await expect(notes).toHaveValue("Draft that must survive switching.");
    await page.evaluate(() => {
      window.meetingFixture.failSave = false;
      window.meetingFixture.conflictNextSave = true;
    });
    await page.getByRole("button", { name: "Save notes", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Review note conflict" }),
    ).toContainText("Updated by another window.");
    await expect(notes).toHaveValue("Draft that must survive switching.");
    await page.getByRole("button", { name: "Save my draft instead" }).click();
    await expect(
      page.getByRole("button", { name: "Save notes", exact: true }),
    ).toBeDisabled();
    assert.equal(await page.evaluate(() => window.meetingFixture.saveCount), 1);
    await page.getByRole("button", { name: "Export saved meeting" }).click();
    assert.equal(
      await page.evaluate(() => window.meetingFixture.exports.length),
      1,
    );
    await page
      .getByRole("button", { name: "Import transcript", exact: true })
      .click();
    await page.getByRole("button", { name: "Choose transcript" }).click();
    await page.getByRole("tab", { name: "Transcript", exact: true }).click();
    await expect(page.getByText("Imported transcript passage.")).toBeVisible();
    await page.getByRole("button", { name: "New note", exact: true }).click();
    await page.getByLabel("Meeting title").fill("Customer conversation");
    await page
      .getByRole("button", { name: "Create note", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Customer conversation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Your notes" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete meeting", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete meeting", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Customer conversation" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Check interrupted recordings" })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Checked 1 interrupted meeting" }),
    ).toContainText("Recording remains stopped.");
    await page.getByRole("button", { name: "Load more meetings" }).click();
    await expect(open("Planning notes 22")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 780 });
    await open("Product planning").click();
    await expect(
      page.getByRole("button", { name: "Back to meetings" }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.getByRole("button", { name: "Back to meetings" }).click();
    await expect(open("Product planning")).toBeVisible();
    await page.evaluate(() => {
      window.meetingFixture.failGetId = "00000000-0000-4000-8000-000000000002";
    });
    await open("Design review").click();
    await expect(page.getByRole("alert")).toContainText(
      "Could not open this meeting",
    );
    await page.getByRole("button", { name: "Back to meetings" }).click();
    await expect(open("Product planning")).toBeVisible();
    assert.deepEqual(errors, []);
    await page.screenshot({ path: "/tmp/vox-meetings-mobile.png" });
    console.log(
      "PASS meeting sources/search, draft preservation, save errors/conflicts, import/export, create/delete, recovery, pagination and narrow layout",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
