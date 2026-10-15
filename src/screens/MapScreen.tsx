import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";

import type {
  AppTab,
  CommunityRoad,
  Destination,
  DraftState,
  FloodDepth,
  FloodVehicleAccess,
  Post,
  PostType,
  RoadAccess,
  RoutePlan,
} from "../types";
import {
  createPost,
  createPostErrorMessage,
  listenActivePosts,
  updatePost,
  deletePost,
  updatePostLocation,
} from "../assets/lib/posts";
import {
  createCommunityRoad,
  listenCommunityRoads,
} from "../assets/lib/communityRoads";
import {
  fetchPlaceDetails,
  formatSuggestionDistance,
  PlacesSearchUnavailableError,
  resetPlacesSession,
  suggest,
  type SearchContext,
  type Suggestion,
} from "../assets/lib/search";
import { calculateRoute, getRouteBounds } from "../assets/lib/routing";
import { isMinePost } from "../assets/lib/identity";
import { normalizePostType, REPORT_TYPE_META } from "../assets/lib/reportTypes";
import { resolveQuickReportLocation } from "../assets/lib/quickReportLocation";
import { useNavigationRouteWarnings } from "../hooks/useNavigationRouteWarnings";
import { useEnsureTrafficJakartaLayerOrder } from "../hooks/useEnsureTrafficJakartaLayerOrder";
import {
  loadMapViewMode,
  saveMapViewMode,
  type MapViewMode,
} from "../assets/lib/mapViewMode";
import { applyMapViewMode, setBuildingExtrusionVisible } from "../assets/lib/mapViewApply";
import { CURRENT_LOCATION_FOCUS_ZOOM } from "../assets/lib/mapCameraConfig";
import {
  requestManualTomTomTrafficRefresh,
  trafficRefreshDiagnostics,
} from "../assets/lib/trafficRefresh";
import MapViewModeToggle from "../components/MapViewModeToggle";
import { requestCurrentPosition } from "../assets/lib/geolocation";
import { getBaseMapStyleUrl } from "../assets/lib/baseMap";
import { auth } from "../assets/lib/firebase";
import {
  consumeAuthReturnState,
  saveAuthReturnState,
} from "../assets/lib/authReturnState";
import { useAuth } from "../contexts/useAuth";
import { useTomTomTrafficLayer } from "../hooks/useTomTomTrafficLayer";
import { useMapStyleDataSync } from "../hooks/useMapStyleDataSync";
import { useEnrichedCommunityRoads } from "../hooks/useEnrichedCommunityRoads";
import { useEnrichedPosts } from "../hooks/useEnrichedPosts";
import { isHiddenFromPublicFeed } from "../assets/lib/trust";
import {
  ensureTrafficJakartaLayerOrder,
  safeGetSource,
  safeRemoveLayer,
  safeRemoveSource,
} from "../assets/lib/trafficLayer";

import PostMarker from "../components/PostMarker";
import PostComposer from "../components/PostComposer";
import PostBottomSheet from "../components/PostBottomSheet";
import CommentPanel from "../components/CommentPanel";
import ProfilePanel from "../components/ProfilePanel";
import BottomNav from "../components/BottomNav";
import EditPostSheet from "../components/EditPostSheet";
import Toast from "../components/Toast";
import CommunityRoadLayer from "../components/CommunityRoadLayer";
import CommunityRoadComposer from "../components/CommunityRoadComposer";
import RouteLayer from "../components/RouteLayer";
import CurrentLocationMarker from "../components/CurrentLocationMarker";
import RouteBottomSheet from "../components/RouteBottomSheet";
import DestinationBottomSheet from "../components/DestinationBottomSheet";
import NavigationHud from "../components/NavigationHud";
import QuickReportSheet from "../components/QuickReportSheet";
import NavRouteReportBanner from "../components/NavRouteReportBanner";
import TrafficIntelligenceDevPanel from "../components/TrafficIntelligenceDevPanel";
import { useNavigation } from "../hooks/useNavigation";

const JAKARTA = { lat: -6.2, lng: 106.8 };
const DRAFT_STORAGE_KEY = "traffic_jakarta_draft";
const SELECTED_POST_KEY = "traffic_jakarta_selected_post";
const FILTER_KEY = "traffic_jakarta_filter";

function loadSelectedPostFromStorage(): Post | null {
  const raw = localStorage.getItem(SELECTED_POST_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Post;
    if (!parsed?.id) return null;

    return {
      ...parsed,
      type: normalizePostType(String(parsed.type ?? "other")),
    };
  } catch {
    localStorage.removeItem(SELECTED_POST_KEY);
    return null;
  }
}

function buildComposerDraft(
  saved: DraftState | null,
  fallbackPos: { lat: number; lng: number }
): DraftState {
  if (saved) {
    return {
      type: saved.type ?? "heavy_traffic",
      text: saved.text ?? "",
      image: saved.image ?? null,
      draftPos: saved.draftPos ?? fallbackPos,
      locationConfirmed: saved.locationConfirmed ?? false,
      floodDepth: saved.floodDepth ?? "unknown",
      floodVehicleAccess: saved.floodVehicleAccess ?? "not_passable",
    };
  }

  return {
    type: "heavy_traffic",
    text: "",
    image: null,
    draftPos: fallbackPos,
    locationConfirmed: false,
    floodDepth: "unknown",
    floodVehicleAccess: "not_passable",
  };
}

