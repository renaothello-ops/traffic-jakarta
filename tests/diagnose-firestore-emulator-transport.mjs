/**
 * One-shot transport diagnostic (run via npm run test:rules:diagnose-transport).
 * Waits for JVM log ready, then tests REST vs gRPC step-by-step.
 */
import { stat } from "node:fs/promises";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { waitForFirestoreEmulatorLogReady } from "./firestoreEmulatorReady.mjs";

const PROJECT = process.env.GCLOUD_PROJECT || "demotrafficjakarta";
const HOST = process.env.FIRESTORE_EMULATOR_HOST || "(unset)";
const STEP_TIMEOUT_MS = 8_000;
const notBeforeMs = Date.now();

const results = {};

function log(label, detail = "") {
  console.log(`[diag] ${new Date().toISOString()} ${label}${detail ? ` — ${detail}` : ""}`);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function runStep(key, name, fn) {
  const t0 = Date.now();
  log(`BEGIN ${name}`);
  try {
    const result = await withTimeout(fn(), STEP_TIMEOUT_MS, name);
    log(`OK ${name}`, `${Date.now() - t0}ms`);
    results[key] = { ok: true, ms: Date.now() - t0, detail: result };
    return true;
  } catch (e) {
    log(`FAIL ${name}`, `${Date.now() - t0}ms — ${e?.message ?? e}`);
    results[key] = { ok: false, ms: Date.now() - t0, error: String(e?.message ?? e) };
    return false;
  }
}

function encodeFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") fields[k] = { stringValue: v };
    else if (typeof v === "number") fields[k] = { integerValue: String(v) };
  }
  return fields;
}

async function countListeners() {
  const { execSync } = await import("node:child_process");
  try {
    const java = execSync("pgrep -lf cloud-firestore-emulator 2>/dev/null || true", {
      encoding: "utf8",
    }).trim();
    const port8080 = execSync("lsof -ti tcp:8080 2>/dev/null || true", {
      encoding: "utf8",
    }).trim();
    log("PROCESS java", java || "(none)");
    log("PROCESS tcp:8080 pids", port8080 || "(none)");
  } catch (e) {
    log("PROCESS check error", String(e));
  }
}

log("ENV", `FIRESTORE_EMULATOR_HOST=${HOST} GCLOUD_PROJECT=${PROJECT}`);

try {
  await waitForFirestoreEmulatorLogReady(undefined, {
    notBeforeMs,
    timeoutMs: 45_000,
  });
  results.logReady = { ok: true };
  log("log ready", "Dev App Server line (fresh log)");
} catch (e) {
  results.logReady = { ok: false, error: String(e?.message ?? e) };
  log("log ready FAIL", String(e?.message ?? e));
}

await runStep("restGet", "REST GET /", async () => {
  const base = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const resp = await fetch(`http://${base}/`, { signal: AbortSignal.timeout(5000) });
  return `status=${resp.status}`;
});

await runStep("restGetDoc", "REST GET document (missing doc)", async () => {
  const base = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const url = `http://${base}/v1/projects/${PROJECT}/databases/(default)/documents/_diag_rest/missing-${Date.now()}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(STEP_TIMEOUT_MS) });
  const body = await resp.text();
  return `status=${resp.status} bytes=${body.length}`;
});

await runStep("restPost", "REST POST document (Bearer owner)", async () => {
  const base = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const url = `http://${base}/v1/projects/${PROJECT}/databases/(default)/documents/_diag_rest/probe?documentId=rest-${Date.now()}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({
      fields: encodeFields({ via: "rest", at: String(Date.now()) }),
    }),
    signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
  });
  const body = await resp.text();
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${body.slice(0, 200)}`);
  return `status=${resp.status} bytes=${body.length}`;
});

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment | undefined} */
let testEnv;

await countListeners();
results.processBeforeGrpc = { note: "after REST, before gRPC init" };

await runStep("grpcInit", "gRPC init initializeTestEnvironment", async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {},
  });
  return "initialized";
});

if (!results.grpcInit?.ok) {
  await countListeners();
  results.processAfterFailedGrpcInit = {
    note: "grpcInit failed or timed out; init promise may still run in background",
  };
  try {
    const { execSync } = await import("node:child_process");
    const nodeProcs = execSync(
      "pgrep -lf 'node.*diagnose-firestore|node.*firestore.rules' 2>/dev/null || true",
      { encoding: "utf8" }
    ).trim();
    log("PROCESS node test/diag", nodeProcs || "(only this process expected)");
  } catch {
    /* ignore */
  }
}

if (testEnv) {
  await runStep("grpcWrite", "gRPC write setDoc (owner)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "_diag_grpc", "write"), {
        at: Date.now(),
        via: "grpc-setDoc",
      });
    });
    return "written";
  });

  await runStep("grpcRead", "gRPC read getDoc (owner)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), "_diag_grpc", "write"));
      if (!snap.exists()) throw new Error("missing doc");
    });
    return "read ok";
  });
}

if (testEnv) {
  try {
    await testEnv.cleanup();
    log("cleanup", "testEnv.cleanup() done");
  } catch (e) {
    log("cleanup FAIL", String(e?.message ?? e));
  }
}

await countListeners();

console.log("[diag] SUMMARY JSON:", JSON.stringify(results, null, 2));

const failed = Object.entries(results).filter(([, v]) => v.ok === false);
process.exit(failed.length ? 1 : 0);
