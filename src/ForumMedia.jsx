import { useEffect, useState, useRef } from "react";
import { ImagePlus, X } from "lucide-react";
export function MediaGallery({ items = [] }) {
  return items.length ? (
    <div className="forum-media-grid">
      {items.map((m) => (
        <div className="forum-media-item" key={m.id}>
          {m.mime.startsWith("video/") ? (
            <video
              controls
              preload="metadata"
              playsInline
              src={`/api/forum/media/${m.id}`}
            />
          ) : (
            <a
              href={`/api/forum/media/${m.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <img
                loading="lazy"
                src={`/api/forum/media/${m.id}`}
                alt="Foto lampiran diskusi"
              />
            </a>
          )}
        </div>
      ))}
    </div>
  ) : null;
}
function Preview({ file }) {
  const media = useRef(null);
  useEffect(() => {
    const value = URL.createObjectURL(file);
    media.current.src = value;
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return file.type.startsWith("video/") ? (
    <video ref={media} controls preload="metadata" playsInline />
  ) : (
    <img ref={media} alt={file.name} />
  );
}
export function MediaPicker({ files, onChange, disabled }) {
  const input = useRef(null),
    [error, setError] = useState("");
  return (
    <div className="forum-media-picker">
      <button
        type="button"
        className="secondary"
        disabled={disabled || files.length >= 4}
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={17} /> Foto / video{" "}
        <span className="fine">{files.length}/4</span>
      </button>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        disabled={disabled}
        onChange={(e) => {
          const next = [...files, ...Array.from(e.target.files)];
          e.target.value = "";
          if (next.length > 4)
            return setError("Maksimal 4 lampiran per kiriman.");
          if (
            next.some(
              (f) =>
                ![
                  "image/jpeg",
                  "image/png",
                  "image/webp",
                  "video/mp4",
                  "video/webm",
                ].includes(f.type),
            )
          )
            return setError("Pilih JPG, PNG, WebP, MP4, atau WebM.");
          if (
            next.some(
              (f) =>
                f.size > (f.type.startsWith("video/") ? 10 : 5) * 1024 * 1024,
            )
          )
            return setError("Foto maksimal 5 MB, video maksimal 10 MB.");
          if (next.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024)
            return setError("Total lampiran maksimal 20 MB.");
          setError("");
          onChange(next);
        }}
      />
      <p className="fine">
        JPG, PNG, WebP (5 MB) · MP4, WebM (10 MB). Total maksimal 20 MB.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <div className="forum-media-previews">
          {files.map((f, i) => (
            <div
              className="forum-media-preview"
              key={`${f.name}-${f.lastModified}-${i}`}
            >
              <Preview file={f} />
              <span title={f.name}>{f.name}</span>
              <button
                type="button"
                aria-label={`Hapus lampiran ${f.name}`}
                disabled={disabled}
                onClick={() => {
                  onChange(files.filter((_, n) => n !== i));
                  setError("");
                }}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
