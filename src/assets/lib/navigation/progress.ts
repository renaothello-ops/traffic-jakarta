import type { RouteInstruction } from "../../../types";
import type { RouteMatch } from "./geometry";

export type RouteProgress = {
  instructionIndex: number;
  current: RouteInstruction;
  next: RouteInstruction | null;
  distanceToManeuverM: number;
  distanceRemainingM: number;
  durationRemainingS: number;
  fractionComplete: number;
};

export function computeRouteProgress(
  instructions: RouteInstruction[],
  totalDistanceM: number,
  totalDurationS: number,
  match: RouteMatch
): RouteProgress {
  const distanceAlong = match.distanceAlongMeters;
  const safeTotal = Math.max(totalDistanceM, 1);

  let instructionIndex = 0;
  for (let i = instructions.length - 1; i >= 0; i--) {
    if (distanceAlong + 15 >= instructions[i].routeOffsetMeters) {
      instructionIndex = i;
      break;
    }
  }

  const current = instructions[instructionIndex] ?? instructions[0];
  const next = instructions[instructionIndex + 1] ?? null;
  const nextOffset = next?.routeOffsetMeters ?? totalDistanceM;
  const distanceToManeuverM = Math.max(0, nextOffset - distanceAlong);
  const distanceRemainingM = Math.max(0, totalDistanceM - distanceAlong);
  const fractionComplete = Math.min(1, distanceAlong / safeTotal);
  const durationRemainingS = Math.max(
    0,
    Math.round(totalDurationS * (1 - fractionComplete))
  );

  return {
    instructionIndex,
    current,
    next,
    distanceToManeuverM,
    distanceRemainingM,
    durationRemainingS,
    fractionComplete,
  };
}
