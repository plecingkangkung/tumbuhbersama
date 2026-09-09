import { useEffect, useRef, useState } from "react";
import {
  MessagesSquare,
  MessageCircle,
  Plus,
  Search,
  ArrowLeft,
  Send,
  Trash2,
  Users,
  RefreshCw,
} from "lucide-react";
const categories = [
  "Cerita sehari-hari",
  "Tumbuh kembang",
  "MPASI & nutrisi",
  "Tidur & kesehatan",
  "Dukungan untuk mom",
];
const formatDate = (value) =>
  new Date(String(value).replace(" ", "T")).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
async function request(path = "", options = {}) {
  const r = await fetch("/api/forum" + path, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "Forum belum dapat dimuat. Coba kembali.");
  return data;
}
const send = (path, body) =>
  request(path, { method: "POST", body: JSON.stringify(body) });
function Author({ name, date }) {
  return (
    <div className="forum-author">
      <span className="forum-avatar" aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div>
        <strong>{name}</strong>
        <span className="fine">{formatDate(date)}</span>
      </div>
    </div>
  );
}
function Pager({ page, total, pageSize, onChange, disabled = false }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return pages > 1 ? (
    <div className="forum-pager">
      <button
        className="secondary"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Sebelumnya
      </button>
      <span className="fine">
        Halaman {page} dari {pages}
      </span>
      <button
        className="secondary"
        disabled={disabled || page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Berikutnya
      </button>
    </div>
  ) : null;
}
function TopicList({ open, refresh }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    request("?" + new URLSearchParams({ q: search, category, page }), {
      signal: abort.signal,
    })
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [search, category, page, retry, refresh]);
  function changePage(p) {
    setLoading(true);
    setPage(p);
  }
  return (
    <>
      <div className="forum-controls">
        <form
          className="article-search"
          onSubmit={(e) => {
            e.preventDefault();
            setLoading(true);
            setPage(1);
            setSearch(query.trim());
            setRetry((n) => n + 1);
          }}
        >
          <Search size={19} />
          <input
            aria-label="Cari diskusi"
            placeholder="Cari cerita atau pertanyaan…"
            maxLength={120}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="text-button">
            Cari
          </button>
        </form>
        <select
          aria-label="Kategori diskusi"
          value={category}
          onChange={(e) => {
            setLoading(true);
            setPage(1);
            setCategory(e.target.value);
          }}
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          className="secondary"
          aria-label="Muat ulang diskusi"
          onClick={() => {
            setLoading(true);
            setRetry((n) => n + 1);
          }}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      {loading ? (
        <p className="empty" role="status">
          Memuat diskusi…
        </p>
      ) : error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : (
        <>
          <p className="fine forum-count" role="status">
            {data?.total || 0} diskusi · Terbaru lebih dahulu
          </p>
          {data?.items.length ? (
            <div className="forum-topic-list">
              {data.items.map((t) => (
                <article className="card forum-topic" key={t.id}>
                  <div className="forum-topic-main">
                    <span className="forum-category">{t.category}</span>
                    <h2>
                      <button
                        className="forum-topic-link"
                        onClick={() => open(t.id)}
                      >
                        {t.title}
                      </button>
                    </h2>
                    <p className="muted forum-excerpt">{t.excerpt}</p>
                    <Author name={t.author_name} date={t.created_at} />
                  </div>
                  <span className="forum-replies">
                    <MessageCircle size={20} />
                    {t.comment_count}
                    <span>balasan</span>
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="card empty">
              <MessagesSquare size={42} />
              <h2>
                {search || category
                  ? "Belum ada diskusi yang cocok"
                  : "Cerita pertama bisa dimulai darimu"}
              </h2>
              <p>
                {search || category
                  ? "Coba kata kunci atau kategori lain."
                  : "Bagikan pengalaman, ajukan pertanyaan, atau sapa mom lainnya."}
              </p>
              {search || category ? (
                <button
                  className="secondary"
                  onClick={() => {
                    setQuery("");
                    setSearch("");
                    setCategory("");
                    setPage(1);
                    setLoading(true);
                    setRetry((n) => n + 1);
                  }}
                >
                  Tampilkan semua
                </button>
              ) : (
                <button className="primary" onClick={() => open("new")}>
                  <Plus size={18} />
                  Mulai diskusi
                </button>
              )}
            </div>
          )}
          <Pager
            page={page}
            total={data?.total || 0}
            pageSize={20}
            onChange={changePage}
          />
        </>
      )}
    </>
  );
}
function NewTopic({ onCreated, onCancel }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="card forum-compose">
      <h2>Mulai diskusi baru</h2>
      <p className="muted">Apa yang ingin kamu ceritakan hari ini?</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const t = await send(
              "",
              Object.fromEntries(new FormData(e.target)),
            );
            onCreated(t.id);
          } catch (e) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Judul diskusi</span>
          <input
            autoFocus
            name="title"
            required
            maxLength={160}
            placeholder="Misalnya: Bagaimana rutinitas membaca bersama si kecil?"
          />
        </label>
        <label className="field">
          <span>Kategori</span>
          <select name="category">
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cerita atau pertanyaan</span>
          <textarea
            name="body"
            required
            maxLength={5000}
            rows={8}
            placeholder="Ceritakan pengalamanmu atau hal yang ingin kamu diskusikan…"
          />
        </label>
        <p className="fine">
          Kiriman dapat dibaca semua pengguna yang login. Hindari mencantumkan
          alamat, nomor telepon, atau data pribadi anak.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="forum-actions">
          <button
            type="button"
            disabled={busy}
            className="secondary"
            onClick={onCancel}
          >
            Batal
          </button>
          <button disabled={busy} className="primary">
            <Send size={17} />
            {busy ? "Menerbitkan…" : "Terbitkan diskusi"}
          </button>
        </div>
      </form>
    </section>
  );
}
function Discussion({ id, onBack }) {
  const [topic, setTopic] = useState(null),
    [comments, setComments] = useState(null),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reply, setReply] = useState("");
  const heading = useRef(null);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      request("/" + id, { signal: abort.signal }),
      request(`/${id}/comments?page=${page}`, { signal: abort.signal }),
    ])
      .then(([t, c]) => {
        setTopic(t);
        setComments(c);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [id, page, refresh]);
  useEffect(() => {
    heading.current?.focus();
  }, [topic?.id]);
  async function remove(commentId) {
    const message = commentId
      ? "Hapus komentarmu?"
      : "Hapus diskusi ini beserta seluruh balasannya? Tindakan ini tidak dapat dibatalkan.";
    if (!window.confirm(message)) return;
    setBusy(true);
    setError("");
    try {
      await request("/" + id + (commentId ? "/comments/" + commentId : ""), {
        method: "DELETE",
        body: "{}",
      });
      if (!commentId) {
        onBack();
        return;
      }
      setPage((p) =>
        Math.min(p, Math.max(1, Math.ceil((comments.total - 1) / 50))),
      );
      setRefresh((n) => n + 1);
      setNotice("Komentar dihapus.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="secondary" onClick={onBack}>
        <ArrowLeft size={17} />
        Semua diskusi
      </button>
      {error && (
        <div className="error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => {
              setLoading(true);
              setRefresh((n) => n + 1);
            }}
          >
            Coba lagi
          </button>
        </div>
      )}
      {loading && !topic ? (
        <p className="empty" role="status">
          Memuat percakapan…
        </p>
      ) : (
        topic && (
          <>
            <article className="card forum-discussion">
              <div className="section-heading">
                <span className="forum-category">{topic.category}</span>
                {Boolean(topic.is_owner) && (
                  <button
                    className="forum-delete"
                    disabled={busy}
                    onClick={() => remove()}
                  >
                    <Trash2 size={16} />
                    Hapus diskusi
                  </button>
                )}
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {topic.title}
              </h1>
              <Author name={topic.author_name} date={topic.created_at} />
              <p className="forum-body">{topic.body}</p>
            </article>
            <section className="card forum-comments">
              <div className="section-heading">
                <h2>
                  Obrolan bersama{" "}
                  <span className="muted">({comments?.total || 0})</span>
                </h2>
                <button
                  className="icon-button"
                  aria-label="Muat ulang komentar"
                  disabled={busy}
                  onClick={() => setRefresh((n) => n + 1)}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              {notice && (
                <p className="success" role="status">
                  {notice}
                </p>
              )}
              {comments?.items.length ? (
                comments.items.map((c) => (
                  <article className="forum-comment" key={c.id}>
                    <div className="section-heading">
                      <Author name={c.author_name} date={c.created_at} />
                      {Boolean(c.is_owner) && (
                        <button
                          className="forum-delete"
                          disabled={busy}
                          aria-label={"Hapus komentar " + c.author_name}
                          onClick={() => remove(c.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <p className="forum-body">{c.body}</p>
                  </article>
                ))
              ) : (
                <p className="muted forum-no-comments">
                  Belum ada balasan. Jadilah yang pertama menyapa.
                </p>
              )}
              <Pager
                page={page}
                total={comments?.total || 0}
                pageSize={50}
                disabled={busy}
                onChange={setPage}
              />
              <form
                className="forum-reply-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    await send("/" + id + "/comments", { body: reply });
                    setReply("");
                    const t = await request("/" + id);
                    setPage(Math.max(1, Math.ceil(t.comment_count / 50)));
                    setRefresh((n) => n + 1);
                    setNotice("Balasanmu berhasil dikirim.");
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="field">
                  <span>Tulis balasan</span>
                  <textarea
                    required
                    maxLength={2000}
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Bagikan pengalaman atau dukungan dengan bahasa yang baik…"
                  />
                </label>
                <div className="forum-actions">
                  <span className="fine">{reply.length}/2.000 karakter</span>
                  <button className="primary" disabled={busy || !reply.trim()}>
                    <Send size={17} />
                    {busy ? "Memproses…" : "Kirim balasan"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )
      )}
    </>
  );
}
export default function Forum() {
  const [view, setView] = useState("list"),
    [refresh, setRefresh] = useState(0);
  const back = () => {
    setView("list");
    setRefresh((n) => n + 1);
  };
  return (
    <section className="forum-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">RUANG CERITA, RUANG DUKUNGAN</span>
          <h1>Forum sesama mom</h1>
          <p className="muted">
            Berbagi pengalaman. Saling mendengar. Tumbuh bersama.
          </p>
        </div>
        {view === "list" && (
          <button className="primary" onClick={() => setView("new")}>
            <Plus size={18} />
            Mulai diskusi
          </button>
        )}
      </div>
      <aside className="forum-welcome">
        <Users size={24} />
        <p>
          Mari saling menghargai dan menjaga privasi. Pengalaman anggota bukan
          pengganti saran tenaga kesehatan.
        </p>
      </aside>
      {view === "list" ? (
        <TopicList open={setView} refresh={refresh} />
      ) : view === "new" ? (
        <NewTopic onCreated={setView} onCancel={back} />
      ) : (
        <Discussion key={view} id={view} onBack={back} />
      )}
    </section>
  );
}
