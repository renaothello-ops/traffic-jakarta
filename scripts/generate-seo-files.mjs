#!/usr/bin/env node
/**
 * Writes public/robots.txt and public/sitemap.xml from env.
 * Set VITE_PUBLIC_SITE_URL (no trailing slash) before production build.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
mkdirSync(publicDir, { recursive: true });

function loadEnv() {
  const out = { ...process.env };
  for (const name of [".env", ".env.local"]) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const env = loadEnv();
const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim() || "traffic-jakarta";
const siteUrl = (env.VITE_PUBLIC_SITE_URL || `https://${projectId}.web.app`).replace(
  /\/$/,
  ""
);

const staticPaths = [
  "/",
  "/home.html",
  "/home-id.html",
  "/legal/privacy.html",
  "/legal/terms.html",
  "/legal/contact.html",
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticPaths
  .map((path) => {
    const loc = `${siteUrl}${path === "/" ? "/" : path}`;
    const hreflang =
      path === "/home.html"
        ? `
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/home.html"/>
    <xhtml:link rel="alternate" hreflang="id" href="${siteUrl}/home-id.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/home.html"/>`
        : path === "/home-id.html"
          ? `
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/home.html"/>
    <xhtml:link rel="alternate" hreflang="id" href="${siteUrl}/home-id.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/home.html"/>`
          : "";
    return `  <url>
    <loc>${loc}</loc>${hreflang}
    <changefreq>weekly</changefreq>
    <priority>${path === "/" || path.startsWith("/home") ? "1.0" : "0.6"}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>
`;

writeFileSync(
  join(publicDir, "robots.txt"),
  `# Traffic Jakarta — ${siteUrl}
User-agent: *
Allow: /
Allow: /home.html
Allow: /home-id.html
Allow: /legal/
Disallow: /api/

# App UI is a SPA; static landing pages are listed in the sitemap.
Sitemap: ${siteUrl}/sitemap.xml
`,
  "utf8"
);

writeFileSync(join(publicDir, "sitemap.xml"), sitemap, "utf8");
console.log("[seo] siteUrl:", siteUrl);
console.log("[seo] wrote public/robots.txt and public/sitemap.xml");
