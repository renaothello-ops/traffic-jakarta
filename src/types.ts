export type PostType = "accident" | "traffic" | "construction" | "weather" | "user" | "other";

export type Post = {
  id: string;
  type: PostType;
  text?: string;
  lat: number;
  lng: number;
  createdAt: number; // ms
  expiresAt: number; // ms
  imageURL?: string;
  username?: string;
};
