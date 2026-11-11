import { test, expect } from "@playwright/test";

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test("joined cards keep complete borders and aligned descriptions across breakpoints", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 390, 560, 561, 768, 900, 901, 1024, 1180, 1181, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await settle(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `overflow at ${width}`).toBeLessThanOrEqual(width);
    for (const [selector, text] of [[".jury-card", "strong"], [".criteria-card", "p"], [".timeline__grid article", ".timeline__details"], [".format-grid article", "p"], [".price-card", "ul"]]) {
      const measurements = await page.locator(selector).evaluateAll((cards, text) => {
        const rows = new Map();
        for (const card of cards) {
          const top = Math.round(card.getBoundingClientRect().top);
          if (!rows.has(top)) rows.set(top, []);
          rows.get(top).push(card.querySelector(text).getBoundingClientRect().top);
        }
        return {
          differences: [...rows.values()].map(row => Math.max(...row) - Math.min(...row)),
          closedBorders: cards.every(card => {
            const style = getComputedStyle(card);
            return ["Top", "Right", "Bottom", "Left"].every(side => parseFloat(style[`border${side}Width`]) > 0);
          }),
        };
      }, text);
      expect(measurements.closedBorders, `${selector} at ${width}`).toBe(true);
      expect(Math.max(...measurements.differences), `${selector} at ${width}`).toBeLessThan(1);
    }
  }
  for (const route of ["/privacy", "/consent", "/cookies", "/news"]) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} at ${width}`).toBeLessThanOrEqual(width);
      if (route === "/cookies" && [390, 1440].includes(width)) {
        await page.screenshot({path: testInfo.outputPath(`cookies-${width}.png`), fullPage: true});
      }
    }
  }
});

test("mobile menu isolates background controls and restores usable keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".page-loader")).toHaveClass(/is-hidden/);
  await expect(page.locator(".back-to-top")).toHaveAttribute("tabindex", "-1");
  const toggle = page.locator(".menu-button");
  await toggle.click();
  expect(await page.locator("main").evaluate(node => node.inert)).toBe(true);
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement.closest(".site-header")))).toBe(true);
  }
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement.closest(".site-header")))).toBe(true);
  }
  await page.locator('#site-nav a[href="#jury"]').click();
  await expect(page.locator("#jury h2")).toBeFocused();
  expect(await page.locator("main").evaluate(node => node.inert)).toBe(false);
  await expect(page.locator(".back-to-top")).toHaveAttribute("tabindex", "0");
  await toggle.click();
  await page.locator('#site-nav a[href="#contacts"]').click();
  await expect(page.locator("#contacts")).toBeFocused();
});

test("hero video pauses outside the viewport and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const video = page.locator(".hero__video");
  await expect.poll(() => video.evaluate(node => node.paused)).toBe(false);
  await page.locator("#jury").scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate(node => node.paused)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => video.evaluate(node => node.paused)).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => video.evaluate(node => node.paused)).toBe(true);
});

test("reveals keep shared frames stationary and reduced motion disables decorative movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator(".page-loader")).toHaveClass(/is-hidden/);
  for (const selector of [".facts-grid", ".price-grid", ".timeline__grid", ".news-content", ".jury-card"]) {
    const card = page.locator(selector).first();
    await expect(card).toHaveCSS("transform", "none");
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveClass(/is-visible/);
    await expect(card).toHaveCSS("opacity", "1");
    await expect(card).toHaveCSS("transform", "none");
  }
  const jury = page.locator(".jury-card").first();
  await jury.scrollIntoViewIfNeeded();
  await jury.hover();
  const before = await jury.boundingBox();
  await expect(jury.locator(".jury-card__portrait")).not.toHaveCSS("transform", "none");
  expect(await jury.boundingBox()).toEqual(before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(jury.locator(".jury-card__portrait")).toHaveCSS("transform", "none");
  await page.locator(".hotel-gallery figure").first().hover();
  await expect(page.locator(".hotel-gallery img").first()).toHaveCSS("transform", "none");
  const summary = page.locator(".nomination-list summary").nth(1);
  await summary.click();
  await expect(summary.locator("..").locator("p")).toBeVisible();
  await expect(summary.locator("..").locator("p")).toHaveCSS("animation-name", "none");
});
