import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

/**
 * Connect to emulators started by `firebase emulators:exec` (npm run test:rules).
 * Do NOT pass inline rules — firebase.json loads firestore.rules / storage.rules.
 * Do NOT pass host/port here — @firebase/rules-unit-testing reads FIRESTORE_EMULATOR_HOST /
 * FIREBASE_STORAGE_EMULATOR_HOST (and optional hub discovery) from the exec child environment.
 */

export async function initRulesTestEnvironment({ projectId, useStorage = false }) {
  const project = process.env.GCLOUD_PROJECT || projectId;

  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set. Run tests via npm run test:rules or test:storage-rules:emulator."
    );
  }

  const config = {
    projectId: project,
    firestore: {},
  };

  if (useStorage) {
    if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      throw new Error("FIREBASE_STORAGE_EMULATOR_HOST is not set.");
    }
    config.storage = {};
  }

  let lastError;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await initializeTestEnvironment(config);
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw lastError ?? new Error("Failed to initialize rules test environment");
}
