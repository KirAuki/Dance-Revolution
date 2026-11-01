import { test, expect } from "@playwright/test";
import { adminCredentials } from "./fixtures.js";

test("settings editor updates the whole site and protects unsaved work, conflicts and expired sessions", async ({ page, request }, testInfo) => {
  const original = (await (await request.get("/api/settings")).json()).settings;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/admin/");
  const origin = new URL(page.url()).origin;
  const login = async () => {
    await page.getByLabel("Логин", {exact:true}).fill(adminCredentials.login);
    await page.getByLabel("Пароль", {exact:true}).fill(adminCredentials.password);
    await page.getByRole("button", {name:"Войти",exact:true}).click();
    await expect(page.locator(".cms-section-tabs")).toBeVisible();
  };
  const put = async record => {
    const session = await (await page.request.get("/api/admin/session")).json();
    return page.request.put("/api/admin/settings", {headers:{Origin:origin,"X-Admin-Request":"1","X-CSRF-Token":session.csrf}, data:record});
  };
  try {
    await login();
    await page.getByRole("button", {name:"Настройки сайта",exact:true}).click();
    const field = name => page.locator(`[name="${name}"]`);
    const save = page.getByRole("button", {name:"Сохранить настройки",exact:true});
    await expect(field("event.startDate")).toHaveValue(original.event.startDate);
    await field("event.startDate").fill("");
    await expect(page.locator(".cms-settings-summary h2")).toHaveText("Укажите даты конкурса");
    await field("event.startDate").fill("2028-05-03");
    await save.click();
    await expect(page.locator(".cms-error")).toContainText("Заезд должен");
    expect((await (await request.get("/api/settings")).json()).settings.event.startDate).toBe(original.event.startDate);
    for (const [name, value] of Object.entries({
      "event.endDate":"2028-05-04", "event.arrivalDate":"2028-05-02", "event.departureDate":"2028-05-05",
      "event.localDeadline":"2028-04-25", "event.travelDeadline":"2028-04-20",
      "event.city":"Тула", "event.localLabel":"Тула и Тульская область", "prices.localFirst":"4500",
      "contacts.email":"contest@example.com", "contacts.phone":"+7 999 123-45-67",
      "venue.name":"Новая сцена", "jury.0.name":"Новое имя жюри", "program.0.text":"Заезд и регистрация с 15:00.",
    })) await field(name).fill(value);
    await field("venue.image").setInputFiles("public/assets/dancers-stage.webp");
    await expect(page.locator("#settings-venue .cms-settings-image")).toHaveAttribute("src", /^\/media\//);
    const picture = await page.locator("#settings-venue .cms-settings-image").getAttribute("src");
    expect((await request.get(picture)).status()).toBe(404);
    await field("documents.regulations").setInputFiles("public/docs/polozhenie-tancevalnaya-revolyutsiya-2027.docx");
    await expect(page.getByRole("link", {name:"Открыть текущее положение"})).toHaveAttribute("href", /^\/documents\//);
    await save.click();
    await expect(page.locator(".cms-success")).toContainText("Настройки сохранены");
    const saved = (await (await request.get("/api/settings")).json()).settings;
    expect(saved.prices.localFirst).toBe(4500);
    expect((await request.get(picture)).status()).toBe(200);
    expect((await request.get(saved.documents.regulations)).headers()["content-disposition"]).toContain("attachment");
    const home = await page.context().newPage();
    await home.goto("/");
    await expect(home.locator(".hero__date time")).toHaveAttribute("datetime", "2028-05-03");
    await expect(home.locator(".hero__meta")).toContainText("3–4 мая 2028");
    await expect(home.locator(".application__meta")).toContainText("3–4 мая 2028");
    await expect(home.locator("#contacts")).toContainText("contest@example.com");
    await expect(home.locator(".jury-card").first()).toContainText("Новое имя жюри");
    await expect(home.locator(".timeline__grid")).toContainText("Заезд и регистрация с 15:00.");
    await expect(home.locator(".price-card").first().locator("strong")).toHaveText(/4\s500 ₽/);
    await expect(home.locator(".hero__actions [download]")).toHaveAttribute("href", saved.documents.regulations);
    expect(await home.title()).toContain("3–4 мая 2028, Тула");
    for (const url of ["/privacy", "/consent.html"]) {
      const html = await (await request.get(url)).text();
      expect(html).toContain("contest@example.com");
      expect(html).toContain("© 2028");
      expect(html).not.toContain("akulov@");
    }
    await home.close();
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      await page.evaluate(() => scrollTo(0,0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.screenshot({path:testInfo.outputPath(`settings-${width}.png`)});
    }
    // A competing edit must not be overwritten by the editor's stale version.
    const competing = await (await page.request.get("/api/admin/settings")).json();
    competing.settings.contacts.hours = "с 10:00 до 18:00";
    expect((await put(competing)).status()).toBe(200);
    await field("event.city").fill("Казань");
    await save.click();
    await expect(page.locator(".cms-error")).toContainText("другой вкладке");
    await expect(field("event.city")).toHaveValue("Казань");
    expect((await (await request.get("/api/settings")).json()).settings.event.city).toBe("Тула");
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", {name:"Новости и статьи",exact:true}).click();
    await expect(field("event.city")).toHaveValue("Казань");
    await page.context().clearCookies();
    await save.click();
    await expect(page.getByRole("heading", {name:"Войти в админку"})).toBeVisible();
    await login();
    await expect(field("event.city")).toHaveValue("Казань");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", {name:"Загрузить сохранённую версию"}).click();
    await expect(field("event.city")).toHaveValue("Тула");
    await expect(field("contacts.hours")).toHaveValue("с 10:00 до 18:00");
    expect(errors).toEqual([]);
  } finally {
    // Other browser tests use the original event; never mutate the user's database.
    const auth = await page.request.post("/api/admin/login", {headers:{Origin:origin,"X-Admin-Request":"1"}, data:adminCredentials});
    expect(auth.ok()).toBe(true);
    const current = await (await page.request.get("/api/admin/settings")).json();
    expect((await put({...current, settings:original})).ok()).toBe(true);
  }
});
