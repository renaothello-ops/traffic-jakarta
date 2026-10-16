import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { timeAgo } from "../../assets/lib/timeAgo";
import type { LocalTrafficNotification } from "../../assets/lib/localTrafficNotifications";
import {
  isCommunityNotification,
  isTrafficNotification,
  isUnread,
  type UnifiedNotification,
} from "../../assets/lib/unifiedNotifications";
import {
  IconCheck,
  IconConstruction,
  IconDroplets,
  IconMapPin,
  IconMessageCircle,
  IconTraffic,
  IconTriangleAlert,
} from "../icons/AppIcons";

type Props = {
  items: UnifiedNotification[];
  onClose: () => void;
  onMarkRead: (n: UnifiedNotification) => void;
  onMarkAllRead: () => void;
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (uid: string) => void;
  onOpenTraffic?: (alert: LocalTrafficNotification) => void;
  onViewTrafficDetails?: (alert: LocalTrafficNotification) => void;
};

function trafficIcon(alert: LocalTrafficNotification) {
  switch (alert.kind) {
    case "flood":
      return <IconDroplets size={20} className="tj-notification-card__icon" />;
    case "accident":
    case "major_incident":
      return <IconTriangleAlert size={20} className="tj-notification-card__icon" />;
    case "construction":
      return <IconConstruction size={20} className="tj-notification-card__icon" />;
    case "heavy_traffic":
    case "worsening":
      return <IconTraffic size={20} className="tj-notification-card__icon" />;
    default:
      return <IconMapPin size={20} className="tj-notification-card__icon" />;
  }
}

function communityIcon(type: string) {
  if (type === "vote_on_post") {
    return <IconCheck size={20} className="tj-notification-card__icon" />;
  }
  return <IconMessageCircle size={20} className="tj-notification-card__icon" />;
}

function NotificationRow({
  n,
  onMarkRead,
  onOpenPost,
  onOpenProfile,
  onOpenTraffic,
  onViewTrafficDetails,
}: {
  n: UnifiedNotification;
  onMarkRead: (n: UnifiedNotification) => void;
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (uid: string) => void;
  onOpenTraffic?: (alert: LocalTrafficNotification) => void;
  onViewTrafficDetails?: (alert: LocalTrafficNotification) => void;
}) {
  const { t } = useTranslation();
  const unread = isUnread(n);

  if (n.source === "local") {
    const alert = n.item;
    return (
      <li className="tj-notification-card-wrap">
        <button
          type="button"
          className={`tj-notification-card${unread ? " tj-notification-card--unread" : ""}`}
          onClick={() => {
            void onMarkRead(n);
            onOpenTraffic?.(alert);
          }}
        >
          {trafficIcon(alert)}
          <div className="tj-notification-card__body">
            <p className="tj-notification-card__title">{t(alert.titleKey)}</p>
            {alert.subtitleKey ? (
              <p className="tj-notification-card__subtitle">
                {t(alert.subtitleKey, alert.subtitleParams ?? {})}
              </p>
            ) : null}
            <p className="tj-notification-card__meta">
              {timeAgo(alert.createdAt)}
              {alert.bodyKey ? (
                <>
                  {" · "}
                  {t(alert.bodyKey, alert.bodyParams ?? {})}
                </>
              ) : null}
            </p>
            {alert.sourceLineKey ? (
              <p className="tj-notification-card__hint">{t(alert.sourceLineKey)}</p>
            ) : null}
          </div>
          {unread ? <span className="tj-notification-card__dot" aria-hidden /> : null}
        </button>
        {onViewTrafficDetails ? (
          <button
            type="button"
            className="tj-notification-card__details-link"
            onClick={(e) => {
              e.stopPropagation();
              onViewTrafficDetails(alert);
            }}
          >
            {t("notifications.viewDetails")}
          </button>
        ) : null}
      </li>
    );
  }

  const item = n.item;
  return (
    <li>
      <button
        type="button"
        className={`tj-notification-card${unread ? " tj-notification-card--unread" : ""}`}
        onClick={() => {
          void onMarkRead(n);
          if (item.relatedProfileUid) onOpenProfile?.(item.relatedProfileUid);
          else if (item.relatedPostId) onOpenPost?.(item.relatedPostId);
        }}
      >
        {communityIcon(item.type)}
        <div className="tj-notification-card__body">
          <p className="tj-notification-card__title">
            {t(`notifications.types.${item.type}`)}
          </p>
          <p className="tj-notification-card__meta">
            {timeAgo(item.createdAt)} · {t(item.bodyKey, item.bodyParams ?? {})}
          </p>
        </div>
        {unread ? <span className="tj-notification-card__dot" aria-hidden /> : null}
      </button>
    </li>
  );
}

export default function NotificationCenterSheet({
  items,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onOpenPost,
  onOpenProfile,
  onOpenTraffic,
  onViewTrafficDetails,
}: Props) {
  const { t } = useTranslation();

  const { community, traffic } = useMemo(() => {
    const communityItems: UnifiedNotification[] = [];
    const trafficItems: UnifiedNotification[] = [];
    for (const n of items) {
      if (isTrafficNotification(n)) trafficItems.push(n);
      else if (isCommunityNotification(n)) communityItems.push(n);
      else communityItems.push(n);
    }
    return { community: communityItems, traffic: trafficItems };
  }, [items]);

  const unreadCount = items.filter(isUnread).length;

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("notifications.centerTitle")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {unreadCount > 0 ? (
          <button
            type="button"
            className="tj-btn tj-btn--ghost tj-btn--compact"
            onClick={() => void onMarkAllRead()}
          >
            {t("notifications.markAllRead")}
          </button>
        ) : null}

        {items.length === 0 ? (
          <p className="tj-hint">{t("notifications.empty")}</p>
        ) : (
          <>
            {traffic.length > 0 ? (
              <section className="tj-notification-section">
                <h3 className="tj-notification-section__title">
                  {t("notifications.sectionTraffic")}
                </h3>
                <ul className="tj-notification-list">
                  {traffic.map((n) => (
                    <NotificationRow
                      key={`${n.source}-${n.item.id}`}
                      n={n}
                      onMarkRead={onMarkRead}
                      onOpenPost={onOpenPost}
                      onOpenProfile={onOpenProfile}
                      onOpenTraffic={onOpenTraffic}
                      onViewTrafficDetails={onViewTrafficDetails}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {community.length > 0 ? (
              <section className="tj-notification-section">
                <h3 className="tj-notification-section__title">
                  {t("notifications.sectionCommunity")}
                </h3>
                <ul className="tj-notification-list">
                  {community.map((n) => (
                    <NotificationRow
                      key={`${n.source}-${n.item.id}`}
                      n={n}
                      onMarkRead={onMarkRead}
                      onOpenPost={onOpenPost}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
