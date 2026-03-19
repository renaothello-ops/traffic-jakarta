import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";

import type { Post, PostType } from "../types";
import {
  createPost,
  listenActivePosts,
  updatePost,
  deletePost,
  updatePostLocation,
} from "../assets/lib/posts";
import { suggest, type Suggestion } from "../assets/lib/search";

const JAKARTA = { lat: -6.2, lng: 106.8 };
const MY_NAME = "Driver";
const isMine = (p: Post) => (p.username ?? "") === MY_NAME;

const typeMeta: Record<PostType, { label: string; emoji: string }> = {
  accident: { label: "Accident", emoji: "🚗" },
  traffic: { label: "Traffic", emoji: "🟡" },
  construction: { label: "Construction", emoji: "🚧" },
  weather: { label: "Weather", emoji: "🌧" },
  user: { label: "User", emoji: "💬" },
  other: { label: "Other", emoji: "…" },
};

function timeAgo(ts: number) {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
}

type DraftState = {
  type: PostType;
  text: string;
  image: string | null;
  draftPos: { lat: number; lng: number } | null;
};

const DRAFT_STORAGE_KEY = "traffic_jakarta_draft";
const SELECTED_POST_KEY = "traffic_jakarta_selected_post";
const FILTER_KEY = "traffic_jakarta_filter";

