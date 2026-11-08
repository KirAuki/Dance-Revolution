import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createApplication } from "../server/app.js";
import {
  hashPassword,
  verifyPassword,
  createAuth,
  tokenHash,
} from "../server/auth.js";

const password = "Only-for-local-automated-tests-27";
const seed = JSON.parse(
  await readFile(
    new URL("../content/news/kak-podgotovit-zayavku.json", import.meta.url),
    "utf8",
  ),
);
const sample = {
  ...seed,
  slug: "test-story",
  title: "Test story",
  image: "",
  published: false,
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVV8AAAAASUVORK5CYII=",
  "base64",
);

test("site settings require authentication and CSRF, validate input, detect conflicts and persist", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("/api/admin/settings", {anonymous:true})).status, 401);
  const current = f.app().store.settings();
  assert.equal((await f.call("/api/admin/settings", {anonymous:true,method:"PUT",data:current})).status, 401);
  await f.login();
  assert.equal((await f.call("/api/admin/settings", {method:"PUT",data:current,headers:{"X-CSRF-Token":"wrong"}})).status, 403);
  const invalid = structuredClone(current);
  invalid.settings.event.endDate = "2027-04-01";
  assert.equal((await f.call("/api/admin/settings", {method:"PUT",data:invalid})).status, 422);
  assert.equal(f.app().store.settings().version, current.version);
  const changed = structuredClone(current);
  changed.settings.event.startDate = "2028-05-03";
  changed.settings.event.endDate = "2028-05-04";
  changed.settings.event.arrivalDate = "2028-05-02";
  changed.settings.event.departureDate = "2028-05-05";
  changed.settings.event.localDeadline = "2028-04-25";
  changed.settings.event.travelDeadline = "2028-04-20";
  changed.settings.prices.localFirst = 4500;
  assert.equal((await f.call("/api/admin/settings", {method:"PUT",data:changed})).status, 200);
  assert.equal((await f.call("/api/admin/settings", {method:"PUT",data:current})).status, 409);
  assert.deepEqual((await (await f.call("/api/settings", {anonymous:true})).json()).settings, changed.settings);
  await f.restart();
  assert.deepEqual((await (await f.call("/api/settings", {anonymous:true})).json()).settings, changed.settings);
});

test("editable document pages publish safely, redirect old URLs and survive restarts", async (t) => {
  const f = await fixture(t);
  await f.login();
  const record = f.app().store.settings();
  record.settings.contacts.email = "pages@example.com";
  record.settings.pages.privacy.title = "Обработка данных";
  record.settings.pages.privacy.sections[0].text = 'Пишите на {email}.\n\n<script>alert(1)</script>';
  record.settings.news.title = "События конкурса";
  assert.equal((await f.call("/api/admin/settings", { method: "PUT", data: record })).status, 200);
  for (const route of ["/privacy.html", "/privacy/"]) {
    const redirect = await f.call(route + "?source=footer", { anonymous: true });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get("location"), "/privacy?source=footer");
  }
  const getHtml = async () => {
    const response = await f.call("/privacy", { anonymous: true });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    return response.text();
  };
  const html = await getHtml();
  assert.ok(html.includes("<h1>Обработка данных</h1>"));
  assert.ok(html.includes('href="mailto:pages@example.com"'));
  assert.ok(html.includes("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"));
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok((await (await f.call("/news", { anonymous: true })).text()).includes("<h1>События конкурса</h1>"));
  assert.equal((await f.call("/consent", { anonymous: true, method: "HEAD" })).status, 200);
  assert.equal((await f.call("/privacy", { method: "POST" })).status, 405);
  const invalid = f.app().store.settings();
  invalid.settings.pages.consent.sections = [];
  assert.equal((await f.call("/api/admin/settings", { method: "PUT", data: invalid })).status, 422);
  await f.restart();
  assert.deepEqual(f.app().store.settings().settings.pages, record.settings.pages);
  assert.equal((await getHtml()).match(/<main[\s\S]*<\/main>/)[0], html.match(/<main[\s\S]*<\/main>/)[0]);
});

