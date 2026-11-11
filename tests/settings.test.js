import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";




import { defaultSiteSettings, validateSiteSettings, eventRange, compactEventDates, daysBetween, homepageSeo } from "../shared/site-settings.js";
import { renderSiteShell } from "../shared/site-html.js";


test("settings validate dates, chronology, prices and uploaded resource paths", () => {
  assert.deepEqual(validateSiteSettings(defaultSiteSettings), defaultSiteSettings);
  const cases = [
    s => { s.event.startDate = "2027-02-30"; },
    s => { s.event.endDate = s.event.arrivalDate; },
    s => { s.event.localDeadline = s.event.departureDate; },
    s => { s.event.arrivalDate = s.event.endDate; },
    s => { s.prices.premium = -100; },
    s => { s.prices.localFirst = "3500"; },
    s => { s.contacts.telegramUrl = "javascript:alert(1)"; },
    s => { s.contacts.telegramUrl = "https://user:password@example.com"; },
    s => { s.seo.googleVerification = '<meta name="google-site-verification">'; },
    s => { s.seo.image = "https://example.com/image.jpg"; },
    s => { s.contacts.email = "a@example.com\r\nBcc: spam@example.com"; },
    s => { s.venue.image = "/assets/../../private.png"; },
    s => { s.documents.regulations = "/documents/test.html"; },
    s => { s.jury = []; },
    s => { s.jury[0] = null; },
    s => { s.program.pop(); },
    s => { s.program[0].note = "x".repeat(501); },
    s => { s.program[0].note = {}; },
    s => { s.pages.privacy.sections = []; },
    s => { s.pages.consent.title = " "; },
    s => { s.pages.cookies = null; },
    s => { s.pages.cookies.sections = []; },
    s => { s.pages.privacy.sections[0].text = "x".repeat(3001); },
  ];
  for (const mutate of cases) {
    const settings = structuredClone(defaultSiteSettings);
    mutate(settings);
    assert.throws(() => validateSiteSettings(settings));
  }
});

test("program accepts existing settings without notices and preserves event line breaks", () => {
  const settings = structuredClone(defaultSiteSettings);
  for (const item of settings.program) delete item.note;
  settings.program[0].text = "Заезд\r\n\r\nРегистрация";
  const validated = validateSiteSettings(settings);
  assert.ok(validated.program.every(item => item.note === ""));
  assert.equal(validated.program[0].text, "Заезд\r\n\r\nРегистрация");
});

test("older settings gain editable pages without changing existing event or contacts", () => {
  const settings = structuredClone(defaultSiteSettings);
  delete settings.pages;
  delete settings.news;
  delete settings.seo;
  settings.contacts.email = "existing@example.com";
  const updated = validateSiteSettings(settings);
  assert.equal(updated.contacts.email, settings.contacts.email);
  assert.deepEqual(updated.event, settings.event);
  assert.deepEqual(updated.pages, defaultSiteSettings.pages);
  assert.deepEqual(updated.news, defaultSiteSettings.news);
  assert.deepEqual(updated.seo, defaultSiteSettings.seo);
});

test("existing legal pages are preserved when the cookies page is introduced", () => {
  const settings = structuredClone(defaultSiteSettings);
  delete settings.pages.cookies;
  settings.pages.privacy.sections[0].text = "Сохранённые реквизиты оператора.";
  const updated = validateSiteSettings(settings);
  assert.deepEqual(updated.pages.privacy, settings.pages.privacy);
  assert.deepEqual(updated.pages.consent, settings.pages.consent);
  assert.deepEqual(updated.pages.cookies, defaultSiteSettings.pages.cookies);
});

test("older contacts retain one email and tolerate unset optional social links", () => {
  const settings = structuredClone(defaultSiteSettings);
  settings.contacts.tracksEmail = "legacy@example.com";
  settings.contacts.telegramLabel = "Legacy label";
  settings.contacts.maxLabel = "Legacy label";
  settings.contacts.instagramUrl = "https://example.com/removed-instagram";
  settings.contacts.whatsappUrl = "https://example.com/removed-whatsapp";
  delete settings.contacts.vkUrl;
  const { contacts } = validateSiteSettings(settings);
  assert.equal(contacts.email, settings.contacts.email);
  assert.ok(!Object.hasOwn(contacts, "tracksEmail"));
  assert.ok(!Object.hasOwn(contacts, "telegramLabel"));
  assert.ok(!Object.hasOwn(contacts, "maxLabel"));
  for (const key of ["instagramUrl", "whatsappUrl"]) assert.ok(!Object.hasOwn(contacts, key));
  assert.equal(contacts.vkUrl, "");
});

test("SEO templates follow event dates and safely render literal text", async () => {
  const settings = structuredClone(defaultSiteSettings);
  settings.seo.title = 'Конкурс {year}: {dates}, {city} $& <test>';
  settings.seo.description = '{venue} — {dates}';
  settings.event.startDate = '2028-05-03';
  settings.event.endDate = '2028-05-04';
  settings.event.city = 'Тула';
  assert.equal(homepageSeo(settings).title, 'Конкурс 2028: 3–4 мая 2028, Тула $& <test>');
  const output = renderSiteShell(await readFile('index.html', 'utf8'), settings);
  assert.ok(output.includes('Тула $&amp; &lt;test&gt;</title>'));
});

test("date formatting handles one day, month boundaries, year boundaries and leap years", () => {
  assert.equal(eventRange("2028-04-03", "2028-04-04"), "3–4 апреля 2028");
  assert.equal(eventRange("2028-04-03", "2028-04-03"), "3 апреля 2028");
  assert.equal(eventRange("2028-04-30", "2028-05-01"), "30 апреля — 1 мая 2028");
  assert.equal(eventRange("2027-12-31", "2028-01-01"), "31 декабря 2027 — 1 января 2028");
  assert.deepEqual(compactEventDates("2027-12-31", "2028-01-01"), ["31.12.2027", "01.01.2028"]);
  assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2);
});

test("HTML settings preserve literal replacement characters and cannot escape their data block", async () => {
  const settings = structuredClone(defaultSiteSettings);
  settings.event.city = "$& </script><img src=x onerror=alert(1)>";
  settings.contacts.email = "hello$&@example.com";
  settings.event.startDate = "2028-04-03";
  settings.event.endDate = "2028-04-04";
  const html = renderSiteShell(await readFile("index.html", "utf8"), settings);
  assert.ok(!html.includes("<img src=x"));
  const data = html.match(/<script type="application\/json" id="site-settings">(.*?)<\/script>/s)[1];
  assert.deepEqual(JSON.parse(data), settings);
  assert.ok(html.includes("3–4 апреля 2028"));
  assert.ok(html.includes("hello$&amp;@example.com"));

});
