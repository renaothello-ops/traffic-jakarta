import type { PostType } from "../../types";

const STORAGE_KEY = "traffic_jakarta_local_traffic_notifications";
const DEDUPE_KEY = "traffic_jakarta_traffic_alert_dedupe";
const MAX_ITEMS = 50;
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

export type LocalTrafficAlertKind =
  | "worsening"
  | "major_incident"
  | "cluster"
  | "accident"
  | "flood"
  | "road_closed"
  | "construction"
  | "heavy_traffic";

export type LocalTrafficNotification = {
  id: string;
  kind: LocalTrafficAlertKind;
  dedupeKey: string;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  subtitleKey?: string;
  subtitleParams?: Record<string, string | number>;
  sourceLineKey?: string;
  lat: number;
  lng: number;
  relatedPostId?: string;
  dominantType?: PostType;
  reportCount?: number;
  clusterId?: string;
  createdAt: number;
  readAt: number | null;
};

type DedupeEntry = { key: string; at: number };

type Listener = () => void;

const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

function loadDedupe(): DedupeEntry[] {
  try {
    const raw = localStorage.getItem(DEDUPE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DedupeEntry[];
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    return parsed.filter((e) => e.at >= cutoff);
  } catch {
    return [];
  }
}

function saveDedupe(entries: DedupeEntry[]) {
  localStorage.setItem(DEDUPE_KEY, JSON.stringify(entries));
}

export function wasRecentlyDeduped(dedupeKey: string): boolean {
  return loadDedupe().some((e) => e.key === dedupeKey);
}

function recordDedupe(dedupeKey: string) {
  const entries = loadDedupe().filter((e) => e.key !== dedupeKey);
  entries.push({ key: dedupeKey, at: Date.now() });
  saveDedupe(entries.slice(-80));
}

function loadAll(): LocalTrafficNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalTrafficNotification[];
  } catch {
    return [];
  }
}

function saveAll(items: LocalTrafficNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  emit();
}

export function listenLocalTrafficNotifications(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLocalTrafficNotifications(): LocalTrafficNotification[] {
  return loadAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function addLocalTrafficNotification(
  input: Omit<LocalTrafficNotification, "id" | "createdAt" | "readAt">
): LocalTrafficNotification | null {
  if (wasRecentlyDeduped(input.dedupeKey)) return null;
  recordDedupe(input.dedupeKey);

  const item: LocalTrafficNotification = {
    ...input,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    readAt: null,
  };

  const next = [item, ...loadAll()].slice(0, MAX_ITEMS);
  saveAll(next);
  return item;
}

export function markLocalTrafficNotificationRead(id: string): void {
  const items = loadAll().map((n) =>
    n.id === id && n.readAt == null ? { ...n, readAt: Date.now() } : n
  );
  saveAll(items);
}

export function markAllLocalTrafficNotificationsRead(): void {
  const now = Date.now();
  saveAll(loadAll().map((n) => (n.readAt == null ? { ...n, readAt: now } : n)));
}

export function formatNotificationBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  if (count >= 10) return "9+";
  return String(count);
}

/** ~1.1 km grid at equator — stable dedupe bucket for alerts. */
export function locationDedupeBucket(lat: number, lng: number): string {
  return `${lat.toFixed(2)}:${lng.toFixed(2)}`;
}

export function timeBucket15Min(now = Date.now()): string {
  return String(Math.floor(now / (15 * 60 * 1000)));
}
