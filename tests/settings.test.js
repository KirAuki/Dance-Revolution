import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "../server/database.js";
import { defaultSiteSettings, validateSiteSettings, eventRange, compactEventDates, daysBetween } from "../shared/site-settings.js";
import { renderSiteShell } from "../shared/site-html.js";
import { renderLegalPage } from "../shared/legal-html.js";

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
    s => { s.contacts.instagramUrl = "javascript:alert(1)"; },
    s => { s.contacts.whatsappUrl = "https://user:password@example.com"; },
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
  settings.contacts.email = "existing@example.com";
  const updated = validateSiteSettings(settings);
  assert.equal(updated.contacts.email, settings.contacts.email);
  assert.deepEqual(updated.event, settings.event);
  assert.deepEqual(updated.pages, defaultSiteSettings.pages);
  assert.deepEqual(updated.news, defaultSiteSettings.news);
});

test("older contacts retain one email and tolerate unset optional social links", () => {
  const settings = structuredClone(defaultSiteSettings);
  settings.contacts.tracksEmail = "legacy@example.com";
  settings.contacts.telegramLabel = "Legacy label";
  settings.contacts.maxLabel = "Legacy label";
  for (const key of ["instagramUrl", "vkUrl", "whatsappUrl"]) delete settings.contacts[key];
  const { contacts } = validateSiteSettings(settings);
  assert.equal(contacts.email, settings.contacts.email);
  assert.ok(!Object.hasOwn(contacts, "tracksEmail"));
  assert.ok(!Object.hasOwn(contacts, "telegramLabel"));
  assert.ok(!Object.hasOwn(contacts, "maxLabel"));
  for (const key of ["instagramUrl", "vkUrl", "whatsappUrl"]) assert.equal(contacts[key], "");
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
  const legal = renderLegalPage("privacy", "https://example.com", "", settings);
  assert.ok(legal.includes("Документы / 2028"));
  assert.ok(legal.includes("hello$&amp;@example.com"));
  assert.ok(!legal.includes(defaultSiteSettings.contacts.email));
});

test("migration adds settings to an existing v1 database without losing content or accounts", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "dance-settings-test-"));
  let store;
  try {
    // Create an actual old schema, not a database already migrated by openStore.
    const old = new DatabaseSync(path.join(dataDir, "site.sqlite"));
    old.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, login TEXT, password_hash TEXT); CREATE TABLE articles (id TEXT PRIMARY KEY, title TEXT); INSERT INTO users VALUES (1,'existing-editor','existing-hash'); INSERT INTO articles VALUES ('saved-story','Existing story'); PRAGMA user_version=1;");
    old.close();
    store = openStore(dataDir);
    assert.equal(store.db.prepare("PRAGMA user_version").get().user_version, 2);
    assert.equal(store.db.prepare("SELECT login FROM users").get().login, "existing-editor");
    assert.equal(store.db.prepare("SELECT title FROM articles").get().title, "Existing story");
    const first = store.settings();
    first.settings.prices.localFirst = 4200;
    const saved = store.saveSettings(first.settings, first.version);
    assert.equal(saved.version, 2);
    assert.equal(store.saveSettings(defaultSiteSettings, first.version), null);
    store.close();
    store = openStore(dataDir);
    assert.equal(store.settings().settings.prices.localFirst, 4200);
    assert.equal(store.settings().version, 2);
  } finally {
    store?.close();
    assert.equal(path.dirname(path.resolve(dataDir)), path.resolve(tmpdir()));
    assert.ok(path.basename(dataDir).startsWith("dance-settings-test-"));
    await rm(dataDir, { recursive: true, force: true });
  }
});
