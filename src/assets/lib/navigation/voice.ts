import type { RouteInstruction } from "../../../types";
import { formatDistance } from "../geo";
import { maneuverLabel } from "./maneuvers";

type VoiceCue = {
  key: string;
  text: string;
};

let lastSpokenKey = "";
let lastSpokenAt = 0;

export function resetVoiceState(): void {
  lastSpokenKey = "";
  lastSpokenAt = 0;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakNavigation(text: string, key: string, muted: boolean): void {
  if (muted || !isSpeechSupported()) return;
  const now = Date.now();
  if (key === lastSpokenKey && now - lastSpokenAt < 12_000) return;

  lastSpokenKey = key;
  lastSpokenAt = now;

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

export function voiceCuesForProgress(
  instruction: RouteInstruction,
  distanceToManeuverM: number,
  arrived: boolean
): VoiceCue[] {
  if (arrived) {
    return [{ key: "arrive", text: "You have arrived." }];
  }

  const street = instruction.street ? ` onto ${instruction.street}` : "";
  const action = instruction.message || maneuverLabel(instruction.maneuver);

  const cues: VoiceCue[] = [];
  if (distanceToManeuverM <= 30 && instruction.maneuver !== "straight") {
    cues.push({ key: `now-${instruction.index}`, text: `${action}${street}.` });
  } else if (distanceToManeuverM <= 100) {
    cues.push({
      key: `100-${instruction.index}`,
      text: `In ${formatDistance(Math.round(distanceToManeuverM))}, ${action.toLowerCase()}${street}.`,
    });
  } else if (distanceToManeuverM <= 500) {
    cues.push({
      key: `500-${instruction.index}`,
      text: `In ${formatDistance(Math.round(distanceToManeuverM))}, ${action.toLowerCase()}${street}.`,
    });
  }
  return cues;
}
