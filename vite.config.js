import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { renderSiteShell } from "./shared/site-html.js";
import { readFile } from "node:fs/promises";
import path from "node:path";

function pythonBackend() {
  return {
    name: "python-backend",
    configureServer(server) {
      server.middlewares.use(async (request,response,next)=>{
        const pathname=request.url?.split("?")[0];
        if(pathname === "/" || pathname === "/index.html") {
          try {
            const api=await fetch(`${process.env.API_ORIGIN || "http://127.0.0.1:3000"}/api/settings`,{signal:AbortSignal.timeout(5000)});
            if(!api.ok)throw new Error("Settings unavailable");
            const {settings}=await api.json();
            const template=await readFile(path.join(server.config.root,"index.html"),"utf8");
            response.setHeader("Content-Type","text/html; charset=utf-8");response.setHeader("Cache-Control","no-store");
            response.end(await server.transformIndexHtml(request.url,renderSiteShell(template,settings)));
          }catch {response.statusCode=503;response.end("Python API is unavailable. Start npm run dev after database initialization.");}
          return;
        }
        if(pathname === "/admin" || pathname?.startsWith("/admin/"))request.url="/admin/index.html";
        next();
      });
    },
  };
}

export default defineConfig(()=>{
  const proxy={};
  for(const route of ["/api","/media","/documents","/bundles","/news","/privacy","/consent","/health","/sitemap.xml","/robots.txt"])
    proxy[route]={target:process.env.API_ORIGIN || "http://127.0.0.1:3000",changeOrigin:false};
  return {plugins:[react(),pythonBackend()],server:{proxy,watch:{ignored:["**/release/**","**/.data/**","**/.qa/**"]}},build:{assetsDir:"bundles",rollupOptions:{input:{main:"index.html",admin:"admin/index.html"}}}};
});
