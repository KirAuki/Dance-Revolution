import { test, expect } from "@playwright/test";
import { validApplication } from "./fixtures.js";

async function fillStep(page, names) {
  for (const name of names) {
    if (name === "duration") {
      const [minutes, seconds] = validApplication.duration.split(":");
      await page.getByRole("textbox", { name: "Минуты", exact: true }).fill(minutes);
      await page.getByRole("textbox", { name: "Секунды", exact: true }).fill(seconds);
      continue;
    }
    const control = page.locator(`[name="${name}"]`);
    if (["nomination", "ageCategory", "professionalLevel"].includes(name))
      await control.selectOption(validApplication[name]);
    else await control.fill(validApplication[name]);
  }
}
async function firstStep(page) {
  await fillStep(page, [
    "collective",
    "performanceTitle",
    "participantCount",
    "duration",
    "nomination",
    "ageCategory",
    "professionalLevel",
  ]);
  await page.getByRole("button", { name: "Далее" }).click();
}
async function secondStep(page) {
  await fillStep(page, [
    "participants",
    "country",
    "city",
    "director",
    "teacher",
  ]);
  await page.locator(".radio-group label").filter({ hasText: "Нет" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
}
async function finalStep(page) {
  await expect(
    page.locator('.form-step:not([hidden]) input[type="checkbox"]'),
  ).toHaveCount(2);
  await fillStep(page, ["email", "phone"]);
  for (const name of ["regulationsAccepted", "personalDataAccepted"])
    await page.locator(`[name="${name}"]`).check();
}

test("desktop and mobile layout, navigation and document links load without browser errors", async ({
  page,
  request,
}, testInfo) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("РЕВОЛЮЦИЯ");
    await page.addStyleTag({
      content:
        ".page-loader{display:none!important}.reveal{opacity:1!important;transform:none!important}",
    });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".page-loader")).toHaveClass(/is-hidden/);
    await page.screenshot({ path: testInfo.outputPath(`layout-${name}.png`) });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow).toBe(false);
    await expect(page.locator("main > section")).toHaveCount(14);
  }
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await expect(page.locator("body")).toHaveClass("menu-open");
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass("menu-open");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .getByRole("navigation")
    .getByText("Номинации", { exact: true })
    .click();
  await expect(page.locator("body")).not.toHaveClass("menu-open");
  const details = page.locator(".nomination-list details");
  await details.nth(1).locator("summary").click();
  await expect(details.nth(1)).toHaveAttribute("open", "");
  await expect(details.nth(0)).not.toHaveAttribute("open", "");
  for (const path of [
    "/privacy.html",
    "/privacy",
    "/consent.html",
    "/consent",
  ]) {
    await page.goto(path);
    await expect(page.locator(".legal-main h1")).toBeVisible();
  }
  expect(
    (
      await request.get("/docs/polozhenie-tancevalnaya-revolyutsiya-2027.docx")
    ).ok(),
  ).toBe(true);
  expect(failures).toEqual([]);
});

test("news replaces FAQ and article drafts are not public", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator("#news")).toContainText("12 / Новости");
  await expect(page.locator("#faq")).toHaveCount(0);
  await page.locator('#news a[href="/news"]').click();
  await expect(page.locator("h1")).toContainText("Новости и статьи");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,follow",
  );
  expect((await request.get("/news/kak-podgotovit-zayavku")).status()).toBe(
    404,
  );
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "kak-podgotovit-zayavku",
  );
});

test("marquee fills wide screens through the entire loop with even spacing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.locator(".marquee__track").waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 1440, 1920, 3840]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const progress of [0, 0.5, 0.999]) {
      const metrics = await page
        .locator(".marquee__track")
        .evaluate((track, progress) => {
          const animation = track.getAnimations()[0];
          animation.pause();
          animation.currentTime = 80000 * progress;
          const groups = [...track.children].map((group) =>
            group.getBoundingClientRect(),
          );
          const children = [...track.querySelectorAll("span")].map((node) =>
            node.getBoundingClientRect(),
          );
          const gaps = children
            .slice(1)
            .map((rect, index) => rect.left - children[index].right);
          return {
            left: groups[0].left,
            right: groups.at(-1).right,
            widths: groups.map((rect) => rect.width),
            minGap: Math.min(...gaps),
            maxGap: Math.max(...gaps),
          };
        }, progress);
      expect(metrics.left).toBeLessThanOrEqual(1);
      expect(metrics.right).toBeGreaterThanOrEqual(width - 1);
      expect(metrics.widths[0]).toBeCloseTo(metrics.widths[1], 1);
      expect(metrics.maxGap - metrics.minGap).toBeLessThan(1);
    }
  }
});

