import { createContext } from "react";
import type { AuthUser } from "../types";

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
};

const AUTH_CONTEXT_KEY = "__traffic_jakarta_auth_context__";

function getAuthContext() {
  const globalRef = globalThis as typeof globalThis & {
    [AUTH_CONTEXT_KEY]?: ReturnType<typeof createContext<AuthContextValue | null>>;
  };
  if (!globalRef[AUTH_CONTEXT_KEY]) {
    globalRef[AUTH_CONTEXT_KEY] = createContext<AuthContextValue | null>(null);
  }
  return globalRef[AUTH_CONTEXT_KEY]!;
}

export const AuthContext = getAuthContext();
