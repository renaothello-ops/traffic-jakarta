import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";

async function deleteQueryBatch(db, querySnap) {
  if (querySnap.empty) return;
  const batch = writeBatch(db);
  for (const d of querySnap.docs) {
    batch.delete(d.ref);
  }
  await batch.commit();
}

async function deletePostTree(db, postId) {
  const comments = await getDocs(collection(db, "posts", postId, "comments"));
  await deleteQueryBatch(db, comments);
  const votes = await getDocs(collection(db, "posts", postId, "votes"));
  await deleteQueryBatch(db, votes);
  try {
    await deleteDoc(doc(db, "posts", postId, "ownerSecret", "owner"));
  } catch {
    /* optional */
  }
  await deleteDoc(doc(db, "posts", postId));
}

async function deleteUserTree(db, uid) {
  const favorites = await getDocs(collection(db, "users", uid, "favoritePlaces"));
  await deleteQueryBatch(db, favorites);
  const notifications = await getDocs(collection(db, "users", uid, "notifications"));
  await deleteQueryBatch(db, notifications);
  await deleteDoc(doc(db, "users", uid));
}

async function deleteConversationTree(db, convId) {
  const messages = await getDocs(collection(db, "conversations", convId, "messages"));
  await deleteQueryBatch(db, messages);
  await deleteDoc(doc(db, "conversations", convId));
}

async function deleteCommunityRoadTree(db, roadId) {
  const votes = await getDocs(collection(db, "communityRoads", roadId, "votes"));
  await deleteQueryBatch(db, votes);
  await deleteDoc(doc(db, "communityRoads", roadId));
}

async function deleteFollowRequestIncoming(db, targetUid) {
  const incoming = await getDocs(
    collection(db, "followRequests", targetUid, "incoming")
  );
  await deleteQueryBatch(db, incoming);
}

async function deleteBlocksTree(db, blockerUid) {
  const blocked = await getDocs(collection(db, "blocks", blockerUid, "blocked"));
  await deleteQueryBatch(db, blocked);
  await deleteDoc(doc(db, "blocks", blockerUid));
}

/**
 * Clear emulator data via Firestore client (avoids broken /emulator/v1 admin REST on some hosts).
 */
export async function clearEmulatorFirestore(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    const posts = await getDocs(collection(db, "posts"));
    for (const p of posts.docs) {
      await deletePostTree(db, p.id);
    }

    const users = await getDocs(collection(db, "users"));
    for (const u of users.docs) {
      await deleteUserTree(db, u.id);
    }

    const profiles = await getDocs(collection(db, "publicProfiles"));
    await deleteQueryBatch(db, profiles);

    const follows = await getDocs(collection(db, "follows"));
    await deleteQueryBatch(db, follows);

    const reports = await getDocs(collection(db, "userReports"));
    await deleteQueryBatch(db, reports);

    const convs = await getDocs(collection(db, "conversations"));
    for (const c of convs.docs) {
      await deleteConversationTree(db, c.id);
    }

    const roads = await getDocs(collection(db, "communityRoads"));
    for (const r of roads.docs) {
      await deleteCommunityRoadTree(db, r.id);
    }

    const followReqRoots = await getDocs(collection(db, "followRequests"));
    for (const fr of followReqRoots.docs) {
      await deleteFollowRequestIncoming(db, fr.id);
      await deleteDoc(fr.ref);
    }

    const blockRoots = await getDocs(collection(db, "blocks"));
    for (const b of blockRoots.docs) {
      await deleteBlocksTree(db, b.id);
    }

    const usernames = await getDocs(collection(db, "usernames"));
    await deleteQueryBatch(db, usernames);
  });
}
