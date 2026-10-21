import type { RouteInstruction } from "../../../types";
import type { RouteProgress } from "./progress";
import { formatDistance } from "../geo";

type VoiceCue = {
  key: string;
  text: string;
};

export type NavVoiceT = (
  key: string,
  options?: { defaultValue?: string; [key: string]: unknown }
) => string;

let lastSpokenKey = "";
let lastSpokenAt = 0;
let lastSpokenText = "";
let speechUnlocked = false;
let lastSpeechError: string | null = null;

const REPEAT_COOLDOWN_MS = 12_000;

const SPEECH_LOCALE_BY_UI: Record<string, string> = {
  ja: "ja-JP",
  id: "id-ID",
  en: "en-US",
};

export function resetVoiceState(): void {
  lastSpokenKey = "";
  lastSpokenAt = 0;
  lastSpokenText = "";
  lastSpeechError = null;
}

export function getLastSpeechError(): string | null {
  return lastSpeechError;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isSpeechUnlocked(): boolean {
  return speechUnlocked;
}

/** Call from a user gesture (tap) before first speak — satisfies mobile autoplay policies. */
export function unlockSpeechFromUserGesture(): void {
  if (!isSpeechSupported()) return;
  speechUnlocked = true;
  lastSpeechError = null;
  window.speechSynthesis.getVoices();
  const warmup = new SpeechSynthesisUtterance(" ");
  warmup.volume = 0.01;
  warmup.lang = "en-US";
  warmup.onerror = () => {
    lastSpeechError = "speech-failed";
  };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(warmup);
}

export function speechLocaleFromUiLanguage(language: string): string {
  const base = language.split("-")[0]?.toLowerCase() ?? "en";
  return SPEECH_LOCALE_BY_UI[base] ?? language;
}

export function speakNavigation(
  text: string,
  key: string,
  muted: boolean,
  language: string,
  options?: { force?: boolean; skipUnlockCheck?: boolean }
): void {
  if (muted || !isSpeechSupported() || !text.trim()) return;
  if (!options?.skipUnlockCheck && !speechUnlocked) {
    lastSpeechError = "speech-not-unlocked";
    return;
  }
  const now = Date.now();
  if (!options?.force && key === lastSpokenKey && now - lastSpokenAt < REPEAT_COOLDOWN_MS) {
    return;
  }

  lastSpokenKey = key;
  lastSpokenAt = now;
  lastSpokenText = text;
  lastSpeechError = null;

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  utter.lang = speechLocaleFromUiLanguage(language);
  utter.onerror = () => {
    lastSpeechError = "speech-failed";
  };
  window.speechSynthesis.speak(utter);
}

function maneuverAction(instruction: RouteInstruction, t: NavVoiceT): string {
  if (instruction.message?.trim()) return instruction.message.trim();
  return t(`maneuvers.${instruction.maneuver}`, {
    defaultValue: t("maneuvers.unknown"),
  });
}

function streetSuffix(instruction: RouteInstruction, t: NavVoiceT): string {
  if (!instruction.street?.trim()) return "";
  return t("nav.voiceOntoStreet", { street: instruction.street });
}

export function voiceTextForProgress(
  progress: RouteProgress | null,
  hasArrived: boolean,
  t: NavVoiceT
): string | null {
  if (hasArrived) return t("nav.arrived");
  if (!progress?.current) return null;
  const action = maneuverAction(progress.current, t);
  const onto = streetSuffix(progress.current, t);
  const dist = progress.distanceToManeuverM;
  if (dist <= 30 && progress.current.maneuver !== "straight") {
    return t("nav.voiceNow", { action, street: onto });
  }
  return t("nav.voiceIn", {
    distance: formatDistance(Math.round(dist)),
    action,
    street: onto,
  });
}

export function repeatLastVoice(
  muted: boolean,
  language: string,
  fallbackText: string | null
): boolean {
  if (muted || !isSpeechSupported()) return false;
  if (!speechUnlocked) {
    unlockSpeechFromUserGesture();
  }
  const text = lastSpokenText || fallbackText;
  if (!text?.trim()) return false;
  speakNavigation(text, `repeat-${Date.now()}`, false, language, {
    force: true,
    skipUnlockCheck: true,
  });
  return true;
}

export function voiceCuesForProgress(
  instruction: RouteInstruction,
  distanceToManeuverM: number,
  arrived: boolean,
  t: NavVoiceT
): VoiceCue[] {
  if (arrived) {
    return [{ key: "arrive", text: t("nav.arrived") }];
  }

  const action = maneuverAction(instruction, t);
  const onto = streetSuffix(instruction, t);

  const cues: VoiceCue[] = [];
  if (distanceToManeuverM <= 30 && instruction.maneuver !== "straight") {
    cues.push({
      key: `now-${instruction.index}`,
      text: t("nav.voiceNow", { action, street: onto }),
    });
  } else if (distanceToManeuverM <= 100) {
    cues.push({
      key: `100-${instruction.index}`,
      text: t("nav.voiceIn", {
        distance: formatDistance(Math.round(distanceToManeuverM)),
        action,
        street: onto,
      }),
    });
  } else if (distanceToManeuverM <= 500) {
    cues.push({
      key: `500-${instruction.index}`,
      text: t("nav.voiceIn", {
        distance: formatDistance(Math.round(distanceToManeuverM)),
        action,
        street: onto,
      }),
    });
  }
  return cues;
}

/** Skip turn announcements when GPS is stale or very inaccurate. */
export function shouldAnnounceVoice(
  accuracy: number | null | undefined,
  timestampMs: number | null | undefined
): boolean {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return false;
  if (Date.now() - timestampMs > 20_000) return false;
  if (accuracy != null && accuracy > 120) return false;
  return true;
}
