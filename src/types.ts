export type PostType =
  | "accident"
  | "traffic"
  | "construction"
  | "weather"
  | "user"
  | "other";

export type Post = {
  id: string;
  type: PostType;
  text?: string;
  lat: number;
  lng: number;
  createdAt: number;
  expiresAt: number;
  imageURL?: string;
  username?: string;
};