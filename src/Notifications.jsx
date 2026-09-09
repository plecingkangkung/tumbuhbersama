import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Heart,
  MessageCircle,
  CheckCheck,
  RefreshCw,
} from "lucide-react";
const timestamp = (value) =>
  new Date(String(value).replace(" ", "T")).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
async function api(path = "", options = {}) {
  const response = await fetch("/api/notifications" + path, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Notifikasi belum dapat dimuat.");
  return data;
}
export default function Notifications({ onOpen }) {
  const [data, setData] = useState({
      items: [],
      unread: 0,
      total: 0,
      page: 1,
      pageSize: 20,
    }),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const menu = useRef(null),
    request = useRef(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await api("?page=" + page, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setData(result);
      setError("");
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    const initialLoad = setTimeout(refresh, 0);
    const update = () => {
      if (!document.hidden) refresh();
    };
    const interval = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
      window.removeEventListener("focus", update);
      request.current?.abort();
    };
  }, [refresh]);
  async function read(item) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/" + item.id + "/read", { method: "PUT", body: "{}" });
      request.current?.abort();
      setData((d) => ({
        ...d,
        unread: Math.max(0, d.unread - (item.read_at ? 0 : 1)),
        items: d.items.map((n) =>
          n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      }));
      menu.current.open = false;
      onOpen(item.topic_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="notification-menu"
      ref={menu}
      onToggle={(e) => {
        if (e.currentTarget.open) refresh();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget))
          e.currentTarget.open = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.open = false;
          e.currentTarget.querySelector("summary").focus();
        }
      }}
    >
      <summary
        aria-label={`Notifikasi, ${data.unread} belum dibaca`}
        title="Notifikasi"
      >
        <Bell size={21} />
        {data.unread > 0 && (
          <span className="notification-badge">
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </summary>
      <div className="notification-panel">
        <div className="notification-heading">
          <h2>Notifikasi</h2>
          <button
            aria-label="Muat ulang notifikasi"
            className="icon-button"
            disabled={busy}
            onClick={refresh}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <div className="notification-tools">
          <span>{data.unread} belum dibaca</span>
          <button
            disabled={busy || !data.unread}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/read-all", { method: "PUT", body: "{}" });
                await refresh();
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckCheck size={15} />
            Tandai semua dibaca
          </button>
        </div>
        {error && (
          <p role="alert" className="notification-error">
            {error}
          </p>
        )}
        <div className="notification-list" aria-busy={loading}>
          {loading ? (
            <p className="notification-empty">Memuat notifikasi…</p>
          ) : data.items.length ? (
            data.items.map((item) => (
              <button
                key={item.id}
                disabled={busy}
                className={`notification-item ${item.read_at ? "" : "unread"}`}
                onClick={() => read(item)}
              >
                <span className={"notification-icon " + item.kind}>
                  {item.kind === "like" ? (
                    <Heart size={17} />
                  ) : (
                    <MessageCircle size={17} />
                  )}
                </span>
                <span className="notification-copy">
                  <span>
                    <strong>{item.actor_name}</strong>{" "}
                    {item.kind === "like" ? "menyukai" : "membalas"} diskusimu
                  </span>
                  <span className="notification-title">{item.topic_title}</span>
                  <span className="notification-date">
                    {timestamp(item.created_at)}
                    {!item.read_at ? " · Belum dibaca" : ""}
                  </span>
                </span>
                {!item.read_at && (
                  <span className="notification-dot" aria-hidden="true" />
                )}
              </button>
            ))
          ) : (
            !error && (
              <div className="notification-empty">
                <Bell size={25} />
                <strong>Belum ada notifikasi</strong>
                <p>Balasan dan like dari mom lainnya akan muncul di sini.</p>
              </div>
            )
          )}
        </div>
        {data.total > 20 && (
          <div className="notification-pagination">
            <button
              disabled={page <= 1 || busy}
              onClick={() => {
                setLoading(true);
                setPage((p) => p - 1);
              }}
            >
              Sebelumnya
            </button>
            <span>
              {page} / {Math.ceil(data.total / 20)}
            </span>
            <button
              disabled={page >= Math.ceil(data.total / 20) || busy}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
            >
              Berikutnya
            </button>
          </div>
        )}
        <p className="notification-footnote">
          Diperbarui otomatis setiap 30 detik.
        </p>
      </div>
    </details>
  );
}
