import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FirebaseError } from "firebase/app";

// Dynamic import so Vite env shims are not required
const { createPostErrorMessageKey } = await import(
  "../src/assets/lib/postErrors.ts"
);

describe("createPostErrorMessageKey", () => {
  it("maps Firebase error codes to i18n keys", () => {
    assert.equal(
      createPostErrorMessageKey(
        new FirebaseError("permission-denied", "rules")
      ),
      "errors.postPermissionDenied"
    );
    assert.equal(
      createPostErrorMessageKey(new FirebaseError("unavailable", "net")),
      "errors.postUnavailable"
    );
    assert.equal(
      createPostErrorMessageKey(
        new FirebaseError("failed-precondition", "pre")
      ),
      "errors.postFailedPrecondition"
    );
  });

  it("maps validation errors", () => {
    assert.equal(
      createPostErrorMessageKey(new Error("Please sign in to post.")),
      "errors.composerSignIn"
    );
    assert.equal(
      createPostErrorMessageKey(new Error("Invalid report location.")),
      "errors.postInvalidLocation"
    );
  });

  it("falls back to generic save failure", () => {
    assert.equal(createPostErrorMessageKey(new Error("unknown")), "errors.postSaveFailed");
  });
});
