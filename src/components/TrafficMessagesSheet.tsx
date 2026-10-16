import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FirebaseError } from "firebase/app";
import type { TrafficThreadSummary } from "../types";
import {
  acceptMessageRequest,
  deleteMessageRequest,
} from "../assets/lib/trafficChat";
import { listenPublicProfile } from "../assets/lib/publicProfile";
import { blockUser } from "../assets/lib/blocking";
import {
  filterInboxBySearch,
  type PeerSearchLabels,
} from "../assets/lib/messageInboxSearch";
import { useAuth } from "../contexts/useAuth";
import { timeAgo } from "../assets/lib/timeAgo";
import { useMountedRef } from "../hooks/useMountedRef";
import UserAvatar from "./UserAvatar";

type Props = {
  onClose: () => void;
  onOpenChat: (thread: TrafficThreadSummary) => void;
  inbox: TrafficThreadSummary[];
  requests: TrafficThreadSummary[];
  loadFailed: boolean;
  lastError?: FirebaseError | null;
};

type View = "inbox" | "requests";

function usePeerProfile(peerUid: string) {
  const mounted = useMountedRef();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  useEffect(() => {
    return listenPublicProfile(peerUid, (p) => {
      if (!mounted.current) return;
      setDisplayName(p?.displayName ?? "");
      setUsername(p?.username ?? null);
      setPhotoURL(p?.photoURL ?? null);
    });
  }, [peerUid, mounted]);

  return { displayName, username, photoURL };
}

