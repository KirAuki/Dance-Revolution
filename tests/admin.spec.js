import { test, expect } from "@playwright/test";
import { adminCredentials } from "./fixtures.js";

test("password login, draft, cover, preview, publish, edit, unpublish and logout work end to end", async ({
  page,
  request,
}, testInfo) => {
  await page.goto("/admin/");
  await page.getByLabel("Логин", { exact: true }).fill(adminCredentials.login);
  await page.getByLabel("Пароль", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Неверный логин");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(adminCredentials.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page
    .getByRole("button", { name: "Новая публикация", exact: true })
    .click();
  await page.locator('[name="title"]').fill("Проверка редактора");
  await page.locator('[name="slug"]').fill("editor-browser-test");
  await page
    .locator('[name="description"]')
    .fill("Тестовая публикация в изолированной базе.");
  await page
    .locator('[name="section-0"]')
    .fill("Первый абзац статьи.\n\nВторой абзац статьи.");
  await page
    .getByLabel("Загрузить обложку")
    .setInputFiles("public/assets/dancers-stage.webp");
  await expect(page.locator(".cms-cover")).toBeVisible();
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.locator(".cms-success")).toContainText("Черновик сохранён");
  expect((await request.get("/news/editor-browser-test")).status()).toBe(404);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.frameLocator('iframe[title="Предпросмотр статьи"]').locator("h1"),
  ).toContainText("Проверка редактора");
  await expect(page.frameLocator('iframe[title="Предпросмотр статьи"]').locator("h1")).toHaveCSS("text-transform", "uppercase");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.locator(".cms-success")).toContainText("доступна на сайте");
  let publicPage = await request.get("/news/editor-browser-test");
  expect(publicPage.status()).toBe(200);
  expect(await publicPage.text()).toContain("Второй абзац статьи.");
  const home = await page.context().newPage();
  await home.goto("/");
  await expect(
    home.locator('#news a[href="/news/editor-browser-test"]'),
  ).toBeVisible();
  await home.close();
  await page.locator('[name="title"]').fill("Обновлённая публикация");
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page.locator(".cms-success")).toBeVisible();
  expect(
    await (await request.get("/news/editor-browser-test")).text(),
  ).toContain("Обновлённая публикация");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`admin-${width}.png`),
      fullPage: true,
    });
  }
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Снять с публикации", exact: true })
    .click();
  await expect(page.locator(".cms-success")).toContainText("Черновик сохранён");
  expect((await request.get("/news/editor-browser-test")).status()).toBe(404);
  await page.getByRole("button", { name: "К списку публикаций" }).click();
  await page
    .locator(".cms-post")
    .filter({ hasText: "Обновлённая публикация" })
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(page.locator(".cms-success")).toContainText("Запись удалена");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Войти в админку" }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/articles")).status()).toBe(401);
});
