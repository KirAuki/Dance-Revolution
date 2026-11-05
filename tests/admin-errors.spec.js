import { test, expect } from "@playwright/test";
import { adminCredentials } from "./fixtures.js";

test("settings draft survives invalid responses, network errors and request timeout", async ({ page, request }) => {
  const original = (await (await request.get("/api/settings")).json()).settings;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/admin/");
  await page.getByLabel("Логин", { exact: true }).fill(adminCredentials.login);
  await page.getByLabel("Пароль", { exact: true }).fill(adminCredentials.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.getByRole("button", { name: "Настройки сайта", exact: true }).click();
  const city = page.locator('[name="event.city"]');
  await expect(city).toHaveValue(original.event.city);
  await city.fill("Несохранённый город");
  const save = page.getByRole("button", { name: "Сохранить настройки", exact: true });
  for (const [mode, message] of [["html", "некорректный ответ"], ["offline", "Нет связи"], ["timeout", "не ответил вовремя"]]) {
    let pendingRoute;
    await page.route("**/api/admin/settings", async route => {
      if (route.request().method() !== "PUT") return route.continue();
      if (mode === "html") return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Proxy error</h1>" });
      if (mode === "offline") return route.abort("internetdisconnected");
      pendingRoute = route;
    });
    if (mode === "timeout") await page.clock.install();
    await save.click();
    if (mode === "timeout") {
      await expect.poll(() => Boolean(pendingRoute)).toBe(true);
      await page.clock.fastForward(31000);
    }
    await expect(page.locator(".cms-error")).toContainText(message);
    await expect(city).toHaveValue("Несохранённый город");
    await expect(save).toBeEnabled();
    await expect(page.locator(".cms-success")).toHaveCount(0);
    if (pendingRoute) await pendingRoute.abort();
    await page.unroute("**/api/admin/settings");
  }
  expect((await (await request.get("/api/settings")).json()).settings).toEqual(original);
  expect(errors).toEqual([]);
});
