import { readFileSync } from "node:fs";
import { describe, it, before, after } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
} from "firebase/firestore";

const PROJECT_ID = "traffic-jakarta-rules-test";
const RULES = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

async function withClearDb(fn) {
  await testEnv.clearFirestore();
  return fn();
}

function validPost(overrides = {}) {
  return {
    type: "accident",
    text: "Test report",
    lat: -6.2,
    lng: 106.8,
    ownerUid: "alice",
    username: "Alice",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("Firestore security rules", () => {
  it("A — anonymous user cannot create a post", async () => {
    await withClearDb(async () => {
      const anon = testEnv.unauthenticatedContext();
      await assertFails(addDoc(collection(anon.firestore(), "posts"), validPost()));
    });
  });

  it("B — authenticated user can create own valid post", async () => {
    await withClearDb(async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(addDoc(collection(alice.firestore(), "posts"), validPost()));
    });
  });

  it("C — user cannot create post with another ownerUid", async () => {
    await withClearDb(async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        addDoc(collection(alice.firestore(), "posts"), validPost({ ownerUid: "bob" }))
      );
    });
  });

  it("D — user cannot edit another user's post", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/post1"), validPost({ ownerUid: "alice" }));
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(
        updateDoc(doc(bob.firestore(), "posts/post1"), { text: "Hacked" })
      );
    });
  });

  it("E — user cannot delete another user's post", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/post1"), validPost({ ownerUid: "alice" }));
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(deleteDoc(doc(bob.firestore(), "posts/post1")));
    });
  });

  it("F — user cannot edit another user's comment", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/post1"), validPost({ ownerUid: "alice" }));
        await setDoc(doc(ctx.firestore(), "posts/post1/comments/c1"), {
          text: "Hi",
          username: "Alice",
          authorUid: "alice",
          createdAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(
        updateDoc(doc(bob.firestore(), "posts/post1/comments/c1"), { text: "Nope" })
      );
    });
  });

  it("G — vote document identity cannot spoof another UID", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/post1"), validPost({ ownerUid: "alice" }));
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        setDoc(doc(alice.firestore(), "posts/post1/votes/bob"), {
          vote: "confirm",
          voterId: "bob",
          createdAt: Date.now(),
        })
      );
    });
  });

  it("H — user cannot create alternative vote doc with mismatched voterId", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/post1"), validPost({ ownerUid: "alice" }));
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        setDoc(doc(alice.firestore(), "posts/post1/votes/alice"), {
          vote: "confirm",
          voterId: "bob",
          createdAt: Date.now(),
        })
      );
    });
  });

  it("I — user cannot set confirmCount on create", async () => {
    await withClearDb(async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        addDoc(collection(alice.firestore(), "posts"), validPost({ confirmCount: 99 }))
      );
    });
  });

  it("J — user cannot modify denyCount on update", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/post1"), {
          ...validPost({ ownerUid: "alice" }),
          confirmCount: 0,
          denyCount: 0,
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        updateDoc(doc(alice.firestore(), "posts/post1"), { denyCount: 99 })
      );
    });
  });

  it("K — user cannot set verified on community road update", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "communityRoads/road1"), {
          name: "Alley",
          access: "private",
          coordinates: [
            { lat: -6.2, lng: 106.8 },
            { lat: -6.21, lng: 106.81 },
          ],
          ownerUid: "alice",
          username: "Alice",
          createdAt: Date.now(),
          verified: false,
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        updateDoc(doc(alice.firestore(), "communityRoads/road1"), { verified: true })
      );
    });
  });

  it("L — invalid report type rejected on create", async () => {
    await withClearDb(async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        addDoc(collection(alice.firestore(), "posts"), validPost({ type: "not_a_type" }))
      );
    });
  });

  it("M — invalid coordinates rejected on create", async () => {
    await withClearDb(async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        addDoc(collection(alice.firestore(), "posts"), validPost({ lat: 999, lng: 106.8 }))
      );
    });
  });

  it("N — user cannot read another user's private profile", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/alice"), {
          displayName: "Alice",
          email: "alice@example.com",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(getDoc(doc(bob.firestore(), "users/alice")));
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(getDoc(doc(alice.firestore(), "users/alice")));
    });
  });
});
