import { useTranslation } from "react-i18next";
import { formatNotificationBadgeCount } from "../assets/lib/localTrafficNotifications";
import { IconBell } from "./icons/AppIcons";

type Props = {
  unreadCount: number;
  onClick: () => void;
  className?: string;
};

export default function MapNotificationBell({ unreadCount, onClick, className = "" }: Props) {
  const { t } = useTranslation();
  const badge = formatNotificationBadgeCount(unreadCount);

  return (
    <button
      type="button"
      className={`tj-notification-bell tj-map-notification-bell ${className}`.trim()}
      aria-label={t("notifications.centerTitle")}
      onClick={onClick}
    >
      <IconBell size={22} />
      {badge ? <span className="tj-notification-bell__badge">{badge}</span> : null}
    </button>
  );
}
