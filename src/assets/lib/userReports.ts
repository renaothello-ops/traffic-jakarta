import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserReportReason, UserReportTargetType } from "../../types";

export async function submitUserReport(input: {
  targetType: UserReportTargetType;
  targetId: string;
  reason: UserReportReason;
  details?: string;
  relatedPostId?: string;
  relatedMessageId?: string;
  reportedUid?: string;
}): Promise<void> {
  const reporterUid = auth.currentUser?.uid;
  if (!reporterUid) throw new Error("auth.required");

  const details = (input.details ?? "").trim().slice(0, 500);
  await addDoc(collection(db, "userReports"), {
    reporterUid,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details,
    relatedPostId: input.relatedPostId ?? null,
    relatedMessageId: input.relatedMessageId ?? null,
    reportedUid: input.reportedUid ?? null,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
    status: "pending",
  });
}
