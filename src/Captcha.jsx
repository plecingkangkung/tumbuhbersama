import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
export default function Captcha({ disabled, submitLabel }) {
  const [challenge, setChallenge] = useState(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/captcha", { signal: abort.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Kode belum dapat dimuat.");
        return data;
      })
      .then(setChallenge)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [version]);
  function refresh() {
    setChallenge(null);
    setError("");
    setVersion((n) => n + 1);
  }
  return (
    <>
      <fieldset className="captcha-field" disabled={disabled}>
        <legend>
          <ShieldCheck size={16} /> Verifikasi keamanan
        </legend>
        {challenge ? (
          <>
            <div className="captcha-image-row">
              <img
                src={challenge.image}
                width="180"
                height="60"
                alt="Kode verifikasi berisi lima karakter"
              />
              <button
                type="button"
                className="icon-button"
                onClick={refresh}
                aria-label="Ganti kode verifikasi"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            <input type="hidden" name="captcha_id" value={challenge.id} />
            <label className="field">
              <span>Ketik kode di atas</span>
              <input
                key={challenge.id}
                name="captcha_answer"
                required
                minLength={5}
                maxLength={5}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="5 karakter"
                aria-describedby="captcha-help"
              />
            </label>
            <p id="captcha-help" className="fine">
              Tidak membedakan huruf besar/kecil. Berlaku 5 menit.
            </p>
          </>
        ) : (
          <>
            <p className="fine" role="status">
              {error || "Memuat kode verifikasi…"}
            </p>
            {error && (
              <button type="button" className="text-button" onClick={refresh}>
                Coba lagi
              </button>
            )}
          </>
        )}
      </fieldset>
      <button className="primary w-full" disabled={disabled || !challenge}>
        {submitLabel}
      </button>
    </>
  );
}