export default function MapScreen() {
  const mapRef = useRef<MapRef | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [filterMin, setFilterMin] = useState<number>(() => {
    const saved = localStorage.getItem(FILTER_KEY);
    return saved ? Number(saved) : 10;
  });

  const [center, setCenter] = useState(JAKARTA);
  const [zoom, setZoom] = useState(15);

  const [openComposer, setOpenComposer] = useState(false);
  const [type, setType] = useState<PostType>("traffic");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [draftPos, setDraftPos] = useState<{ lat: number; lng: number } | null>(null);

  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const timer = useRef<number | null>(null);

  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);

  const [editing, setEditing] = useState<Post | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState<PostType>("traffic");

  const [selectedPost, setSelectedPost] = useState<Post | null>(() => {
    const raw = localStorage.getItem(SELECTED_POST_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // 投稿一覧を filter で取得
  useEffect(() => {
    const unsub = listenActivePosts(0, setPosts);
    return () => unsub();
  }, [filterMin]);

  // filter 保存
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, String(filterMin));
  }, [filterMin]);

  // selected post 保存
  useEffect(() => {
    if (selectedPost) {
      localStorage.setItem(SELECTED_POST_KEY, JSON.stringify(selectedPost));
    } else {
      localStorage.removeItem(SELECTED_POST_KEY);
    }
  }, [selectedPost]);

  // posts 更新時に最新データへ同期
  useEffect(() => {
    if (!selectedPost) return;

    const found = posts.find((p) => p.id === selectedPost.id);
    if (found) {
      setSelectedPost(found);
    } else {
      setSelectedPost(null);
    }
  }, [posts]);

  // draft 保存
  useEffect(() => {
    const draft: DraftState = {
      type,
      text,
      image,
      draftPos,
    };

    if (openComposer) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [openComposer, type, text, image, draftPos]);

  // 検索suggest
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);

    const q = searchText.trim();
    if (!q) {
      setSuggestions([]);
      setShowSug(false);
      return;
    }

    setShowSug(true);
    timer.current = window.setTimeout(async () => {
      const items = await suggest(q);
      setSuggestions(items);
    }, 300);
  }, [searchText]);

  const feed = useMemo(() => posts.slice(0, 50), [posts]);

  // 初回だけ現在地へ
  useEffect(() => {
    if (hasCenteredOnce) return;

    if (!navigator.geolocation) {
      setHasCenteredOnce(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setMyPos({ lat, lng });
        setCenter({ lat, lng });
        setZoom(14);

        mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 800 });

        setHasCenteredOnce(true);
      },
      () => {
        setHasCenteredOnce(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [hasCenteredOnce]);

  function openNewComposer() {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);

    if (raw) {
      const saved: DraftState = JSON.parse(raw);
      setType(saved.type ?? "traffic");
      setText(saved.text ?? "");
      setImage(saved.image ?? null);
      setDraftPos(saved.draftPos ?? { lat: center.lat, lng: center.lng });
    } else {
      setType("traffic");
      setText("");
      setImage(null);
      setDraftPos({
        lat: center.lat,
        lng: center.lng,
      });
    }

    setOpenComposer(true);
  }

  function resetDraft() {
    setType("traffic");
    setText("");
    setImage(null);
    setDraftPos(null);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  async function onSubmit() {
    try {
      const postLat = draftPos?.lat ?? center.lat;
      const postLng = draftPos?.lng ?? center.lng;

      await createPost({
        type,
        text,
        lat: postLat,
        lng: postLng,
        imageURL: image ?? undefined,
        username: MY_NAME,
        ttlMinutes: filterMin,
      });

      resetDraft();
      setOpenComposer(false);
    } catch (err) {
      console.error("createPost failed:", err);
      alert("Failed to post. Please try again.");
    }
  }

  function goMyLocation() {
    setLocErr(null);

    if (!navigator.geolocation) {
      setLocErr("This browser does not support location.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setMyPos({ lat, lng });

        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: Math.max(15, zoom),
          duration: 900,
        });

        setCenter({ lat, lng });
        setZoom(Math.max(15, zoom));
      },
      (err) => {
        setLocErr(
          err.code === 1
            ? "Location permission is off. Please enable it in your browser."
            : "Failed to get current location."
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function startEdit(p: Post) {
    if (!isMine(p)) return;

    setEditing(p);
    setEditText(p.text ?? "");
    setEditType(p.type);
    setSelectedPost(p);
    setDraggingPostId(null);
  }

  async function saveEdit() {
    if (!editing) return;

    await updatePost(editing.id, {
      text: editText,
      type: editType,
    });

    setDraggingPostId(null);
    setEditing(null);
  }

  async function removePost(p: Post) {
    const ok = confirm("Delete this post?");
    if (!ok) return;

    await deletePost(p.id);

    if (selectedPost?.id === p.id) {
      setSelectedPost(null);
    }
    if (editing?.id === p.id) {
      setEditing(null);
    }
    if (draggingPostId === p.id) {
      setDraggingPostId(null);
    }
  }

  // map load 後に TomTom layer 追加
  useEffect(() => {
    if (!mapReady) return;

    const map = mapRef.current?.getMap();
    if (!map) return;

    const sourceId = "tomtom-traffic";
    const layerId = "tomtom-traffic-layer";

    const addTrafficLayer = () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      map.addSource(sourceId, {
        type: "raster",
        tiles: ["/api/tomtom-flow.png?mode=relative&z={z}&x={x}&y={y}"],
        tileSize: 256,
      });

      map.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
        paint: {
          "raster-opacity": 1,
          "raster-contrast": 0.2,
          "raster-saturation": 1,
        },
      });
    };

    if (map.isStyleLoaded()) {
      addTrafficLayer();
    } else {
      map.once("load", addTrafficLayer);
    }

    const handleStyleData = () => {
      if (!map.getSource(sourceId) && map.isStyleLoaded()) {
        addTrafficLayer();
      }
    };

    map.on("styledata", handleStyleData);

    return () => {
      map.off("styledata", handleStyleData);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [mapReady]);

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <Map
        ref={mapRef}
        mapLib={maplibregl as any}
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom: 13,
        }}
        style={{ position: "absolute", inset: 0 }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        onMove={(e) => {
          setCenter({
            lat: e.viewState.latitude,
            lng: e.viewState.longitude,
          });
          setZoom(e.viewState.zoom);
        }}
        onLoad={() => {
          setMapReady(true);
        }}
      >
        {myPos && (
          <Marker longitude={myPos.lng} latitude={myPos.lat} anchor="center">
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: "#1a73e8",
                boxShadow: "0 0 0 6px rgba(26,115,232,0.25)",
                border: "2px solid white",
              }}
              aria-label="my-location"
            />
          </Marker>
        )}

        {openComposer && draftPos && (
          <Marker
            longitude={draftPos.lng}
            latitude={draftPos.lat}
            anchor="bottom"
            draggable={true}
            onDragEnd={(e) => {
              setDraftPos({
                lat: e.lngLat.lat,
                lng: e.lngLat.lng,
              });
            }}
          >
            <div
              style={{
                background: "#2563eb",
                color: "white",
                padding: "10px 12px",
                borderRadius: 999,
                fontWeight: 800,
                boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
                cursor: "grab",
              }}
              title="Drag to choose post location"
            >
              📍 New post
            </div>
          </Marker>
        )}

        {posts.map((p) => (
          <Marker
            key={p.id}
            longitude={p.lng}
            latitude={p.lat}
            anchor="bottom"
            draggable={isMine(p) && draggingPostId === p.id}
            onDragEnd={async (e) => {
              if (!isMine(p)) return;
              if (draggingPostId !== p.id) return;

              await updatePostLocation(p.id, e.lngLat.lat, e.lngLat.lng);
            }}
          >
            <button
              onClick={() => setSelectedPost(p)}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "8px 10px",
                background:
                  draggingPostId === p.id
                    ? "rgba(255,140,0,0.9)"
                    : p.type === "accident"
                    ? "#ef4444"
                    : p.type === "traffic"
                    ? "#f59e0b"
                    : p.type === "construction"
                    ? "#f97316"
                    : p.type === "weather"
                    ? "#3b82f6"
                    : p.type === "user"
                    ? "#8b5cf6"
                    : "rgba(0,0,0,0.75)",
                color: "white",
                cursor: draggingPostId === p.id ? "grab" : "pointer",
                fontWeight: 700,
              }}
              aria-label="post"
            >
              {typeMeta[p.type].emoji}
            </button>
          </Marker>
        ))}
      </Map>

      {selectedPost && (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 320,
            zIndex: 30,
            background: "white",
            borderRadius: 20,
            padding: 16,
            boxShadow: "0 14px 36px rgba(0,0,0,0.18)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              width: 42,
              height: 5,
              borderRadius: 999,
              background: "rgba(0,0,0,0.12)",
              margin: "0 auto 12px auto",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              {typeMeta[selectedPost.type].emoji} {typeMeta[selectedPost.type].label}
            </div>
            <button
              onClick={() => setSelectedPost(null)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
            {timeAgo(selectedPost.createdAt)}
          </div>

          <div style={{ marginTop: 10, fontSize: 16, lineHeight: 1.5 }}>
            {selectedPost.text || "No description"}
          </div>

          {selectedPost.imageURL && (
            <img
              src={selectedPost.imageURL}
              style={{
                width: "100%",
                marginTop: 10,
                borderRadius: 12,
                objectFit: "cover",
                maxHeight: 240,
              }}
            />
          )}

          {editing?.id === selectedPost.id && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#d97706",
                fontWeight: 700,
              }}
            >
              Tap "Move marker", drag the marker, then tap "Fix marker".
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => startEdit(selectedPost)}
              style={{
                padding: "9px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ✏️ Edit
            </button>

            <button
              onClick={() => removePost(selectedPost)}
              style={{
                padding: "9px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              🗑 Delete
            </button>

            <button
              onClick={() => {
                mapRef.current?.flyTo({
                  center: [selectedPost.lng, selectedPost.lat],
                  zoom: Math.max(16, zoom),
                  duration: 700,
                });
              }}
              style={{
                padding: "9px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              📍 Focus
            </button>

            {isMine(selectedPost) && (
              <>
                <button
                  onClick={() => {
                    setDraggingPostId(selectedPost.id);
                  }}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  🟠 Move marker
                </button>

                <button
                  onClick={() => {
                    setDraggingPostId(null);
                  }}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  📌 Fix marker
                </button>
              </>
            )}

            <button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPost.lat},${selectedPost.lng}`;
                window.open(url, "_blank");
              }}
              style={{
                padding: "9px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              🧭 Navigate
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          right: 10,
          display: "grid",
          gap: 10,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={filterMin}
            onChange={(e) => setFilterMin(Number(e.target.value))}
            style={{
              padding: 10,
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "rgba(255,255,255,0.95)",
            }}
          >
            <option value={10}>10 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={180}>3 hours</option>
            <option value={1440}>1 day</option>
          </select>

          <button
            onClick={openNewComposer}
            style={{
              padding: 10,
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "rgba(255,255,255,0.95)",
              cursor: "pointer",
            }}
          >
            ➕ Post
          </button>

          <div
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.95)",
              border: "1px solid #ddd",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Posts: {feed.length}
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search place"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px solid #ddd",
              background: "rgba(255,255,255,0.95)",
              outline: "none",
            }}
          />

          {showSug && (
            <div
              style={{
                marginTop: 8,
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.98)",
              }}
            >
              {suggestions.length === 0 ? (
                <div style={{ padding: 12, opacity: 0.7 }}>Type to search…</div>
              ) : (
                suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      mapRef.current?.flyTo({
                        center: [s.lng, s.lat],
                        zoom: Math.max(14, zoom),
                        duration: 800,
                      });
                      setCenter({ lat: s.lat, lng: s.lng });
                      setSearchText(s.title);
                      setShowSug(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      borderTop:
                        idx === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{s.title}</div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.subtitle}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 270,
          zIndex: 15,
          display: "grid",
          gap: 8,
        }}
      >
        <button
          onClick={goMyLocation}
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "rgba(255,255,255,0.95)",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          📍 lokasi saat ini
        </button>
        {locErr && (
          <div
            style={{
              maxWidth: 240,
              padding: 10,
              borderRadius: 12,
              background: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(0,0,0,0.08)",
              fontSize: 12,
            }}
          >
            ⚠️ {locErr}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: 10,
          zIndex: 10,
          background: "rgba(255,255,255,0.92)",
          borderRadius: 16,
          padding: 12,
          maxHeight: 240,
          overflow: "auto",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Feed</div>
        {feed.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No posts</div>
        ) : (
          feed.map((p) => (
            <div
              key={p.id}
              style={{
                padding: "10px 0",
                borderTop: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>{typeMeta[p.type].emoji}</div>
                <div style={{ fontWeight: 700 }}>{typeMeta[p.type].label}</div>
                <div
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    opacity: 0.6,
                  }}
                >
                  {timeAgo(p.createdAt)}
                </div>
              </div>

              {p.text ? (
                <div style={{ marginTop: 6 }}>{p.text}</div>
              ) : (
                <div style={{ marginTop: 6, opacity: 0.5 }}>(no text)</div>
              )}

              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => startEdit(p)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => removePost(p)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  🗑 Delete
                </button>
                <button
                  onClick={() => setSelectedPost(p)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Open
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {openComposer && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              background: "white",
              width: "100%",
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 900 }}>New Post ({filterMin} min)</div>
              <button
                onClick={() => {
                  setOpenComposer(false);
                  resetDraft();
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {(Object.keys(typeMeta) as PostType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: t === type ? "2px solid black" : "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  {typeMeta[t].emoji} {typeMeta[t].label}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Text (optional)"
              style={{
                width: "100%",
                marginTop: 10,
                height: 80,
                borderRadius: 12,
                border: "1px solid #ddd",
                padding: 10,
              }}
            />

            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = () => {
                  setImage(reader.result as string);
                };
                reader.readAsDataURL(file);
              }}
              style={{ marginTop: 10 }}
            />

            {image && (
              <img
                src={image}
                style={{
                  width: "100%",
                  marginTop: 10,
                  borderRadius: 12,
                  objectFit: "cover",
                  maxHeight: 220,
                }}
              />
            )}

            <button
              onClick={onSubmit}
              style={{
                width: "100%",
                marginTop: 10,
                padding: 12,
                borderRadius: 14,
                border: "none",
                background: "black",
                color: "white",
                fontWeight: 900,
              }}
            >
              Post here
            </button>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
              Drag the blue marker to choose post location
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              background: "white",
              width: "100%",
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 900 }}>Edit Post</div>
              <button
                onClick={() => setEditing(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {(Object.keys(typeMeta) as PostType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setEditType(t)}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border:
                      t === editType ? "2px solid black" : "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  {typeMeta[t].emoji} {typeMeta[t].label}
                </button>
              ))}
            </div>

            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Text"
              style={{
                width: "100%",
                marginTop: 10,
                height: 90,
                borderRadius: 12,
                border: "1px solid #ddd",
                padding: 10,
              }}
            />

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Tap "Move marker" in the post card, drag the marker on the map, then tap "Fix marker".
            </div>

            <button
              onClick={saveEdit}
              style={{
                width: "100%",
                marginTop: 10,
                padding: 12,
                borderRadius: 14,
                border: "none",
                background: "black",
                color: "white",
                fontWeight: 900,
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}