test("settings publish uploaded photos and regulations only after saving their references", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("/api/admin/documents", {method:"POST",anonymous:true,body:Buffer.from("%PDF-1.4\n%%EOF")})).status, 401);
  await f.login();
  assert.equal((await f.call("/api/admin/documents", {method:"POST",body:Buffer.from("<html>not a document</html>")})).status, 415);
  const picture = await (await f.call("/api/admin/media", {method:"POST",body:png})).json();
  const document = await (await f.call("/api/admin/documents", {method:"POST",body:Buffer.from("%PDF-1.4\n%%EOF")})).json();
  assert.equal((await f.call(picture.url, {anonymous:true})).status, 404);
  assert.equal((await f.call(document.url, {anonymous:true})).status, 404);
  const original = f.app().store.settings();
  const changed = structuredClone(original);
  changed.settings.venue.image = picture.url;
  changed.settings.documents.regulations = document.url;
  assert.equal((await f.call("/api/admin/settings", {method:"PUT",data:changed})).status, 200);
  assert.equal((await f.call(picture.url, {anonymous:true})).status, 200);
  const download = await f.call(document.url, {anonymous:true});
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /^attachment;/);
  assert.equal(download.headers.get("content-type"), "application/pdf");
  assert.equal((await f.call("/api/admin/settings", {method:"PUT",data:{settings:original.settings,version:original.version+1}})).status, 200);
  assert.equal((await f.call(picture.url, {anonymous:true})).status, 404);
  assert.equal((await f.call(document.url, {anonymous:true})).status, 404);
});
let encoded;
test.before(async () => {
  encoded = await hashPassword(password);
});

