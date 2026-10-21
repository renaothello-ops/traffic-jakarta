import { tomtomApiKey } from "./envSecrets.js";
import {
  bboxParam,
  centroidFromGeometry,
  computeTomTomSeverityScore,
  iconCategoryToLiveCategory,
  JAKARTA_INCIDENT_BBOX,
} from "./liveTrafficLogic.js";

export type TomTomNormalizedIncident = {
  id: string;
  category: string;
  severityScore: number;
  magnitudeOfDelay: number | null;
  delaySeconds: number | null;
  lengthMeters: number | null;
  roadName: string | null;
  placeName: string | null;
  lat: number;
  lng: number;
  summary: string | null;
  detailKnown: boolean;
  startedAt: string | null;
  lastUpdatedAt: string | null;
  timeValidity: string | null;
};

const FIELDS =
  "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity,lastReportTime,probabilityOfOccurrence}}}";

export function tomtomLanguageFromAppLanguage(lang: string | undefined): string {
  const raw = (lang ?? "en").trim();
  const map: Record<string, string> = {
    en: "en-GB",
    id: "id-ID",
    ja: "ja-JP",
    ko: "ko-KR",
    "zh-Hans": "zh-CN",
    "zh-Hant": "zh-TW",
    ms: "ms-MY",
    th: "th-TH",
    vi: "vi-VN",
    fil: "fil-PH",
    hi: "hi-IN",
    ar: "ar",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    pt: "pt-BR",
    it: "it-IT",
    ru: "ru-RU",
    tr: "tr-TR",
    nl: "nl-NL",
  };
  if (map[raw]) return map[raw];
  const base = raw.split("-")[0]?.toLowerCase() ?? "en";
  return map[base] ?? "en-GB";
}

function normalizeIncident(feature: Record<string, unknown>): TomTomNormalizedIncident | null {
  const props = feature.properties as Record<string, unknown> | undefined;
  const geometry = feature.geometry as Record<string, unknown> | undefined;
  if (!props?.id) return null;
  const center = centroidFromGeometry(geometry);
  if (!center) return null;

  const iconCategory = Number(props.iconCategory ?? 0);
  const events = (props.events as Array<{ description?: string }> | undefined) ?? [];
  const description = events.map((e) => e.description?.trim()).filter(Boolean).join(" · ");
  const from = typeof props.from === "string" ? props.from.trim() : "";
  const to = typeof props.to === "string" ? props.to.trim() : "";
  const roadNumbers = Array.isArray(props.roadNumbers)
    ? props.roadNumbers.filter((r) => typeof r === "string").join(", ")
    : "";

  let roadName = from || to || roadNumbers || null;
  if (from && to && from !== to) {
    roadName = `${from} → ${to}`;
  }

  const magnitudeOfDelay =
    props.magnitudeOfDelay != null ? Number(props.magnitudeOfDelay) : null;
  const delaySeconds = props.delay != null ? Number(props.delay) : null;
  const lengthMeters = props.length != null ? Number(props.length) : null;

  return {
    id: String(props.id),
    category: iconCategoryToLiveCategory(iconCategory),
    severityScore: computeTomTomSeverityScore({
      magnitudeOfDelay,
      delay: delaySeconds,
      length: lengthMeters,
    }),
    magnitudeOfDelay,
    delaySeconds,
    lengthMeters,
    roadName,
    placeName: roadName,
    lat: center.lat,
    lng: center.lng,
    summary: description || null,
    detailKnown: Boolean(description || roadName),
    startedAt: typeof props.startTime === "string" ? props.startTime : null,
    lastUpdatedAt:
      typeof props.lastReportTime === "string"
        ? props.lastReportTime
        : typeof props.startTime === "string"
          ? props.startTime
          : null,
    timeValidity: typeof props.timeValidity === "string" ? props.timeValidity : null,
  };
}

export type FetchTomTomIncidentsResult = {
  incidents: TomTomNormalizedIncident[];
  trafficModelId: string | null;
  httpStatus: number;
  errorMessage: string | null;
};

export async function fetchTomTomIncidentDetails(
  language: string
): Promise<FetchTomTomIncidentsResult> {
  const key = tomtomApiKey();
  if (!key) {
    return {
      incidents: [],
      trafficModelId: null,
      httpStatus: 503,
      errorMessage: "missing_tomtom_key",
    };
  }

  const bbox = bboxParam(JAKARTA_INCIDENT_BBOX);
  const lang = tomtomLanguageFromAppLanguage(language);
  const params = new URLSearchParams({
    key,
    bbox,
    fields: FIELDS,
    language: lang,
    timeValidityFilter: "present",
  });

  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  const trafficModelId = res.headers.get("TrafficModelID");
  const data = (await res.json().catch(() => ({}))) as {
    incidents?: Array<Record<string, unknown> | null>;
    detailedError?: { message?: string };
  };

  if (!res.ok) {
    return {
      incidents: [],
      trafficModelId,
      httpStatus: res.status,
      errorMessage:
        data.detailedError?.message ?? `TomTom incidentDetails HTTP ${res.status}`,
    };
  }

  const incidents = (data.incidents ?? [])
    .filter((f): f is Record<string, unknown> => f != null)
    .map(normalizeIncident)
    .filter((i): i is TomTomNormalizedIncident => i != null)
    .filter((i) => i.timeValidity !== "future");

  return {
    incidents,
    trafficModelId,
    httpStatus: res.status,
    errorMessage: null,
  };
}
