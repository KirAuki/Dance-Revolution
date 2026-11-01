import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createApplication } from "./app.js";
import { sendFile } from "./http.js";
import { renderSiteShell, renderLegalPage } from "../shared/site-html.js";

export async function startServer({
  root = fileURLToPath(new URL("../", import.meta.url)),
  port = Number(process.env.PORT || 3000),
  host = process.env.HOST || "127.0.0.1",
  dataDir = process.env.DATA_DIR || path.join(root, ".data"),
  production = process.env.NODE_ENV === "production",
  siteUrl = process.env.SITE_URL,
  trustProxy = process.env.TRUST_PROXY === "1",
} = {}) {
  const dist = path.join(root, "dist");
  const index = await readFile(path.join(dist, "index.html"), "utf8").catch(
    () => {
      throw new Error("Сначала выполните npm run build.");
    },
  );
  const styles = [...index.matchAll(/<link\b(?=[^>]*rel="stylesheet")[^>]*>/g)]
    .map((match) => match[0])
    .join("");
  const app = createApplication({
    root,
    dataDir,
    production,
    siteUrl,
    trustProxy,
    styles,
  });
  const server = createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (production) {
      response.setHeader("Strict-Transport-Security", "max-age=31536000");
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; frame-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      );
    }
    try {
      if (await app.handle(request, response)) return;
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end();
        return;
      }
      let pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      if (
        pathname.includes("\\") ||
        pathname.includes("\0") ||
        pathname.split("/").some((part) => part.startsWith("."))
      ) {
        response.statusCode = 404;
        response.end();
        return;
      }
      if (pathname === "/" || pathname === "/index.html") {
        const origin = siteUrl
          ? new URL(siteUrl).origin
          : `http://${host}:${server.address().port}`;
        const html = renderSiteShell(index, app.store.settings().settings).replace(
          "</head>",
          `<link rel="canonical" href="${origin}/">\n</head>`,
        );
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        response.end(request.method === "HEAD" ? undefined : html);
        return;
      }
      if (pathname === "/admin" || pathname === "/admin/")
        pathname = "/admin/index.html";
      if (["/privacy", "/consent"].includes(pathname)) pathname += ".html";
      if (["/privacy.html", "/consent.html"].includes(pathname)) {
        const template = await readFile(path.join(dist, pathname.slice(1)), "utf8");
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        response.end(request.method === "HEAD" ? undefined : renderLegalPage(template, app.store.settings().settings));
        return;
      }
      const filename = path.resolve(dist, `.${pathname}`);
      if (!filename.startsWith(`${dist}${path.sep}`)) {
        response.statusCode = 404;
        response.end();
        return;
      }
      const cache = pathname.startsWith("/bundles/")
        ? "public, max-age=31536000, immutable"
        : pathname.endsWith(".html")
          ? "no-cache"
          : "public, max-age=3600";
      if (!(await sendFile(request, response, filename, { cache }))) {
        response.statusCode = 404;
        response.end("Not found");
      }
    } catch {
      if (!response.headersSent) response.statusCode = 500;
      response.end("Request failed");
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return {
    server,
    app,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      app.close();
    },
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const running = await startServer();
  console.log(
    `Сайт: http://${process.env.HOST || "127.0.0.1"}:${running.server.address().port}; админка: /admin/`,
  );
  if (!running.app.store.db.prepare("SELECT 1 FROM users LIMIT 1").get())
    console.log("Создайте администратора: npm run admin:create");
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await running.close();
      process.exit(0);
    });
}
