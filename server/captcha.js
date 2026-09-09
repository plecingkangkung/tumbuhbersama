import svgCaptcha from "svg-captcha";
import {
  createHash,
  randomUUID,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import rateLimit from "express-rate-limit";
const hash = (id, answer) =>
  createHash("sha256").update(`${id}:${answer.toUpperCase()}`).digest("hex");
const fail = () =>
  Object.assign(
    new Error("Kode verifikasi salah atau kedaluwarsa. Gunakan kode baru."),
    { status: 400 },
  );
export function authCaptcha(query) {
  const limit = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Terlalu banyak permintaan kode. Coba lagi dalam 5 menit.",
    },
  });
  return {
    limit,
    issue: async (req, res) => {
      await query("DELETE FROM auth_captchas WHERE expires_at<=NOW()");
      const [count] = await query(
        "SELECT COUNT(*) AS total FROM auth_captchas",
      );
      if (count.total >= 5000)
        return res
          .status(503)
          .json({
            error: "Verifikasi sedang sibuk. Coba kembali sebentar lagi.",
          });
      const id = randomUUID(),
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const answer = Array.from(
        { length: 5 },
        () => alphabet[randomInt(alphabet.length)],
      ).join("");
      const svg = svgCaptcha(answer, {
        noise: 3,
        color: false,
        background: "#eff7f3",
        width: 180,
        height: 60,
        fontSize: 44,
      });
      await query(
        "INSERT INTO auth_captchas(id,answer_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 5 MINUTE))",
        [id, hash(id, answer)],
      );
      res.json({
        id,
        image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
        expiresIn: 300,
      });
    },
    verify: async (req, res, next) => {
      const id = req.body?.captcha_id,
        answer = req.body?.captcha_answer;
      if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) throw fail();
      const [row] = await query(
        "SELECT answer_hash,(expires_at>NOW()) AS valid FROM auth_captchas WHERE id=?",
        [id],
      );
      const removed = await query("DELETE FROM auth_captchas WHERE id=?", [id]);
      // Consumed even on failure; affectedRows ensures concurrent reuse has one winner.
      if (
        !row ||
        !removed.affectedRows ||
        !row.valid ||
        typeof answer !== "string" ||
        answer.length > 20 ||
        !timingSafeEqual(
          Buffer.from(row.answer_hash, "hex"),
          Buffer.from(hash(id, answer.trim()), "hex"),
        )
      )
        throw fail();
      next();
    },
  };
}
