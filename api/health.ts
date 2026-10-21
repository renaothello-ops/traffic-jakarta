import {
  googlePlacesApiKey,
  openAiApiKey,
  tomtomApiKey,
} from "../server/envSecrets.js";

export default async function handler(
  req: { method?: string },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
    setHeader: (name: string, value: string) => void;
  }
) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  const body: Record<string, unknown> = {
    ok: true,
    handler: "api/health",
  };
  if (process.env.VERCEL_ENV !== "production") {
    body.secretsConfigured = {
      GOOGLE_PLACES_API_KEY: Boolean(googlePlacesApiKey()),
      TOMTOM_API_KEY: Boolean(tomtomApiKey()),
      OPENAI_API_KEY: Boolean(openAiApiKey()),
    };
  }
  res.status(200).json(body);
}
