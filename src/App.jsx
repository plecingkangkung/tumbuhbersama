import Milestones from "./Milestones";
import Captcha from "./Captcha";
import BrandMark from "./BrandMark";
import ResponsiveSidebar from "./ResponsiveSidebar";
import Notifications from "./Notifications";
import ChildPicker from "./ChildPicker";
import Forum from "./Forum";
import Articles from "./Articles";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  Sprout,
  Menu,
  ListChecks,
  LayoutDashboard,
  TrendingUp,
  BookHeart,
  BookOpen,
  MessagesSquare,
  CalendarDays,
  Plus,
  LogOut,
  ArrowUpRight,
  X,
  Heart,
  Ruler,
  Weight,
  CircleUserRound,
} from "lucide-react";
const GrowthChart = lazy(() => import("./GrowthChart"));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const date = (value) =>
  new Date(value + "T12:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Permintaan gagal. Silakan coba kembali.");
  return data;
}
const post = (path, body) =>
  api(path, { method: "POST", body: JSON.stringify(body) });
function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input required {...props} />
    </label>
  );
}
function age(dob) {
  const d = new Date(dob),
    n = new Date();
  const m =
    (n.getFullYear() - d.getFullYear()) * 12 +
    n.getMonth() -
    d.getMonth() -
    (n.getDate() < d.getDate() ? 1 : 0);
  return m < 1
    ? "Di bawah 1 bulan"
    : `${Math.floor(m / 12) ? Math.floor(m / 12) + " tahun " : ""}${m % 12} bulan`;
}
export default function App() {
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [children, setChildren] = useState([]),
    [selected, setSelected] = useState(""),
    [records, setRecords] = useState([]),
    [tab, setTab] = useState("Ringkasan"),
    [forumTarget, setForumTarget] = useState({ id: "list", version: 0 }),
    [metric, setMetric] = useState("weight"),
    [modal, setModal] = useState(""),
    [register, setRegister] = useState(false),
    [notice, setNotice] = useState(""),
    [demoAvailable, setDemoAvailable] = useState(false);
  useEffect(() => {
    api("/me")
      .then((d) => {
        setUser(d.user);
        setDemoAvailable(d.demo);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    api("/children")
      .then((d) => {
        if (active) {
          setChildren(d);
          setSelected(d[0]?.id || "");
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [user]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    api(`/children/${selected}/records`)
      .then((d) => {
        if (active) setRecords(d);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [selected]);
  const child = children.find((c) => c.id === selected),
    measurements = records
      .filter((r) => r.kind === "measurement" && r.child_id === selected)
      .sort((a, b) => a.date.localeCompare(b.date)),
    journal = records
      .filter((r) => r.kind === "journal" && r.child_id === selected)
      .sort((a, b) => b.date.localeCompare(a.date)),
    visits = records
      .filter((r) => r.kind === "visit" && r.child_id === selected)
      .sort((a, b) => a.date.localeCompare(b.date)),
    latest = measurements.at(-1);
  async function auth(e, demo = false) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await post(
        demo ? "/demo" : register ? "/register" : "/login",
        demo ? {} : Object.fromEntries(new FormData(e.target)),
      );
      setUser(d.user);
    } catch (e) {
      setError(e.message);
      setCaptchaVersion((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(e.target));
      if (modal === "child") {
        const c = await post("/children", body);
        setChildren([...children, c]);
        setSelected(c.id);
      } else {
        const r = await post(`/children/${selected}/records`, {
          ...body,
          kind: modal,
        });
        setRecords([...records, r]);
      }
      setModal("");
      setNotice("Catatan berhasil disimpan.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const open = (kind) => {
    setError("");
    setModal(kind);
  };
  if (loading) return <div className="empty">Menyiapkan TumbuhBersama…</div>;
  if (!user)
    return (
      <main className="auth">
        <section className="auth-story">
          <div className="brand">
            <BrandMark /> TumbuhBersama
          </div>
          <span className="eyebrow">SETIAP LANGKAH KECIL, BERARTI.</span>
          <h1>
            Temani tumbuhnya.
            <br />
            Simpan ceritanya.
          </h1>
          <p>
            Satu tempat untuk mencatat pertumbuhan, kemampuan baru, dan
            perjalanan si kecil.
          </p>
          <div className="story-mark">
            <BrandMark size={100} />
            <span>Tumbuh, bersama kasih.</span>
          </div>
        </section>
        <section className="auth-form">
          <div className="card">
            <h2>
              {register ? "Mulai cerita keluarga" : "Selamat datang kembali"}
            </h2>
            <p className="muted mb-6">
              {register
                ? "Buat akun orang tua untuk memulai."
                : "Masuk untuk melihat perjalanan si kecil."}
            </p>
            {!demoAvailable && (
              <form onSubmit={auth}>
                {register && (
                  <Field
                    label="Nama orang tua"
                    name="name"
                    maxLength="80"
                    autoComplete="name"
                  />
                )}
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                />
                <Field
                  label="Kata sandi"
                  name="password"
                  type="password"
                  minLength="8"
                  maxLength="128"
                  autoComplete={register ? "new-password" : "current-password"}
                />
                <Captcha
                  key={`${register}-${captchaVersion}`}
                  disabled={busy}
                  submitLabel={
                    busy ? "Memproses…" : register ? "Buat akun" : "Masuk"
                  }
                />
              </form>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {!demoAvailable && (
              <button
                className="text-button mt-4"
                onClick={() => setRegister(!register)}
              >
                {register
                  ? "Sudah punya akun? Masuk"
                  : "Belum punya akun? Daftar"}
              </button>
            )}
            {demoAvailable && (
              <>
                <div className="divider">DEMO PORTOFOLIO</div>
                <button
                  className="secondary w-full"
                  disabled={busy}
                  onClick={(e) => auth(e, true)}
                >
                  Jelajahi dengan data fiktif <ArrowUpRight size={17} />
                </button>
                <p className="fine mt-3">
                  Demo bersifat sementara. Data dihapus saat server dimulai
                  ulang.
                </p>
              </>
            )}
          </div>
        </section>
      </main>
    );
  return (
    <div className="app-shell">
      <ResponsiveSidebar open={menuOpen} onClose={closeMenu}>
        <div className="brand">
          <BrandMark />
          <span>
            Tumbuh<span className="font-normal">Bersama</span>
          </span>
        </div>
        <span className="eyebrow nav-label">RUANG KELUARGA</span>
        <nav aria-label="Navigasi utama">
          {[
            ["Ringkasan", LayoutDashboard],
            ["Pertumbuhan", TrendingUp],
            ["Jurnal perkembangan", BookHeart],
            ["Milestone", ListChecks],
            ["Kunjungan", CalendarDays],
            ["Artikel", BookOpen],
            ["Forum", MessagesSquare],
          ].map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => {
                setTab(name);
                closeMenu();
                if (name === "Forum")
                  setForumTarget((current) => ({
                    id: "list",
                    version: current.version + 1,
                  }));
              }}
            >
              <Icon size={20} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Heart size={23} />
          <h3>Setiap anak punya cerita.</h3>
          <p>Catat momen kecil hari ini untuk dikenang esok hari.</p>
        </div>
        <button
          className="logout"
          onClick={async () => {
            try {
              await post("/logout", {});
              closeMenu();
              setUser(null);
              setChildren([]);
              setRecords([]);
              setSelected("");
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <LogOut size={18} /> Keluar
        </button>
      </ResponsiveSidebar>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-header-brand">
            <button
              type="button"
              className="icon-button"
              aria-label="Buka menu navigasi"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <BrandMark size={32} />
            <span>TumbuhBersama</span>
          </div>
          <span className="desktop-breadcrumb">
            Ruang keluarga <span className="muted">/ {tab}</span>
          </span>
          <div className="flex items-center gap-3">
            <Notifications
              key={user.id}
              onOpen={(id) => {
                setForumTarget((current) => ({
                  id,
                  version: current.version + 1,
                }));
                setTab("Forum");
              }}
            />
            <span className="fine">{user.demo ? "MODE DEMO" : user.name}</span>
            <details
              className="account-menu"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  event.currentTarget.open = false;
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector("summary").focus();
                }
              }}
            >
              <summary aria-label="Menu akun" title="Menu akun">
                <CircleUserRound size={28} />
              </summary>
              <div className="account-panel">
                <p className="account-name">{user.name}</p>
                <p className="fine">{user.demo ? "Akun demo" : user.email}</p>
                <button
                  className="account-signout"
                  onClick={async () => {
                    try {
                      await post("/logout", {});
                      closeMenu();
                      setUser(null);
                      setChildren([]);
                      setRecords([]);
                      setSelected("");
                      setNotice("");
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  <LogOut size={18} /> Keluar
                </button>
              </div>
            </details>
          </div>
        </header>
        <main className="content">
          {user.demo && (
            <div className="demo-banner">
              Data fiktif untuk eksplorasi · Catatan demo bersifat sementara.
            </div>
          )}
          {tab === "Forum" ? (
            <Forum key={forumTarget.version} initialTopic={forumTarget.id} />
          ) : tab === "Artikel" ? (
            <Articles />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">TUMBUH BERSAMA, SETIAP HARI</span>
                  <h1>
                    {tab === "Ringkasan"
                      ? `Halo, ${user.name.split(" ")[0]}!`
                      : tab}
                  </h1>
                  <p className="muted">
                    {tab === "Ringkasan"
                      ? "Mari lihat cerita terbaru si kecil."
                      : "Simpan setiap bagian dari perjalanan si kecil."}
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => open(child ? "measurement" : "child")}
                >
                  <Plus size={18} />
                  {child ? "Catat pengukuran" : "Tambah anak"}
                </button>
              </div>
              {error && !modal && (
                <div role="alert" className="error">
                  {error}
                </div>
              )}
              {notice && (
                <div role="status" className="success">
                  {notice}
                  <button
                    aria-label="Tutup pemberitahuan"
                    onClick={() => setNotice("")}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <ChildPicker
                children={children}
                selected={selected}
                onSelect={setSelected}
                onAdd={() => open("child")}
                subtitle={
                  child ? `${age(child.dob)} · Lahir ${date(child.dob)}` : ""
                }
              />
              {!child ? (
                <section className="card empty">
                  <Sprout size={40} />
                  <h2>Mulai dari profil si kecil</h2>
                  <p>Tambahkan nama dan tanggal lahir untuk mulai mencatat.</p>
                </section>
              ) : (
                <>
                  {(tab === "Ringkasan" || tab === "Pertumbuhan") && (
                    <>
                      <div className="stats">
                        {[
                          ["Berat badan", "weight", "kg", Weight],
                          ["Panjang / tinggi badan", "height", "cm", Ruler],
                          ["Lingkar kepala", "head", "cm", CircleUserRound],
                        ].map(([label, key, unit, Icon]) => (
                          <article className="card stat" key={key}>
                            <div className="flex justify-between items-center">
                              <span className="muted">{label}</span>
                              <span className={"stat-icon " + key}>
                                <Icon size={20} />
                              </span>
                            </div>
                            <strong>
                              {latest
                                ? Number(latest[key]).toLocaleString("id-ID")
                                : "—"}{" "}
                              <small>{unit}</small>
                            </strong>
                            <p className="fine">
                              {latest
                                ? "Pengukuran " + date(latest.date)
                                : "Belum ada pengukuran"}
                            </p>
                          </article>
                        ))}
                      </div>
                      <section className="card growth">
                        <div className="section-heading">
                          <div>
                            <h2>Cerita pertumbuhan</h2>
                            <p className="muted text-sm">
                              Pantau pengukuran si kecil bersama persentil WHO.
                            </p>
                          </div>
                          <select
                            aria-label="Jenis pengukuran grafik"
                            value={metric}
                            onChange={(e) => setMetric(e.target.value)}
                          >
                            <option value="weight">Berat badan (kg)</option>
                            <option value="height">
                              Panjang / tinggi (cm)
                            </option>
                            <option value="head">Lingkar kepala (cm)</option>
                          </select>
                        </div>
                        <Suspense
                          fallback={<p className="empty">Memuat kurva WHO…</p>}
                        >
                          <GrowthChart
                            key={child.id}
                            child={child}
                            records={measurements}
                            metric={metric}
                            onPosition={async (recordId, position) => {
                              const updated = await api(
                                "/children/" +
                                  child.id +
                                  "/records/" +
                                  recordId +
                                  "/position",
                                {
                                  method: "PUT",
                                  body: JSON.stringify({
                                    height_position: position,
                                  }),
                                },
                              );
                              setRecords((current) =>
                                current.map((r) =>
                                  r.id === updated.id ? updated : r,
                                ),
                              );
                            }}
                          />
                        </Suspense>
                      </section>
                    </>
                  )}
                  {tab === "Milestone" && (
                    <Milestones key={child.id} child={child} />
                  )}
                  {tab === "Pertumbuhan" && (
                    <section className="card">
                      <h2>Riwayat pengukuran</h2>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Tanggal</th>
                              <th>Berat (kg)</th>
                              <th>Panjang / tinggi (cm)</th>
                              <th>Lingkar kepala (cm)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...measurements].reverse().map((r) => (
                              <tr key={r.id}>
                                <td>{date(r.date)}</td>
                                <td>{r.weight}</td>
                                <td>{r.height}</td>
                                <td>{r.head}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!measurements.length && (
                        <p className="empty">Belum ada pengukuran.</p>
                      )}
                    </section>
                  )}
                  <div className={tab === "Ringkasan" ? "bottom-grid" : ""}>
                    {(tab === "Ringkasan" || tab === "Jurnal perkembangan") && (
                      <section className="card">
                        <div className="section-heading">
                          <div>
                            <span className="eyebrow">MOMEN BERHARGA</span>
                            <h2>Jurnal perkembangan</h2>
                            <button
                              className="text-button"
                              onClick={() => setTab("Milestone")}
                            >
                              Buka checklist sesuai usia
                            </button>
                          </div>
                          <button
                            className="icon-button"
                            aria-label="Tambah jurnal"
                            onClick={() => open("journal")}
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                        {!journal.length ? (
                          <p className="empty">
                            Kemampuan baru apa yang kamu amati hari ini?
                          </p>
                        ) : (
                          (tab === "Ringkasan"
                            ? journal.slice(0, 3)
                            : journal
                          ).map((r) => (
                            <article className="journal-item" key={r.id}>
                              <span className="journal-dot">
                                <BookHeart size={18} />
                              </span>
                              <div>
                                <span className="fine">
                                  {date(r.date)} · {r.category}
                                </span>
                                <h3>{r.title}</h3>
                                <p className="muted text-sm">{r.notes}</p>
                              </div>
                            </article>
                          ))
                        )}
                      </section>
                    )}
                    {(tab === "Ringkasan" || tab === "Kunjungan") && (
                      <section className="card visits">
                        <div className="section-heading">
                          <div>
                            <span className="eyebrow">AGENDA SI KECIL</span>
                            <h2>Kunjungan</h2>
                          </div>
                          <button
                            className="icon-button"
                            aria-label="Tambah kunjungan"
                            onClick={() => open("visit")}
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                        {!visits.length ? (
                          <p className="empty">
                            Catat jadwal posyandu atau kunjungan dokter
                            berikutnya.
                          </p>
                        ) : (
                          (tab === "Ringkasan"
                            ? visits
                                .filter((v) => v.date >= today())
                                .slice(0, 2)
                            : visits
                          ).map((r) => (
                            <article className="visit-item" key={r.id}>
                              <CalendarDays size={23} />
                              <div>
                                <span className="fine">{date(r.date)}</span>
                                <h3>{r.title}</h3>
                                <p className="muted text-sm">{r.notes}</p>
                              </div>
                            </article>
                          ))
                        )}
                        {tab === "Ringkasan" &&
                          visits.length > 0 &&
                          !visits.some((v) => v.date >= today()) && (
                            <p className="empty">Belum ada jadwal mendatang.</p>
                          )}
                        <p className="fine mt-5">
                          Catatan jadwal pribadi, tanpa pengingat otomatis.
                        </p>
                      </section>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          <footer>
            <Sprout size={16} /> Dibuat untuk menemani, selangkah demi
            selangkah.<span>Catatan orang tua · Bukan diagnosis medis</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal("");
          }}
        >
          <section
            className="card modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setModal("");
              if (e.key === "Tab") {
                const els = [
                  ...e.currentTarget.querySelectorAll(
                    "button:not(:disabled),input,select,textarea",
                  ),
                ];
                if (e.shiftKey && document.activeElement === els[0]) {
                  e.preventDefault();
                  els.at(-1).focus();
                } else if (
                  !e.shiftKey &&
                  document.activeElement === els.at(-1)
                ) {
                  e.preventDefault();
                  els[0].focus();
                }
              }
            }}
          >
            <div className="section-heading">
              <h2 id="modal-title">
                {
                  {
                    child: "Tambah profil anak",
                    measurement: "Catat pengukuran",
                    journal: "Momen baru si kecil",
                    visit: "Catat kunjungan",
                  }[modal]
                }
              </h2>
              <button
                disabled={busy}
                className="icon-button"
                aria-label="Tutup formulir"
                onClick={() => setModal("")}
              >
                <X />
              </button>
            </div>
            <form onSubmit={save}>
              {modal === "child" ? (
                <>
                  <Field
                    autoFocus
                    label="Nama panggilan"
                    name="name"
                    maxLength="80"
                  />
                  <Field
                    label="Tanggal lahir"
                    name="dob"
                    type="date"
                    max={today()}
                  />
                  <label className="field">
                    <span>Jenis kelamin</span>
                    <select name="sex">
                      <option value="female">Perempuan</option>
                      <option value="male">Laki-laki</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <Field
                    autoFocus
                    label="Tanggal"
                    name="date"
                    type="date"
                    defaultValue={today()}
                    min={child.dob}
                    max={modal === "visit" ? undefined : today()}
                  />
                  {modal === "measurement" ? (
                    <>
                      <Field
                        label="Berat badan (kg)"
                        name="weight"
                        type="number"
                        min="0.1"
                        max="150"
                        step="0.01"
                      />
                      <Field
                        label="Panjang / tinggi badan (cm)"
                        name="height"
                        type="number"
                        min="10"
                        max="220"
                        step="0.1"
                      />
                      <label className="field">
                        <span>Posisi pengukuran panjang / tinggi</span>
                        <select name="height_position" required defaultValue="">
                          <option value="" disabled>
                            Pilih posisi saat diukur
                          </option>
                          <option value="recumbent">
                            Telentang (panjang badan)
                          </option>
                          <option value="standing">
                            Berdiri (tinggi badan)
                          </option>
                        </select>
                      </label>
                      <Field
                        label="Lingkar kepala (cm)"
                        name="head"
                        type="number"
                        min="10"
                        max="100"
                        step="0.1"
                      />
                    </>
                  ) : (
                    <>
                      <Field
                        label={
                          modal === "journal"
                            ? "Kemampuan atau momen baru"
                            : "Nama kunjungan / tempat"
                        }
                        name="title"
                        maxLength="150"
                      />
                      {modal === "journal" && (
                        <label className="field">
                          <span>Kategori catatan</span>
                          <select name="category">
                            {[
                              "Gerak tubuh",
                              "Komunikasi",
                              "Interaksi sosial",
                              "Kemandirian",
                              "Momen lainnya",
                            ].map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="field">
                        <span>Catatan (opsional)</span>
                        <textarea name="notes" maxLength="2000" rows="3" />
                      </label>
                    </>
                  )}
                </>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="primary w-full" disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
