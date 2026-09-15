import type { ManeuverKind } from "../types";

type Props = {
  kind: ManeuverKind;
  className?: string;
};

export default function ManeuverIcon({ kind, className = "" }: Props) {
  return (
    <svg
      className={`tj-maneuver-icon ${className}`.trim()}
      viewBox="0 0 48 48"
      aria-hidden
    >
      <ManeuverPath kind={kind} />
    </svg>
  );
}

function ManeuverPath({ kind }: { kind: ManeuverKind }) {
  switch (kind) {
    case "left":
    case "sharp-left":
      return (
        <path
          d="M30 8 L30 24 L14 24 M14 24 L20 18 M14 24 L20 30"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "slight-left":
      return (
        <path
          d="M34 10 L34 26 L18 34 M18 34 L22 28 M18 34 L24 38"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "right":
    case "sharp-right":
      return (
        <path
          d="M18 8 L18 24 L34 24 M34 24 L28 18 M34 24 L28 30"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "slight-right":
      return (
        <path
          d="M14 10 L14 26 L30 34 M30 34 L26 28 M30 34 L24 38"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "u-turn":
      return (
        <path
          d="M24 8 L24 20 C24 30 36 30 36 20 L36 14 M36 14 L42 14 M36 14 L36 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "roundabout":
    case "roundabout-exit":
      return (
        <>
          <circle
            cx="24"
            cy="24"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            d="M24 8 L24 14 M34 24 L28 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      );
    case "arrive":
      return (
        <path
          d="M24 8 C18 8 14 14 14 20 C14 28 24 40 24 40 C24 40 34 28 34 20 C34 14 30 8 24 8 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      );
    case "exit":
    case "merge":
      return (
        <path
          d="M12 36 L24 12 L36 36 M20 28 L28 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    default:
      return (
        <path
          d="M24 8 L24 40 M18 34 L24 40 L30 34"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
  }
}
