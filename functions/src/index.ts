import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { handleApiHttp } from "../../server/apiHttp.js";

initializeApp();

export {
  onFollowCreated,
  onFollowDeleted,
  onPostCreated,
  onPostOwnerSecretCreated,
  onPostDeleted,
} from "./socialCounterTriggers.js";

export const api = onRequest(
  {
    region: "asia-southeast2",
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: ["TOMTOM_API_KEY", "GOOGLE_PLACES_API_KEY"],
    cors: true,
  },
  async (req, res) => {
    try {
      await handleApiHttp(req, res);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      }
    }
  }
);
