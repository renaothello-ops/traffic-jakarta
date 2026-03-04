export default async function handler(req: any, res: any) {
  try {
    const { mode, z, x, y } = req.query as {
      mode: "relative" | "absolute";
      z: string;
      x: string;
      y: string;
    };

    if (mode !== "relative" && mode !== "absolute") {
      res.status(400).send("Invalid mode");
      return;
    }

    const key = process.env.TOMTOM_API_KEY;
    if (!key) {
      res.status(500).send("Missing TOMTOM_API_KEY");
      return;
    }

    const url = `https://api.tomtom.com/traffic/map/4/tile/flow/${mode}/${z}/${x}/${y}.png?key=${encodeURIComponent(
      key
    )}`;

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      res.status(r.status).send(text);
      return;
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, s-maxage=60, max-age=60");
    res.status(200).send(buf);
  } catch (e: any) {
    res.status(500).send(e?.message ?? "Server error");
  }
}