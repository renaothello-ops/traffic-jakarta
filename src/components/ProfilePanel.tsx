import { useEffect, useMemo, useState } from "react";
import type { Post } from "../types";
import { isMinePost, displayNameOrFallback } from "../assets/lib/identity";
import { auth } from "../assets/lib/firebase";
import { useAuth } from "../contexts/useAuth";
import { getReportTypeMeta } from "../assets/lib/reportTypes";
import { timeAgo } from "../assets/lib/timeAgo";
import { saveAuthReturnState } from "../assets/lib/authReturnState";
import SignInPanel from "./SignInPanel";

const PLATE_KEY = "traffic_jakarta_license_plate";
const GANJIL_GENAP_KEY = "traffic_jakarta_ganjil_genap_enabled";

type Props = {
  posts: Post[];
  onOpenPost: (post: Post) => void;
};

function plateParity(plate: string): "ganjil" | "genap" | null {
  const digits = plate.replace(/\D/g, "");
  if (!digits) return null;
  const last = Number(digits[digits.length - 1]);
  if (Number.isNaN(last)) return null;
  return last % 2 === 0 ? "genap" : "ganjil";
}

function todayRestriction(): "ganjil" | "genap" {
  const day = new Date().getDate();
  return day % 2 === 0 ? "genap" : "ganjil";
}

export default function ProfilePanel({ posts, onOpenPost }: Props) {
  const { user, loading, authError, signIn, signOut, clearAuthError } = useAuth();

  const [licensePlate, setLicensePlate] = useState(
    () => localStorage.getItem(PLATE_KEY) ?? ""
  );
  const [ganjilGenapEnabled, setGanjilGenapEnabled] = useState(
    () => localStorage.getItem(GANJIL_GENAP_KEY) === "1"
  );
  const [signingOut, setSigningOut] = useState(false);

  const myPosts = useMemo(
    () =>
      posts
        .filter((p) => isMinePost(p, user?.uid))
        .sort((a, b) => b.createdAt - a.createdAt),
    [posts, user?.uid]
  );

  const parity = plateParity(licensePlate.trim());
  const today = todayRestriction();
  const allowedToday =
    parity != null && ganjilGenapEnabled ? parity === today : null;

  useEffect(() => {
    localStorage.setItem(PLATE_KEY, licensePlate);
  }, [licensePlate]);

  useEffect(() => {
    localStorage.setItem(GANJIL_GENAP_KEY, ganjilGenapEnabled ? "1" : "0");
  }, [ganjilGenapEnabled]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.info("AUTH_CURRENT_USER_UID", auth.currentUser?.uid ?? null);
    console.info("AUTH_CONTEXT_UID", user?.uid ?? null);
    console.info("PROFILE_UID", user?.uid ?? null);
  }, [user]);

  if (loading) {
    return (
      <div className="tj-tab-panel">
        <p className="tj-hint">Loading profile…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <SignInPanel
        loading={loading}
        error={authError}
        onSignIn={() => {
          clearAuthError();
          saveAuthReturnState({ activeTab: "profile" });
          void signIn().catch(() => {
            // Error is stored in authError by AuthContext
          });
        }}
      />
    );
  }

  const name = displayNameOrFallback(user.displayName);

  return (
    <div className="tj-tab-panel">
      <header className="tj-tab-panel__header">
        <h1 className="tj-tab-panel__title">👤 Profile</h1>
        <p className="tj-tab-panel__subtitle">Account, vehicle, and settings</p>
      </header>

      <section className="tj-profile-section">
        <h2 className="tj-profile-section__title">Google account</h2>
        <div className="tj-profile-user">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="tj-profile-user__photo" />
          ) : (
            <div className="tj-profile-user__photo tj-profile-user__photo--placeholder">
              👤
            </div>
          )}
          <div>
            <strong>{name}</strong>
            {user.email && <p className="tj-profile-user__email">{user.email}</p>}
            <p className="tj-hint">UID: {user.uid}</p>
          </div>
        </div>
        <button
          type="button"
          className="tj-btn tj-btn--ghost"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            try {
              await signOut();
            } finally {
              setSigningOut(false);
            }
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        {authError && (
          <p className="tj-error" role="alert">
            {authError}
          </p>
        )}
      </section>

      <section className="tj-profile-section">
        <h2 className="tj-profile-section__title">Vehicle registration</h2>
        <label className="tj-field">
          <span className="tj-field__label">License plate</span>
          <input
            className="tj-input"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
            placeholder="B 1234 ABC"
          />
        </label>
        {parity && (
          <p className="tj-profile-badge">
            Plate type: <strong>{parity === "ganjil" ? "Ganjil (odd)" : "Genap (even)"}</strong>
          </p>
        )}
      </section>

      <section className="tj-profile-section">
        <h2 className="tj-profile-section__title">Ganjil–Genap</h2>
        <label className="tj-toggle-row">
          <span>Enable automatic odd/even detection</span>
          <input
            type="checkbox"
            checked={ganjilGenapEnabled}
            onChange={(e) => setGanjilGenapEnabled(e.target.checked)}
          />
        </label>
        {ganjilGenapEnabled && parity && (
          <p
            className={`tj-profile-status${allowedToday ? " tj-profile-status--ok" : " tj-profile-status--warn"}`}
          >
            Today is <strong>{today}</strong> day.
            {allowedToday
              ? " Your plate is allowed on the road today."
              : " Your plate may be restricted today under Ganjil–Genap rules."}
          </p>
        )}
        {ganjilGenapEnabled && !parity && (
          <p className="tj-hint">Enter a valid license plate to detect odd/even.</p>
        )}
      </section>

      <section className="tj-profile-section">
        <h2 className="tj-profile-section__title">My Posts ({myPosts.length})</h2>
        {myPosts.length === 0 ? (
          <p className="tj-tab-panel__empty">You have not posted any reports yet.</p>
        ) : (
          <div className="tj-comment-list">
            {myPosts.map((p) => {
              const meta = getReportTypeMeta(p.type);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="tj-comment-card"
                  onClick={() => onOpenPost(p)}
                >
                  <span className="tj-comment-card__emoji" aria-hidden>
                    {meta.emoji}
                  </span>
                  <span className="tj-comment-card__body">
                    <span className="tj-comment-card__row">
                      <strong>{meta.label}</strong>
                      <span className="tj-comment-card__time">{timeAgo(p.createdAt)}</span>
                    </span>
                    {p.text && <span className="tj-comment-card__text">{p.text}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="tj-profile-section">
        <h2 className="tj-profile-section__title">Settings</h2>
        <ul className="tj-settings-list">
          <li>Notifications — coming soon</li>
          <li>Language — coming soon</li>
          <li>Privacy — coming soon</li>
        </ul>
      </section>
    </div>
  );
}
