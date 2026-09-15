import { useEffect, useRef, useState } from "react";
import type { PostType } from "../types";
import { REPORT_TYPE_META } from "../assets/lib/reportTypes";
import type { QuickReportLocation } from "../assets/lib/quickReportLocation";

export const QUICK_REPORT_TYPES: PostType[] = [
  "accident",
  "heavy_traffic",
  "flooded",
  "road_closed",
  "hazard",
  "car_passable",
  "other",
];

type Props = {
  open: boolean;
  location: QuickReportLocation | null;
  submitting: boolean;
  error: string | null;
  isSignedIn: boolean;
  onSignIn: () => void;
  onClose: () => void;
  onPost: (input: {
    type: PostType;
    text?: string;
    image?: string | null;
  }) => void | Promise<void>;
};

export default function QuickReportSheet({
  open,
  location,
  submitting,
  error,
  isSignedIn,
  onSignIn,
  onClose,
  onPost,
}: Props) {
  const [selectedType, setSelectedType] = useState<PostType | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedType(null);
    setShowDetails(false);
    setText("");
    setImage(null);
  }, [open]);

  if (!open) return null;

  const canPost = Boolean(location && selectedType && isSignedIn && !submitting);

  async function handlePost(type: PostType) {
    if (!location || !isSignedIn || submitting) return;
    await onPost({
      type,
      text: text.trim() || undefined,
      image,
    });
  }

  return (
    <div className="tj-quick-report-backdrop" onClick={onClose}>
      <div
        className="tj-quick-report-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Quick report"
      >
        <div className="tj-sheet__handle" />
        <div className="tj-quick-report-sheet__head">
          <h2 className="tj-quick-report-sheet__title">Quick report</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose} aria-label="Cancel">
            ✕
          </button>
        </div>

        <p className="tj-quick-report-sheet__location">
          {location ? "📍 Current location" : "Waiting for current location…"}
        </p>

        {!isSignedIn ? (
          <div className="tj-quick-report-sheet__auth">
            <p className="tj-hint">Sign in to post a report while navigating.</p>
            <button type="button" className="tj-btn tj-btn--primary tj-btn--compact" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        ) : (
          <>
            <div className="tj-quick-report-grid">
              {QUICK_REPORT_TYPES.map((type) => {
                const meta = REPORT_TYPE_META[type];
                const selected = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`tj-quick-report-type${selected ? " tj-quick-report-type--selected" : ""}`}
                    onClick={() => setSelectedType(type)}
                    disabled={!location || submitting}
                  >
                    <span className="tj-quick-report-type__emoji" aria-hidden>
                      {meta.emoji}
                    </span>
                    <span className="tj-quick-report-type__label">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {showDetails && (
              <div className="tj-quick-report-details">
                <textarea
                  className="tj-textarea tj-textarea--compact"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Short note (optional)"
                  rows={2}
                />
                <div className="tj-quick-report-details__actions">
                  <button
                    type="button"
                    className="tj-btn tj-btn--ghost tj-btn--compact"
                    onClick={() => fileRef.current?.click()}
                  >
                    📷 Photo
                  </button>
                  {"webkitSpeechRecognition" in window || "SpeechRecognition" in window ? (
                    <button
                      type="button"
                      className="tj-btn tj-btn--ghost tj-btn--compact"
                      onClick={() => {
                        type SpeechRecognitionCtor = new () => {
                          lang: string;
                          interimResults: boolean;
                          maxAlternatives: number;
                          onresult: ((ev: { results: Array<Array<{ transcript: string }>> }) => void) | null;
                          start: () => void;
                        };
                        const W = window as Window & {
                          SpeechRecognition?: SpeechRecognitionCtor;
                          webkitSpeechRecognition?: SpeechRecognitionCtor;
                        };
                        const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
                        if (!SR) return;
                        const rec = new SR();
                        rec.lang = "en-US";
                        rec.interimResults = false;
                        rec.maxAlternatives = 1;
                        rec.onresult = (ev) => {
                          const transcript = ev.results[0]?.[0]?.transcript;
                          if (transcript) {
                            setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
                          }
                        };
                        rec.start();
                      }}
                    >
                      🎤 Note
                    </button>
                  ) : null}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="tj-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file || !file.type.startsWith("image/") || file.size > 1_500_000) return;
                    const reader = new FileReader();
                    reader.onload = () => setImage(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                {image ? (
                  <img src={image} alt="Report preview" className="tj-preview-img tj-preview-img--compact" />
                ) : null}
              </div>
            )}

            {error ? <p className="tj-error">{error}</p> : null}

            <div className="tj-quick-report-sheet__actions">
              <button
                type="button"
                className="tj-btn tj-btn--primary"
                disabled={!canPost}
                onClick={() => selectedType && void handlePost(selectedType)}
              >
                {submitting ? "Posting…" : "Post"}
              </button>
              {!showDetails ? (
                <button
                  type="button"
                  className="tj-btn tj-btn--ghost"
                  onClick={() => setShowDetails(true)}
                  disabled={!selectedType}
                >
                  Add details
                </button>
              ) : null}
              <button type="button" className="tj-btn tj-btn--ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
