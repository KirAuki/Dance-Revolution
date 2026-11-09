import { test, expect } from "@playwright/test";
import { adminCredentials, validApplication } from "./fixtures.js";

test("applications are saved without mail and admins can search, review and update them", async ({ page, request }, testInfo) => {
  const key=crypto.randomUUID();
  const data={...validApplication,collective:"Коллектив проверки заявок",city:"Казань"};
  const response=await request.post("/api/application",{data,headers:{"Idempotency-Key":key}});
  expect(response.status()).toBe(201);
  const {applicationNumber}=await response.json();
  const retry=await request.post("/api/application",{data,headers:{"Idempotency-Key":key}});
  expect((await retry.json()).applicationNumber).toBe(applicationNumber);
  await page.goto("/admin/applications");
  await page.getByLabel("Логин",{exact:true}).fill(adminCredentials.login);
  await page.getByLabel("Пароль",{exact:true}).fill(adminCredentials.password);
  await page.getByRole("button",{name:"Войти",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Заявки участников"})).toBeVisible();
  await page.getByLabel("Поиск заявок",{exact:true}).fill(applicationNumber);
  await page.getByRole("button",{name:"Найти",exact:true}).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button",{name:applicationNumber,exact:true}).click();
  await expect(page.getByRole("heading",{name:data.collective,exact:true})).toBeVisible();
  await expect(page.locator(".cms-application-fields")).toContainText(data.participants);
  await expect(page.locator(".cms-mail-status").first()).toContainText("Ожидает отправки");
  await page.getByLabel("Статус",{exact:true}).selectOption("confirmed");
  await page.getByLabel("Заметки оргкомитета").fill("Договорились о приезде. Проверить состав.");
  await page.getByRole("button",{name:"Сохранить заявку",exact:true}).click();
  await expect(page.getByText("Изменения сохранены.",{exact:true})).toBeVisible();
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    await page.screenshot({path:testInfo.outputPath(`application-${width}.png`)});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  }
  await page.getByRole("button",{name:"← К списку заявок",exact:true}).click();
  await expect(page.locator("tbody")).toContainText("Подтверждена");
  const exported=await page.request.get("/api/admin/applications/export?search="+encodeURIComponent(applicationNumber));
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain(data.collective);
  await page.reload();
  await expect(page.getByRole("heading",{name:"Заявки участников"})).toBeVisible();
});
