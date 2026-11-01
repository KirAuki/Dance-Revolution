import path from "node:path";
import { mkdir, writeFile, unlink, readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { openStore } from "./database.js";
import {
  createAuth,
  normalizeLogin,
  validLogin,
  verifyPassword,
} from "./auth.js";
import { HttpError, json, readBody, readJson, sendFile } from "./http.js";
import { validateArticles } from "../shared/news.js";
import { validateSiteSettings, settingsImages } from "../shared/site-settings.js";
import {
  renderArticle,
  renderNewsIndex,
  renderSitemap,
  renderNotFound,
} from "../shared/news-html.js";
import applicationHandler from "../api/application.js";

function checkMethod(request, response, allowed) {
  if (!allowed.includes(request.method)) {
    response.setHeader("Allow", allowed.join(", "));
    throw new HttpError(405, "Метод не поддерживается.");
  }
}
function imageType(buffer) {
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { ext: "png", mime: "image/png" };
  if (
    buffer.length >= 4 &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255
  )
    return { ext: "jpg", mime: "image/jpeg" };
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return { ext: "webp", mime: "image/webp" };
  throw new HttpError(
    415,
    "Обложка должна быть изображением JPG, PNG или WebP.",
  );
}

export function createApplication({
  root = process.cwd(),
  dataDir = path.join(root, ".data"),
  siteUrl,
  production = false,
  trustProxy = false,
  styles = '<link rel="stylesheet" href="/src/styles.css">',
  transformHtml = async (html) => html,
  seedDir = path.join(root, "content/news"),
  now = Date.now,
} = {}) {
  const store = openStore(dataDir, { seedDir });
  const auth = createAuth(store, { secure: production, now });
  const uploads = path.join(dataDir, "uploads");
  const fixedOrigin = siteUrl ? new URL(siteUrl).origin : null;
  if (production && (!fixedOrigin || !fixedOrigin.startsWith("https://"))) {
    store.close();
    throw new Error("Для рабочего сервера задайте SITE_URL=https://ваш-домен.");
  }
  let passwordChecks = 0;
  const passwordMatches = async (password, encoded) => {
    if (passwordChecks >= 2)
      throw new HttpError(
        429,
        "Сервер занят проверкой входа. Попробуйте через несколько секунд.",
      );
    passwordChecks++;
    try {
      return await verifyPassword(password, encoded);
    } finally {
      passwordChecks--;
    }
  };
  const originFor = (request) => {
    if (fixedOrigin) return fixedOrigin;
    const host = request.headers.host || "127.0.0.1:3000";
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))
      throw new HttpError(400, "Задайте SITE_URL для доступа по этому домену.");
    return `http://${host}`;
  };
  const requireSession = (request) => {
    const session = auth.session(request);
    if (!session) throw new HttpError(401, "Войдите в админ-панель.");
    return session;
  };
  const sameOrigin = (request) => {
    if (
      request.headers.origin !== originFor(request) ||
      request.headers["x-admin-request"] !== "1"
    )
      throw new HttpError(
        403,
        "Запрос отклонён. Обновите страницу и попробуйте снова.",
      );
  };
  const requireMutation = (request) => {
    sameOrigin(request);
    const session = requireSession(request);
    if (request.headers["x-csrf-token"] !== session.csrf)
      throw new HttpError(403, "Сессия страницы устарела. Обновите страницу.");
    return session;
  };
  const validateImage = (article) => {
    if (
      article.image?.startsWith("/media/") &&
      !store.db
        .prepare("SELECT 1 FROM media WHERE name=?")
        .get(article.image.slice(7))
    )
      throw new HttpError(422, "Загрузите обложку заново.");
  };
  const articleInput = (body) => {
    const article = Object.fromEntries(
      [
        "slug",
        "title",
        "description",
        "category",
        "date",
        "published",
        "image",
        "sections",
      ].map((key) => [key, body[key]]),
    );
    try {
      validateArticles([article]);
    } catch (error) {
      throw new HttpError(422, error.message);
    }
    validateImage(article);
    return article;
  };
  const sendHtml = async (response, html, status = 200) => {
    response.writeHead(status, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(await transformHtml(html));
  };

  async function handle(request, response) {
    try {
      const url = new URL(request.url, "http://localhost");
      const pathname = url.pathname;
      if (
        !pathname.startsWith("/api/") &&
        !pathname.startsWith("/media/") &&
        !pathname.startsWith("/documents/") &&
        !/^\/news(?:[/.]|$)/.test(pathname) &&
        !["/robots.txt", "/sitemap.xml", "/health"].includes(pathname)
      )
        return false;
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Referrer-Policy", "same-origin");
      response.setHeader("Cache-Control", "no-store");
      if (pathname === "/health") {
        checkMethod(request, response, ["GET"]);
        store.db.prepare("SELECT 1").get();
        json(response, 200, { ok: true });
        return true;
      }
      if (pathname === "/api/application") {
        request.siteSettings = store.settings().settings;
        // Reuse the existing mail delivery and validation on the Node host.
        request.body =
          request.method === "POST"
            ? await readJson(request, 65536)
            : undefined;
        response.status = (code) => {
          response.statusCode = code;
          return response;
        };
        response.json = (data) => json(response, response.statusCode, data);
        await applicationHandler(request, response);
        return true;
      }
      if (pathname === "/api/admin/login") {
        checkMethod(request, response, ["POST"]);
        sameOrigin(request);
        const body = await readJson(request, 4096);
        const login = normalizeLogin(body.login);
        if (
          !validLogin(login) ||
          typeof body.password !== "string" ||
          body.password.length > 256
        )
          throw new HttpError(400, "Проверьте логин и пароль.");
        const ip = trustProxy
          ? String(
              request.headers["x-forwarded-for"] ||
                request.socket.remoteAddress,
            )
              .split(",")
              .at(-1)
              .trim()
          : request.socket.remoteAddress || "unknown";
        const retryAfter = auth.allowAttempt(login, ip);
        if (retryAfter) {
          response.setHeader("Retry-After", retryAfter);
          throw new HttpError(
            429,
            "Слишком много попыток. Повторите вход через 15 минут.",
          );
        }
        const user = store.db
          .prepare("SELECT * FROM users WHERE login=?")
          .get(login);
        if (!(await passwordMatches(body.password, user?.password_hash)))
          throw new HttpError(401, "Неверный логин или пароль.");
        auth.resetAttempts(login, ip);
        auth.end(request, response);
        const csrf = auth.start(user.id, response);
        json(response, 200, { user: { login: user.login }, csrf });
        return true;
      }
      if (pathname === "/api/admin/session") {
        checkMethod(request, response, ["GET"]);
        const session = requireSession(request);
        json(response, 200, {
          user: { login: session.login },
          csrf: session.csrf,
        });
        return true;
      }
      if (pathname === "/api/admin/logout") {
        checkMethod(request, response, ["POST"]);
        requireMutation(request);
        auth.end(request, response);
        json(response, 200, { ok: true });
        return true;
      }
      if (pathname === "/api/settings" || pathname === "/api/admin/settings") {
        const admin = pathname.startsWith("/api/admin/");
        checkMethod(request, response, admin ? ["GET", "PUT"] : ["GET"]);
        if (request.method === "GET") {
          if (admin) requireSession(request);
          const current = store.settings();
          json(response, 200, admin ? current : { settings: current.settings });
          return true;
        }
        requireMutation(request);
        const body = await readJson(request, 131072);
        if (!Number.isSafeInteger(body.version) || body.version < 1) throw new HttpError(409, "Откройте настройки заново: версия страницы устарела.");
        let settings;
        try { settings = validateSiteSettings(body.settings); }
        catch (error) { throw new HttpError(422, error.message); }
        for (const image of settingsImages(settings)) validateImage({ image });
        for (const resource of [...settingsImages(settings), settings.documents.regulations].filter(value => value.startsWith("/assets/") || value.startsWith("/docs/"))) {
          if (!(await stat(path.join(root, `public${resource}`)).catch(() => null))?.isFile())
            throw new HttpError(422, "Один из файлов не найден. Загрузите его заново.");
        }
        if (settings.documents.regulations.startsWith("/documents/") && !store.db.prepare("SELECT 1 FROM media WHERE name=?").get(settings.documents.regulations.slice(11)))
          throw new HttpError(422, "Загрузите положение заново.");
        const updated = store.saveSettings(settings, body.version);
        if (!updated) throw new HttpError(409, "Настройки изменены в другой вкладке. Сохраните свой текст и загрузите актуальную версию.");
        json(response, 200, updated);
        return true;
      }
      if (pathname === "/api/admin/documents") {
        checkMethod(request, response, ["POST"]);
        requireMutation(request);
        const buffer = await readBody(request, 10 * 1024 * 1024);
        const pdf = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
        const docx = buffer.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) && buffer.includes(Buffer.from("word/document.xml"));
        if (!pdf && !docx) throw new HttpError(415, "Положение должно быть файлом PDF или DOCX.");
        const name = `${randomUUID()}.${pdf ? "pdf" : "docx"}`;
        const mime = pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        await mkdir(uploads, { recursive: true, mode: 0o700 });
        const filename = path.join(uploads, name);
        await writeFile(filename, buffer, { flag: "wx", mode: 0o600 });
        try { store.db.prepare("INSERT INTO media VALUES (?,?,?,?)").run(name, mime, buffer.length, new Date(now()).toISOString()); }
        catch (error) { await unlink(filename); throw error; }
        json(response, 201, { url: `/documents/${name}` });
        return true;
      }
      if (pathname === "/api/admin/media") {
        checkMethod(request, response, ["POST"]);
        requireMutation(request);
        const buffer = await readBody(request, 2 * 1024 * 1024);
        const type = imageType(buffer);
        const name = `${randomUUID()}.${type.ext}`;
        await mkdir(uploads, { recursive: true, mode: 0o700 });
        const filename = path.join(uploads, name);
        await writeFile(filename, buffer, { flag: "wx", mode: 0o600 });
        try {
          store.db
            .prepare("INSERT INTO media VALUES (?,?,?,?)")
            .run(name, type.mime, buffer.length, new Date(now()).toISOString());
        } catch (error) {
          await unlink(filename);
          throw error;
        }
        json(response, 201, { url: `/media/${name}` });
        return true;
      }
      if (pathname === "/api/admin/preview") {
        checkMethod(request, response, ["POST"]);
        requireMutation(request);
        const article = articleInput(await readJson(request));
        // Sandboxed previews have an opaque origin; embed private cover bytes instead of relying on cookies.
        if (article.image?.startsWith("/media/")) {
          const name = article.image.slice(7);
          const media = store.db
            .prepare("SELECT mime FROM media WHERE name=?")
            .get(name);
          article.image = `data:${media.mime};base64,${(await readFile(path.join(uploads, name))).toString("base64")}`;
        }
        const html = renderArticle(article, originFor(request), styles, store.settings().settings).replace(
          'content="index,follow"',
          'content="noindex,nofollow"',
        );
        json(response, 200, { html });
        return true;
      }
      if (pathname === "/api/admin/articles") {
        checkMethod(request, response, ["GET", "POST"]);
        if (request.method === "GET") {
          requireSession(request);
          json(response, 200, { articles: store.cards() });
          return true;
        }
        requireMutation(request);
        const article = articleInput(await readJson(request));
        if (
          store.db
            .prepare("SELECT 1 FROM articles WHERE slug=?")
            .get(article.slug)
        )
          throw new HttpError(409, "Этот адрес статьи уже занят.");
        json(response, 201, { article: store.save(article) });
        return true;
      }
      const articleMatch = /^\/api\/admin\/articles\/([a-f0-9-]{36})$/.exec(
        pathname,
      );
      if (articleMatch) {
        checkMethod(request, response, ["GET", "PUT", "DELETE"]);
        if (request.method === "GET") requireSession(request);
        else requireMutation(request);
        const article = store.article(articleMatch[1]);
        if (!article) throw new HttpError(404, "Публикация не найдена.");
        if (request.method === "GET") {
          json(response, 200, { article });
          return true;
        }
        const body = await readJson(request);
        if (!Number.isInteger(body.version) || body.version !== article.version)
          throw new HttpError(
            409,
            "Запись изменена в другой вкладке. Скопируйте свой текст и откройте запись заново.",
          );
        if (request.method === "DELETE") {
          store.db
            .prepare("DELETE FROM articles WHERE id=? AND version=?")
            .run(article.id, body.version);
          json(response, 200, { ok: true });
          return true;
        }
        const input = articleInput(body);
        if (input.slug !== article.slug)
          throw new HttpError(
            422,
            "Адрес сохранённой статьи менять нельзя: старые ссылки должны продолжать работать.",
          );
        const updated = store.save(input, article.id, body.version);
        if (!updated)
          throw new HttpError(409, "Запись уже изменена. Откройте её заново.");
        json(response, 200, { article: updated });
        return true;
      }
      if (pathname === "/api/news") {
        checkMethod(request, response, ["GET"]);
        json(response, 200, {
          articles: store.cards({ publicOnly: true, limit: 3 }),
        });
        return true;
      }
      if (pathname.startsWith("/media/") || pathname.startsWith("/documents/")) {
        checkMethod(request, response, ["GET", "HEAD"]);
        const document = pathname.startsWith("/documents/");
        const name = pathname.slice(document ? 11 : 7);
        if (!(document ? /^[a-f0-9-]{36}\.(pdf|docx)$/ : /^[a-f0-9-]{36}\.(jpg|png|webp)$/).test(name))
          throw new HttpError(404, "Файл не найден.");
        const media = store.db
          .prepare("SELECT * FROM media WHERE name=?")
          .get(name);
        const publicImage = store.db
          .prepare(
            "SELECT 1 FROM articles WHERE image=? AND published=1 LIMIT 1",
          )
          .get(pathname);
        const settings = store.settings().settings;
        const publicSetting = document ? settings.documents.regulations === pathname : settingsImages(settings).includes(pathname);
        if (!media || (!publicImage && !publicSetting && !auth.session(request)))
          throw new HttpError(404, "Файл не найден.");
        if (document) response.setHeader("Content-Disposition", `attachment; filename="regulations.${name.split(".").at(-1)}"`);
        if (
          !(await sendFile(request, response, path.join(uploads, name), {
            cache: "private, no-cache",
            mime: media.mime,
          }))
        )
          throw new HttpError(404, "Файл не найден.");
        return true;
      }
      if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
        checkMethod(request, response, ["GET", "HEAD"]);
        const origin = originFor(request);
        response.setHeader(
          "Content-Type",
          pathname.endsWith("xml")
            ? "application/xml; charset=utf-8"
            : "text/plain; charset=utf-8",
        );
        response.end(
          request.method === "HEAD"
            ? undefined
            : pathname.endsWith("xml")
              ? renderSitemap(
                  store.cards({ publicOnly: true, limit: 50000 }),
                  origin,
                )
              : `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin/\nSitemap: ${origin}/sitemap.xml\n`,
        );
        return true;
      }
      if (/^\/news(?:[/.]|$)/.test(pathname)) {
        checkMethod(request, response, ["GET", "HEAD"]);
        const cleanPath = pathname.replace(/\.html$/, "").replace(/\/$/, "");
        if (cleanPath !== pathname) {
          response.writeHead(308, { Location: `${cleanPath}${url.search}` });
          response.end();
          return true;
        }
        const origin = originFor(request);
        const article = /^\/news\/[a-z0-9-]+$/.test(cleanPath)
          ? store.published(cleanPath.slice(6))
          : null;
        const found = cleanPath === "/news" || Boolean(article);
        if (request.method === "HEAD") {
          response.statusCode = found ? 200 : 404;
          response.end();
          return true;
        }
        const html =
          cleanPath === "/news"
            ? renderNewsIndex(store.cards({ publicOnly: true }), origin, styles, store.settings().settings)
            : article
              ? renderArticle(article, origin, styles, store.settings().settings)
              : renderNotFound(origin, styles, store.settings().settings);
        await sendHtml(response, html, found ? 200 : 404);
        return true;
      }
      throw new HttpError(404, "Страница не найдена.");
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return true;
      }
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500)
        console.error("Server request failed:", error.code || error.name);
      json(response, status, {
        message:
          status === 500
            ? "Не удалось выполнить запрос. Попробуйте позже."
            : error.message,
      });
      return true;
    }
  }
  return { handle, store, close: () => store.close() };
}
