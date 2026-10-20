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
  /** Firebase Auth uid — omitted on anonymous public posts in client views */
  ownerUid?: string;
  /** Public traffic vs followers-only. Legacy posts without field = public. */
  audience?: PostAudience;
  /** When true, UI must not link to author; ownerUid may live in ownerSecret subdoc. */
  anonymous?: boolean;
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

export type AppLanguage =
  | "id"
  | "en"
  | "ja"
  | "ko"
  | "zh-Hans"
  | "zh-Hant"
  | "ms"
  | "th"
  | "vi"
  | "fil"
  | "hi"
  | "ar"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "ru"
  | "tr"
  | "nl";

export type AvatarSource = "google" | "initials" | "custom";

export type NotificationSettings = {
  master: boolean;
  trafficAlerts: boolean;
  accidents: boolean;
  floods: boolean;
  roadClosures: boolean;
  communityActivity: boolean;
  commentsOnMyPosts: boolean;
  votesOnMyPosts: boolean;
  nearbyAlerts: boolean;
  sound: boolean;
  /** Preference only until FCM is configured server-side. */
  pushEnabled: boolean;
};

export type AccountVisibility = "public" | "private";

export type PostAudience = "public" | "followers";

export type MessageRequestPolicy = "everyone" | "people_i_follow" | "nobody";

export type PrivacySettings = {
  useLocation: boolean;
  usePreciseLocation: boolean;
  showDisplayNameOnPosts: boolean;
  showUsernameOnPosts: boolean;
  showPhotoOnPosts: boolean;
  allowAnonymizedMl: boolean;
  /** Profile visibility — set explicitly for new accounts; legacy may omit. */
  accountVisibility?: AccountVisibility;
  /** Who may start a Traffic Message request with you. Default everyone for new users. */
  messageRequestPolicy?: MessageRequestPolicy;
};

export type UserProfile = {
  uid: string;
  displayName: string;
  username: string | null;
  usernameLower: string | null;
  photoURL: string | null;
  email: string | null;
  language: AppLanguage;
  avatarSource: AvatarSource;
  licensePlate?: string;
  ganjilGenapEnabled?: boolean;
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
  bio?: string;
  /** Set when onboarding (username + display name + policy step) completes. */
  onboardingCompletedAt?: number | null;
  termsAcceptedAt?: number | null;
  termsAcceptedVersion?: string | null;
  privacyNoticeAcknowledgedAt?: number | null;
  createdAt: number;
  updatedAt: number;
};

/** Public-safe profile — no email or private settings. */
export type PublicUserProfile = {
  uid: string;
  displayName: string;
  username: string | null;
  usernameLower: string | null;
  photoURL: string | null;
  bio: string;
  accountVisibility: AccountVisibility;
  postCount: number;
  followerCount: number;
  followingCount: number;
  updatedAt: number;
};

export type FollowRelation = {
  id: string;
  followerUid: string;
  followingUid: string;
  createdAt: number;
};

export type FollowRequest = {
  id: string;
  targetUid: string;
  requesterUid: string;
  createdAt: number;
  status: "pending" | "accepted" | "rejected";
};

export type FavoritePlaceKind = "home" | "school" | "work" | "other";

export type FavoritePlaceRadiusKm = 1 | 3 | 5 | 10;

export type FavoritePlace = {
  id: string;
  label: string;
  kind: FavoritePlaceKind;
  lat: number;
  lng: number;
  radiusKm: FavoritePlaceRadiusKm;
  createdAt: number;
  updatedAt: number;
};

export type InAppNotificationType =
  | "comment_on_post"
  | "comment_reply"
  | "vote_on_post"
  | "nearby_incident"
  | "new_follower"
  | "follow_request"
  | "follow_request_accepted"
  | "message_request"
  | "new_message"
  | "report_confirmation";

export type TrafficMessageKind =
  | "text"
  | "photo"
  | "traffic_report"
  | "location"
  | "route";

export type TrafficConversationStatus = "pending" | "active" | "blocked";

export type TrafficReportAttachment = {
  postId: string;
  type: PostType;
  text?: string;
  lat: number;
  lng: number;
  createdAt: number;
  authorLabel?: string;
};

export type TrafficLocationAttachment = {
  lat: number;
  lng: number;
  label?: string;
};

export type TrafficRouteAttachment = {
  originLabel: string;
  destinationLabel: string;
  distanceMeters: number;
  durationSeconds: number;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
};

export type TrafficMessage = {
  id: string;
  conversationId: string;
  senderUid: string;
  kind: TrafficMessageKind;
  text?: string;
  photoURL?: string;
  storagePath?: string;
  trafficReport?: TrafficReportAttachment;
  location?: TrafficLocationAttachment;
  route?: TrafficRouteAttachment;
  createdAt: number;
};

export type TrafficThreadSummary = {
  conversationId: string;
  peerUid: string;
  status: TrafficConversationStatus;
  pendingForUid: string | null;
  lastMessageAt: number;
  lastPreview: string;
  lastSenderUid: string | null;
  unreadCount: number;
};

export type UserReportReason =
  | "spam"
  | "harassment"
  | "false_traffic"
  | "inappropriate"
  | "other";

export type UserReportTargetType = "user" | "post" | "comment" | "message";

export type InAppNotification = {
  id: string;
  type: InAppNotificationType;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  relatedPostId?: string;
  relatedProfileUid?: string;
  actorUid?: string;
  recipientUid: string;
  createdAt: number;
  readAt: number | null;
};

export type Comment = {
  id: string;
  postId: string;
  text: string;
  username: string;
  createdAt: number;
  /** Firebase Auth uid — required for new comments; used for ownership */
  authorUid?: string;
  parentCommentId?: string;
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