function usePeerSearchLabels(peerUids: string[]): PeerSearchLabels {
  const mounted = useMountedRef();
  const [labels, setLabels] = useState<PeerSearchLabels>({});

  useEffect(() => {
    const unique = [...new Set(peerUids.filter(Boolean))];
    if (unique.length === 0) {
      setLabels({});
      return;
    }

    const unsubs = unique.map((peerUid) =>
      listenPublicProfile(peerUid, (p) => {
        if (!mounted.current) return;
        setLabels((prev) => ({
          ...prev,
          [peerUid]: {
            displayName: p?.displayName ?? "",
            username: p?.username ?? null,
          },
        }));
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [peerUids.join("|"), mounted]);

  return labels;
}

function InboxRow({
  thread,
  onOpen,
}: {
  thread: TrafficThreadSummary;
  onOpen: () => void;
}) {
  const peer = usePeerProfile(thread.peerUid);

  return (
    <button type="button" className="tj-messages-row" onClick={onOpen}>
      <UserAvatar
        profile={{
          displayName: peer.displayName,
          photoURL: peer.photoURL,
          avatarSource: peer.photoURL ? "custom" : "initials",
          privacySettings: { showPhotoOnPosts: true } as never,
        }}
        authPhotoURL={null}
        size={44}
      />
      <span className="tj-messages-row__body">
        <span className="tj-messages-row__name">{peer.displayName || "…"}</span>
        <span className="tj-messages-row__preview">{thread.lastPreview || "—"}</span>
      </span>
      <span className="tj-messages-row__meta">
        <span className="tj-messages-row__time">{timeAgo(thread.lastMessageAt)}</span>
        {thread.unreadCount > 0 ? (
          <span className="tj-messages-row__badge">{thread.unreadCount}</span>
        ) : null}
      </span>
    </button>
  );
}

function RequestRow({
  thread,
  onOpenChat,
}: {
  thread: TrafficThreadSummary;
  onOpenChat: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const peer = usePeerProfile(thread.peerUid);

  return (
    <div className="tj-messages-request-row">
      <button type="button" className="tj-messages-row" onClick={onOpenChat}>
        <UserAvatar
          profile={{
            displayName: peer.displayName,
            photoURL: peer.photoURL,
            avatarSource: peer.photoURL ? "custom" : "initials",
            privacySettings: { showPhotoOnPosts: true } as never,
          }}
          authPhotoURL={null}
          size={44}
        />
        <span className="tj-messages-row__body">
          <span className="tj-messages-row__name">{peer.displayName || "…"}</span>
          <span className="tj-messages-row__preview">{thread.lastPreview || "—"}</span>
        </span>
        <span className="tj-messages-row__time">{timeAgo(thread.lastMessageAt)}</span>
      </button>
      <div className="tj-messages-request-actions">
        <button
          type="button"
          className="tj-btn tj-btn--primary tj-btn--compact"
          disabled={!user?.uid}
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
          disabled={!user?.uid}
          onClick={() =>
            user?.uid &&
            void deleteMessageRequest(user.uid, thread.conversationId)
          }
        >
          {t("messages.decline")}
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          disabled={!user?.uid}
          onClick={() =>
            user?.uid && void blockUser(user.uid, thread.peerUid)
          }
        >
          {t("messages.block")}
        </button>
      </div>
    </div>
  );
}

export default function TrafficMessagesSheet({
  onClose,
  onOpenChat,
  inbox,
  requests,
  loadFailed,
  lastError,
}: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("inbox");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (loadFailed && lastError && import.meta.env.DEV) {
      console.error("[TrafficMessages] inbox load failed", {
        code: lastError.code,
        message: lastError.message,
      });
    }
  }, [loadFailed, lastError]);

  const peerUids = useMemo(() => inbox.map((t) => t.peerUid), [inbox]);
  const peerLabels = usePeerSearchLabels(peerUids);

  const filteredInbox = useMemo(
    () => filterInboxBySearch(inbox, search, peerLabels),
    [inbox, search, peerLabels]
  );

  const showInbox = view === "inbox";
  const showSearch = inbox.length > 0;

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("messages.title")}</h2>
          <button
            type="button"
            className="tj-icon-btn"
            onClick={() => {
              if (import.meta.env.DEV) {
                console.debug("[TrafficMessages] close pressed");
              }
              onClose();
            }}
          >
            {t("common.close")}
          </button>
        </div>

        {showInbox ? (
          <>
            <button
              type="button"
              className="tj-messages-requests-link tj-messages-requests-link--compact"
              onClick={() => setView("requests")}
            >
              <span>{t("messages.requests")}</span>
              <span className="tj-messages-requests-link__meta">
                {requests.length > 0 ? requests.length : null}
                <span aria-hidden> ›</span>
              </span>
            </button>

            {showSearch ? (
              <label className="tj-messages-search">
                <span className="tj-sr-only">{t("messages.search")}</span>
                <input
                  className="tj-input"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("messages.searchPlaceholder")}
                />
              </label>
            ) : null}

            {loadFailed ? (
              <p className="tj-error">{t("errors.loadFailed")}</p>
            ) : null}

            {!loadFailed && inbox.length === 0 ? (
              <div className="tj-messages-empty">
                <p className="tj-messages-empty__title">{t("messages.emptyInbox")}</p>
                <p className="tj-hint">{t("messages.emptyInboxHint")}</p>
              </div>
            ) : null}

            {!loadFailed && inbox.length > 0 && filteredInbox.length === 0 ? (
              <p className="tj-hint">{t("messages.searchNoResults")}</p>
            ) : null}

            {!loadFailed
              ? filteredInbox.map((thread) => (
                  <InboxRow
                    key={thread.conversationId}
                    thread={thread}
                    onOpen={() => onOpenChat(thread)}
                  />
                ))
              : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact tj-messages-back"
              onClick={() => setView("inbox")}
            >
              {t("common.back")}
            </button>
            <h3 className="tj-profile-section__subtitle">{t("messages.requests")}</h3>
            {loadFailed ? (
              <p className="tj-error">{t("errors.loadFailed")}</p>
            ) : requests.length === 0 ? (
              <p className="tj-hint">{t("messages.emptyRequests")}</p>
            ) : (
              requests.map((thread) => (
                <RequestRow
                  key={thread.conversationId}
                  thread={thread}
                  onOpenChat={() => onOpenChat(thread)}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
