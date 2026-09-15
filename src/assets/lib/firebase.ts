import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import {
  buildFirebaseWebConfig,
  getFirebaseConfigErrorMessage,
  getFirebaseConfigIssues,
  type FirebaseWebConfig,
} from "./firebaseConfig";

/** Valid-shaped config so Firebase SDK init does not crash the app at import time. */
function bootstrapFirebaseConfig(): FirebaseWebConfig {
  return {
    apiKey: "bootstrap-not-configured",
    authDomain: "localhost.firebaseapp.com",
    projectId: "bootstrap-local",
    storageBucket: "bootstrap-local.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:bootstrap000000",
  };
}

function resolveFirebaseConfig(): FirebaseWebConfig {
  if (getFirebaseConfigIssues().length === 0) {
    try {
      return buildFirebaseWebConfig();
    } catch (error) {
      console.error("[firebase] invalid configuration:", error);
    }
  }

  console.error(
    "[firebase] configuration problems:",
    getFirebaseConfigIssues().map((i) => i.field).join(", ")
  );
  console.error("[firebase]", getFirebaseConfigErrorMessage());
  console.warn(
    "[firebase] using bootstrap config so the app can render; set .env and restart dev server"
  );
  return bootstrapFirebaseConfig();
}

export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(resolveFirebaseConfig());

export const auth: Auth = getAuth(app);

export const authReady = setPersistence(auth, browserLocalPersistence).catch(
  (error) => {
    console.error("[firebase] persistence failed", error);
  }
);

if (import.meta.env.DEV) {
  console.info("AUTH_APP_COUNT", getApps().length);
  console.info("AUTH_INSTANCE_CREATED", true);
  console.info("AUTH_DOMAIN", auth.app.options.authDomain);
}

export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfigIssues().length === 0;
}

export function getFirebaseSetupMessage(): string | null {
  return getFirebaseConfigErrorMessage();
}

if (import.meta.env.VITE_FIREBASE_APP_CHECK_ENABLED === "true") {
  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (!siteKey) {
    console.warn(
      "[app-check] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is required when App Check is enabled"
    );
  } else if (import.meta.env.DEV) {
    Object.assign(globalThis, { FIREBASE_APPCHECK_DEBUG_TOKEN: true });
    console.info("[app-check] debug token mode enabled for local development");
  }

  if (siteKey && isFirebaseConfigured()) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.info("[app-check] initialized (enforcement must be enabled manually in Console)");
  }
}
