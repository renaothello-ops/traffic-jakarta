# Firestore emulator (rules tests)

Rules tests use **`firebase emulators:exec`** with **firebase-tools 13.29.1**, which downloads **Firestore Emulator v1.19.8** (compatible with Firebase JS SDK 12.x gRPC).

Do **not** upgrade firebase-tools to 15.x for rules tests without re-validating: v15 ships Firestore **1.22.0** and starts it in **standard edition**, which breaks the current `@firebase/rules-unit-testing` + SDK 12.8 setup (Listen → `ECONNRESET`).

Requirements:

- Java 21 on `PATH` (Homebrew: `brew install openjdk@21`)
- Node **20** for the test process (`brew install node@20`)

```bash
npm run test:rules
npm run test:storage-rules:emulator
```

Optional offline JAR (gitignored under `.emulator/`):

```bash
mkdir -p .emulator
curl -fsSL -o .emulator/cloud-firestore-emulator-v1.19.8.jar \
  https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.19.8.jar
export FIRESTORE_EMULATOR_BINARY_PATH="$PWD/.emulator/cloud-firestore-emulator-v1.19.8.jar"
```

Before tests, stale emulators are stopped via `scripts/kill-emulators.mjs`.
