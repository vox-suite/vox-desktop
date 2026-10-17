const {
  chromium,
  expect,
} = require("../../vox-web/node_modules/@playwright/test");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/\/src\/lib\/tauri\.ts(?:\?.*)?$/, (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.voiceStarts=[];window.voiceEnds=0;const idle={state:'idle',active:false,mic_level:0,is_speaking:false,is_vox_speaking:false};export const api={callStatus:async()=>idle,startCall:()=>new Promise((resolve,reject)=>window.voiceStarts.push({resolve,reject})),endCall:async()=>{window.voiceEnds++;}};export const invokeErrorMessage=String;`,
      }),
    );
    await page.goto(
      process.env.VOICE_TEST_URL ||
        "http://127.0.0.1:1432/tests/voice-cancel-preview.html",
    );
    const toggle = page.getByRole("button", { name: "Toggle call" });
    const state = page.getByTestId("state");
    await toggle.click();
    await expect(state).toHaveText("connecting");
    // Exercise polling while native authentication/setup has not registered a call yet.
    await page.waitForTimeout(1000);
    await expect(state).toHaveText("connecting");
    await toggle.click();
    await expect(state).toHaveText("idle");
    assert.equal(await page.evaluate(() => window.voiceEnds), 1);
    await toggle.click();
    await expect(state).toHaveText("connecting");
    await page.evaluate(() =>
      window.voiceStarts[0].resolve({ state: "active", active: true }),
    );
    await expect(state).toHaveText("connecting");
    await page.evaluate(() =>
      window.voiceStarts[1].reject(new Error("current setup failed")),
    );
    await expect(state).toHaveText("idle");
    await expect(page.getByTestId("error")).toContainText(
      "current setup failed",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS connecting cancellation, polling, stale start result, current failure",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
