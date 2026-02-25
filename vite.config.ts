import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function tomtomProxy(): Plugin {
  return {
    name: "tomtom-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        const m = url.match(
          /^\/api\/tomtom\/flow\/(relative|absolute)\/(\d+)\/(\d+)\/(\d+)\.png$/
        );
        if (!m) return next();

        const style = m[1]; // relative | absolute
        const z = m[2];
        const x = m[3];
        const y = m[4];

        const key = process.env.TOMTOM_API_KEY;
        if (!key) {
          res.statusCode = 500;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("TOMTOM_API_KEY がありません。.env.local に入力してください。");
          return;
        }

        const upstream = `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/${z}/${x}/${y}.png?key=${encodeURIComponent(
          key
        )}`;

        try {
          const r = await fetch(upstream);
          const buf = Buffer.from(await r.arrayBuffer());

          res.statusCode = r.status;
          res.setHeader("content-type", "image/png");
          // 403やエラー時はテキストも返せるように
          if (!r.ok) {
            res.setHeader("content-type", "application/json; charset=utf-8");
          }
          res.end(buf);
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end(String(e?.message ?? e));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // ✅ Viteのdev server(=Node)側で process.env を使えるようにする
  process.env = { ...process.env, ...env };

  return {
    plugins: [react(), tomtomProxy()],
  };
});
