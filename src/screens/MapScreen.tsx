import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";

import type { Post, PostType } from "../types";
import { createPost, listenActivePosts, updatePost, deletePost, updatePostLocation } from "../assets/lib/posts";
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

function minutesAgo(ts: number) {
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}

export default function MapScreen() {
  const mapRef = useRef<MapRef | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [filterMin, setFilterMin] = useState(10);

  const [center, setCenter] = useState(JAKARTA);
  const [zoom, setZoom] = useState(15);

  // composer
  const [openComposer, setOpenComposer] = useState(false);
  const [type, setType] = useState<PostType>("traffic");
  const [text, setText] = useState("");

  // search
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const timer = useRef<number | null>(null);

  // my location
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);

  // edit modal
  const [editing, setEditing] = useState<Post | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState<PostType>("traffic");

  // -----------------------------
  // Listen posts
  // -----------------------------
  useEffect(() => {
    const unsub = listenActivePosts(filterMin, setPosts);
    return () => unsub();
  }, [filterMin]);

  // -----------------------------
  // Search suggest debounce
  // -----------------------------
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

  // -----------------------------
  // 初回だけ現在地へ寄せる
  // -----------------------------
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

        // map が準備できていれば fly
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 800 });

        setHasCenteredOnce(true);
      },
      () => {
        // 失敗/拒否は Jakarta のまま
        setHasCenteredOnce(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [hasCenteredOnce]);

  // -----------------------------
  // 新規投稿を開くたびリセット
  // -----------------------------
  function openNewComposer() {
    setType("traffic");
    setText("");
    setOpenComposer(true);
  }

  // -----------------------------
  // Submit
  // -----------------------------
  async function onSubmit() {
    await createPost({
      type,
      text,
      lat: center.lat,
      lng: center.lng,
      username: MY_NAME,
      ttlMinutes: filterMin,
    });

    // ✅ 次の投稿に備えてリセット
    setText("");
    setType("traffic");
    setOpenComposer(false);
  }

  // -----------------------------
  // 現在地へ
  // -----------------------------
  function goMyLocation() {
    setLocErr(null);

    if (!navigator.geolocation) {
      setLocErr("このブラウザは位置情報に対応していません");
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
        setLocErr(err.code === 1 ? "位置情報の許可がOFFです（ブラウザで許可してね）" : "位置情報の取得に失敗しました");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // -----------------------------
  // 編集
  // -----------------------------
  function startEdit(p: Post) {
    setEditing(p);
    setEditText(p.text ?? "");
    setEditType(p.type);
  }

  async function saveEdit() {
    if (!editing) return;
    await updatePost(editing.id, { text: editText, type: editType });
    setEditing(null);
  }

  // -----------------------------
  // 削除
  // -----------------------------
  async function removePost(p: Post) {
    const ok = confirm("削除する？");
    if (!ok) return;
    await deletePost(p.id);
  }

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <Map
        ref={mapRef}
        mapLib={maplibregl as any}
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom }}
        style={{ position: "absolute", inset: 0 }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        onMove={(e) => {
          setCenter({ lat: e.viewState.latitude, lng: e.viewState.longitude });
          setZoom(e.viewState.zoom);
        }}
      >
        {/* ✅ TomTom 渋滞 overlay（/api/tomtom が 200 で PNG を返すときだけ見える） */}
        <Source
          id="tomtom-traffic"
          type="raster"
          tiles={["/api/tomtom/flow/relative/{z}/{x}/{y}.png"]}
          tileSize={256}
        >
          <Layer
            id="tomtom-traffic-layer"
            type="raster"
            paint={{
              "raster-opacity": 0.85,
            }}
          />
        </Source>

        {/* ✅ 自分の現在地マーカー */}
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

        {/* ✅ 投稿マーカー（自分の投稿だけドラッグ可） */}
        {posts.map((p) => (
          <Marker
            key={p.id}
            longitude={p.lng}
            latitude={p.lat}
            anchor="bottom"
            draggable={isMine(p)}
            onDragEnd={async (e) => {
              await updatePostLocation(p.id, e.lngLat.lat, e.lngLat.lng);
            }}
          >
            <button
              onClick={() =>
                alert(
                  `${typeMeta[p.type].emoji} ${typeMeta[p.type].label}\n${minutesAgo(p.createdAt)} min ago\n${p.text ?? ""}`
                )
              }
              style={{
                border: "none",
                borderRadius: 999,
                padding: "8px 10px",
                background: "rgba(0,0,0,0.75)",
                color: "white",
                cursor: isMine(p) ? "grab" : "pointer",
              }}
              aria-label="post"
              title={isMine(p) ? "Drag to move" : "Read only"}
            >
              {typeMeta[p.type].emoji}
            </button>
          </Marker>
        ))}
      </Map>

      {/* 上部バー */}
      <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "grid", gap: 10, zIndex: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={filterMin}
            onChange={(e) => setFilterMin(Number(e.target.value))}
            style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd", background: "rgba(255,255,255,0.95)" }}
          >
            <option value={10}>10 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={180}>3 hours</option>
          </select>

          <button
            onClick={openNewComposer}
            style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd", background: "rgba(255,255,255,0.95)", cursor: "pointer" }}
          >
            ➕ Post
          </button>

          <div style={{ flex: 1 }} />
        </div>

        {/* 検索バー */}
        <div style={{ position: "relative" }}>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search place"
            style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid #ddd", background: "rgba(255,255,255,0.95)", outline: "none" }}
          />

          {showSug && (
            <div style={{ marginTop: 8, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.98)" }}>
              {suggestions.length === 0 ? (
                <div style={{ padding: 12, opacity: 0.7 }}>Type to search…</div>
              ) : (
                suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      mapRef.current?.flyTo({ center: [s.lng, s.lat], zoom: Math.max(14, zoom), duration: 800 });
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
                      borderTop: idx === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{s.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.subtitle}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 右下：現在地ボタン */}
      <div style={{ position: "absolute", right: 12, bottom: 270, zIndex: 15, display: "grid", gap: 8 }}>
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
          <div style={{ maxWidth: 240, padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}>
            ⚠️ {locErr}
          </div>
        )}
      </div>

      {/* 下部Feed（編集・削除） */}
      <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 10, background: "rgba(255,255,255,0.92)", borderRadius: 16, padding: 12, maxHeight: 240, overflow: "auto" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Feed</div>
        {feed.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No posts</div>
        ) : (
          feed.map((p) => (
            <div key={p.id} style={{ padding: "10px 0", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>{typeMeta[p.type].emoji}</div>
                <div style={{ fontWeight: 700 }}>{typeMeta[p.type].label}</div>
                <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>{minutesAgo(p.createdAt)} min</div>
              </div>

              {p.text ? <div style={{ marginTop: 6 }}>{p.text}</div> : <div style={{ marginTop: 6, opacity: 0.5 }}>(no text)</div>}

              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button
                  onClick={() => startEdit(p)}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", cursor: "pointer", fontWeight: 700 }}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => removePost(p)}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", cursor: "pointer", fontWeight: 700 }}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      {openComposer && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "white", width: "100%", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>New Post（{filterMin} min）</div>
              <button onClick={() => setOpenComposer(false)} style={{ border: "none", background: "transparent", fontSize: 18 }}>✕</button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {(Object.keys(typeMeta) as PostType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{ padding: 10, borderRadius: 12, border: t === type ? "2px solid black" : "1px solid #ddd", background: "white", cursor: "pointer", fontWeight: 800 }}
                >
                  {typeMeta[t].emoji} {typeMeta[t].label}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Text (optional)"
              style={{ width: "100%", marginTop: 10, height: 80, borderRadius: 12, border: "1px solid #ddd", padding: 10 }}
            />

            <button
              onClick={onSubmit}
              style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 14, border: "none", background: "black", color: "white", fontWeight: 900 }}
            >
              Post here (map center)
            </button>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>Location = current map center</div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "white", width: "100%", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>Edit</div>
              <button onClick={() => setEditing(null)} style={{ border: "none", background: "transparent", fontSize: 18 }}>✕</button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {(Object.keys(typeMeta) as PostType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setEditType(t)}
                  style={{ padding: 10, borderRadius: 12, border: t === editType ? "2px solid black" : "1px solid #ddd", background: "white", cursor: "pointer", fontWeight: 800 }}
                >
                  {typeMeta[t].emoji} {typeMeta[t].label}
                </button>
              ))}
            </div>

            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Text"
              style={{ width: "100%", marginTop: 10, height: 90, borderRadius: 12, border: "1px solid #ddd", padding: 10 }}
            />

            <button
              onClick={saveEdit}
              style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 14, border: "none", background: "black", color: "white", fontWeight: 900 }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
