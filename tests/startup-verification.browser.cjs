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
      viewport: { width: 1000, height: 800 },
      colorScheme: "light",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let releaseStyle;
    const styleGate = new Promise((resolve) => {
      releaseStyle = resolve;
    });
    await page.route(
      "https://tiles.openfreemap.org/styles/dark",
      async (route) => {
        await styleGate;
        await route.continue();
      },
    );
    await page.goto(
      "http://127.0.0.1:1421/screenshots.html?screen=verification",
    );
    await expect(
      page.getByRole("heading", { name: "Verify your number" }),
    ).toBeVisible();
    const map = page.locator(".vox-map-host");
    await expect(map.locator("canvas")).toBeAttached();
    const original = await map.locator("canvas").elementHandle();
    await expect(map).toHaveAttribute("data-ready", "false");
    await expect(map.locator("canvas")).toHaveCSS("visibility", "hidden");
    await page
      .getByRole("button", { name: "Verify later", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Verify your number" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Home", exact: true }),
    ).toBeVisible();
    if (
      !(await original.evaluate(
        (el) => el === document.querySelector(".vox-map-host canvas"),
      ))
    )
      throw Error("Map remounted across verification");
    const color = await map.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    if (color === "rgb(0, 0, 0)")
      throw Error("Light startup has a black background");
    releaseStyle();
    await expect(map).toHaveAttribute("data-ready", "true", { timeout: 45000 });
    await expect(map.locator("canvas")).toHaveCSS("visibility", "visible");
    expect(errors).toEqual([]);
    console.log(
      "PASS: verification preserves map instance; light loading host stays themed; canvas appears after themed render",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