async function fixture(t) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "dance-server-test-"));
  let app, server, origin;
  const start = async () => {
    app = createApplication({ dataDir });
    server = createServer(async (request, response) => {
      if (!(await app.handle(request, response))) {
        response.statusCode = 404;
        response.end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    await new Promise((resolve) => server.close(resolve));
    app.close();
  };
  await start();
  app.store.db
    .prepare("INSERT INTO users (login,password_hash) VALUES (?,?)")
    .run("editor", encoded);
  t.after(async () => {
    await stop();
    assert.equal(path.dirname(path.resolve(dataDir)), path.resolve(tmpdir()));
    assert.ok(path.basename(dataDir).startsWith("dance-server-test-"));
    await rm(dataDir, { recursive: true, force: true });
  });
  let cookie = "",
    csrf = "";
  async function call(
    route,
    { method = "GET", data, body, anonymous = false, headers = {} } = {},
  ) {
    return fetch(`${origin}${route}`, {
      method,
      headers: {
        Origin: origin,
        "X-Admin-Request": "1",
        ...(anonymous ? {} : { Cookie: cookie, "X-CSRF-Token": csrf }),
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body || (data ? JSON.stringify(data) : undefined),
      redirect: "manual",
    });
  }
  async function login() {
    const response = await call("/api/admin/login", {
      method: "POST",
      data: { login: "EDITOR", password },
    });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie").split(";")[0];
    csrf = (await response.json()).csrf;
    return response;
  }
  return {
    call,
    login,
    app: () => app,
    cookie: () => cookie,
    restart: async () => {
      await stop();
      await start();
    },
  };
}

test("password verification, HttpOnly sessions, origin/CSRF protection and logout", async (t) => {
  const f = await fixture(t);
  assert.ok(!encoded.includes(password));
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword("wrong password", encoded), false);
  assert.equal(
    (await f.call("/api/admin/articles", { anonymous: true })).status,
    401,
  );
  assert.equal(
    (
      await f.call("/api/admin/login", {
        method: "POST",
        data: { login: "editor", password },
        headers: { Origin: "https://evil.test" },
      })
    ).status,
    403,
  );
  const response = await f.login();
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  assert.ok(
    f.app().store.db.prepare("SELECT token_hash FROM sessions").get()
      .token_hash !== f.cookie().split("=")[1],
  );
  assert.equal(
    (
      await f.call("/api/admin/articles", {
        method: "POST",
        data: sample,
        headers: { "X-CSRF-Token": "forged" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call("/api/admin/articles", {
        method: "POST",
        data: sample,
        headers: { Origin: "https://evil.test" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await f.call("/api/admin/logout", { method: "POST" })).status,
    200,
  );
  assert.equal((await f.call("/api/admin/session")).status, 401);
});

test("drafts and uploads stay private, publishing and unpublishing update HTML, cards and sitemap immediately", async (t) => {
  const f = await fixture(t);
  await f.login();
  const badImage = await f.call("/api/admin/media", {
    method: "POST",
    body: "<svg onload=alert(1)></svg>",
    headers: { "Content-Type": "image/png" },
  });
  assert.equal(badImage.status, 415);
  const upload = await f.call("/api/admin/media", {
    method: "POST",
    body: png,
    headers: { "Content-Type": "image/png" },
  });
  assert.equal(upload.status, 201);
  const image = (await upload.json()).url;
  assert.equal((await f.call(image, { anonymous: true })).status, 404);
  assert.equal((await f.call(image)).status, 200);
  const saved = await f.call("/api/admin/articles", {
    method: "POST",
    data: { ...sample, image, title: '<img src=x onerror="alert(1)">' },
  });
  assert.equal(saved.status, 201);
  let article = (await saved.json()).article;
  assert.equal(
    (await f.call(`/news/${article.slug}`, { anonymous: true })).status,
    404,
  );
  assert.ok(
    !(await (await f.call("/sitemap.xml")).text()).includes(article.slug),
  );
  const preview = await f.call("/api/admin/preview", {
    method: "POST",
    data: article,
  });
  const previewHtml = (await preview.json()).html;
  assert.ok(previewHtml.includes('content="noindex,nofollow"'));
  assert.ok(previewHtml.includes("data:image/png;base64,"));
  const published = await f.call(`/api/admin/articles/${article.id}`, {
    method: "PUT",
    data: { ...article, published: true },
  });
  assert.equal(published.status, 200);
  article = (await published.json()).article;
  const page = await f.call(`/news/${article.slug}`, { anonymous: true });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes(sample.sections[0].paragraphs[0]));
  const news = await (await f.call("/api/news", { anonymous: true })).json();
  assert.equal(news.articles[0].slug, article.slug);
  assert.ok(!("sections" in news.articles[0]));
  assert.ok(
    (await (await f.call("/sitemap.xml")).text()).includes(article.slug),
  );
  assert.equal((await f.call(image, { anonymous: true })).status, 200);
  await f.call(`/api/admin/articles/${article.id}`, {
    method: "PUT",
    data: { ...article, published: false },
  });
  assert.equal(
    (await f.call(`/news/${article.slug}`, { anonymous: true })).status,
    404,
  );
  assert.equal((await f.call(image, { anonymous: true })).status, 404);
});

test("edits are versioned, slugs stable, duplicate slugs rejected and data survives restart", async (t) => {
  const f = await fixture(t);
  await f.login();
  let article = (
    await (
      await f.call("/api/admin/articles", { method: "POST", data: sample })
    ).json()
  ).article;
  assert.equal(
    (await f.call("/api/admin/articles", { method: "POST", data: sample }))
      .status,
    409,
  );
  assert.equal(
    (
      await f.call(`/api/admin/articles/${article.id}`, {
        method: "PUT",
        data: { ...article, slug: "renamed" },
      })
    ).status,
    422,
  );
  const original = article;
  article = (
    await (
      await f.call(`/api/admin/articles/${article.id}`, {
        method: "PUT",
        data: { ...article, title: "Updated" },
      })
    ).json()
  ).article;
  assert.equal(
    (
      await f.call(`/api/admin/articles/${article.id}`, {
        method: "PUT",
        data: original,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.call(`/api/admin/articles/${article.id}`, {
        method: "DELETE",
        data: { version: original.version },
      })
    ).status,
    409,
  );
  await f.restart();
  assert.equal(
    (await (await f.call(`/api/admin/articles/${article.id}`)).json()).article
      .title,
    "Updated",
  );
  assert.equal(
    (
      await f.call(`/api/admin/articles/${article.id}`, {
        method: "DELETE",
        data: { version: article.version },
      })
    ).status,
    200,
  );
  await f.restart();
  assert.equal((await f.call(`/api/admin/articles/${article.id}`)).status, 404);
});

test("login rate limit persists across restart and expired sessions cannot be reused", async (t) => {
  const f = await fixture(t);
  await f.login();
  const db = f.app().store.db;
  const response = {
    setHeader(key, value) {
      this[key] = value;
    },
  };
  const auth = createAuth(f.app().store, { secure: true, now: () => 1000 });
  auth.start(1, response);
  assert.match(response["Set-Cookie"], /^__Host-dance_admin=/);
  assert.match(response["Set-Cookie"], /; Secure$/);
  const token = f.cookie().split("=")[1];
  db.prepare("UPDATE sessions SET expires_at=0 WHERE token_hash=?").run(
    tokenHash(token),
  );
  assert.equal((await f.call("/api/admin/session")).status, 401);
  const limiter = createAuth(f.app().store);
  for (let i = 0; i < 10; i++)
    assert.equal(limiter.allowAttempt("editor", "127.0.0.1"), 0);
  await f.restart();
  const blocked = await f.call("/api/admin/login", {
    method: "POST",
    data: { login: "editor", password },
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
});
