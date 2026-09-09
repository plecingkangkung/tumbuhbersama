import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "node:crypto";
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const parse = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 4,
    fields: 4,
    fieldSize: 20000,
    parts: 8,
  },
}).array("media", 4);
export function uploadMedia(req, res, next) {
  parse(req, res, async (error) => {
    if (error)
      return next(
        fail(
          "Unggahan gagal. Maksimal 4 file, masing-masing tidak lebih dari 10 MB.",
          413,
        ),
      );
    try {
      let total = 0;
      for (const file of req.files || []) {
        const type = await fileTypeFromBuffer(file.buffer);
        if (
          !type ||
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "video/mp4",
            "video/webm",
          ].includes(type.mime)
        )
          throw fail(
            "Format tidak didukung. Gunakan JPG, PNG, WebP, MP4, atau WebM.",
          );
        if (type.mime.startsWith("image/") && file.size > 5 * 1024 * 1024)
          throw fail("Ukuran foto maksimal 5 MB.", 413);
        total += file.size;
        file.detectedMime = type.mime;
      }
      if (total > 20 * 1024 * 1024)
        throw fail("Total lampiran maksimal 20 MB per kiriman.", 413);
      next();
    } catch (e) {
      next(
        e.status
          ? e
          : fail("File tidak dapat dibaca. Pilih foto atau video lain."),
      );
    }
  });
}
export async function saveMedia(query, files, topicId, commentId = null) {
  for (const file of files || [])
    await query(
      "INSERT INTO forum_media(id,topic_id,comment_id,mime,size,data) VALUES(?,?,?,?,?,?)",
      [
        randomUUID(),
        topicId,
        commentId,
        file.detectedMime,
        file.size,
        file.buffer,
      ],
    );
}
export async function listMedia(query, topicId) {
  return query(
    "SELECT id,comment_id,mime,size FROM forum_media WHERE topic_id=? ORDER BY id",
    [topicId],
  );
}
export function mediaRoute(query) {
  return async (req, res) => {
    const [meta] = await query("SELECT mime,size FROM forum_media WHERE id=?", [
      req.params.mediaId,
    ]);
    if (!meta) throw fail("Lampiran sudah dihapus atau tidak ditemukan.", 404);
    res.set({
      "Content-Type": meta.mime,
      "Accept-Ranges": "bytes",
      "Content-Disposition": "inline",
    });
    let start = 0,
      end = meta.size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2]))
        return res
          .status(416)
          .set("Content-Range", `bytes */${meta.size}`)
          .end();
      start = match[1]
        ? Number(match[1])
        : Math.max(0, meta.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= meta.size
      )
        return res
          .status(416)
          .set("Content-Range", `bytes */${meta.size}`)
          .end();
      res
        .status(206)
        .set("Content-Range", `bytes ${start}-${end}/${meta.size}`);
    }
    res.set("Content-Length", String(end - start + 1));
    if (req.method === "HEAD") return res.end();
    const [row] = await query(
      "SELECT SUBSTRING(data,?,?) AS data FROM forum_media WHERE id=?",
      [start + 1, end - start + 1, req.params.mediaId],
    );
    if (!row) return res.status(404).end();
    res.end(row.data);
  };
}
