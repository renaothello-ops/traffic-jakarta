import "maplibre-gl/dist/maplibre-gl.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import type { Feature, LineString } from "geojson";
import { maplibregl } from "../assets/lib/maplibreSetup";

import type {
  AppTab,
  CommunityRoad,
  Destination,
  DraftState,
  FloodDepth,
  FloodVehicleAccess,
  Post,
  PostAudience,
  PostType,
  TrafficThreadSummary,
  RoadAccess,
  RoutePlan,
} from "../types";
import {
  createPost,
  createPostErrorMessageKey,
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
  resolvePlacesSearchErrorKey,
  resetPlacesSession,
  suggest,
  type SearchContext,
  type Suggestion,
} from "../assets/lib/search";
import { calculateRoute, getRouteBounds } from "../assets/lib/routing";
import { isMinePost } from "../assets/lib/identity";
import { normalizePostType } from "../assets/lib/reportTypes";
import { resolveQuickReportLocation } from "../assets/lib/quickReportLocation";
import { useNavigationRouteWarnings } from "../hooks/useNavigationRouteWarnings";
import { useEnsureTrafficJakartaLayerOrder } from "../hooks/useEnsureTrafficJakartaLayerOrder";
import {
  loadMapViewMode,
  saveMapViewMode,
  type MapViewMode,
} from "../assets/lib/mapViewMode";
import { applyMapViewMode, setBuildingExtrusionVisible } from "../assets/lib/mapViewApply";
import {
  CURRENT_LOCATION_FOCUS_ZOOM,
  INITIAL_LOCATION_FLY_ZOOM,
  INITIAL_MAP_ZOOM,
} from "../assets/lib/mapCameraConfig";
import {
  ensureTomTomTrafficLayer,
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
import { useUserProfile } from "../contexts/UserProfileContext";
import { formatPublicAuthorLabel } from "../assets/lib/publicAuthor";
import {
  createInAppNotification,
  shouldDeliverInApp,
} from "../assets/lib/inAppNotifications";
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
import PublicProfileSheet from "../components/PublicProfileSheet";
import UserSearchSheet from "../components/UserSearchSheet";
import FavoritePlacesSheet from "../components/FavoritePlacesSheet";
import { useFollowingUids } from "../hooks/useFollowingUids";
import { listenFavoritePlaces } from "../assets/lib/favoritePlaces";
import { syncFavoritePlaceAlertsFromPosts } from "../assets/lib/favoritePlaceAlerts";
import type { FavoritePlace } from "../types";
import TrafficMessagesSheet from "../components/TrafficMessagesSheet";
import TrafficChatSheet from "../components/TrafficChatSheet";
import {
  openTrafficChatWithUser,
  startChatWithReportAuthor,
} from "../assets/lib/trafficChat";
import BottomNav from "../components/BottomNav";
import EditPostSheet from "../components/EditPostSheet";
import Toast from "../components/Toast";
import CommunityRoadLayer from "../components/CommunityRoadLayer";
import CommunityRoadComposer from "../components/CommunityRoadComposer";
import RouteLayer from "../components/RouteLayer";
import CurrentLocationMarker from "../components/CurrentLocationMarker";
import LocationHeadingHint from "../components/LocationHeadingHint";
import RouteBottomSheet from "../components/RouteBottomSheet";
import DestinationBottomSheet from "../components/DestinationBottomSheet";
import NavigationHud from "../components/NavigationHud";
import QuickReportSheet from "../components/QuickReportSheet";
import NavRouteReportBanner from "../components/NavRouteReportBanner";
import TrafficIntelligenceDevPanel from "../components/TrafficIntelligenceDevPanel";
import MapNotificationBell from "../components/MapNotificationBell";
import { useMessageInboxSummary } from "../hooks/useMessageInboxSummary";
import NotificationCenterSheet from "../components/settings/NotificationCenterSheet";
import TrafficIntelligenceDetailSheet from "../components/TrafficIntelligenceDetailSheet";
import { useUnifiedNotifications } from "../hooks/useUnifiedNotifications";
import { syncTrafficIntelligenceAlerts } from "../assets/lib/trafficAlertSync";
import type { LocalTrafficNotification } from "../assets/lib/localTrafficNotifications";
import { haversineMeters } from "../assets/lib/geo";
import { useNavigation } from "../hooks/useNavigation";
import { useDeviceHeading } from "../hooks/useDeviceHeading";
import { useTrafficIntelligence } from "../hooks/useTrafficIntelligence";
import { useNearbyCommentCounts } from "../hooks/useNearbyCommentCounts";
import { summarizeRouteIntelligence } from "../intelligence/route/routeIncidentSummary";
import { analyzeTrafficTextRuleBased } from "../intelligence/textAnalysis/ruleBasedAnalyzer";
import { useTranslation } from "react-i18next";

const JAKARTA = { lat: -6.2, lng: 106.8 };
const DRAFT_STORAGE_KEY = "traffic_jakarta_draft";
const SELECTED_POST_KEY = "traffic_jakarta_selected_post";
const FILTER_KEY = "traffic_jakarta_filter";
const SMART_TRAFFIC_KEY = "traffic_jakarta_smart_traffic";

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
  const { profile: userProfile } = useUserProfile();
  const { t, i18n } = useTranslation();
  const pendingPostIdRef = useRef<string | null>(null);
  const returnStateRestoredRef = useRef(false);

  const [activeTab, setActiveTab] = useState<AppTab>("map");
  const [posts, setPosts] = useState<Post[]>([]);
  const [communityRoads, setCommunityRoads] = useState<CommunityRoad[]>([]);
  const enrichedCommunityRoads = useEnrichedCommunityRoads(communityRoads);
  const [filterMin, setFilterMin] = useState<number>(() => {
    const saved = localStorage.getItem(FILTER_KEY);
    return saved ? Number(saved) : 10;
  });

  const [center, setCenter] = useState(JAKARTA);
  const [zoom, setZoom] = useState(INITIAL_MAP_ZOOM);

  const [openComposer, setOpenComposer] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(
    loadSelectedPostFromStorage
  );
  const listenPostVotes =
    activeTab === "map" ||
    activeTab === "comment" ||
    openComposer ||
    selectedPost != null;
  const enrichedPosts = useEnrichedPosts(posts, {
    listenVotes: listenPostVotes,
    priorityPostIds: selectedPost?.id ? [selectedPost.id] : [],
  });
  const [type, setType] = useState<PostType>("heavy_traffic");
  const [postAudience, setPostAudience] = useState<PostAudience>("public");
  const [postAnonymous, setPostAnonymous] = useState(false);
  const [publicProfileUid, setPublicProfileUid] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<TrafficThreadSummary | null>(null);
  const [chatReportContext, setChatReportContext] = useState<Post | null>(null);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [favoritePlacesOpen, setFavoritePlacesOpen] = useState(false);
  const [favoritePickMode, setFavoritePickMode] = useState(false);
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([]);

  const followingUids = useFollowingUids(user?.uid);
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
  /** Compact map chrome by default so the map stays the hero on phone and desktop. */
  const [mapChromeExpanded, setMapChromeExpanded] = useState(false);
  const initialFlyDoneRef = useRef(false);
  /** User panned/zoomed before geolocation — skip automatic recenter. */
  const userAdjustedViewRef = useRef(false);
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
  const [postsLoadErrorKey, setPostsLoadErrorKey] = useState<string | null>(null);
  const [roadsLoadErrorKey, setRoadsLoadErrorKey] = useState<string | null>(null);
  const firestoreErrorKey = postsLoadErrorKey ?? roadsLoadErrorKey;

  const [smartTrafficEnabled, setSmartTrafficEnabled] = useState(() => {
    const stored = localStorage.getItem(SMART_TRAFFIC_KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
    return true;
  });
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [trafficDetailOpen, setTrafficDetailOpen] = useState(false);
  const [trafficDetailAlert, setTrafficDetailAlert] =
    useState<LocalTrafficNotification | null>(null);

  const {
    items: unifiedNotifications,
    unreadCount: notificationUnreadCount,
    markRead: markNotificationReadUnified,
    markAllRead: markAllNotificationsReadUnified,
  } = useUnifiedNotifications(user?.uid);
  const messageInbox = useMessageInboxSummary(user?.uid);
  const [composerTextAnalysisHint, setComposerTextAnalysisHint] = useState<
    string | null
  >(null);

  const intelligenceLat = myPos?.lat ?? center.lat;
  const intelligenceLng = myPos?.lng ?? center.lng;

  const nearbyCommentCounts = useNearbyCommentCounts(
    smartTrafficEnabled && activeTab === "map",
    posts,
    intelligenceLat,
    intelligenceLng
  );

  const { result: mapIntelligence, loadingTomTom: intelligenceTomTomLoading } =
    useTrafficIntelligence({
      enabled: smartTrafficEnabled && activeTab === "map",
      lat: intelligenceLat,
      lng: intelligenceLng,
      posts: visibleMapPosts,
      commentCountByPostId: nearbyCommentCounts,
      tomTomRasterVisible: mapReady,
    });

  const nearbyAlertSentRef = useRef(false);
  useEffect(() => {
    if (!user?.uid || !userProfile || !mapIntelligence) return;
    if (mapIntelligence.trend.trend !== "major_incident_detected") return;
    if (mapIntelligence.nearbyReportCount < 2) return;
    if (!shouldDeliverInApp(userProfile.notificationSettings, "nearby_incident")) {
      return;
    }
    if (nearbyAlertSentRef.current) return;
    nearbyAlertSentRef.current = true;
    void createInAppNotification({
      recipientUid: user.uid,
      actorUid: user.uid,
      type: "nearby_incident",
      titleKey: "notifications.types.nearby_incident",
      bodyKey: "notifications.body.nearby_incident",
      allowSelfRecipient: true,
    }).catch(() => {
      nearbyAlertSentRef.current = false;
    });
  }, [user?.uid, userProfile, mapIntelligence]);

  useEffect(() => {
    if (!userProfile || !smartTrafficEnabled || !mapIntelligence) return;
    syncTrafficIntelligenceAlerts(mapIntelligence, userProfile.notificationSettings);
  }, [userProfile, smartTrafficEnabled, mapIntelligence]);

  useEffect(() => {
    if (!userProfile) return;
    const on = userProfile.notificationSettings.trafficAlerts;
    setSmartTrafficEnabled(on);
    localStorage.setItem(SMART_TRAFFIC_KEY, on ? "1" : "0");
  }, [userProfile?.notificationSettings.trafficAlerts, userProfile?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setFavoritePlaces([]);
      return;
    }
    return listenFavoritePlaces(user.uid, setFavoritePlaces);
  }, [user?.uid]);

  useEffect(() => {
    if (!userProfile || !favoritePlaces.length) return;
    syncFavoritePlaceAlertsFromPosts(
      favoritePlaces,
      posts.filter((p) => p.audience !== "followers"),
      userProfile.notificationSettings
    );
  }, [userProfile, favoritePlaces, posts]);

  const routeIntelligence = useMemo(() => {
    if (!routePlan) return null;
    const route = routePlan.routes[routePlan.selectedIndex];
    if (!route?.coordinates?.length) return null;
    return summarizeRouteIntelligence({
      posts: visibleMapPosts,
      routeCoordinates: route.coordinates,
      filterMin,
    });
  }, [routePlan, visibleMapPosts, filterMin]);

  useEffect(() => {
    let active = true;

    const unsub = listenActivePosts(
      filterMin,
      (next) => {
        if (!active) return;
        setPosts(next);
        setPostsLoadErrorKey(null);
      },
      (message) => {
        if (!active) return;
        setPostsLoadErrorKey(message);
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
        setRoadsLoadErrorKey(null);
      },
      (message) => {
        if (!active) return;
        setRoadsLoadErrorKey(message);
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
        setSearchError(t(resolvePlacesSearchErrorKey(error)));
        if (import.meta.env.DEV && error instanceof PlacesSearchUnavailableError) {
          console.info("[places-search]", {
            endpoint: "/api/places",
            httpStatus: error.status,
            googleMessage: error.googleMessage ?? null,
          });
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
  }, [searchText, searchContext, t]);

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
      if (userProfile?.privacySettings.useLocation === false) {
        setLocErr("errors.locationPrivacyOff");
        return;
      }
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
        (messageKey) => {
          setLocErr(messageKey);
        }
      );
    },
    [mapReady, flyToPoint, userProfile?.privacySettings.useLocation]
  );

  const lastCommunityUpdateRef = useRef(Date.now());
  useEffect(() => {
    lastCommunityUpdateRef.current = Date.now();
  }, [posts]);

  useEffect(() => {
    if (userProfile?.privacySettings.useLocation === false) return;
    requestCurrentPosition(
      (point) => {
        setMyPos(point);
        setLocErr(null);
        if (import.meta.env.DEV) {
          console.info("USER_LOCATION_STATE", { lat: point.lat, lng: point.lng });
        }
      },
      () => {
        if (import.meta.env.DEV) {
          console.info("USER_LOCATION_STATE", null);
        }
      }
    );
  }, [userProfile?.privacySettings.useLocation]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (myPos) {
      console.info("USER_LOCATION_STATE", { lat: myPos.lat, lng: myPos.lng });
    }
  }, [myPos]);

  // Geolocation often resolves before the map is ready — fly once both exist
  useEffect(() => {
    if (!mapReady || !myPos || initialFlyDoneRef.current) return;
    if (userAdjustedViewRef.current) {
      initialFlyDoneRef.current = true;
      pendingFlyRef.current = null;
      return;
    }
    if (flyToPoint(myPos.lat, myPos.lng, INITIAL_LOCATION_FLY_ZOOM)) {
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
          e instanceof Error ? e.message : t("errors.routeRecalcFailed")
        );
        return false;
      } finally {
        setRouting(false);
      }
    },
    [destination]
  );

  const deviceHeadingRef = useRef<number | null>(null);

  const {
    heading: deviceHeading,
    headingStatus,
    requestCompassAccess,
    orientationPermission,
  } = useDeviceHeading({ locationActive: myPos != null });

  deviceHeadingRef.current = deviceHeading;

  const nav = useNavigation({
    mapRef,
    mapReady,
    routePlan,
    mapViewMode,
    onReroute: handleReroute,
    voiceT: t,
    voiceLanguage: i18n.language,
    externalHeadingRef: deviceHeadingRef,
  });

  const isNavigating =
    nav.phase === "navigating" ||
    nav.phase === "paused" ||
    nav.phase === "arrived";

  const locationMarkerPosition =
    nav.displayPosition ?? (myPos ? { lat: myPos.lat, lng: myPos.lng } : null);

  const locationHeading =
    deviceHeading ?? nav.displayPosition?.heading ?? null;

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
          isNavigating &&
          nav.cameraMode === "follow" &&
          nav.mapBearingMode === "course"
            ? (nav.displayPosition?.heading ?? map.getBearing())
            : isNavigating && nav.mapBearingMode === "north"
              ? 0
              : undefined,
      });
    },
    [
      isNavigating,
      mapRef,
      nav.cameraMode,
      nav.mapBearingMode,
      nav.displayPosition?.heading,
    ]
  );

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    setBuildingExtrusionVisible(map, mapViewMode === "3d");
  }, [mapReady, mapViewMode, mapRef]);

  useEffect(() => {
    if (!openComposer) {
      setComposerTextAnalysisHint(null);
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      setComposerTextAnalysisHint(null);
      return;
    }
    const timer = window.setTimeout(() => {
      const analysis = analyzeTrafficTextRuleBased(trimmed, type);
      setComposerTextAnalysisHint(
        `Text insight (rule-based): ${analysis.category.replace(/_/g, " ")} · severity ${Math.round(analysis.severity * 100)}% · confidence ${Math.round(analysis.confidence * 100)}%`
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [openComposer, text, type]);

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
        setQuickReportError(t("errors.signInToPost"));
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
          authorLabel: formatPublicAuthorLabel(userProfile),
          ...(input.type === "flooded"
            ? {
                floodDepth: "unknown" as const,
                floodVehicleAccess: "not_passable" as const,
              }
            : {}),
        });
        setToast(
          t("quickReport.postedToast", {
            type: t(`reportTypes.${input.type}.label`),
          })
        );
        setQuickReportOpen(false);
      } catch {
        setQuickReportError(t("errors.quickPostFailed"));
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
        setRouteError(t("errors.routeNeedsLocation"));
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
          e instanceof Error ? e.message : t("errors.routeFailed")
        );
      } finally {
        setRouting(false);
      }
    },
    [myPos, nav.endNavigation]
  );

  const selectDestination = useCallback(
    (dest: Destination, fly = true) => {
      setSelectedPost(null);
      setDestination(dest);
      setDestPickMode(false);
      setShowSug(false);
      setSearchText("");
      setSearchError(null);
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
            name:
              details.title === "map.selectedPoint"
                ? t("map.selectedPoint")
                : details.title,
            placeId: details.placeId,
            address: details.address,
          };
        }
        selectDestination(dest, true);
      } catch (error) {
        if (error instanceof PlacesSearchUnavailableError) {
          setSearchError(t(resolvePlacesSearchErrorKey(error)));
        } else {
          const msg =
            error instanceof Error ? error.message : "errors.placeLoadFailed";
          setSearchError(msg.startsWith("errors.") ? t(msg) : t("errors.placeLoadFailed"));
        }
      }
    },
    [searchContext, selectDestination, t]
  );

  const clearRoute = useCallback(() => {
    nav.endNavigation();
    setRoutePlan(null);
    setDestination(null);
    setRouteError(null);
    setDestPickMode(false);
    setSearchText("");
    setSearchError(null);
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
            name: t("map.selectedPoint"),
          },
          false
        );
        return;
      }
      setShowSug(false);
      setMapChromeExpanded(false);
    },
    [roadMode, destPickMode, selectDestination, t]
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
    if (!locationConfirmed || submitting) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setComposerError(t("errors.composerSignIn"));
      return;
    }
    setSubmitting(true);
    setComposerError(null);
    const mapCenter = getMapCenterPoint();
    const postLat = draftPos?.lat ?? mapCenter.lat;
    const postLng = draftPos?.lng ?? mapCenter.lng;
    const isAnonymous = postAnonymous && postAudience === "public";
    try {
      const postId = await createPost({
        type,
        text,
        lat: postLat,
        lng: postLng,
        imageURL: image ?? undefined,
        ownerUid: currentUser.uid,
        displayName: currentUser.displayName,
        authorLabel: formatPublicAuthorLabel(userProfile),
        audience: postAudience,
        anonymous: isAnonymous,
        ...(type === "flooded"
          ? { floodDepth, floodVehicleAccess }
          : {}),
      });

      resetDraft();
      setOpenComposer(false);
      setActiveTab("map");
      setToast(t("toast.reportPosted"));

      const createdPost: Post = {
        id: postId,
        type,
        text: text.trim(),
        lat: postLat,
        lng: postLng,
        createdAt: Date.now(),
        imageURL: image ?? undefined,
        username: isAnonymous
          ? "Anonymous"
          : formatPublicAuthorLabel(userProfile),
        ownerUid: isAnonymous ? undefined : currentUser.uid,
        audience: postAudience,
        anonymous: isAnonymous,
        confirmCount: 0,
        denyCount: 0,
        ...(type === "flooded"
          ? { floodDepth, floodVehicleAccess }
          : {}),
      };
      selectPost(createdPost, true);
    } catch (error) {
      console.error("CREATE_POST_ERROR", error);
      setComposerError(t(createPostErrorMessageKey(error)));
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
    void requestCompassAccess();
    if (isNavigating) nav.unlockVoice();
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
    setToast(t("toast.reportUpdated"));
  }

  async function removePost(p: Post) {
    const ok = confirm(t("confirm.deleteReport"));
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
    if (!isNavigating && (destination || routePlan || destPickMode)) {
      nav.endNavigation();
      setRoutePlan(null);
      setDestination(null);
      setDestPickMode(false);
      setRouteError(null);
      setSearchText("");
    }
    if (focusMap) focusPost(p);
  }

  function openTrafficAlert(alert: LocalTrafficNotification) {
    setNotificationCenterOpen(false);
    setActiveTab("map");
    mapRef.current?.flyTo({
      center: [alert.lng, alert.lat],
      zoom: Math.max(16, zoom),
      duration: 700,
    });

    if (alert.relatedPostId) {
      const post = posts.find((p) => p.id === alert.relatedPostId);
      if (post) {
        selectPost(post, false);
        return;
      }
    }

    let best: Post | null = null;
    let bestD = Infinity;
    for (const p of visibleMapPosts) {
      const d = haversineMeters(alert.lat, alert.lng, p.lat, p.lng);
      if (d < bestD && d <= 800) {
        bestD = d;
        best = p;
      }
    }
    if (best) selectPost(best, false);
  }

  function startRoadMode() {
    if (!user) {
      setToast(t("toast.signInForRoads"));
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

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (globalThis as Record<string, unknown>).__trafficJakartaStartRoadMode = startRoadMode;
  });

  function finishRoadDrawing() {
    if (roadPoints.length < 2) {
      setRoadError(t("errors.roadMinPoints"));
      return;
    }
    setRoadComposerOpen(true);
    setRoadError(null);
  }

  async function saveRoad() {
    if (roadPoints.length < 2) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setRoadError(t("errors.roadSignInSave"));
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
      setToast(t("toast.roadSaved"));
    } catch {
      setRoadError(t("errors.roadSaveFailed"));
    } finally {
      setRoadSubmitting(false);
    }
  }

  const showMapChrome = activeTab === "map" && !isNavigating;
  const draftDraggable = openComposer && !locationConfirmed;

  const onNavSelectTab = useCallback((tab: AppTab) => {
    setMessagesOpen(false);
    setActiveTab(tab);
  }, []);

  const onNavPressMessages = useCallback(() => {
    if (!user) {
      void signIn();
      return;
    }
    setMessagesOpen(true);
  }, [user, signIn]);

  const overlaySheetOpen =
    openComposer ||
    messagesOpen ||
    activeChat != null ||
    notificationCenterOpen ||
    userSearchOpen ||
    favoritePlacesOpen ||
    publicProfileUid != null ||
    roadComposerOpen ||
    editing != null ||
    trafficDetailOpen ||
    (selectedPost != null && !openComposer);

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
    <div
      className={`tj-app${activeTab !== "map" ? " tj-app--overlay-tab" : ""}${overlaySheetOpen ? " tj-app--sheet-open" : ""}`}
    >
      <div
        className={`tj-map-shell${activeTab !== "map" ? " tj-map-shell--background" : ""}`}
        aria-hidden={activeTab !== "map"}
      >
      <Map
        ref={mapRef}
        mapLib={maplibregl as typeof maplibregl}
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom: INITIAL_MAP_ZOOM,
          pitch: 0,
          bearing: 0,
        }}
        style={{ position: "absolute", inset: 0 }}
        mapStyle={baseMapStyleUrl}
        onMoveStart={(e) => {
          if (e.originalEvent) {
            userAdjustedViewRef.current = true;
          }
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
            ensureTomTomTrafficLayer(map);
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

        {smartTrafficEnabled &&
          mapIntelligence?.clusters.map((cluster) => (
            <Marker
              key={cluster.id}
              longitude={cluster.lng}
              latitude={cluster.lat}
              anchor="center"
            >
              <button
                type="button"
                className="tj-smart-cluster-marker"
                title={`${cluster.reportCount} reports — confidence ${cluster.maxConfidence}`}
                onClick={() => {
                  mapRef.current?.flyTo({
                    center: [cluster.lng, cluster.lat],
                    zoom: Math.max(zoom, 15),
                    duration: 700,
                  });
                  setTrafficDetailAlert({
                    id: `cluster-marker-${cluster.id}`,
                    kind: "cluster",
                    dedupeKey: cluster.id,
                    titleKey: "notifications.trafficAlert.clusterTitle",
                    bodyKey: "notifications.trafficAlert.reportCount",
                    bodyParams: { count: cluster.reportCount },
                    lat: cluster.lat,
                    lng: cluster.lng,
                    clusterId: cluster.id,
                    reportCount: cluster.reportCount,
                    createdAt: Date.now(),
                    readAt: null,
                  });
                  setTrafficDetailOpen(true);
                }}
              >
                {cluster.reportCount}
              </button>
            </Marker>
          ))}

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
      </div>

      <CurrentLocationMarker
        mapRef={mapRef}
        mapReady={mapReady}
        position={locationMarkerPosition}
        accuracy={nav.gpsFix?.accuracy ?? null}
        heading={locationHeading}
        navigating={isNavigating}
      />

      {activeTab === "map" && myPos != null && !selectedPost ? (
        <LocationHeadingHint
          visible
          headingStatus={headingStatus}
          orientationPermission={orientationPermission}
          onEnableCompass={() => void requestCompassAccess()}
        />
      ) : null}

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
          <div
            className={`tj-top-bar${mapChromeExpanded ? " tj-top-bar--expanded" : " tj-top-bar--compact"}`}
          >
            <div className="tj-top-bar__main">
              <div className="tj-search-wrap">
                <input
                  className="tj-input tj-input--search"
                  value={searchText}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSearchText(next);
                    if (next.trim()) setMapChromeExpanded(true);
                    if (destination && next.trim()) {
                      setDestination(null);
                      setRoutePlan(null);
                      setRouteError(null);
                      nav.endNavigation();
                    }
                  }}
                  onFocus={() => {
                    setMapChromeExpanded(true);
                    if (searchText.trim()) setShowSug(true);
                  }}
                  placeholder={t("map.searchPlaceholder")}
                  aria-label={t("map.searchPlaceholder")}
                />
                {searchError ? (
                  <p className="tj-search-error">{searchError}</p>
                ) : null}
                {showSug && mapChromeExpanded ? (
                  <div className="tj-suggestions">
                    {searchLoading ? (
                      <div className="tj-suggestions__empty">{t("map.searchSearching")}</div>
                    ) : searchError ? (
                      <div className="tj-suggestions__empty tj-suggestions__error" role="alert">
                        {searchError}
                      </div>
                    ) : suggestions.length === 0 ? (
                      <div className="tj-suggestions__empty">
                        {searchText.trim()
                          ? t("map.searchNoResults")
                          : t("map.searchTypeHint")}
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
                          {s.subtitle ? (
                            <span className="tj-suggestion__address">{s.subtitle}</span>
                          ) : null}
                          {formatSuggestionDistance(s.distanceM) ? (
                            <span className="tj-suggestion__distance">
                              {formatSuggestionDistance(s.distanceM)}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div className="tj-top-bar__tools">
                <select
                  className="tj-select tj-select--compact"
                  value={filterMin}
                  onChange={(e) => setFilterMin(Number(e.target.value))}
                  aria-label={t("map.filterAria")}
                >
                  <option value={5}>{t("map.filter5m")}</option>
                  <option value={10}>{t("map.filter10m")}</option>
                  <option value={30}>{t("map.filter30m")}</option>
                  <option value={60}>{t("map.filter1h")}</option>
                  <option value={1440}>{t("map.filter1d")}</option>
                </select>

                {user ? (
                  <MapNotificationBell
                    unreadCount={notificationUnreadCount}
                    onClick={() => setNotificationCenterOpen(true)}
                  />
                ) : null}

                <button
                  type="button"
                  className="tj-icon-btn tj-top-bar__expand"
                  aria-expanded={mapChromeExpanded}
                  aria-label={
                    mapChromeExpanded ? t("common.close") : t("map.searchPlaceholder")
                  }
                  onClick={() => setMapChromeExpanded((v) => !v)}
                >
                  {mapChromeExpanded ? "▴" : "▾"}
                </button>
              </div>
            </div>

            {mapChromeExpanded ? (
              <div className="tj-search-actions">
                <button
                  type="button"
                  className="tj-btn tj-btn--ghost tj-btn--compact"
                  onClick={() => {
                    setDestPickMode(true);
                    setRouteError(null);
                    setSelectedPost(null);
                  }}
                >
                  {t("map.tapMapDestination")}
                </button>
                {destination ? (
                  <button
                    type="button"
                    className="tj-btn tj-btn--ghost tj-btn--compact"
                    onClick={() =>
                      selectDestination(
                        { lat: center.lat, lng: center.lng, name: t("map.mapCenter") },
                        false
                      )
                    }
                  >
                    {t("map.destinationMapCenter")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="tj-map-controls">
            <MapViewModeToggle
              mode={mapViewMode}
              onChange={handleMapViewModeChange}
            />
            <button type="button" className="tj-locate-btn" onClick={goMyLocation}>
              📍 {t("map.currentLocation")}
            </button>
            {locErr ? (
              <div className="tj-locate-err" role="status">
                <p className="tj-locate-err__text">{t(locErr)}</p>
                <button
                  type="button"
                  className="tj-locate-retry"
                  onClick={() => {
                    void requestCompassAccess();
                    requestLocation({
                      fly: true,
                      targetZoom: CURRENT_LOCATION_FOCUS_ZOOM,
                      focusLocation: true,
                    });
                  }}
                >
                  {t("common.retry")}
                </button>
              </div>
            ) : null}
          </div>

          {destPickMode && (
            <div className="tj-road-banner">
              <span>{t("map.destPickBanner")}</span>
              <button
                type="button"
                className="tj-btn tj-btn--ghost"
                onClick={() => setDestPickMode(false)}
              >
                {t("common.cancel")}
              </button>
            </div>
          )}

          {roadMode && (
            <div className="tj-road-banner">
              <span>{t("map.roadPickBanner", { count: roadPoints.length })}</span>
              <div className="tj-road-banner__actions">
                <button type="button" className="tj-btn tj-btn--ghost" onClick={finishRoadDrawing}>
                  {t("map.doneDrawing")}
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
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

        </>
      )}

      {activeTab === "map" &&
        !selectedPost &&
        (routePlan || destination || destPickMode || isNavigating) && (
        <button
          type="button"
          className={`tj-route-end-fab${
            routePlan && nav.phase === "preview" ? " tj-route-end-fab--above-sheet" : ""
          }${isNavigating ? " tj-route-end-fab--navigating" : ""}`}
          onClick={() => clearRoute()}
          aria-label={t("map.endRoute")}
        >
          {t("map.endRoute")}
        </button>
      )}

      {destination &&
        !routePlan &&
        !destPickMode &&
        activeTab === "map" &&
        !selectedPost && (
        <DestinationBottomSheet
          destination={destination}
          routing={routing}
          routeError={routeError}
          onDirections={() => {
            if (!destination) return;
            if (myPos) {
              void fetchRoute(destination, myPos);
            } else {
              setRouteError(t("errors.routeNeedsLocation"));
            }
          }}
          onClose={clearRoute}
        />
      )}

      {routePlan &&
        activeTab === "map" &&
        nav.phase === "preview" &&
        !selectedPost && (
        <RouteBottomSheet
          routePlan={routePlan}
          routing={routing}
          routeError={routeError}
          routeIntelligenceWarnings={routeIntelligence?.warningItems}
          onSelectRoute={(index) =>
            setRoutePlan((prev) => (prev ? { ...prev, selectedIndex: index } : prev))
          }
          onStartNavigation={() => {
            void requestCompassAccess();
            nav.startNavigation();
          }}
          onClearRoute={clearRoute}
          onChangeDestination={() => {
            nav.endNavigation();
            setDestination(null);
            setDestPickMode(true);
            setRoutePlan(null);
            setRouteError(null);
            setSearchText("");
            setSearchError(null);
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
            onEnd={() => clearRoute()}
            onToggleVoice={nav.toggleVoice}
            onRepeatVoice={nav.repeatVoice}
            onPause={nav.pauseNavigation}
            onResume={nav.resumeNavigation}
            onNorthUp={nav.setMapBearingNorthUp}
            onCourseUp={nav.setMapBearingCourseUp}
            onUnlockVoice={nav.unlockVoice}
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

      <div className="tj-tab-scaffold" aria-hidden={activeTab === "map"}>
      <div
        className={`tj-tab-panel${activeTab !== "comment" ? " tj-tab-panel--hidden" : ""}`}
        aria-hidden={activeTab !== "comment"}
      >
        <CommentPanel
          posts={feedPosts}
          userLat={myPos?.lat ?? null}
          userLng={myPos?.lng ?? null}
          viewerUid={user?.uid ?? null}
          followingUids={followingUids}
          onSelect={(p) => selectPost(p)}
          onOpenProfile={(uid) => setPublicProfileUid(uid)}
          onOpenUserSearch={() => setUserSearchOpen(true)}
        />
      </div>

      <div
        className={`tj-tab-panel${activeTab !== "profile" ? " tj-tab-panel--hidden" : ""}`}
        aria-hidden={activeTab !== "profile"}
      >
        <ProfilePanel
          posts={posts}
          onOpenPost={(p) => selectPost(p)}
          unifiedNotifications={unifiedNotifications}
          notificationUnreadCount={notificationUnreadCount}
          onMarkNotificationRead={(n) => void markNotificationReadUnified(n)}
          onMarkAllNotificationsRead={() => void markAllNotificationsReadUnified()}
          onOpenTrafficAlert={openTrafficAlert}
          onViewTrafficDetails={(alert) => {
            setTrafficDetailAlert(alert);
            setTrafficDetailOpen(true);
          }}
          onOpenProfile={(uid) => setPublicProfileUid(uid)}
          onOpenFavoritePlaces={() => setFavoritePlacesOpen(true)}
        />
      </div>
      </div>

      {selectedPost &&
        !openComposer &&
        !destination &&
        !(routePlan && nav.phase === "preview") &&
        !destPickMode && (
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
          onAskReporter={(post) => {
            if (!user?.uid) {
              void signIn();
              return;
            }
            void startChatWithReportAuthor(user.uid, post)
              .then((conversationId) => {
                setChatReportContext(post);
                setActiveChat({
                  conversationId,
                  peerUid: post.ownerUid!,
                  status: "pending",
                  pendingForUid: post.ownerUid!,
                  lastMessageAt: Date.now(),
                  lastPreview: "",
                  lastSenderUid: user.uid,
                  unreadCount: 0,
                });
                setSelectedPost(null);
              })
              .catch(() => {});
          }}
        />
      )}

      {openComposer && !locationConfirmed && (
        <div className="tj-location-pick-banner" role="status">
          {t("composer.pickLocationBanner")}
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
          onUseMapCenter={() => {
            const p = getMapCenterPoint();
            setDraftPos({ lat: p.lat, lng: p.lng });
          }}
          onUseMyLocation={() => {
            if (myPos) setDraftPos({ lat: myPos.lat, lng: myPos.lng });
          }}
          onFloodDepthChange={setFloodDepth}
          onFloodVehicleChange={setFloodVehicleAccess}
          onSubmit={onSubmit}
          onClose={closeComposer}
          textAnalysisHint={composerTextAnalysisHint}
          postAudience={postAudience}
          postAnonymous={postAnonymous}
          onPostAudienceChange={setPostAudience}
          onPostAnonymousChange={setPostAnonymous}
        />
      )}

      {notificationCenterOpen && user ? (
        <NotificationCenterSheet
          items={unifiedNotifications}
          onClose={() => setNotificationCenterOpen(false)}
          onMarkRead={(n) => void markNotificationReadUnified(n)}
          onMarkAllRead={() => void markAllNotificationsReadUnified()}
          onOpenPost={(postId) => {
            setNotificationCenterOpen(false);
            const post = posts.find((p) => p.id === postId);
            if (post) selectPost(post, true);
          }}
          onOpenTraffic={openTrafficAlert}
          onOpenProfile={(uid) => {
            setNotificationCenterOpen(false);
            setPublicProfileUid(uid);
          }}
          onViewTrafficDetails={(alert) => {
            setTrafficDetailAlert(alert);
            setTrafficDetailOpen(true);
          }}
        />
      ) : null}

      {messagesOpen && user ? (
        <TrafficMessagesSheet
          inbox={messageInbox.inbox}
          requests={messageInbox.requests}
          loadFailed={messageInbox.loadFailed}
          lastError={messageInbox.lastError}
          onClose={() => setMessagesOpen(false)}
          onOpenUserSearch={() => {
            setMessagesOpen(false);
            setUserSearchOpen(true);
          }}
          onOpenChat={(thread) => {
            setMessagesOpen(false);
            setActiveChat(thread);
            setChatReportContext(null);
          }}
        />
      ) : null}

      {activeChat && user ? (
        <TrafficChatSheet
          thread={activeChat}
          initialReport={chatReportContext}
          mapCenter={{ lat: center.lat, lng: center.lng }}
          onClose={() => {
            setActiveChat(null);
            setChatReportContext(null);
          }}
          onOpenProfile={(uid) => {
            setActiveChat(null);
            setPublicProfileUid(uid);
          }}
        />
      ) : null}

      {publicProfileUid ? (
        <PublicProfileSheet
          uid={publicProfileUid}
          posts={posts}
          onClose={() => setPublicProfileUid(null)}
          onOpenPost={(p) => {
            setPublicProfileUid(null);
            selectPost(p, true);
          }}
          onMessageUser={(peerUid) => {
            if (!user?.uid) return;
            void openTrafficChatWithUser(user.uid, peerUid).then(({ conversationId, status }) => {
              setPublicProfileUid(null);
              setActiveChat({
                conversationId,
                peerUid,
                status,
                pendingForUid: status === "pending" ? peerUid : null,
                lastMessageAt: Date.now(),
                lastPreview: "",
                lastSenderUid: user.uid,
                unreadCount: 0,
              });
            });
          }}
        />
      ) : null}

      {userSearchOpen ? (
        <UserSearchSheet
          onClose={() => setUserSearchOpen(false)}
          onSelectProfile={(uid) => {
            setUserSearchOpen(false);
            setPublicProfileUid(uid);
          }}
        />
      ) : null}

      {favoritePlacesOpen && user ? (
        <FavoritePlacesSheet
          uid={user.uid}
          pickMode={favoritePickMode}
          pickedLat={favoritePickMode ? center.lat : null}
          pickedLng={favoritePickMode ? center.lng : null}
          onClose={() => {
            setFavoritePlacesOpen(false);
            setFavoritePickMode(false);
          }}
          onStartPick={() => {
            setFavoritePickMode(true);
            setActiveTab("map");
          }}
        />
      ) : null}

      {trafficDetailOpen ? (
        <TrafficIntelligenceDetailSheet
          open={trafficDetailOpen}
          onClose={() => {
            setTrafficDetailOpen(false);
            setTrafficDetailAlert(null);
          }}
          intelligence={smartTrafficEnabled ? mapIntelligence : null}
          loadingTomTom={intelligenceTomTomLoading}
          alert={trafficDetailAlert}
        />
      ) : null}

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

      {!isNavigating && !overlaySheetOpen ? (
        <BottomNav
          activeTab={activeTab}
          composerOpen={openComposer}
          messagesOpen={messagesOpen}
          messageUnreadCount={messageInbox.unreadMessageCount}
          onSelectTab={onNavSelectTab}
          onPressPost={openNewComposer}
          onPressMessages={onNavPressMessages}
        />
      ) : null}

      {firestoreErrorKey ? (
        <p className="tj-firestore-err" role="alert">
          {t(firestoreErrorKey)}
        </p>
      ) : null}

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
  geojson: Feature<LineString>;
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
