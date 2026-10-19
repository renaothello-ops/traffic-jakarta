import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string };

const defaults = { size: 18, className: "" };

function Svg({
  children,
  size = 18,
  className = "",
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconUser(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

export function IconAtSign(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </Svg>
  );
}

export function IconPencil(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}

export function IconBell(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

export function IconCheck(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function IconGlobe(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  );
}

export function IconShield(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  );
}

export function IconLogOut(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  );
}

export function IconTrash(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

export function IconMessageCircle(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Svg>
  );
}

export function IconShare(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </Svg>
  );
}

export function IconThumbsUp(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </Svg>
  );
}

export function IconTriangleAlert(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function IconDroplets(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
    </Svg>
  );
}

export function IconConstruction(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <rect x="2" y="6" width="20" height="8" rx="1" />
      <path d="M17 14v7" />
      <path d="M7 14v7" />
      <path d="M17 3v3" />
      <path d="M7 3v3" />
      <path d="M10 14 2.3 6.3" />
      <path d="m14 6 7.7 7.7" />
      <path d="m8 6 8 8" />
    </Svg>
  );
}

export function IconMapPin(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

/** Bottom nav — folded map */
export function IconNavMap(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M8 6v12" />
      <path d="M16 6v12" />
      <path d="M8 6l8-2v12l-8 2V6z" />
    </Svg>
  );
}

/** Bottom nav — nearby / feed */
export function IconNavNearby(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Svg>
  );
}

/** Bottom nav — create post */
export function IconNavPlus(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

/** Bottom nav — direct messages */
export function IconX(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Svg>
  );
}

export function IconSearch(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function IconNavSend(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Svg>
  );
}

export function IconTraffic(props: IconProps = defaults) {
  return (
    <Svg {...props}>
      <path d="M10 6V4a2 2 0 0 1 4 0v2" />
      <path d="M7 10h10" />
      <path d="M8 10v10" />
      <path d="M16 10v10" />
      <rect x="5" y="10" width="14" height="12" rx="2" />
    </Svg>
  );
}
