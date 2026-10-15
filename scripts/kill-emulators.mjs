#!/usr/bin/env node
import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function killPort(port) {
  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" }).trim();
    if (!out) return;
    for (const pid of out.split("\n").filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* nothing listening */
  }
}

for (const port of [8080, 9199, 4400, 4401, 4000, 4001, 9150, 4500, 4501, 5000, 5001]) {
  killPort(port);
}

try {
  execSync("pkill -9 -f cloud-firestore-emulator 2>/dev/null || true", { stdio: "ignore" });
  execSync("pkill -9 -f 'firebase emulators' 2>/dev/null || true", { stdio: "ignore" });
} catch {
  /* ignore */
}

/** Leftover hub locator → "multiple instances" warning (see firebase-tools hub.js). */
for (const projectId of [
  "demotrafficjakarta",
  "traffic-jakarta",
  "traffic-jakarta-rules-test",
]) {
  try {
    unlinkSync(path.join(tmpdir(), `hub-${projectId}.json`));
  } catch {
    /* ENOENT */
  }
}

for (const name of ["firestore-debug.log", "firebase-debug.log", "ui-debug.log"]) {
  try {
    unlinkSync(path.join(ROOT, name));
  } catch {
    /* ENOENT */
  }
}