test("mobile menu covers the viewport after scrolling and stays usable on short screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".page-loader")).toHaveClass(/is-hidden/);
  const menu = page.locator("#site-nav");
  const toggle = page.locator(".menu-button");

  for (const top of [0, 5000, 20000]) {
    await page.evaluate((y) => window.scrollTo(0, y), top);
    if (top > 0)
      await expect(page.locator(".site-header")).toHaveClass(/is-scrolled/);
    const savedScroll = await page.evaluate(() => window.scrollY);
    await toggle.click();
    await expect(menu).toBeVisible();
    const bounds = await menu.boundingBox();
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    expect(bounds.width).toBe(390);
    expect(bounds.height).toBe(844);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(document.elementFromPoint(200, 800)?.closest("#site-nav")),
        ),
      )
      .toBe(true);
    await expect(menu.locator("a").first()).toBeInViewport();
    await expect(menu.locator("a").last()).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => window.scrollY)).toBe(savedScroll);
  }

  await page.setViewportSize({ width: 844, height: 390 });
  await toggle.click();
  await expect(menu).toBeVisible();
  await expect(menu.locator("a").first()).toBeInViewport();
  await menu.locator("a").last().scrollIntoViewIfNeeded();
  await expect(menu.locator("a").last()).toBeInViewport();
  await menu.locator("a").last().click();
  await expect(menu).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/menu-open/);
  await expect(page).toHaveURL(/#contacts$/);
});

test("form validates every step, requires guests and preserves entered values", async ({
  page,
}) => {
  await page.goto("/#application");
  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.locator('[name="collective"]')).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await firstStep(page);
  await fillStep(page, [
    "participants",
    "country",
    "city",
    "director",
    "teacher",
  ]);
  await page.locator(".radio-group label").filter({ hasText: "Да" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.locator('[name="hotelGuests"]')).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.locator('[name="hotelGuests"]').fill("Тестовый гость");
  await page.locator(".radio-group label").filter({ hasText: "Нет" }).click();
  await expect(page.locator('[name="hotelGuests"]')).toBeHidden();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "01 Номер" }).click();
  await expect(page.locator('[name="collective"]')).toHaveValue(
    validApplication.collective,
  );
  await page.locator('[name="participantCount"]').fill("501");
  await page.getByRole("button", { name: "03 Контакты" }).click();
  await expect(page.locator('[name="participantCount"]')).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator('[name="email"]')).toBeHidden();
});

test("duration supports separate fields, colon typing and pasted formats without losing validation", async ({ page }, testInfo) => {
  await page.goto("/#application");
  await fillStep(page, ["collective", "performanceTitle", "participantCount", "nomination", "ageCategory", "professionalLevel"]);
  const minutes = page.getByRole("textbox", { name: "Минуты", exact: true });
  const seconds = page.getByRole("textbox", { name: "Секунды", exact: true });
  await page.getByRole("button", { name: "Далее" }).click();
  await expect(minutes).toBeFocused();
  await expect(page.locator("#duration-error")).toBeVisible();
  for (const [min, sec] of [["0", "00"], ["3", "60"], ["4", "01"], ["1.5", "30"]]) {
    await minutes.fill(min);
    await seconds.fill(sec);
    await page.getByRole("button", { name: "Далее" }).click();
    await expect(page.locator("#duration-error")).toBeVisible();
    await expect(minutes).toBeVisible();
  }
  await minutes.fill("");
  await seconds.fill("");
  await minutes.pressSequentially("3:30");
  await expect(minutes).toHaveValue("3");
  await expect(seconds).toHaveValue("30");
  for (const input of ["03:30", "3.30", "3,30", "3 30", "330"]) {
    await minutes.evaluate((node, text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text", text);
      node.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
    }, input);
    await expect(minutes).toHaveValue(input === "03:30" ? "03" : "3");
    await expect(seconds).toHaveValue("30");
  }
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator(".duration-field").screenshot({ path: testInfo.outputPath(`duration-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  // A performance under one minute does not require typing a zero in minutes.
  await minutes.fill("");
  await seconds.fill("45");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "01 Номер" }).click();
  await expect(minutes).toHaveValue("");
  await expect(seconds).toHaveValue("45");
  await page.getByRole("button", { name: "Далее" }).click();
  await secondStep(page);
  await finalStep(page);
  const saved = page.waitForResponse(response => response.url().endsWith("/api/application") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON().duration).toBe("00:45");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).last().click();
  await expect(minutes).toHaveValue("");
  await expect(seconds).toHaveValue("");
});

test("form keeps data on failure, blocks duplicate submits and resets after confirmed success", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/application", async (route) => {
    attempts++;
    const body = route.request().postDataJSON();
    expect(body.duration).toBe("04:00");
    expect(body.personalDataAccepted).toBe(true);
    expect(body).not.toHaveProperty("mediaAccepted");
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: attempts === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        attempts === 1
          ? { message: "Почтовая отправка ещё не настроена." }
          : { applicationNumber: "TR-2027-TEST" },
      ),
    });
  });
  await page.goto("/#application");
  await firstStep(page);
  await secondStep(page);
  await finalStep(page);
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.locator(".button--submit")).toBeDisabled();
  await expect(page.locator("#form-alert")).toContainText(
    "Почтовая отправка ещё не настроена.",
  );
  await expect(page.locator('[name="email"]')).toHaveValue(
    validApplication.email,
  );
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByRole("dialog")).toContainText("TR-2027-TEST");
  await page
    .getByRole("button", { name: "Закрыть", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator('[name="collective"]')).toHaveValue("");
  expect(attempts).toBe(2);
});

test("local API rejects invalid payloads", async ({ request }) => {
  expect((await request.get("/api/application")).status()).toBe(405);
  const response = await request.post("/api/application", {
    data: { ...validApplication, participantCount: 4 },
    headers: {"Idempotency-Key":crypto.randomUUID()},
  });
  expect(response.status()).toBe(422);
});
