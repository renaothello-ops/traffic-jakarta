import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const LOG_NAME = "firestore-debug.log";
const READY_LINE = "Dev App Server is now running";
const LOG_PREFIX = "[firestore-ready]";

function diag(message, extra = "") {
  const suffix = extra ? ` ${extra}` : "";
  console.error(`${LOG_PREFIX} ${new Date().toISOString()} ${message}${suffix}`);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Wait until firestore-debug.log is from THIS emulator run (mtime) and contains READY_LINE.
 */
export async function waitForFirestoreEmulatorLogReady(
  logPath = path.join(process.cwd(), LOG_NAME),
  { pollMs = 100, timeoutMs = 45_000, notBeforeMs } = {}
) {
  if (notBeforeMs == null) {
    throw new Error("notBeforeMs is required (pass Date.now() at test start)");
  }
  const deadline = Date.now() + timeoutMs;
  let lastDiag = 0;

  while (Date.now() < deadline) {
    try {
      const st = await stat(logPath);
      const fresh = st.mtimeMs >= notBeforeMs - 2000;
      const text = await readFile(logPath, "utf8");
      if (fresh && text.includes(READY_LINE)) {
        diag("log ready", `(mtime=${st.mtimeMs} notBefore=${notBeforeMs})`);
        return;
      }
      if (Date.now() - lastDiag > 5000) {
        diag(
          "waiting for log",
          `fresh=${fresh} hasLine=${text.includes(READY_LINE)} mtime=${st.mtimeMs}`
        );
        lastDiag = Date.now();
      }
    } catch (e) {
      if (e?.code !== "ENOENT") throw e;
      if (Date.now() - lastDiag > 5000) {
        diag("waiting for log file to appear", logPath);
        lastDiag = Date.now();
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `${READY_LINE} not found in fresh ${LOG_NAME} within ${timeoutMs}ms (stale log ignored)`
  );
}

/**
 * Verify gRPC write+read against the emulator (same path as rules tests).
 */
export async function verifyFirestoreEmulatorGrpc(projectId, { rpcTimeoutMs = 8_000 } = {}) {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST is not set");
  }
  const project = process.env.GCLOUD_PROJECT || projectId;

  let testEnv;
  try {
    testEnv = await withTimeout(
      initializeTestEnvironment({ projectId: project, firestore: {} }),
      rpcTimeoutMs,
      "gRPC init"
    );

    await withTimeout(
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        const ref = doc(ctx.firestore(), "_emulator_probe", "ready");
        await setDoc(ref, { at: Date.now() });
      }),
      rpcTimeoutMs,
      "gRPC write"
    );

    await withTimeout(
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        const snap = await getDoc(doc(ctx.firestore(), "_emulator_probe", "ready"));
        if (!snap.exists()) throw new Error("probe read missing document");
      }),
      rpcTimeoutMs,
      "gRPC read"
    );
  } finally {
    if (testEnv) await testEnv.cleanup();
  }
}

/**
 * Log readiness + gRPC probe with bounded retries.
 */
export async function waitForFirestoreEmulatorReady(
  projectId,
  {
    notBeforeMs = Date.now(),
    logTimeoutMs = 45_000,
    grpcAttempts = 8,
    grpcDelayMs = 400,
    grpcRpcTimeoutMs = 8_000,
    totalTimeoutMs = 120_000,
  } = {}
) {
  const overallDeadline = Date.now() + totalTimeoutMs;
  diag("start", `host=${process.env.FIRESTORE_EMULATOR_HOST} project=${process.env.GCLOUD_PROJECT || projectId}`);

  const logWaitBudget = Math.min(logTimeoutMs, overallDeadline - Date.now());
  await waitForFirestoreEmulatorLogReady(undefined, {
    notBeforeMs,
    timeoutMs: logWaitBudget,
  });

  let lastError;
  for (let attempt = 1; attempt <= grpcAttempts; attempt++) {
    if (Date.now() >= overallDeadline) {
      throw new Error(`overall readiness timed out after ${totalTimeoutMs}ms`);
    }
    diag("gRPC probe attempt", `${attempt}/${grpcAttempts}`);
    try {
      await verifyFirestoreEmulatorGrpc(projectId, { rpcTimeoutMs: grpcRpcTimeoutMs });
      diag("gRPC probe ok", `attempt=${attempt}`);
      return { logReady: true, grpcAttempts: attempt };
    } catch (e) {
      lastError = e;
      const msg = String(e?.message ?? e);
      const phase = msg.includes("gRPC init")
        ? "init"
        : msg.includes("gRPC write")
          ? "write"
          : msg.includes("gRPC read")
            ? "read"
            : "unknown";
      diag("gRPC probe failed", `phase=${phase} ${msg}`);
      if (attempt < grpcAttempts && Date.now() < overallDeadline) {
        await new Promise((r) => setTimeout(r, grpcDelayMs));
      }
    }
  }
  throw lastError ?? new Error("Firestore emulator gRPC probe failed");
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const projectId = process.env.GCLOUD_PROJECT || "demotrafficjakarta";
  const result = await waitForFirestoreEmulatorReady(projectId, {
    notBeforeMs: Date.now(),
  });
  console.log(
    `firestore emulator ready (log ok, gRPC ok after ${result.grpcAttempts} attempt(s))`
  );
}
