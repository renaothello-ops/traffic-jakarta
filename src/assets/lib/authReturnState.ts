import type { AppTab, DraftState } from "../../types";

const RETURN_STATE_KEY = "traffic_jakarta_auth_return";

export type AuthReturnState = {
  activeTab: AppTab;
  openComposer?: boolean;
  selectedPostId?: string;
  draft?: DraftState;
};

export function saveAuthReturnState(state: AuthReturnState): void {
  sessionStorage.setItem(RETURN_STATE_KEY, JSON.stringify(state));
}

export function peekAuthReturnState(): AuthReturnState | null {
  const raw = sessionStorage.getItem(RETURN_STATE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthReturnState;
  } catch {
    return null;
  }
}

export function consumeAuthReturnState(): AuthReturnState | null {
  const state = peekAuthReturnState();
  if (state) sessionStorage.removeItem(RETURN_STATE_KEY);
  return state;
}
