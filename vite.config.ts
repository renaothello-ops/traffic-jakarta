import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleApiHttp } from "./server/apiHttp.js";

function tomtomProxy(): Plugin {
  return {
    name: "tomtom-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (await handleApiHttp(req, res)) return;
        next();
      });
    },
  };
}

function publicSiteUrl(env: Record<string, string>): string {
  const fromEnv = env.VITE_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim() || "traffic-jakarta";
  return `https://${projectId}.web.app`;
}

function seoHtmlPlugin(siteUrl: string): Plugin {
  return {
    name: "seo-html",
    transformIndexHtml(html) {
      return html.replaceAll("%VITE_PUBLIC_SITE_URL%", siteUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env = { ...process.env, ...env };
  const siteUrl = publicSiteUrl(env);

  if (mode === "development") {
    console.info(
      "[places-proxy] GOOGLE_PLACES_API_KEY loaded:",
      Boolean(process.env.GOOGLE_PLACES_API_KEY)
    );
  }

  return {
    plugins: [react(), seoHtmlPlugin(siteUrl), tomtomProxy()],
  };
});
