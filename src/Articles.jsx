import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Search,
  Blocks,
  MessageCircle,
  Apple,
  Moon,
  Clock,
} from "lucide-react";
const icons = { play: Blocks, talk: MessageCircle, food: Apple, sleep: Moon };
const categories = [
  "Semua",
  "Tumbuh kembang",
  "Stimulasi",
  "Nutrisi",
  "Kesehatan",
];
const coverDescriptions = {
  play: "Ilustrasi orang tua mendampingi anak bermain balok warna-warni",
  talk: "Ilustrasi orang tua dan bayi membaca buku bergambar bersama",
  food: "Ilustrasi mangkuk makanan pendamping dan bahan makanan segar",
  sleep: "Ilustrasi anak beristirahat dalam pelukan orang tua pada sore hari",
};
function ArticleImage({ topic, detail = false }) {
  const [failed, setFailed] = useState(false);
  const Icon = icons[topic] || BookOpen;
  if (failed || !coverDescriptions[topic])
    return (
      <div className={`article-image-fallback ${topic}`}>
        <Icon size={48} />
      </div>
    );
  return (
    <img
      className="article-photo"
      src={`/images/articles/${topic}.jpg`}
      alt={coverDescriptions[topic]}
      width="1536"
      height="1024"
      loading={detail ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
export default function Articles() {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("Semua"),
    [article, setArticle] = useState(null),
    [opening, setOpening] = useState(false),
    [retry, setRetry] = useState(0);
  const heading = useRef(null),
    controller = useRef(null),
    lastButton = useRef(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/articles", { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 401
              ? "Sesi login berakhir. Silakan masuk kembali."
              : "Artikel belum dapat dimuat dari server. Silakan coba lagi.",
          );
        return r.json();
      })
      .then(setItems)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [retry]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (article) heading.current?.focus();
  }, [article]);
  async function read(item, event) {
    lastButton.current = event.currentTarget;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setOpening(true);
    setError("");
    try {
      const response = await fetch(
        "/api/articles/" + encodeURIComponent(item.slug),
        { signal: abort.signal },
      );
      if (!response.ok)
        throw new Error("Artikel belum dapat dibuka. Coba kembali.");
      setArticle(await response.json());
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      if (!abort.signal.aborted) setOpening(false);
    }
  }
  const filtered = items.filter(
    (a) =>
      (category === "Semua" || a.category === category) &&
      `${a.title} ${a.excerpt} ${a.category} ${a.age}`
        .toLocaleLowerCase("id-ID")
        .includes(query.trim().toLocaleLowerCase("id-ID")),
  );
  if (article) {
    return (
      <div className="article-reader">
        <button
          className="secondary"
          onClick={() => {
            setArticle(null);
            requestAnimationFrame(() => {
              document.getElementById(lastButton.current?.id)?.focus();
            });
          }}
        >
          <ArrowLeft size={17} /> Kembali ke artikel
        </button>
        <article className="card article-body">
          <figure className="article-detail-cover">
            <ArticleImage key={article.icon} topic={article.icon} detail />
            <figcaption>
              Ilustrasi dibuat dengan AI untuk TumbuhBersama.
            </figcaption>
          </figure>
          <span className="eyebrow">
            {article.category} · {article.age}
          </span>
          <h1 ref={heading} tabIndex={-1}>
            {article.title}
          </h1>
          <p className="article-lead">{article.excerpt}</p>
          <div className="article-meta">
            <Clock size={15} /> {article.readingMinutes} menit baca{" "}
            <span>·</span> Rujukan diperiksa 9 September 2026
          </div>
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}
          <aside className="article-source">
            <h2>Sumber bacaan</h2>
            <p>
              Ringkasan edukasi TumbuhBersama berdasarkan {article.sourceName};
              bukan publikasi resmi organisasi tersebut.
            </p>
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {article.sourceTitle}
              <ArrowUpRight size={17} />
            </a>
          </aside>
          <p className="fine">
            Informasi umum, bukan diagnosis atau saran medis individual.
            Konsultasikan kekhawatiran tentang kesehatan dan perkembangan anak
            kepada tenaga kesehatan.
          </p>
        </article>
      </div>
    );
  }
  return (
    <section className="articles-page" aria-labelledby="articles-heading">
      <div className="page-heading">
        <div>
          <span className="eyebrow">BEKAL UNTUK ORANG TUA</span>
          <h1 id="articles-heading">Ruang baca keluarga</h1>
          <p className="muted">
            Temukan ide dan pengetahuan untuk menemani tumbuhnya.
          </p>
        </div>
        <BookOpen size={37} className="article-heading-icon" />
      </div>
      <div className="article-toolbar">
        <label className="article-search">
          <Search size={19} />
          <input
            type="search"
            aria-label="Cari artikel"
            placeholder="Cari topik, misalnya MPASI…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="article-filters" aria-label="Kategori artikel">
          {categories.map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => {
              setError("");
              setLoading(true);
              setRetry((r) => r + 1);
            }}
          >
            Coba lagi
          </button>
        </div>
      )}
      {loading ? (
        <p className="empty" role="status">
          Memuat bacaan…
        </p>
      ) : (
        <>
          <p className="fine article-count" role="status">
            {filtered.length} artikel
            {query.trim() ? ` untuk “${query.trim()}”` : ""}
          </p>
          <div className="article-grid">
            {filtered.map((item) => {
              return (
                <article className="card article-card" key={item.slug}>
                  <div className="article-cover article-cover-photo">
                    <ArticleImage topic={item.icon} />
                    <span>{item.age}</span>
                  </div>
                  <span className="eyebrow">{item.category}</span>
                  <h2>
                    <button
                      id={"article-" + item.slug}
                      disabled={opening}
                      onClick={(e) => read(item, e)}
                    >
                      {item.title}
                    </button>
                  </h2>
                  <p className="muted">{item.excerpt}</p>
                  <div className="article-card-meta">
                    <span>
                      {item.sourceName} · {item.readingMinutes} menit baca
                    </span>
                    <ArrowUpRight size={18} />
                  </div>
                </article>
              );
            })}
          </div>
          {!error && !filtered.length && (
            <div className="card empty">
              <Search size={30} />
              <h2>Belum menemukan bacaan yang cocok</h2>
              <p>Coba kata kunci lain atau tampilkan semua kategori.</p>
              <button
                className="secondary"
                onClick={() => {
                  setQuery("");
                  setCategory("Semua");
                }}
              >
                Tampilkan semua artikel
              </button>
            </div>
          )}
        </>
      )}
      {opening && (
        <p role="status" className="fine">
          Membuka artikel…
        </p>
      )}
      <p className="fine article-note">
        Bacaan edukasi berdasarkan rujukan WHO dan UNICEF. Tidak menggantikan
        konsultasi dengan tenaga kesehatan.
      </p>
    </section>
  );
}
