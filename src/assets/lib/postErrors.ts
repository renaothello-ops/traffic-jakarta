import { FirebaseError } from "firebase/app";

function isDevBuild(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    Boolean(import.meta.env.DEV)
  );
}

/** Returns an i18n key for user-facing post errors (never Firebase internals). */
export function createPostErrorMessageKey(error: unknown): string {
  if (isDevBuild()) {
    if (error instanceof FirebaseError) {
      console.error("[createPost]", { code: error.code, message: error.message });
    } else if (error instanceof Error) {
      console.error("[createPost]", { message: error.message });
    } else {
      console.error("[createPost]", error);
    }
  }

  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "permission-denied":
        return "errors.postPermissionDenied";
      case "unavailable":
      case "deadline-exceeded":
      case "resource-exhausted":
        return "errors.postUnavailable";
      case "failed-precondition":
        return "errors.postFailedPrecondition";
      default:
        return "errors.postSaveFailed";
    }
  }

  if (error instanceof Error) {
    if (error.message.startsWith("composer.")) return error.message;
    const msg = error.message.toLowerCase();
    if (msg.includes("sign in")) return "errors.composerSignIn";
    if (msg.includes("location")) return "errors.postInvalidLocation";
    if (msg.includes("image")) return "errors.postInvalidImage";
    if (msg.includes("report type")) return "errors.postInvalidType";
  }

  return "errors.postSaveFailed";
}
