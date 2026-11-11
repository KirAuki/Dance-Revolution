import { test, expect } from "@playwright/test";

test("server HTML remains readable without JavaScript and React enhances the same page", async ({ browser }, testInfo) => {
  const origin = process.env.API_ORIGIN;
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(origin + "/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("#jury")).toContainText("Ильдар Гайнутдинов");
    await expect(page.locator("#nominations")).toContainText("Народный танец");
    await expect(page.locator("#schedule")).toContainText("3 апреля 2027");
    await expect(page.locator("#news a[href='/news']")).toBeVisible();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^http.*\/assets\/dancers-stage.webp$/);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: testInfo.outputPath("home-without-js.png") });
  } finally { await context.close(); }

  const interactive = await browser.newContext({ viewport: {width:390,height:844}, reducedMotion:"reduce" });
  try {
    const page = await interactive.newPage();
    await page.goto(origin + "/");
    await expect(page.locator(".server-home")).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator(".footer__socials a")).toHaveCount(3);
    await expect(page.locator("#application form")).toBeVisible();
    expect(await interactive.cookies()).toHaveLength(0);
  } finally { await interactive.close(); }
});
