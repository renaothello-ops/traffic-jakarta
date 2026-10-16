import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { NotificationSettings, UserProfile } from "../../types";
import { saveNotificationSettings } from "../../assets/lib/userProfile";
import {
  getPushRegistrationState,
  requestBrowserNotificationPermission,
} from "../../assets/lib/pushNotifications";

const SMART_TRAFFIC_KEY = "traffic_jakarta_smart_traffic";

type Props = {
  profile: UserProfile;
  onClose: () => void;
};

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="tj-toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function NotificationSettingsSheet({ profile, onClose }: Props) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotificationSettings>(
    profile.notificationSettings
  );
  const [saving, setSaving] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const patch = (partial: Partial<NotificationSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveNotificationSettings(profile.uid, settings);
      localStorage.setItem(SMART_TRAFFIC_KEY, settings.trafficAlerts ? "1" : "0");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    const state = getPushRegistrationState();
    if (state === "unsupported") {
      setPushMsg(t("notifications.push.unsupported"));
      return;
    }
    const perm = await requestBrowserNotificationPermission();
    if (perm === "granted") {
      patch({ pushEnabled: true });
      setPushMsg(null);
    } else {
      setPushMsg(t("notifications.push.denied"));
      patch({ pushEnabled: false });
    }
  };

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("notifications.title")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        <Toggle
          label={t("notifications.master")}
          checked={settings.master}
          onChange={(v) => patch({ master: v })}
        />
        <Toggle
          label={t("notifications.trafficAlerts")}
          checked={settings.trafficAlerts}
          disabled={!settings.master}
          onChange={(v) => patch({ trafficAlerts: v })}
        />
        <p className="tj-hint">{t("settings.trafficAlertsHint")}</p>
        <Toggle
          label={t("notifications.commentsOnMyPosts")}
          checked={settings.commentsOnMyPosts}
          disabled={!settings.master}
          onChange={(v) => patch({ commentsOnMyPosts: v })}
        />
        <Toggle
          label={t("notifications.votesOnMyPosts")}
          checked={settings.votesOnMyPosts}
          disabled={!settings.master}
          onChange={(v) => patch({ votesOnMyPosts: v })}
        />
        <Toggle
          label={t("notifications.nearbyAlerts")}
          checked={settings.nearbyAlerts}
          disabled={!settings.master}
          onChange={(v) => patch({ nearbyAlerts: v })}
        />
        <Toggle
          label={t("notifications.accidents")}
          checked={settings.accidents}
          disabled={!settings.master}
          onChange={(v) => patch({ accidents: v })}
        />
        <Toggle
          label={t("notifications.floods")}
          checked={settings.floods}
          disabled={!settings.master}
          onChange={(v) => patch({ floods: v })}
        />
        <Toggle
          label={t("notifications.roadClosures")}
          checked={settings.roadClosures}
          disabled={!settings.master}
          onChange={(v) => patch({ roadClosures: v })}
        />
        <Toggle
          label={t("notifications.sound")}
          checked={settings.sound}
          disabled={!settings.master}
          onChange={(v) => patch({ sound: v })}
        />

        <div className="tj-profile-section">
          <p className="tj-hint">{t("notifications.pushExplain")}</p>
          <button
            type="button"
            className="tj-btn tj-btn--ghost"
            onClick={() => void enablePush()}
          >
            {t("notifications.enablePush")}
          </button>
          {pushMsg ? <p className="tj-hint">{pushMsg}</p> : null}
        </div>

        <button
          type="button"
          className="tj-btn tj-btn--primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? t("common.loading") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
