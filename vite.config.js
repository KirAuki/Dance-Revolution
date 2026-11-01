import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createApplication } from "./server/app.js";
import { renderSiteShell, renderLegalPage } from "./shared/site-html.js";

function localServer() {
  const connect = async (server, preview = false) => {
    const root = server.config.root;
    let styles = '<link rel="stylesheet" href="/src/styles.css">';
    if (preview) {
      const html = await readFile(
        path.resolve(root, server.config.build.outDir, "index.html"),
        "utf8",
      );
      styles = [...html.matchAll(/<link\b(?=[^>]*rel="stylesheet")[^>]*>/g)]
        .map((match) => match[0])
        .join("");
    }
    const app = createApplication({
      root,
      dataDir: process.env.DATA_DIR || path.join(root, ".data"),
      styles,
      transformHtml: preview
        ? undefined
        : (html) => server.transformIndexHtml("/news", html),
    });
    server.httpServer?.once("close", () => app.close());
    server.middlewares.use(async (request, response, next) => {
      if (await app.handle(request, response)) return;
      const pathname = request.url?.split("?")[0];
      if ((pathname === "/" || pathname === "/index.html") && ["GET", "HEAD"].includes(request.method)) {
        const template = await readFile(path.join(root, preview ? "dist/index.html" : "index.html"), "utf8");
        const html = renderSiteShell(template, app.store.settings().settings);
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(request.method === "HEAD" ? undefined : preview ? html : await server.transformIndexHtml(request.url, html));
        return;
      }
      if (pathname === "/admin" || pathname === "/admin/")
        request.url = request.url.replace(pathname, "/admin/index.html");
      if (/^\/(privacy|consent)(\.html)?$/.test(pathname) && ["GET", "HEAD"].includes(request.method)) {
        const filename = pathname.replace(/\.html$/, "").slice(1) + ".html";
        const template = await readFile(path.join(root, preview ? "dist" : "", filename), "utf8");
        const html = renderLegalPage(template, app.store.settings().settings);
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(request.method === "HEAD" ? undefined : preview ? html : await server.transformIndexHtml(pathname, html));
        return;
      }
      next();
    });
  };
  return {
    name: "local-node-server",
    configureServer: (server) => connect(server),
    configurePreviewServer: (server) => connect(server, true),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "RESEND_API_KEY",
    "APPLICATION_TO_EMAIL",
    "APPLICATION_FROM_EMAIL",
    "DATA_DIR",
  ]) {
    if (process.env[key] === undefined && env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [react(), localServer()],
    build: {
      assetsDir: "bundles",
      rollupOptions: {
        input: {
          main: "index.html",
          admin: "admin/index.html",
          privacy: "privacy.html",
          consent: "consent.html",
        },
      },
    },
  };
});
