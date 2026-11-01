import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "../server/database.js";
import { defaultSiteSettings, validateSiteSettings, eventRange, compactEventDates, daysBetween } from "../shared/site-settings.js";
import { renderSiteShell, renderLegalPage } from "../shared/site-html.js";

test("settings validate dates, chronology, prices and uploaded resource paths", () => {
  assert.deepEqual(validateSiteSettings(defaultSiteSettings), defaultSiteSettings);
  const cases = [
    s => { s.event.startDate = "2027-02-30"; },
    s => { s.event.endDate = "2027-04-01"; },
    s => { s.event.localDeadline = "2027-04-04"; },
    s => { s.event.arrivalDate = "2027-04-04"; },
    s => { s.prices.premium = -100; },
    s => { s.prices.localFirst = "3500"; },
    s => { s.contacts.telegramUrl = "javascript:alert(1)"; },
    s => { s.contacts.telegramUrl = "https://user:password@example.com"; },
    s => { s.contacts.email = "a@example.com\r\nBcc: spam@example.com"; },
    s => { s.venue.image = "/assets/../../private.png"; },
    s => { s.documents.regulations = "/documents/test.html"; },
    s => { s.jury = []; },
    s => { s.jury[0] = null; },
    s => { s.program.pop(); },
  ];
  for (const mutate of cases) {
    const settings = structuredClone(defaultSiteSettings);
    mutate(settings);
    assert.throws(() => validateSiteSettings(settings));
  }
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
  const legal = renderLegalPage(await readFile("privacy.html", "utf8"), settings);
  assert.ok(legal.includes("Документы / 2028"));
  assert.ok(legal.includes("hello$&amp;@example.com"));
  assert.ok(!legal.includes("akulov@"));
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
