import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidPostImageURL } from "../src/assets/lib/postImageValidation.mjs";

test("isValidPostImageURL accepts data URLs and Firebase Storage https URLs", () => {
  assert.equal(
    isValidPostImageURL(
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD"
    ),
    true
  );
  assert.equal(
    isValidPostImageURL(
      "https://firebasestorage.googleapis.com/v0/b/x/o/postPhotos%2Fu%2Fp.jpg?alt=media"
    ),
    true
  );
  assert.equal(isValidPostImageURL("https://evil.example/photo.jpg"), false);
  assert.equal(isValidPostImageURL(""), false);
});
