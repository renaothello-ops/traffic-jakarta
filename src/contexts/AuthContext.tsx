import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { AuthUser } from "../types";
import { auth } from "../assets/lib/firebase";
import {
  authErrorMessage,
  mapFirebaseUser,
  signInWithGoogle,
  signOutUser,
} from "../assets/lib/auth";
import { AuthContext, type AuthContextValue } from "./auth-context";

const LOADING_SAFETY_MS = 8_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let loadingCleared = false;

    const clearLoading = () => {
      if (loadingCleared) return;
      loadingCleared = true;
      setLoading(false);
    };

    const loadingTimeout = window.setTimeout(() => {
      if (import.meta.env.DEV) {
        console.warn("AUTH_LOADING_SAFETY_TIMEOUT");
      }
      clearLoading();
    }, LOADING_SAFETY_MS);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (import.meta.env.DEV) {
        console.info("AUTH_STATE_CHANGED_UID", firebaseUser?.uid ?? null);
      }

      setUser(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
      if (firebaseUser) setAuthError(null);
      clearLoading();
    });

    return () => {
      window.clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(authErrorMessage(error));
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await signOutUser();
    } catch (error) {
      setAuthError(authErrorMessage(error));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      authError,
      clearAuthError,
      signIn,
      signOut,
    }),
    [user, loading, authError, clearAuthError, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
