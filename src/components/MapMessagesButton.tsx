import { useTranslation } from "react-i18next";
import { formatNotificationBadgeCount } from "../assets/lib/localTrafficNotifications";
import { IconMessageCircle } from "./icons/AppIcons";

type Props = {
  unreadCount: number;
  onClick: () => void;
  className?: string;
};

export default function MapMessagesButton({
  unreadCount,
  onClick,
  className = "",
}: Props) {
  const { t } = useTranslation();
  const badge = formatNotificationBadgeCount(unreadCount);

  return (
    <button
      type="button"
      className={`tj-notification-bell tj-map-notification-bell ${className}`.trim()}
      aria-label={t("messages.openAria")}
      onClick={onClick}
    >
      <IconMessageCircle size={22} />
      {badge ? (
        <span className="tj-notification-bell__badge">{badge}</span>
      ) : null}
    </button>
  );
}
