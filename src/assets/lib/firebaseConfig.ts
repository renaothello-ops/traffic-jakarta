const PLACEHOLDER_PATTERN = /^(x+|your[-_]|placeholder|example|changeme|todo|fixme)/i;

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export type FirebaseConfigIssue = {
  field: string;
  message: string;
};

function readEnv(name: string): string {
  return String(import.meta.env[name] ?? "").trim();
}

function isPlaceholder(value: string): boolean {
  if (!value) return true;
  if (PLACEHOLDER_PATTERN.test(value)) return true;
  if (value.toLowerCase() === "xxxx") return true;
  return false;
}

function missingValueMessage(field: string): string {
  return `${field} is empty or missing. Save .env and restart the dev server (npm run dev).`;
}

export function isValidAuthDomain(value: string): boolean {
  return /^[a-z0-9-]+\.(firebaseapp\.com|web\.app)$/i.test(value);
}

export function isValidProjectId(value: string): boolean {
  return /^[a-z0-9-]{6,30}$/.test(value);
}

/** Resolve authDomain — never return a bare placeholder or non-hostname. */
export function resolveAuthDomain(
  authDomainRaw: string,
  projectIdRaw: string
): string | null {
  if (!isPlaceholder(authDomainRaw) && isValidAuthDomain(authDomainRaw)) {
    return authDomainRaw;
  }

  if (!isPlaceholder(projectIdRaw) && isValidProjectId(projectIdRaw)) {
    const derived = `${projectIdRaw}.firebaseapp.com`;
    if (isPlaceholder(authDomainRaw) || authDomainRaw !== derived) {
      console.warn(
        "[firebase] VITE_FIREBASE_AUTH_DOMAIN is missing or invalid; using",
        derived
      );
    }
    return derived;
  }

  return null;
}

export function getFirebaseConfigIssues(): FirebaseConfigIssue[] {
  const issues: FirebaseConfigIssue[] = [];

  const apiKey = readEnv("VITE_FIREBASE_API_KEY");
  const authDomainRaw = readEnv("VITE_FIREBASE_AUTH_DOMAIN");
  const projectId = readEnv("VITE_FIREBASE_PROJECT_ID");
  const storageBucket = readEnv("VITE_FIREBASE_STORAGE_BUCKET");
  const messagingSenderId = readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID");
  const appId = readEnv("VITE_FIREBASE_APP_ID");

  if (isPlaceholder(apiKey)) {
    issues.push({
      field: "VITE_FIREBASE_API_KEY",
      message: missingValueMessage("VITE_FIREBASE_API_KEY"),
    });
  }

  if (isPlaceholder(projectId) || !isValidProjectId(projectId)) {
    issues.push({
      field: "VITE_FIREBASE_PROJECT_ID",
      message: isPlaceholder(projectId)
        ? missingValueMessage("VITE_FIREBASE_PROJECT_ID")
        : "VITE_FIREBASE_PROJECT_ID must be 6–30 lowercase letters, numbers, or hyphens",
    });
  }

  const authDomain = resolveAuthDomain(authDomainRaw, projectId);
  if (!authDomain) {
    issues.push({
      field: "VITE_FIREBASE_AUTH_DOMAIN",
      message:
        "Set VITE_FIREBASE_AUTH_DOMAIN to your-project-id.firebaseapp.com in .env",
    });
  } else if (
    !isPlaceholder(authDomainRaw) &&
    !isValidAuthDomain(authDomainRaw)
  ) {
    issues.push({
      field: "VITE_FIREBASE_AUTH_DOMAIN",
      message: "authDomain must look like your-project-id.firebaseapp.com",
    });
  }

  if (isPlaceholder(storageBucket)) {
    issues.push({
      field: "VITE_FIREBASE_STORAGE_BUCKET",
      message: missingValueMessage("VITE_FIREBASE_STORAGE_BUCKET"),
    });
  }

  if (isPlaceholder(messagingSenderId)) {
    issues.push({
      field: "VITE_FIREBASE_MESSAGING_SENDER_ID",
      message: missingValueMessage("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    });
  }

  if (isPlaceholder(appId)) {
    issues.push({
      field: "VITE_FIREBASE_APP_ID",
      message: missingValueMessage("VITE_FIREBASE_APP_ID"),
    });
  }

  return issues;
}

export function buildFirebaseWebConfig(): FirebaseWebConfig {
  const apiKey = readEnv("VITE_FIREBASE_API_KEY");
  const authDomainRaw = readEnv("VITE_FIREBASE_AUTH_DOMAIN");
  const projectId = readEnv("VITE_FIREBASE_PROJECT_ID");
  const storageBucket = readEnv("VITE_FIREBASE_STORAGE_BUCKET");
  const messagingSenderId = readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID");
  const appId = readEnv("VITE_FIREBASE_APP_ID");

  const authDomain = resolveAuthDomain(authDomainRaw, projectId);
  if (!authDomain) {
    throw new Error(
      "Firebase authDomain is not configured. Set VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_AUTH_DOMAIN in .env using values from Firebase Console → Project settings."
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

export function getFirebaseConfigErrorMessage(): string | null {
  const issues = getFirebaseConfigIssues();
  if (issues.length === 0) return null;
  return issues.map((i) => `${i.field}: ${i.message}`).join(" ");
}
