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
    const choose = async title => page.getByRole("navigation",{name:"Разделы настроек"}).getByRole("button",{name:title,exact:true}).click();
    const groupTitles = {event:"Даты и город",prices:"Стоимость и премия",contacts:"Контакты",venue:"Площадка",jury:"Жюри",program:"Программа",news:"Страница новостей",documents:"Документы",seo:"SEO и поиск"};
    const pageTitles = {privacy:"Политика конфиденциальности",consent:"Согласие на обработку ПД",cookies:"Использование cookies"};
    const chooseField = async name => choose(name.startsWith("pages.") ? pageTitles[name.split(".")[1]] : groupTitles[name.split(".")[0]]);
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
      "contacts.vkUrl":"https://vk.ru/example",
      "seo.title":"Конкурс танца — {dates}, {city}",
      "seo.description":"Хореографический конкурс {year}. {venue}, {city}.",
      "venue.name":"Новая сцена", "jury.0.name":"Новое имя жюри", "program.0.text":"Заезд и регистрация с 15:00.\n\nУжин",
      "program.0.note":"Приготовьте документы для заселения.",
      "pages.privacy.title":"Обработка данных",
      "pages.privacy.sections.0.text":"Организатор конкурса.\n\nСвязаться: {email}.",
      "pages.consent.lead":"Согласие на обработку данных для участия в конкурсе.",
      "pages.cookies.lead":"Технические cookies для входа администратора.",
      "news.title":"События конкурса",
      "news.lead":"Новости и материалы для участников.",
    })) { await chooseField(name); await field(name).fill(value); }
    await choose("Первый экран");
    await field("home.hero.lead").fill("Обновлённое описание конкурса из редактора.");
    await choose("Политика конфиденциальности");
    const privacy = page.locator("#settings-privacy");
    await privacy.getByRole("button", { name: "Добавить раздел", exact: true }).click();
    const sectionIndex = original.pages.privacy.sections.length;
    await field(`pages.privacy.sections.${sectionIndex}.heading`).fill("Обратная связь");
    await field(`pages.privacy.sections.${sectionIndex}.text`).fill("Напишите на {email}.");
    await privacy.locator(".cms-settings-item").last().getByRole("button", {name:"Выше",exact:true}).click();
    await expect(field(`pages.privacy.sections.${sectionIndex - 1}.heading`)).toHaveValue("Обратная связь");
    await privacy.locator(".cms-settings-item").nth(sectionIndex - 1).getByRole("button", {name:"Убрать",exact:true}).click();
    await choose("Площадка");
    await field("venue.image").setInputFiles("public/assets/dancers-stage.webp");
    await expect(page.locator("#settings-venue .cms-settings-image")).toHaveAttribute("src", /^\/media\//);
    const picture = await page.locator("#settings-venue .cms-settings-image").getAttribute("src");
    expect((await request.get(picture)).status()).toBe(404);
    await choose("Документы");
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
    await expect(home.locator(".hero__lead")).toHaveText("Обновлённое описание конкурса из редактора.");
    await expect(home.locator(".hero__date time")).toHaveAttribute("datetime", "2028-05-03");
    await expect(home.locator(".hero__meta")).toContainText("3–4 мая 2028");
    await expect(home.locator(".application__meta")).toContainText("3–4 мая 2028");
    await expect(home.locator("#contacts")).toContainText("contest@example.com");
    await expect(home.locator(".footer__grid > div").first().getByRole("link", {name:"contest@example.com"})).toHaveAttribute("href", "mailto:contest@example.com");
    await expect(home.locator(".footer__socials").getByRole("link", {name:"Instagram",exact:true})).toHaveCount(0);
    await expect(home.locator(".footer__socials").getByRole("link", {name:"VK",exact:true})).toHaveAttribute("href", "https://vk.ru/example");
    await expect(home.locator(".footer__socials").getByRole("link", {name:"WhatsApp",exact:true})).toHaveCount(0);
    await expect(home.locator(".jury-card").first()).toContainText("Новое имя жюри");
    await expect(home.locator(".timeline__grid")).toContainText("Заезд и регистрация с 15:00.");
    await expect(home.locator(".timeline__events").first().locator("li")).toHaveText(["Заезд и регистрация с 15:00.", "Ужин"]);
    await expect(home.locator(".timeline__note").first()).toContainText("Приготовьте документы для заселения.");
    await expect(home.locator(".price-card").first().locator("strong")).toHaveText(/4\s500 ₽/);
    await expect(home.locator(".hero__actions [download]")).toHaveAttribute("href", saved.documents.regulations);
    expect(await home.title()).toContain("3–4 мая 2028, Тула");
    expect(await home.title()).toMatch(/^Конкурс танца/);
    await expect(home.locator('meta[name="description"]')).toHaveAttribute('content', 'Хореографический конкурс 2028. Новая сцена, Тула.');
    for (const url of ["/privacy", "/consent.html"]) {
      const html = await (await request.get(url)).text();
      expect(html).toContain("contest@example.com");
      expect(html).toContain("© 2028");
      expect(html).not.toContain(original.contacts.email);
    }
    await home.goto("/privacy.html");
    await expect(home).toHaveURL(/\/privacy$/);
    await expect(home.locator("h1")).toHaveText("Обработка данных");
    await expect(home.locator(".legal-main section").first().locator("p")).toHaveCount(2);
    await expect(home.locator(".legal-main section").first().getByRole("link", { name: "contest@example.com" })).toHaveAttribute("href", "mailto:contest@example.com");
    await home.goto("/consent");
    await expect(home.locator(".legal-lead")).toHaveText("Согласие на обработку данных для участия в конкурсе.");
    await home.goto("/cookies");
    await expect(home.locator(".legal-lead")).toHaveText("Технические cookies для входа администратора.");
    await home.goto("/news");
    await expect(home.locator("h1")).toHaveText("События конкурса");
    await expect(home.locator(".news-index__lead")).toHaveText("Новости и материалы для участников.");
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
    await choose("Даты и город");
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
    await choose("Контакты");
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
