import type { ManeuverKind } from "../../../types";

/** Map TomTom maneuver codes to app-owned maneuver kinds. */
export function mapTomTomManeuver(maneuver?: string): ManeuverKind {
  const m = (maneuver ?? "").toUpperCase();
  if (!m || m === "STRAIGHT") return "straight";
  if (m === "DEPART" || m === "ENTER_MOTORWAY" || m === "ENTER_FREEWAY") return "depart";
  if (m === "ARRIVE" || m === "ARRIVE_LEFT" || m === "ARRIVE_RIGHT") return "arrive";
  if (m.includes("ROUNDABOUT") && m.includes("EXIT")) return "roundabout-exit";
  if (m.includes("ROUNDABOUT")) return "roundabout";
  if (m.includes("UTURN") || m.includes("U_TURN")) return "u-turn";
  if (m.includes("SHARP") && m.includes("LEFT")) return "sharp-left";
  if (m.includes("SHARP") && m.includes("RIGHT")) return "sharp-right";
  if (m.includes("BEAR") && m.includes("LEFT")) return "slight-left";
  if (m.includes("BEAR") && m.includes("RIGHT")) return "slight-right";
  if (m.includes("SLIGHT") && m.includes("LEFT")) return "slight-left";
  if (m.includes("SLIGHT") && m.includes("RIGHT")) return "slight-right";
  if (m.includes("TURN") && m.includes("LEFT")) return "left";
  if (m.includes("TURN") && m.includes("RIGHT")) return "right";
  if (m.includes("MERGE")) return "merge";
  if (m.includes("EXIT") || m.includes("RAMP")) return "exit";
  if (m.includes("KEEP")) return "keep";
  return "unknown";
}

export function maneuverLabel(kind: ManeuverKind): string {
  switch (kind) {
    case "depart":
      return "Head out";
    case "straight":
      return "Continue straight";
    case "slight-left":
      return "Bear left";
    case "slight-right":
      return "Bear right";
    case "left":
      return "Turn left";
    case "right":
      return "Turn right";
    case "sharp-left":
      return "Sharp left";
    case "sharp-right":
      return "Sharp right";
    case "u-turn":
      return "Make a U-turn";
    case "roundabout":
      return "Enter roundabout";
    case "roundabout-exit":
      return "Take exit";
    case "merge":
      return "Merge";
    case "exit":
      return "Take exit";
    case "keep":
      return "Keep going";
    case "arrive":
      return "You have arrived";
    default:
      return "Continue";
  }
}