export default function MapScreen() {
  const mapRef = useRef<MapRef | null>(null);
  const { user, loading: authLoading, signIn } = useAuth();
  const pendingPostIdRef = useRef<string | null>(null);
  const returnStateRestoredRef = useRef(false);

  const [activeTab, setActiveTab] = useState<AppTab>("map");
  const [posts, setPosts] = useState<Post[]>([]);
  const [communityRoads, setCommunityRoads] = useState<CommunityRoad[]>([]);
  const enrichedCommunityRoads = useEnrichedCommunityRoads(communityRoads);
  const enrichedPosts = useEnrichedPosts(posts);
  const [filterMin, setFilterMin] = useState<number>(() => {
    const saved = localStorage.getItem(FILTER_KEY);
    return saved ? Number(saved) : 10;
  });

  const [center, setCenter] = useState(JAKARTA);
  const [zoom, setZoom] = useState(15);

  const [openComposer, setOpenComposer] = useState(false);
  const [type, setType] = useState<PostType>("heavy_traffic");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [draftPos, setDraftPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [floodDepth, setFloodDepth] = useState<FloodDepth>("unknown");
  const [floodVehicleAccess, setFloodVehicleAccess] =
    useState<FloodVehicleAccess>("not_passable");
  const [submitting, setSubmitting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimer = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);
  const initialFlyDoneRef = useRef(false);
  const pendingFlyRef = useRef<{ lat: number; lng: number; zoom: number } | null>(
    null
  );
  const baseMapStyleUrl = useMemo(() => getBaseMapStyleUrl(), []);

  const searchContext = useMemo<SearchContext>(
    () => ({
      originLat: myPos?.lat ?? null,
      originLng: myPos?.lng ?? null,
      mapCenterLat: center.lat,
      mapCenterLng: center.lng,
    }),
    [myPos, center.lat, center.lng]
  );

  const [editing, setEditing] = useState<Post | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState<PostType>("heavy_traffic");
  const [editFloodDepth, setEditFloodDepth] = useState<FloodDepth>("unknown");
  const [editFloodVehicleAccess, setEditFloodVehicleAccess] =
    useState<FloodVehicleAccess>("not_passable");

  const [selectedPost, setSelectedPost] = useState<Post | null>(
    loadSelectedPostFromStorage
  );

  const visibleMapPosts = useMemo(() => {
    const selectedId = selectedPost?.id;
    return enrichedPosts.filter(
      (p) =>
        !isHiddenFromPublicFeed(p.trustLevel) || p.id === selectedId
    );
  }, [enrichedPosts, selectedPost?.id]);

  const feedPosts = useMemo(
    () => enrichedPosts.filter((p) => !isHiddenFromPublicFeed(p.trustLevel)),
    [enrichedPosts]
  );

  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>(() =>
    loadMapViewMode()
  );
  const [toast, setToast] = useState<string | null>(null);
  const [quickReportOpen, setQuickReportOpen] = useState(false);
  const [quickReportSubmitting, setQuickReportSubmitting] = useState(false);
  const [quickReportError, setQuickReportError] = useState<string | null>(null);

  const [roadMode, setRoadMode] = useState(false);
  const [roadPoints, setRoadPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [roadComposerOpen, setRoadComposerOpen] = useState(false);
  const [roadName, setRoadName] = useState("");
  const [roadDescription, setRoadDescription] = useState("");
  const [roadAccess, setRoadAccess] = useState<RoadAccess>("private");
  const [roadImage, setRoadImage] = useState<string | null>(null);
  const [roadSubmitting, setRoadSubmitting] = useState(false);
  const [roadError, setRoadError] = useState<string | null>(null);

  const [destination, setDestination] = useState<Destination | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [destPickMode, setDestPickMode] = useState(false);
  const [postsLoadError, setPostsLoadError] = useState<string | null>(null);
  const [roadsLoadError, setRoadsLoadError] = useState<string | null>(null);
  const firestoreError = postsLoadError ?? roadsLoadError;

  useEffect(() => {
    let active = true;

    const unsub = listenActivePosts(
      filterMin,
      (next) => {
        if (!active) return;
        setPosts(next);
        setPostsLoadError(null);
      },
      (message) => {
        if (!active) return;
        setPostsLoadError(message);
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, [filterMin]);

  useEffect(() => {
    let active = true;

    const unsub = listenCommunityRoads(
      (next) => {
        if (!active) return;
        setCommunityRoads(next);
        setRoadsLoadError(null);
      },
      (message) => {
        if (!active) return;
        setRoadsLoadError(message);
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, String(filterMin));
  }, [filterMin]);

  useEffect(() => {
    if (selectedPost) {
      localStorage.setItem(SELECTED_POST_KEY, JSON.stringify(selectedPost));
    } else {
      localStorage.removeItem(SELECTED_POST_KEY);
    }
  }, [selectedPost]);

  useEffect(() => {
    if (!selectedPost) return;
    const found = posts.find((p) => p.id === selectedPost.id);
    if (found) setSelectedPost(found);
    else setSelectedPost(null);
  }, [posts, selectedPost?.id]);

  useEffect(() => {
    if (authLoading || returnStateRestoredRef.current) return;

    const returnState = consumeAuthReturnState();
    returnStateRestoredRef.current = true;
    if (!returnState) return;

    setActiveTab(returnState.activeTab);

    if (returnState.selectedPostId) {
      pendingPostIdRef.current = returnState.selectedPostId;
    }

    if (returnState.openComposer && returnState.draft && user) {
      const draft = returnState.draft;
      setType(draft.type);
      setText(draft.text);
      setImage(draft.image);
      setDraftPos(draft.draftPos);
      setLocationConfirmed(draft.locationConfirmed);
      setFloodDepth(draft.floodDepth ?? "unknown");
      setFloodVehicleAccess(draft.floodVehicleAccess ?? "not_passable");
      setComposerError(null);
      setRoadMode(false);
      setRoadPoints([]);
      setOpenComposer(true);
    }
  }, [authLoading, user]);

  useEffect(() => {
    const postId = pendingPostIdRef.current;
    if (!postId) return;
    const post = posts.find((p) => p.id === postId);
    if (post) {
      setSelectedPost(post);
      pendingPostIdRef.current = null;
    }
  }, [posts]);

  useEffect(() => {
    if (!openComposer) return;
    const draft: DraftState = {
      type,
      text,
      image,
      draftPos,
      locationConfirmed,
      floodDepth,
      floodVehicleAccess,
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    openComposer,
    type,
    text,
    image,
    draftPos,
    locationConfirmed,
    floodDepth,
    floodVehicleAccess,
  ]);

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchAbortRef.current?.abort();

    const q = searchText.trim();
    if (!q) {
      setSuggestions([]);
      setShowSug(false);
      setSearchLoading(false);
      setSearchError(null);
      resetPlacesSession();
      return;
    }

    setShowSug(true);
    searchTimer.current = window.setTimeout(async () => {
      const requestId = ++searchRequestIdRef.current;
      const ac = new AbortController();
      searchAbortRef.current = ac;

      setSearchLoading(true);
      setSearchError(null);

      try {
        const results = await suggest(q, searchContext, ac.signal);
        if (requestId !== searchRequestIdRef.current) return;
        setSuggestions(results);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (requestId !== searchRequestIdRef.current) return;
        setSuggestions([]);
        if (error instanceof PlacesSearchUnavailableError) {
          setSearchError("Search temporarily unavailable");
          if (import.meta.env.DEV) {
            console.info("[places-search]", {
              endpoint: "/api/places",
              httpStatus: error.status,
              googleMessage: error.googleMessage ?? null,
            });
          }
        } else {
          setSearchError("Search temporarily unavailable");
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
      searchAbortRef.current?.abort();
    };
  }, [searchText, searchContext]);

  const flyToPoint = useCallback(
    (
      lat: number,
      lng: number,
      targetZoom?: number,
      options?: { focusLocation?: boolean }
    ): boolean => {
      const map = mapRef.current?.getMap();
      if (!map) return false;
      const z = targetZoom ?? CURRENT_LOCATION_FOCUS_ZOOM;
      let pitch = map.getPitch();
      let bearing = map.getBearing();
      if (options?.focusLocation && mapViewMode === "2d") {
        pitch = 0;
        bearing = 0;
      }
      map.flyTo({
        center: [lng, lat],
        zoom: z,
        pitch,
        bearing,
        duration: 900,
      });
      setCenter({ lat, lng });
      setZoom(z);
      return true;
    },
    [mapViewMode]
  );

  const requestLocation = useCallback(
    (options?: {
      fly?: boolean;
      targetZoom?: number;
      focusLocation?: boolean;
      onSuccess?: (point: { lat: number; lng: number }) => void;
    }) => {
      const shouldFly = options?.fly ?? false;
      const targetZoom = options?.targetZoom ?? CURRENT_LOCATION_FOCUS_ZOOM;
      setLocErr(null);
      requestCurrentPosition(
        (point) => {
          setMyPos(point);
          setLocErr(null);
          if (shouldFly) {
            if (mapReady) {
              flyToPoint(point.lat, point.lng, targetZoom, {
                focusLocation: options?.focusLocation,
              });
            } else {
              pendingFlyRef.current = {
                lat: point.lat,
                lng: point.lng,
                zoom: targetZoom,
              };
            }
          }
          options?.onSuccess?.(point);
        },
        (message) => {
          setLocErr(message);
        }
      );
    },
    [mapReady, flyToPoint]
  );

  const lastCommunityUpdateRef = useRef(Date.now());
  useEffect(() => {
    lastCommunityUpdateRef.current = Date.now();
  }, [posts]);

  useEffect(() => {
    requestCurrentPosition(
      (point) => {
        setMyPos(point);
        setLocErr(null);
        if (import.meta.env.DEV) {
          console.info("USER_LOCATION_STATE", { lat: point.lat, lng: point.lng });
        }
      },
      (message) => {
        setLocErr(message);
        if (import.meta.env.DEV) {
          console.info("USER_LOCATION_STATE", null);
        }
      }
    );
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (myPos) {
      console.info("USER_LOCATION_STATE", { lat: myPos.lat, lng: myPos.lng });
    }
  }, [myPos]);

  // Geolocation often resolves before the map is ready — fly once both exist
  useEffect(() => {
    if (!mapReady || !myPos || initialFlyDoneRef.current) return;
    if (flyToPoint(myPos.lat, myPos.lng, 14)) {
      initialFlyDoneRef.current = true;
      pendingFlyRef.current = null;
    }
  }, [mapReady, myPos, flyToPoint]);

  // Honor a user-initiated fly that completed before the map finished loading
  useEffect(() => {
    if (!mapReady) return;
    const pending = pendingFlyRef.current;
    if (!pending) return;
    pendingFlyRef.current = null;
    flyToPoint(pending.lat, pending.lng, pending.zoom);
  }, [mapReady, flyToPoint]);

  useTomTomTrafficLayer(mapRef, mapReady);

  const handleReroute = useCallback(
    async (origin: { lat: number; lng: number }) => {
      if (!destination) return false;
      setRouting(true);
      setRouteError(null);
      try {
        const plan = await calculateRoute(origin, destination);
        setRoutePlan(plan);
        return true;
      } catch (e) {
        setRouteError(
          e instanceof Error ? e.message : "Could not recalculate route."
        );
        return false;
      } finally {
        setRouting(false);
      }
    },
    [destination]
  );

  const nav = useNavigation({
    mapRef,
    mapReady,
    routePlan,
    mapViewMode,
    onReroute: handleReroute,
  });

  const isNavigating =
    nav.phase === "navigating" || nav.phase === "arrived";

  const locationMarkerPosition =
    nav.displayPosition ?? (myPos ? { lat: myPos.lat, lng: myPos.lng } : null);

  const quickReportLocation = useMemo(
    () => resolveQuickReportLocation(nav.rawGps, nav.gpsFix),
    [nav.rawGps, nav.gpsFix]
  );

  const navigationSessionKey = useMemo(() => {
    if (!routePlan || !destination) return "";
    const route = routePlan.routes[routePlan.selectedIndex];
    if (!route) return "";
    const start = route.coordinates[0];
    const end = route.coordinates[route.coordinates.length - 1];
    return `${start?.[0] ?? 0},${start?.[1] ?? 0}-${end?.[0] ?? 0},${end?.[1] ?? 0}-${nav.phase}`;
  }, [routePlan, destination, nav.phase]);

  useEnsureTrafficJakartaLayerOrder(mapRef, mapReady, [
    isNavigating,
    routePlan?.selectedIndex,
    nav.remainingCoordinates.length,
    nav.completedCoordinates.length,
    filterMin,
    mapViewMode,
  ]);

  const handleMapViewModeChange = useCallback(
    (mode: MapViewMode) => {
      setMapViewMode(mode);
      saveMapViewMode(mode);
      const map = mapRef.current?.getMap();
      if (!map) return;
      applyMapViewMode(map, mode, {
        isNavigating,
        bearing:
          isNavigating && nav.cameraMode === "follow"
            ? (nav.displayPosition?.heading ?? map.getBearing())
            : undefined,
      });
    },
    [
      isNavigating,
      mapRef,
      nav.cameraMode,
      nav.displayPosition?.heading,
    ]
  );

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    setBuildingExtrusionVisible(map, mapViewMode === "3d");
  }, [mapReady, mapViewMode, mapRef]);

  const routeWarnings = useNavigationRouteWarnings({
    isNavigating,
    posts: visibleMapPosts,
    remainingCoordinates: nav.remainingCoordinates,
    filterMin,
    userLat: locationMarkerPosition?.lat ?? null,
    userLng: locationMarkerPosition?.lng ?? null,
    navigationSessionKey,
  });

  const submitQuickReport = useCallback(
    async (input: {
      type: PostType;
      text?: string;
      image?: string | null;
    }) => {
      if (!quickReportLocation) return;
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setQuickReportError("Please sign in to post.");
        return;
      }
      setQuickReportSubmitting(true);
      setQuickReportError(null);
      try {
        await createPost({
          type: input.type,
          text: input.text,
          lat: quickReportLocation.lat,
          lng: quickReportLocation.lng,
          imageURL: input.image ?? undefined,
          ownerUid: currentUser.uid,
          displayName: currentUser.displayName,
          ...(input.type === "flooded"
            ? {
                floodDepth: "unknown" as const,
                floodVehicleAccess: "not_passable" as const,
              }
            : {}),
        });
        setToast(`${REPORT_TYPE_META[input.type].label} reported`);
        setQuickReportOpen(false);
      } catch {
        setQuickReportError("Could not post report");
      } finally {
        setQuickReportSubmitting(false);
      }
    },
    [quickReportLocation]
  );

  const fetchRoute = useCallback(
    async (dest: Destination, origin?: { lat: number; lng: number }) => {
      const from = origin ?? myPos;
      if (!from) {
        setRouteError("Current location is required to calculate a route.");
        return;
      }
      setRouting(true);
      setRouteError(null);
      nav.endNavigation();
      try {
        const plan = await calculateRoute(from, dest);
        setRoutePlan(plan);
      } catch (e) {
        setRoutePlan(null);
        setRouteError(
          e instanceof Error ? e.message : "Could not calculate route."
        );
      } finally {
        setRouting(false);
      }
    },
    [myPos, nav.endNavigation]
  );

  const selectDestination = useCallback(
    (dest: Destination, fly = true) => {
      setDestination(dest);
      setDestPickMode(false);
      setShowSug(false);
      setSearchText(dest.name);
      setRoutePlan(null);
      setRouteError(null);
      nav.endNavigation();
      if (fly) {
        flyToPoint(dest.lat, dest.lng, Math.max(15, zoom));
      }
    },
    [zoom, flyToPoint, nav.endNavigation]
  );

  const handleSelectSuggestion = useCallback(
    async (s: Suggestion) => {
      setSearchError(null);
      try {
        let dest: Destination;
        if (s.lat != null && s.lng != null) {
          resetPlacesSession();
          dest = {
            lat: s.lat,
            lng: s.lng,
            name: s.title,
            placeId: s.placeId,
            address: s.subtitle,
          };
        } else {
          const details = await fetchPlaceDetails(s.placeId, searchContext);
          dest = {
            lat: details.lat,
            lng: details.lng,
            name: details.title,
            placeId: details.placeId,
            address: details.address,
          };
        }
        selectDestination(dest, true);
      } catch (error) {
        if (error instanceof PlacesSearchUnavailableError) {
          setSearchError("Search temporarily unavailable");
        } else {
          setSearchError(
            error instanceof Error ? error.message : "Could not load place"
          );
        }
      }
    },
    [searchContext, selectDestination]
  );

  const clearRoute = useCallback(() => {
    nav.endNavigation();
    setRoutePlan(null);
    setDestination(null);
    setRouteError(null);
    setDestPickMode(false);
    resetPlacesSession();
  }, [nav.endNavigation]);

  useEffect(() => {
    if (!routePlan || !mapReady || nav.phase !== "preview") return;
    const map = mapRef.current?.getMap();
    const bounds = getRouteBounds(routePlan);
    if (!map || !bounds) return;
    map.fitBounds(bounds, {
      padding: { top: 120, bottom: 220, left: 48, right: 48 },
      duration: 900,
      pitch: 0,
      bearing: 0,
    });
  }, [routePlan, mapReady, nav.phase]);

  const handleMapClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (roadMode) {
        setRoadPoints((prev) => [
          ...prev,
          { lat: e.lngLat.lat, lng: e.lngLat.lng },
        ]);
        return;
      }
      if (destPickMode) {
        selectDestination(
          {
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
            name: "Selected point",
          },
          false
        );
      }
    },
    [roadMode, destPickMode, selectDestination]
  );

  function getMapCenterPoint(): { lat: number; lng: number } {
    const mapCenter = mapRef.current?.getMap()?.getCenter();
    if (mapCenter) {
      return { lat: mapCenter.lat, lng: mapCenter.lng };
    }
    return { lat: center.lat, lng: center.lng };
  }

  function openNewComposer() {
    const fallbackPos = myPos ?? getMapCenterPoint();

    if (!user) {
      let saved: DraftState | null = null;
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        try {
          saved = JSON.parse(raw) as DraftState;
        } catch {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }

      saveAuthReturnState({
        activeTab: "map",
        openComposer: true,
        draft: buildComposerDraft(saved, fallbackPos),
      });
      void signIn();
      return;
    }

    setRoadMode(false);
    setRoadPoints([]);
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const saved: DraftState = JSON.parse(raw);
      setType(saved.type ?? "heavy_traffic");
      setText(saved.text ?? "");
      setImage(saved.image ?? null);
      setDraftPos(saved.draftPos ?? fallbackPos);
      setLocationConfirmed(saved.locationConfirmed ?? false);
      setFloodDepth(saved.floodDepth ?? "unknown");
      setFloodVehicleAccess(saved.floodVehicleAccess ?? "not_passable");
    } else {
      setType("heavy_traffic");
      setText("");
      setImage(null);
      setDraftPos(fallbackPos);
      setLocationConfirmed(false);
      setFloodDepth("unknown");
      setFloodVehicleAccess("not_passable");
    }
    setComposerError(null);
    setOpenComposer(true);
    setActiveTab("map");
  }

  function resetDraft() {
    setType("heavy_traffic");
    setText("");
    setImage(null);
    setDraftPos(null);
    setLocationConfirmed(false);
    setFloodDepth("unknown");
    setFloodVehicleAccess("not_passable");
    setComposerError(null);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  function closeComposer() {
    setOpenComposer(false);
    resetDraft();
  }

  async function onSubmit() {
    if (!locationConfirmed) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setComposerError("Please sign in to post.");
      return;
    }
    setSubmitting(true);
    setComposerError(null);
    try {
      const postLat = draftPos?.lat ?? center.lat;
      const postLng = draftPos?.lng ?? center.lng;

      await createPost({
        type,
        text,
        lat: postLat,
        lng: postLng,
        imageURL: image ?? undefined,
        ownerUid: currentUser.uid,
        displayName: currentUser.displayName,
        ...(type === "flooded"
          ? { floodDepth, floodVehicleAccess }
          : {}),
      });

      resetDraft();
      setOpenComposer(false);
      setToast("Report posted");
    } catch (error) {
      console.error("CREATE_POST_ERROR", error);
      setComposerError(createPostErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function goMyLocation() {
    if (isNavigating) {
      nav.recenter();
      const map = mapRef.current?.getMap();
      if (map) requestManualTomTomTrafficRefresh(map);
      return;
    }
    requestLocation({
      fly: true,
      targetZoom: CURRENT_LOCATION_FOCUS_ZOOM,
      focusLocation: true,
    });
    const map = mapRef.current?.getMap();
    if (map) requestManualTomTomTrafficRefresh(map);
  }

  function startEdit(p: Post) {
    if (!isMinePost(p, user?.uid)) return;
    setEditing(p);
    setEditText(p.text ?? "");
    setEditType(p.type);
    setEditFloodDepth(p.floodDepth ?? "unknown");
    setEditFloodVehicleAccess(p.floodVehicleAccess ?? "not_passable");
    setSelectedPost(p);
    setDraggingPostId(null);
  }

  async function saveEdit() {
    if (!editing) return;
    await updatePost(editing.id, {
      text: editText,
      type: editType,
      ...(editType === "flooded"
        ? {
            floodDepth: editFloodDepth,
            floodVehicleAccess: editFloodVehicleAccess,
          }
        : {}),
    });
    setDraggingPostId(null);
    setEditing(null);
    setToast("Report updated");
  }

  async function removePost(p: Post) {
    const ok = confirm("Delete this report?");
    if (!ok) return;
    await deletePost(p.id);
    if (selectedPost?.id === p.id) setSelectedPost(null);
    if (editing?.id === p.id) setEditing(null);
    if (draggingPostId === p.id) setDraggingPostId(null);
  }

  function focusPost(p: Post) {
    setActiveTab("map");
    mapRef.current?.flyTo({
      center: [p.lng, p.lat],
      zoom: Math.max(16, zoom),
      duration: 700,
    });
  }

  function selectPost(p: Post, focusMap = false) {
    setSelectedPost(p);
    if (focusMap) focusPost(p);
  }

  function startRoadMode() {
    if (!user) {
      setToast("Sign in on the Profile tab to add community roads.");
      setActiveTab("profile");
      return;
    }
    setOpenComposer(false);
    resetDraft();
    setRoadMode(true);
    setRoadPoints([]);
    setRoadComposerOpen(false);
    setRoadName("");
    setRoadDescription("");
    setRoadAccess("private");
    setRoadImage(null);
    setRoadError(null);
    setActiveTab("map");
  }

  function finishRoadDrawing() {
    if (roadPoints.length < 2) {
      setRoadError("Tap at least 2 points on the map to draw a road.");
      return;
    }
    setRoadComposerOpen(true);
    setRoadError(null);
  }

  async function saveRoad() {
    if (roadPoints.length < 2) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setRoadError("Sign in on the Profile tab to save community roads.");
      return;
    }
    setRoadSubmitting(true);
    setRoadError(null);
    try {
      await createCommunityRoad({
        name: roadName.trim() || undefined,
        description: roadDescription.trim() || undefined,
        access: roadAccess,
        coordinates: roadPoints,
        imageURL: roadImage ?? undefined,
        ownerUid: currentUser.uid,
        displayName: currentUser.displayName,
      });
      setRoadMode(false);
      setRoadComposerOpen(false);
      setRoadPoints([]);
      setToast("Community road saved");
    } catch {
      setRoadError("Could not save community road.");
    } finally {
      setRoadSubmitting(false);
    }
  }

  const showMapChrome = activeTab === "map" && !isNavigating;
  const draftDraggable = openComposer && !locationConfirmed;

  const roadLineGeoJson = useMemo(
    () => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: roadPoints.map((p) => [p.lng, p.lat]),
      },
      properties: {},
    }),
    [roadPoints]
  );

  return (
    <div className="tj-app">
      <Map
        ref={mapRef}
        mapLib={maplibregl as typeof maplibregl}
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom: 13,
          pitch: 0,
          bearing: 0,
        }}
        style={{ position: "absolute", inset: 0 }}
        mapStyle={baseMapStyleUrl}
        onMove={(e) => {
          setCenter({ lat: e.viewState.latitude, lng: e.viewState.longitude });
          setZoom(e.viewState.zoom);
        }}
        onMoveEnd={(e) => {
          setCenter({ lat: e.viewState.latitude, lng: e.viewState.longitude });
          setZoom(e.viewState.zoom);
        }}
        onLoad={() => {
          setMapReady(true);
          const map = mapRef.current?.getMap();
          if (map) {
            setBuildingExtrusionVisible(map, mapViewMode === "3d");
            ensureTrafficJakartaLayerOrder(map);
          }
          if (import.meta.env.DEV) {
            console.info("MAP_STYLE_LOADED");
          }
        }}
        onClick={handleMapClick}
        cursor={roadMode ? "crosshair" : destPickMode ? "crosshair" : undefined}
      >
        {destination && (
          <Marker
            longitude={destination.lng}
            latitude={destination.lat}
            anchor="bottom"
          >
            <div className="tj-dest-marker" aria-label="Destination">
              🎯
            </div>
          </Marker>
        )}

        {openComposer && draftPos && (
          <Marker
            longitude={draftPos.lng}
            latitude={draftPos.lat}
            anchor="bottom"
            draggable={draftDraggable}
            onDragEnd={(e) => {
              setDraftPos({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            }}
          >
            <div
              className={`tj-draft-marker${locationConfirmed ? " tj-draft-marker--fixed" : ""}`}
              aria-hidden
            >
              {locationConfirmed ? "📌" : "📍"}
            </div>
          </Marker>
        )}

        {visibleMapPosts.map((p) => (
          <PostMarker
            key={p.id}
            post={p}
            filterMin={filterMin}
            isDragging={draggingPostId === p.id}
            isSelected={selectedPost?.id === p.id}
            verificationTier={p.displayVerificationTier}
            trustLevel={p.trustLevel}
            draggable={isMinePost(p, user?.uid) && draggingPostId === p.id}
            onSelect={(post) => selectPost(post, true)}
            onDragEnd={async (post, lat, lng) => {
              if (!isMinePost(post, user?.uid)) return;
              if (draggingPostId !== post.id) return;
              await updatePostLocation(post.id, lat, lng);
            }}
          />
        ))}

        {roadMode &&
          roadPoints.map((pt, idx) => (
            <Marker key={`road-pt-${idx}`} longitude={pt.lng} latitude={pt.lat} anchor="center">
              <div className="tj-road-point">{idx + 1}</div>
            </Marker>
          ))}
      </Map>

      <CurrentLocationMarker
        mapRef={mapRef}
        mapReady={mapReady}
        position={locationMarkerPosition}
        accuracy={nav.gpsFix?.accuracy ?? null}
        heading={nav.displayPosition?.heading ?? null}
        navigating={isNavigating}
      />

      <CommunityRoadLayer
        mapRef={mapRef}
        mapReady={mapReady}
        roads={enrichedCommunityRoads}
      />

      <RouteLayer
        mapRef={mapRef}
        mapReady={mapReady}
        routePlan={routePlan}
        navigationMode={isNavigating}
        completedCoordinates={nav.completedCoordinates}
        remainingCoordinates={nav.remainingCoordinates}
      />

      {roadMode && roadPoints.length >= 2 && mapReady && (
        <DraftRoadOverlay
          mapRef={mapRef}
          mapReady={mapReady}
          geojson={roadLineGeoJson}
        />
      )}

      {showMapChrome && (
        <>
          <div className="tj-top-bar">
            <div className="tj-top-row">
              <select
                className="tj-select tj-select--compact"
                value={filterMin}
                onChange={(e) => setFilterMin(Number(e.target.value))}
                aria-label="Show reports from"
              >
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={1440}>1 day</option>
              </select>

              <button type="button" className="tj-chip-btn" onClick={openNewComposer}>
                ➕ Post
              </button>

              <button type="button" className="tj-chip-btn" onClick={startRoadMode}>
                ➕ Add road
              </button>

              <div className="tj-counter">Reports: {posts.length}</div>
            </div>

            <div className="tj-search-wrap">
              <input
                className="tj-input tj-input--search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onFocus={() => {
                  if (searchText.trim()) setShowSug(true);
                }}
                placeholder="Search places"
                aria-label="Search places"
              />
              {searchError && (
                <p className="tj-search-error">{searchError}</p>
              )}
              {showSug && (
                <div className="tj-suggestions">
                  {searchLoading ? (
                    <div className="tj-suggestions__empty">Searching…</div>
                  ) : suggestions.length === 0 ? (
                    <div className="tj-suggestions__empty">
                      {searchText.trim() ? "No places found" : "Type to search…"}
                    </div>
                  ) : (
                    suggestions.map((s) => (
                      <button
                        key={s.placeId}
                        type="button"
                        className="tj-suggestion"
                        onClick={() => void handleSelectSuggestion(s)}
                      >
                        <strong>{s.title}</strong>
                        {s.subtitle && (
                          <span className="tj-suggestion__address">{s.subtitle}</span>
                        )}
                        {formatSuggestionDistance(s.distanceM) && (
                          <span className="tj-suggestion__distance">
                            {formatSuggestionDistance(s.distanceM)}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
              <div className="tj-search-actions">
                <button
                  type="button"
                  className="tj-btn tj-btn--ghost tj-btn--compact"
                  onClick={() => {
                    setDestPickMode(true);
                    setRouteError(null);
                  }}
                >
                  Tap map to set destination
                </button>
                {destination && (
                  <button
                    type="button"
                    className="tj-btn tj-btn--ghost tj-btn--compact"
                    onClick={() =>
                      selectDestination(
                        { lat: center.lat, lng: center.lng, name: "Map center" },
                        false
                      )
                    }
                  >
                    Destination = map center
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="tj-map-controls">
            <MapViewModeToggle
              mode={mapViewMode}
              onChange={handleMapViewModeChange}
            />
            <button type="button" className="tj-locate-btn" onClick={goMyLocation}>
              📍 Lokasi saat ini
            </button>
            {locErr && (
              <div className="tj-locate-err">
                <span>⚠️ {locErr}</span>
                <button
                  type="button"
                  className="tj-locate-retry"
                  onClick={() =>
                    requestLocation({
                      fly: true,
                      targetZoom: CURRENT_LOCATION_FOCUS_ZOOM,
                      focusLocation: true,
                    })
                  }
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {destPickMode && (
            <div className="tj-road-banner">
              <span>Tap the map to set your destination</span>
              <button
                type="button"
                className="tj-btn tj-btn--ghost"
                onClick={() => setDestPickMode(false)}
              >
                Cancel
              </button>
            </div>
          )}

          {roadMode && (
            <div className="tj-road-banner">
              <span>Tap map to add road points ({roadPoints.length})</span>
              <div className="tj-road-banner__actions">
                <button type="button" className="tj-btn tj-btn--ghost" onClick={finishRoadDrawing}>
                  Done drawing
                </button>
                <button
                  type="button"
                  className="tj-btn tj-btn--ghost"
                  onClick={() => {
                    setRoadMode(false);
                    setRoadPoints([]);
                    setRoadComposerOpen(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </>
      )}

      {destination && !routePlan && activeTab === "map" && (
        <DestinationBottomSheet
          destination={destination}
          routing={routing}
          routeError={routeError}
          onDirections={() => {
            if (!destination) return;
            if (myPos) {
              void fetchRoute(destination, myPos);
            } else {
              setRouteError(
                "Current location is required to calculate a route."
              );
            }
          }}
          onClose={clearRoute}
        />
      )}

      {routePlan && activeTab === "map" && nav.phase === "preview" && (
        <RouteBottomSheet
          routePlan={routePlan}
          routing={routing}
          routeError={routeError}
          onSelectRoute={(index) =>
            setRoutePlan((prev) => (prev ? { ...prev, selectedIndex: index } : prev))
          }
          onStartNavigation={() => nav.startNavigation()}
          onClearRoute={clearRoute}
          onChangeDestination={() => {
            nav.endNavigation();
            setDestPickMode(true);
            setRoutePlan(null);
            setRouteError(null);
          }}
        />
      )}

      {activeTab === "map" && isNavigating && (
        <div className="tj-map-view-toggle-nav-wrap">
          <MapViewModeToggle
            mode={mapViewMode}
            navigating
            onChange={handleMapViewModeChange}
          />
        </div>
      )}

      {routePlan && destination && activeTab === "map" && isNavigating && !quickReportOpen && (
        <>
          <NavRouteReportBanner
            warning={routeWarnings.warning}
            onSelect={(postId) => {
              const post = visibleMapPosts.find((p) => p.id === postId);
              if (post) selectPost(post);
            }}
          />
          {import.meta.env.DEV &&
          localStorage.getItem("tj_intel_dev") === "1" ? (
            <TrafficIntelligenceDevPanel
              snapshot={routeWarnings.intelligenceSnapshot}
              warning={routeWarnings.warning}
              trafficDiagnostics={trafficRefreshDiagnostics}
              communityUpdatedAt={lastCommunityUpdateRef.current}
            />
          ) : null}
          <button
            type="button"
            className="tj-nav-quick-report-btn"
            onClick={() => {
              setQuickReportError(null);
              setQuickReportOpen(true);
            }}
            aria-label="Quick report"
          >
            + Report
          </button>
          <NavigationHud
            {...nav}
            destination={destination}
            onRecenter={() => {
              nav.recenter();
              const map = mapRef.current?.getMap();
              if (map) requestManualTomTomTrafficRefresh(map);
            }}
            onOverview={nav.showOverview}
            onEnd={() => nav.endNavigation()}
            onToggleVoice={nav.toggleVoice}
            onToggleSimulation={nav.toggleSimulation}
          />
        </>
      )}

      {isNavigating && quickReportOpen && (
        <QuickReportSheet
          open={quickReportOpen}
          location={quickReportLocation}
          submitting={quickReportSubmitting}
          error={quickReportError}
          isSignedIn={Boolean(user)}
          onSignIn={() => void signIn()}
          onClose={() => {
            setQuickReportOpen(false);
            setQuickReportError(null);
          }}
          onPost={submitQuickReport}
        />
      )}

      {activeTab === "comment" && (
        <CommentPanel
          posts={feedPosts}
          userLat={myPos?.lat ?? null}
          userLng={myPos?.lng ?? null}
          onSelect={(p) => selectPost(p)}
        />
      )}

      {activeTab === "profile" && (
        <ProfilePanel posts={posts} onOpenPost={(p) => selectPost(p)} />
      )}

      {selectedPost && !openComposer && (
        <PostBottomSheet
          post={selectedPost}
          editing={editing?.id === selectedPost.id}
          dragging={draggingPostId === selectedPost.id}
          onClose={() => {
            setSelectedPost(null);
            setEditing(null);
            setDraggingPostId(null);
          }}
          onEdit={() => startEdit(selectedPost)}
          onDelete={() => removePost(selectedPost)}
          onFocus={() => focusPost(selectedPost)}
          onMoveMarker={() => setDraggingPostId(selectedPost.id)}
          onFixMarker={() => setDraggingPostId(null)}
          onRequireSignIn={() => {
            saveAuthReturnState({
              activeTab: "map",
              selectedPostId: selectedPost?.id,
            });
            void signIn();
          }}
        />
      )}

      {openComposer && !locationConfirmed && (
        <div className="tj-location-pick-banner" role="status">
          Move the marker to the correct location
        </div>
      )}

      {openComposer && draftPos && (
        <PostComposer
          type={type}
          text={text}
          image={image}
          locationConfirmed={locationConfirmed}
          floodDepth={floodDepth}
          floodVehicleAccess={floodVehicleAccess}
          submitting={submitting}
          error={composerError}
          hasMyLocation={myPos != null}
          onTypeChange={setType}
          onTextChange={setText}
          onImageChange={setImage}
          onConfirmLocation={() => setLocationConfirmed(true)}
          onUseMapCenter={() =>
            setDraftPos({ lat: center.lat, lng: center.lng })
          }
          onUseMyLocation={() => {
            if (myPos) setDraftPos({ lat: myPos.lat, lng: myPos.lng });
          }}
          onFloodDepthChange={setFloodDepth}
          onFloodVehicleChange={setFloodVehicleAccess}
          onSubmit={onSubmit}
          onClose={closeComposer}
        />
      )}

      {editing && (
        <EditPostSheet
          type={editType}
          text={editText}
          floodDepth={editFloodDepth}
          floodVehicleAccess={editFloodVehicleAccess}
          onTypeChange={setEditType}
          onTextChange={setEditText}
          onFloodDepthChange={setEditFloodDepth}
          onFloodVehicleChange={setEditFloodVehicleAccess}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}

      {roadComposerOpen && (
        <CommunityRoadComposer
          points={roadPoints}
          name={roadName}
          description={roadDescription}
          access={roadAccess}
          image={roadImage}
          submitting={roadSubmitting}
          error={roadError}
          onNameChange={setRoadName}
          onDescriptionChange={setRoadDescription}
          onAccessChange={setRoadAccess}
          onImageChange={setRoadImage}
          onSubmit={saveRoad}
          onClose={() => setRoadComposerOpen(false)}
        />
      )}

      <BottomNav active={activeTab} onChange={setActiveTab} />

      {firestoreError && (
        <p className="tj-firestore-err" role="alert">
          Live reports unavailable: {firestoreError}
        </p>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

/** Temporary preview line while drawing a community road */
function DraftRoadOverlay({
  mapRef,
  mapReady,
  geojson,
}: {
  mapRef: React.RefObject<MapRef | null>;
  mapReady: boolean;
  geojson: GeoJSON.Feature<GeoJSON.LineString>;
}) {
  const srcId = "draft-road";
  const layerId = "draft-road-layer";

  const sync = useCallback(
    (map: maplibregl.Map) => {
      const existing = safeGetSource(map, srcId);
      if (existing && "setData" in existing) {
        (existing as maplibregl.GeoJSONSource).setData(geojson);
        ensureTrafficJakartaLayerOrder(map);
      } else {
        safeRemoveLayer(map, layerId);
        safeRemoveSource(map, srcId);
        map.addSource(srcId, { type: "geojson", data: geojson });
        map.addLayer({
          id: layerId,
          type: "line",
          source: srcId,
          paint: {
            "line-color": "#a855f7",
            "line-width": 4,
            "line-dasharray": [2, 2],
          },
        });
        ensureTrafficJakartaLayerOrder(map);
      }
    },
    [geojson]
  );

  useMapStyleDataSync(mapRef, mapReady, sync, [geojson]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    return () => {
      safeRemoveLayer(map, layerId);
      safeRemoveSource(map, srcId);
    };
  }, [mapRef, mapReady]);

  return null;
}
