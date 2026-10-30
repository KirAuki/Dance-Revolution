import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import applicationHandler from "./api/application.js";

// Run the same Vercel handler locally; secrets stay in the Node process.
function localApplicationApi() {
  const middleware = async (request, response, next) => {
    const pathname = request.url?.split("?")[0];
    if (pathname === "/privacy" || pathname === "/consent")
      request.url = `${pathname}.html`;
    if (pathname !== "/api/application") return next();
    response.status = (code) => {
      response.statusCode = code;
      return response;
    };
    response.json = (data) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(data));
    };
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 65536)
          return response
            .status(413)
            .json({ message: "Заявка слишком большая." });
        chunks.push(chunk);
      }
      const text = Buffer.concat(chunks).toString("utf8");
      try {
        request.body = text ? JSON.parse(text) : undefined;
      } catch {
        return response
          .status(400)
          .json({ message: "Некорректный формат заявки." });
      }
      await applicationHandler(request, response);
    } catch {
      if (!response.headersSent)
        response.status(500).json({ message: "Не удалось обработать заявку." });
    }
  };
  return {
    name: "local-application-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "RESEND_API_KEY",
    "APPLICATION_TO_EMAIL",
    "APPLICATION_FROM_EMAIL",
  ]) {
    if (process.env[key] === undefined && env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [react(), localApplicationApi()],
    build: {
      assetsDir: "bundles",
      rollupOptions: {
        input: {
          main: "index.html",
          privacy: "privacy.html",
          consent: "consent.html",
        },
      },
    },
  };
});
