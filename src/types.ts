/** Current report categories */
export type PostType =
  | "accident"
  | "road_closed"
  | "heavy_traffic"
  | "flooded"
  | "construction"
  | "car_passable"
  | "motorcycle_only"
  | "hazard"
  | "other";

/** Legacy Firestore values — normalized on read */
export type LegacyPostType = "traffic" | "weather" | "user";

export type FloodDepth =
  | "lt10"
  | "10to30"
  | "30to50"
  | "gt50"
  | "unknown";

export type FloodVehicleAccess =
  | "car_passable"
  | "suv_caution"
  | "motorcycle_passable"
  | "not_passable";

export type Post = {
  id: string;
  type: PostType;
  text?: string;
  lat: number;
  lng: number;
  createdAt: number;
  expiresAt?: number;
  imageURL?: string;
  /** Snapshot of display name at post time */
  username?: string;
  /** Firebase Auth uid — required for new posts; used for ownership */
  ownerUid?: string;
  floodDepth?: FloodDepth;
  floodVehicleAccess?: FloodVehicleAccess;
  confirmCount?: number;
  denyCount?: number;
};

export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

export type Comment = {
  id: string;
  postId: string;
  text: string;
  username: string;
  createdAt: number;
  /** Firebase Auth uid — required for new comments; used for ownership */
  authorUid?: string;
};

export type VoteType = "confirm" | "deny";

export type Vote = {
  id: string;
  postId: string;
  voterId: string;
  vote: VoteType;
  createdAt: number;
};

export type ConfidenceStatus =
  | "unverified"
  | "community_reported"
  | "community_verified"
  | "possibly_outdated";

export type RoadAccess =
  | "cars"
  | "motorcycles"
  | "motorcycle_only"
  | "restricted"
  | "private";

export type CommunityRoad = {
  id: string;
  name?: string;
  description?: string;
  access: RoadAccess;
  coordinates: Array<{ lat: number; lng: number }>;
  imageURL?: string;
  username: string;
  ownerUid?: string;
  createdAt: number;
  confirmCount: number;
  denyCount: number;
  verified: boolean;
};

export type RoadVoteType = "confirm" | "deny";

export type AppTab = "map" | "comment" | "profile";

export type DraftState = {
  type: PostType;
  text: string;
  image: string | null;
  draftPos: { lat: number; lng: number } | null;
  locationConfirmed: boolean;
  floodDepth?: FloodDepth;
  floodVehicleAccess?: FloodVehicleAccess;
};

export type Destination = {
  lat: number;
  lng: number;
  name: string;
  placeId?: string;
  address?: string;
};

export type ManeuverKind =
  | "depart"
  | "straight"
  | "slight-left"
  | "slight-right"
  | "left"
  | "right"
  | "sharp-left"
  | "sharp-right"
  | "u-turn"
  | "roundabout"
  | "roundabout-exit"
  | "merge"
  | "exit"
  | "keep"
  | "arrive"
  | "unknown";

export type RouteInstruction = {
  index: number;
  maneuver: ManeuverKind;
  message: string;
  street?: string;
  /** Distance from route start to this instruction point, meters */
  routeOffsetMeters: number;
  /** Distance along route from this instruction to the next, meters */
  stepDistanceMeters: number;
  point: { lat: number; lng: number };
};

export type RouteOption = {
  id: string;
  label: string;
  distanceMeters: number;
  durationSeconds: number;
  trafficDelaySeconds: number;
  coordinates: Array<[number, number]>;
  instructions: RouteInstruction[];
};

export type RoutePlan = {
  origin: { lat: number; lng: number };
  destination: Destination;
  routes: RouteOption[];
  selectedIndex: number;
  provider?: "tomtom" | "osrm-fallback";
};

export type GpsFix = {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
};

export type NavigationPhase = "preview" | "navigating" | "arrived";

export type NavigationCameraMode = "follow" | "overview" | "free";
