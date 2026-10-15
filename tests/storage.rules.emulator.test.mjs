/**
 * Dynamic Storage rules tests — requires Java + Firebase emulators.
 * Run: npm run test:storage-rules:emulator
 */
import { describe, it, before, after } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { initRulesTestEnvironment } from "./emulatorTestEnv.mjs";
import { waitForFirestoreEmulatorReady } from "./firestoreEmulatorReady.mjs";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadString, getBytes, deleteObject } from "firebase/storage";

const PROJECT_ID = "demotrafficjakarta";

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

before(async () => {
  const notBeforeMs = Date.now();
  console.error(`[test:storage] ${new Date().toISOString()} before() start`);
  await waitForFirestoreEmulatorReady(PROJECT_ID, { notBeforeMs });
  testEnv = await initRulesTestEnvironment({
    projectId: PROJECT_ID,
    useStorage: true,
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe("Storage rules (emulator)", () => {
  it("conversation photo: A and B allow, C and anonymous deny", async () => {
    const convId = `conv-ab-${Date.now()}`;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "conversations", convId), {
        memberKeys: ["alice", "bob"],
        memberA: "alice",
        memberB: "bob",
        status: "active",
        pendingForUid: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: Date.now(),
        lastPreview: "",
        lastSenderUid: "alice",
      });
    });

    const path = `chatPhotos/${convId}/photo1.jpg`;
    const alice = testEnv.authenticatedContext("alice");
    const bob = testEnv.authenticatedContext("bob");
    const carol = testEnv.authenticatedContext("carol");
    const anon = testEnv.unauthenticatedContext();

    await assertSucceeds(
      uploadString(ref(alice.storage(), path), "fake-image", "raw", {
        contentType: "image/jpeg",
      })
    );
    await assertSucceeds(getBytes(ref(bob.storage(), path)));
    await assertFails(getBytes(ref(carol.storage(), path)));
    await assertFails(getBytes(ref(anon.storage(), path)));
  });

  it("profile photo: owner write allow, other user overwrite deny", async () => {
    const path = "profilePhotos/alice/avatar.jpg";
    const alice = testEnv.authenticatedContext("alice");
    const bob = testEnv.authenticatedContext("bob");

    await assertSucceeds(
      uploadString(ref(alice.storage(), path), "avatar", "raw", {
        contentType: "image/jpeg",
      })
    );
    await assertFails(
      uploadString(ref(bob.storage(), path), "hijack", "raw", {
        contentType: "image/jpeg",
      })
    );
    await assertFails(deleteObject(ref(bob.storage(), path)));
  });
});
