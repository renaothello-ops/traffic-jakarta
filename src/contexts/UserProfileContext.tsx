import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { UserProfile } from "../types";
import { useAuth } from "./useAuth";
import {
  ensureUserProfileDocument,
  listenUserProfile,
} from "../assets/lib/userProfile";
import { syncLanguageFromFirestoreProfile } from "../i18n/languagePreference";

type UserProfileContextValue = {
  profile: UserProfile | null;
  /** True only until the first Firestore snapshot for the current uid (not preference updates). */
  profileInitialLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileInitialLoading, setProfileInitialLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const hydratedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setProfileInitialLoading(false);
      hydratedUidRef.current = null;
      return;
    }

    const needsInitialLoad = hydratedUidRef.current !== uid;
    if (needsInitialLoad) {
      setProfileInitialLoading(true);
    }

    let active = true;

    void ensureUserProfileDocument().catch((e) => {
      if (!active) return;
      setProfileError(e instanceof Error ? e.message : String(e));
    });

    const unsub = listenUserProfile(
      uid,
      (p) => {
        if (!active) return;
        if (p) {
          setProfile(p);
          hydratedUidRef.current = uid;
          setProfileInitialLoading(false);
          if (p.language) {
            syncLanguageFromFirestoreProfile(p.language);
          }
        }
      },
      (msg) => {
        if (!active) return;
        setProfileError(msg);
        setProfileInitialLoading(false);
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, [uid]);

  const refreshProfile = useCallback(async () => {
    if (!uid) return;
    try {
      const p = await ensureUserProfileDocument();
      if (p) {
        setProfile(p);
        hydratedUidRef.current = uid;
        if (p.language) syncLanguageFromFirestoreProfile(p.language);
      }
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : String(e));
    }
  }, [uid]);

  const value = useMemo(
    () => ({
      profile,
      profileInitialLoading,
      profileError,
      refreshProfile,
    }),
    [profile, profileInitialLoading, profileError, refreshProfile]
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    throw new Error("useUserProfile must be used within UserProfileProvider");
  }
  return ctx;
}
