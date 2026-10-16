import { Component, type ErrorInfo, type ReactNode } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";
import { AuthProvider } from "./contexts/AuthContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import MapScreen from "./screens/MapScreen";
import LanguageDocumentSync from "./components/LanguageDocumentSync";
import "./i18n";

type BoundaryState = { error: Error | null; resetKey: number };

class AppErrorBoundaryInner extends Component<
  { children: ReactNode } & WithTranslation,
  BoundaryState
> {
  state: BoundaryState = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[app] render crash:", error.message, info.componentStack);
    if (import.meta.env.DEV) {
      console.error(error);
    }
  }

  private retry = () => {
    this.setState({ error: null, resetKey: this.state.resetKey + 1 });
  };

  private backToMap = () => {
    this.setState({ error: null, resetKey: this.state.resetKey + 1 });
    window.location.hash = "";
    window.history.replaceState({}, "", window.location.pathname);
  };

  render() {
    if (this.state.error) {
      const { t } = this.props;
      return (
        <div className="tj-crash-screen" role="alert">
          <h1>{t("app.crashTitle")}</h1>
          <p>{t("app.crashBody")}</p>
          <div className="tj-action-row">
            <button type="button" className="tj-btn tj-btn--primary" onClick={this.retry}>
              {t("app.tryAgain")}
            </button>
            <button type="button" className="tj-btn tj-btn--ghost" onClick={this.backToMap}>
              {t("app.backToMap")}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div key={this.state.resetKey}>{this.props.children}</div>
    );
  }
}

const AppErrorBoundary = withTranslation()(AppErrorBoundaryInner);

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <UserProfileProvider>
          <LanguageDocumentSync />
          <MapScreen />
        </UserProfileProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
