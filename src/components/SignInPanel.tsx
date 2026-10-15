import { getFirebaseSetupMessage, isFirebaseConfigured } from "../assets/lib/firebase";

type Props = {
  loading: boolean;
  error: string | null;
  onSignIn: () => void;
};

export default function SignInPanel({ loading, error, onSignIn }: Props) {
  const configError = isFirebaseConfigured() ? null : getFirebaseSetupMessage();

  return (
    <div className="tj-tab-panel tj-sign-in-panel">
      <header className="tj-tab-panel__header">
        <h1 className="tj-tab-panel__title">👤 Profile</h1>
        <p className="tj-tab-panel__subtitle">
          Sign in to post reports, comment, and manage your profile
        </p>
      </header>

      <section className="tj-profile-section tj-sign-in-card">
        <h2 className="tj-profile-section__title">Sign in</h2>
        <p className="tj-hint">
          Use your Google account to sign in. You will return here automatically
          after authentication.
        </p>

        {configError && (
          <p className="tj-error" role="alert">
            Firebase is not configured correctly. Update <code>.env</code> with
            values from Firebase Console → Project settings → Your apps, then
            restart <code>npm run dev</code>.
            <br />
            <span className="tj-hint">{configError}</span>
          </p>
        )}

        <button
          type="button"
          className="tj-btn tj-btn--primary tj-sign-in-btn"
          onClick={onSignIn}
          disabled={loading || Boolean(configError)}
        >
          {loading ? "Checking session…" : "Sign in with Google"}
        </button>

        {error && (
          <p className="tj-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
