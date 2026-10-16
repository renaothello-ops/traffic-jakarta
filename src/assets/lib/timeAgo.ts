import { formatTimeAgo } from "../../i18n/formatters";

export function timeAgo(ts: number): string {
  return formatTimeAgo(ts);
}
