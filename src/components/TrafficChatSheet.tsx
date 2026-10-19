import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Post, TrafficMessage, TrafficThreadSummary } from "../types";
import {
  acceptMessageRequest,
  deleteMessageRequest,
  listenConversationMessages,
  markThreadRead,
  sendLocationMessage,
  sendPhotoMessage,
  sendTextMessage,
  sendTrafficReportMessage,
} from "../assets/lib/trafficChat";
import { blockUser } from "../assets/lib/blocking";
import { submitUserReport } from "../assets/lib/userReports";
import { listenPublicProfile } from "../assets/lib/publicProfile";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";
import { timeAgo } from "../assets/lib/timeAgo";
import { useAuth } from "../contexts/useAuth";
import { useMountedRef } from "../hooks/useMountedRef";
import { IconX } from "./icons/AppIcons";

type Props = {
  thread: TrafficThreadSummary;
  initialReport?: Post | null;
  mapCenter?: { lat: number; lng: number } | null;
  onClose: () => void;
  onOpenProfile: (uid: string) => void;
};

export default function TrafficChatSheet({
  thread,
  initialReport,
  mapCenter,
  onClose,
  onOpenProfile,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<TrafficMessage[]>([]);
  const [text, setText] = useState("");
  const [peerName, setPeerName] = useState("");
  const [peerUsername, setPeerUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bootstrapped = useRef(false);
  const mounted = useMountedRef();

  useEffect(() => {
    return listenConversationMessages(thread.conversationId, (next) => {
      if (mounted.current) setMessages(next);
    });
  }, [thread.conversationId, mounted]);

  useEffect(() => {
    return listenPublicProfile(thread.peerUid, (p) => {
      if (!mounted.current) return;
      setPeerName(p?.displayName ?? "");
      setPeerUsername(p?.username ?? null);
    });
  }, [thread.peerUid, mounted]);

  useEffect(() => {
    if (!user?.uid) return;
    void markThreadRead(user.uid, thread.conversationId);
  }, [user?.uid, thread.conversationId]);

  useEffect(() => {
    if (!user?.uid || !initialReport || bootstrapped.current) return;
    if (thread.status !== "active" && thread.pendingForUid === user.uid) return;
    bootstrapped.current = true;
    void sendTrafficReportMessage(
      thread.conversationId,
      user.uid,
      initialReport,
      initialReport.username
    ).catch(() => {});
  }, [initialReport, thread, user?.uid]);

  async function onSend() {
    if (!user?.uid || !text.trim()) return;
    setBusy(true);
    try {
      await sendTextMessage(thread.conversationId, user.uid, text);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  const isRecipientPending =
    thread.status === "pending" && thread.pendingForUid === user?.uid;

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll tj-chat-sheet tj-dm-chat">
        <div className="tj-sheet__header tj-dm-sheet__header">
          <button
            type="button"
            className="tj-chat-header"
            onClick={() => onOpenProfile(thread.peerUid)}
          >
            <strong>{peerName || t("common.loading")}</strong>
            {peerUsername ? <span>@{peerUsername}</span> : null}
          </button>
          <button
            type="button"
            className="tj-icon-btn tj-icon-btn--touch"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <IconX size={22} />
          </button>
        </div>

        {isRecipientPending ? (
          <div className="tj-chat-requests">
            <p className="tj-hint">{t("messages.pendingHint")}</p>
            <button
              type="button"
              className="tj-btn tj-btn--primary tj-btn--compact"
              onClick={() =>
                user?.uid &&
                void acceptMessageRequest(user.uid, thread.conversationId)
              }
            >
              {t("messages.accept")}
            </button>
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact"
              onClick={() =>
                user?.uid &&
                void deleteMessageRequest(user.uid, thread.conversationId).then(onClose)
              }
            >
              {t("messages.decline")}
            </button>
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact"
              onClick={() =>
                user?.uid &&
                void blockUser(user.uid, thread.peerUid).then(onClose)
              }
            >
              {t("messages.block")}
            </button>
          </div>
        ) : null}

        <ul className="tj-chat-messages">
          {messages.map((m) => (
            <li
              key={m.id}
              className={
                m.senderUid === user?.uid
                  ? "tj-chat-msg tj-chat-msg--mine"
                  : "tj-chat-msg"
              }
            >
              {m.kind === "text" ? <p>{m.text}</p> : null}
              {m.kind === "photo" && m.photoURL ? (
                <img src={m.photoURL} alt="" className="tj-chat-photo" />
              ) : null}
              {m.kind === "traffic_report" && m.trafficReport ? (
                <div className="tj-chat-card">
                  <strong>{reportTypeLabel(t, m.trafficReport.type)}</strong>
                  {m.trafficReport.text ? <p>{m.trafficReport.text}</p> : null}
                  <span className="tj-hint">{timeAgo(m.trafficReport.createdAt)}</span>
                </div>
              ) : null}
              {m.kind === "location" && m.location ? (
                <div className="tj-chat-card">
                  📍 {m.location.label ?? `${m.location.lat.toFixed(4)}, ${m.location.lng.toFixed(4)}`}
                </div>
              ) : null}
              {m.kind === "route" && m.route ? (
                <div className="tj-chat-card">
                  🛣 {m.route.originLabel} → {m.route.destinationLabel}
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {thread.status === "pending" && thread.pendingForUid === user?.uid ? null : (
          <div className="tj-chat-composer">
            <button
              type="button"
              className="tj-icon-btn"
              aria-label={t("messages.attachPhoto")}
              onClick={() => setAttachOpen((v) => !v)}
            >
              +
            </button>
            {attachOpen ? (
              <div className="tj-chat-attach-menu">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                >
                  {t("messages.attachPhoto")}
                </button>
                {mapCenter ? (
                  <button
                    type="button"
                    onClick={() =>
                      user?.uid &&
                      void sendLocationMessage(thread.conversationId, user.uid, {
                        lat: mapCenter.lat,
                        lng: mapCenter.lng,
                        label: t("map.mapCenter"),
                      })
                    }
                  >
                    {t("messages.attachLocation")}
                  </button>
                ) : null}
              </div>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && user?.uid) {
                  void sendPhotoMessage(thread.conversationId, user.uid, file);
                }
                e.target.value = "";
              }}
            />
            <input
              className="tj-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("messages.composePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSend();
              }}
            />
            <button
              type="button"
              className="tj-btn tj-btn--primary tj-btn--compact"
              disabled={busy || !text.trim()}
              onClick={() => void onSend()}
            >
              {t("messages.send")}
            </button>
          </div>
        )}

        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() =>
            user?.uid &&
            void submitUserReport({
              targetType: "user",
              targetId: thread.peerUid,
              reason: "spam",
              reportedUid: thread.peerUid,
            }).then(() => alert(t("messages.reportSubmitted")))
          }
        >
          {t("messages.report")}
        </button>
      </div>
    </div>
  );
}
