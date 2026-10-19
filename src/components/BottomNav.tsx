import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppTab } from "../types";
import { formatNotificationBadgeCount } from "../assets/lib/localTrafficNotifications";
import {
  IconNavMap,
  IconNavNearby,
  IconNavPlus,
  IconNavSend,
  IconUser,
} from "./icons/AppIcons";

type TabId = AppTab;

type Props = {
  activeTab: TabId;
  composerOpen: boolean;
  messagesOpen: boolean;
  messageUnreadCount: number;
  onSelectTab: (tab: TabId) => void;
  onPressPost: () => void;
  onPressMessages: () => void;
};

type NavItem =
  | { kind: "tab"; id: TabId; labelKey: string; Icon: typeof IconNavMap }
  | { kind: "post"; labelKey: string; Icon: typeof IconNavPlus }
  | { kind: "messages"; labelKey: string; Icon: typeof IconNavSend };

const NAV_ITEMS: NavItem[] = [
  { kind: "tab", id: "map", labelKey: "nav.map", Icon: IconNavMap },
  { kind: "tab", id: "comment", labelKey: "nav.nearby", Icon: IconNavNearby },
  { kind: "post", labelKey: "nav.post", Icon: IconNavPlus },
  { kind: "messages", labelKey: "nav.messages", Icon: IconNavSend },
  { kind: "tab", id: "profile", labelKey: "nav.profile", Icon: IconUser },
];

function isItemActive(
  item: NavItem,
  activeTab: TabId,
  composerOpen: boolean,
  messagesOpen: boolean
): boolean {
  if (item.kind === "tab") return activeTab === item.id;
  if (item.kind === "post") return composerOpen;
  if (item.kind === "messages") return messagesOpen;
  return false;
}

function BottomNavInner({
  activeTab,
  composerOpen,
  messagesOpen,
  messageUnreadCount,
  onSelectTab,
  onPressPost,
  onPressMessages,
}: Props) {
  const { t } = useTranslation();
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  /** Instant tab highlight while parent `activeTab` updates via startTransition. */
  const [optimisticTab, setOptimisticTab] = useState<TabId | null>(null);
  const messageBadge = formatNotificationBadgeCount(messageUnreadCount);

  useEffect(() => {
    if (optimisticTab != null && optimisticTab === activeTab) {
      setOptimisticTab(null);
    }
  }, [activeTab, optimisticTab]);

  const displayTab = optimisticTab ?? activeTab;

  const handlePointerDown = useCallback((key: string) => {
    setPressedKey(key);
  }, []);

  const clearPressed = useCallback(() => {
    setPressedKey(null);
  }, []);

  return (
    <nav className="tj-bottom-nav" aria-label={t("nav.mainAria")}>
      {NAV_ITEMS.map((item) => {
        const key =
          item.kind === "tab" ? `tab-${item.id}` : item.kind;
        const label = t(item.labelKey);
        const active = isItemActive(
          item,
          displayTab,
          composerOpen,
          messagesOpen
        );
        const pressed = pressedKey === key;
        const Icon = item.Icon;
        const isPost = item.kind === "post";

        return (
          <button
            key={key}
            type="button"
            className={[
              "tj-bottom-nav__btn",
              active ? "tj-bottom-nav__btn--active" : "",
              pressed ? "tj-bottom-nav__btn--pressed" : "",
              isPost ? "tj-bottom-nav__btn--post" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onPointerDown={() => handlePointerDown(key)}
            onPointerUp={clearPressed}
            onPointerLeave={clearPressed}
            onPointerCancel={clearPressed}
            onClick={() => {
              if (item.kind === "tab") {
                setOptimisticTab(item.id);
                onSelectTab(item.id);
              } else if (item.kind === "post") onPressPost();
              else onPressMessages();
            }}
          >
            <span className="tj-bottom-nav__icon-wrap" aria-hidden>
              <Icon
                size={isPost ? 26 : 24}
                className="tj-bottom-nav__icon"
              />
              {item.kind === "messages" && messageBadge ? (
                <span className="tj-bottom-nav__badge">{messageBadge}</span>
              ) : null}
            </span>
            <span className="tj-bottom-nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default memo(BottomNavInner);
