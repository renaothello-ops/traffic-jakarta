import type { MessageRequestPolicy } from "../../types";

/** Whether `senderUid` may open a Traffic Message request to `recipientUid`. */
export function canSendMessageRequest(
  senderUid: string,
  recipientUid: string,
  policy: MessageRequestPolicy | undefined,
  recipientFollowsSender: boolean
): boolean {
  if (!senderUid || !recipientUid || senderUid === recipientUid) return false;
  const p = policy ?? "everyone";
  if (p === "nobody") return false;
  if (p === "people_i_follow") return recipientFollowsSender;
  return true;
}
