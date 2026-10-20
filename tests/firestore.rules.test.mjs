import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { initRulesTestEnvironment } from "./emulatorTestEnv.mjs";
import { waitForFirestoreEmulatorReady } from "./firestoreEmulatorReady.mjs";
import { clearEmulatorFirestore } from "./clearEmulatorFirestore.mjs";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

const PROJECT_ID = "demotrafficjakarta";
// Security rules: loaded by `firebase emulators:exec` from ../firestore.rules (see emulatorTestEnv.mjs).

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

before(async () => {
  const notBeforeMs = Date.now();
  console.error(`[test:rules] ${new Date().toISOString()} before() start`);
  await waitForFirestoreEmulatorReady(PROJECT_ID, { notBeforeMs });
  console.error(`[test:rules] ${new Date().toISOString()} initRulesTestEnvironment`);
  testEnv = await initRulesTestEnvironment({ projectId: PROJECT_ID });
  console.error(`[test:rules] ${new Date().toISOString()} before() done`);
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

async function withClearDb(fn) {
  await clearEmulatorFirestore(testEnv);
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
    audience: "public",
    anonymous: false,
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

  it("B2a — user cannot forge ownerSecret with another uid", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/anon-forge"), {
          type: "heavy_traffic",
          text: "",
          lat: -6.2,
          lng: 106.8,
          username: "Anonymous",
          audience: "public",
          anonymous: true,
          createdAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(
        setDoc(doc(bob.firestore(), "posts/anon-forge/ownerSecret/owner"), {
          ownerUid: "alice",
          createdAt: Date.now(),
        })
      );
    });
  });

  it("B2 — authenticated user can create anonymous public post + ownerSecret (createPost batch)", async () => {
    await withClearDb(async () => {
      const alice = testEnv.authenticatedContext("alice");
      const fs = alice.firestore();
      const postRef = doc(collection(fs, "posts"));
      const now = Date.now();
      const batch = writeBatch(fs);
      batch.set(postRef, {
        type: "heavy_traffic",
        text: "",
        lat: -6.2,
        lng: 106.8,
        username: "Anonymous",
        audience: "public",
        anonymous: true,
        createdAt: now,
        createdAtServer: serverTimestamp(),
      });
      batch.set(doc(fs, "posts", postRef.id, "ownerSecret", "owner"), {
        ownerUid: "alice",
        createdAt: now,
        createdAtServer: serverTimestamp(),
      });
      await assertSucceeds(batch.commit());
      await assertSucceeds(getDoc(postRef));
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

  it("O — owner can patch language only on profile", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/alice"), {
          displayName: "Alice",
          email: "alice@example.com",
          language: "en",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(
        updateDoc(doc(alice.firestore(), "users/alice"), {
          language: "id",
          updatedAt: Date.now(),
        })
      );
    });
  });

  it("P — language patch allowed when legacy extra field exists on profile", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/alice"), {
          displayName: "Alice",
          email: "alice@example.com",
          language: "en",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          legacyMigrationFlag: true,
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(
        updateDoc(doc(alice.firestore(), "users/alice"), {
          language: "ja",
          updatedAt: Date.now(),
        })
      );
    });
  });

  it("Q — invalid language value rejected", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/alice"), {
          displayName: "Alice",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        updateDoc(doc(alice.firestore(), "users/alice"), {
          language: "xx",
          updatedAt: Date.now(),
        })
      );
    });
  });

  it("R1 — user A cannot read user B favoritePlaces", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/bob/favoritePlaces/home1"), {
          label: "Home",
          kind: "home",
          lat: -6.2,
          lng: 106.8,
          radiusKm: 3,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        getDoc(doc(alice.firestore(), "users/bob/favoritePlaces/home1"))
      );
    });
  });

  it("R2 — user A cannot read conversation between B and C", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "conversations/conv-bc"), {
          memberKeys: ["bob", "carol"],
          memberA: "bob",
          memberB: "carol",
          status: "active",
          pendingForUid: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
          lastPreview: "hi",
          lastSenderUid: "bob",
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(getDoc(doc(alice.firestore(), "conversations/conv-bc")));
    });
  });

  it("R3 — user A cannot read message in B/C conversation", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "conversations/conv-bc"), {
          memberKeys: ["bob", "carol"],
          memberA: "bob",
          memberB: "carol",
          status: "active",
          pendingForUid: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastMessageAt: Date.now(),
          lastPreview: "hi",
          lastSenderUid: "bob",
        });
        await setDoc(doc(ctx.firestore(), "conversations/conv-bc/messages/m1"), {
          senderUid: "bob",
          kind: "text",
          text: "secret",
          createdAt: Date.now(),
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        getDoc(doc(alice.firestore(), "conversations/conv-bc/messages/m1"))
      );
    });
  });

  it("R4 — user A cannot update user B private profile", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/bob"), {
          displayName: "Bob",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        updateDoc(doc(alice.firestore(), "users/bob"), {
          displayName: "Hacked",
          updatedAt: Date.now(),
        })
      );
    });
  });

  it("R5 — non-follower cannot read followers-only post", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/followers1"), {
          ...validPost({ ownerUid: "alice", audience: "followers" }),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(getDoc(doc(bob.firestore(), "posts/followers1")));
    });
  });

  it("R6 — user cannot read another user's moderation report", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "userReports/r1"), {
          reporterUid: "alice",
          targetType: "user",
          targetId: "mallory",
          reason: "spam",
          status: "pending",
          createdAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(getDoc(doc(bob.firestore(), "userReports/r1")));
    });
  });

  it("R7 — user cannot read another user's ownerSecret", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/anon1/ownerSecret/owner"), {
          ownerUid: "alice",
          createdAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(
        getDoc(doc(bob.firestore(), "posts/anon1/ownerSecret/owner"))
      );
    });
  });

  it("R9 — non-follower cannot read comments on followers-only post", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/followers1"), {
          ...validPost({ ownerUid: "alice", audience: "followers" }),
        });
        await setDoc(doc(ctx.firestore(), "posts/followers1/comments/c1"), {
          text: "followers only thread",
          username: "Alice",
          authorUid: "alice",
          createdAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(
        getDoc(doc(bob.firestore(), "posts/followers1/comments/c1"))
      );
    });
  });

  it("R10 — user cannot forge another user's publicProfile counters (999999)", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "publicProfiles/bob"), {
          displayName: "Bob",
          accountVisibility: "public",
          followerCount: 1,
          followingCount: 0,
          postCount: 0,
          updatedAt: Date.now(),
        });
      });
      const mallory = testEnv.authenticatedContext("mallory");
      await assertFails(
        updateDoc(doc(mallory.firestore(), "publicProfiles/bob"), {
          followerCount: 999999,
          followingCount: 0,
          postCount: 0,
          updatedAt: Date.now(),
        })
      );
    });
  });

  it("R10b — user cannot zero another user's followerCount", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "publicProfiles/bob"), {
          displayName: "Bob",
          followerCount: 5,
          followingCount: 0,
          postCount: 0,
          updatedAt: Date.now(),
        });
      });
      const mallory = testEnv.authenticatedContext("mallory");
      await assertFails(
        updateDoc(doc(mallory.firestore(), "publicProfiles/bob"), {
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          updatedAt: Date.now(),
        })
      );
    });
  });

  it("R10c — user cannot set negative counters on another profile", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "publicProfiles/bob"), {
          displayName: "Bob",
          followerCount: 1,
          followingCount: 0,
          postCount: 0,
          updatedAt: Date.now(),
        });
      });
      const mallory = testEnv.authenticatedContext("mallory");
      await assertFails(
        updateDoc(doc(mallory.firestore(), "publicProfiles/bob"), {
          followerCount: -1,
          followingCount: 0,
          postCount: 0,
          updatedAt: Date.now(),
        })
      );
    });
  });

  it("R9b — approved follower can read comment on followers-only post", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/followers1"), {
          ...validPost({ ownerUid: "alice", audience: "followers" }),
        });
        await setDoc(doc(ctx.firestore(), "posts/followers1/comments/c1"), {
          text: "followers only thread",
          username: "Alice",
          authorUid: "alice",
          createdAt: Date.now(),
        });
        await setDoc(doc(ctx.firestore(), "follows/bob_alice"), {
          followerUid: "bob",
          followingUid: "alice",
          createdAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertSucceeds(
        getDoc(doc(bob.firestore(), "posts/followers1/comments/c1"))
      );
    });
  });

  it("R9c — post owner can read comment on followers-only post", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "posts/followers1"), {
          ...validPost({ ownerUid: "alice", audience: "followers" }),
        });
        await setDoc(doc(ctx.firestore(), "posts/followers1/comments/c1"), {
          text: "owner thread",
          username: "Alice",
          authorUid: "alice",
          createdAt: Date.now(),
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(
        getDoc(doc(alice.firestore(), "posts/followers1/comments/c1"))
      );
    });
  });

  it("R11 — legitimate follow create (no client counter patch)", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "publicProfiles/alice"), {
          displayName: "Alice",
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          updatedAt: Date.now(),
        });
        await setDoc(doc(ctx.firestore(), "publicProfiles/bob"), {
          displayName: "Bob",
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          updatedAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertSucceeds(
        setDoc(doc(bob.firestore(), "follows/bob_alice"), {
          followerUid: "bob",
          followingUid: "alice",
          createdAt: Date.now(),
        })
      );
    });
  });

  it("R12 — legitimate unfollow delete", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "follows/bob_alice"), {
          followerUid: "bob",
          followingUid: "alice",
          createdAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertSucceeds(deleteDoc(doc(bob.firestore(), "follows/bob_alice")));
    });
  });

  it("R8 — user A cannot read user B notifications", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/bob/notifications/n1"), {
          type: "new_message",
          titleKey: "x",
          bodyKey: "y",
          actorUid: "carol",
          recipientUid: "bob",
          createdAt: Date.now(),
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        getDoc(doc(alice.firestore(), "users/bob/notifications/n1"))
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

  it("U1 — user can claim an available username handle", async () => {
    await withClearDb(async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(
        setDoc(doc(alice.firestore(), "usernames/rena_jkt"), {
          uid: "alice",
          createdAt: Date.now(),
        })
      );
    });
  });

  it("U2 — user cannot claim a username handle owned by someone else", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "usernames/taken_name"), {
          uid: "alice",
          createdAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(
        setDoc(doc(bob.firestore(), "usernames/taken_name"), {
          uid: "bob",
          createdAt: Date.now(),
        })
      );
    });
  });

  it("U3 — invalid username handle document id is rejected", async () => {
    await withClearDb(async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        setDoc(doc(alice.firestore(), "usernames/AB"), {
          uid: "alice",
          createdAt: Date.now(),
        })
      );
    });
  });

  it("U4 — only one user can create the same username handle (race)", async () => {
    await withClearDb(async () => {
      const alice = testEnv.authenticatedContext("alice");
      const bob = testEnv.authenticatedContext("bob");
      const results = await Promise.allSettled([
        setDoc(doc(alice.firestore(), "usernames/race_handle"), {
          uid: "alice",
          createdAt: Date.now(),
        }),
        setDoc(doc(bob.firestore(), "usernames/race_handle"), {
          uid: "bob",
          createdAt: Date.now(),
        }),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      assert.equal(fulfilled.length, 1);
    });
  });

  it("U5 — user cannot set username on profile without usernames reservation", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/alice"), {
          displayName: "Alice",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        updateDoc(doc(alice.firestore(), "users/alice"), {
          username: "stolen_name",
          usernameLower: "stolen_name",
          updatedAt: Date.now(),
        })
      );
    });
  });

  it("U6 — user cannot update another user's private profile", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/alice"), {
          displayName: "Alice",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(
        updateDoc(doc(bob.firestore(), "users/alice"), {
          displayName: "Hacked",
          updatedAt: Date.now(),
        })
      );
    });
  });

  it("U7 — username on profile must match owned reservation", async () => {
    await withClearDb(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "users/alice"), {
          displayName: "Alice",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await setDoc(doc(ctx.firestore(), "usernames/alice_ok"), {
          uid: "alice",
          createdAt: Date.now(),
        });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(
        updateDoc(doc(alice.firestore(), "users/alice"), {
          username: "alice_ok",
          usernameLower: "alice_ok",
          updatedAt: Date.now(),
        })
      );
    });
  });
});
