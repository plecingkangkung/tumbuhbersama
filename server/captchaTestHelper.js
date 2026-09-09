import { randomUUID, createHash } from "node:crypto";
// Only tests insert known challenge fixtures. Production always issues random SVG challenges.
export async function captchaBody(db, path, body) {
  if (!["/login", "/register"].includes(path) || !body) return body;
  const id = randomUUID(),
    answer = "AB234";
  const hash = createHash("sha256").update(`${id}:${answer}`).digest("hex");
  await db.execute(
    "INSERT INTO auth_captchas(id,answer_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 5 MINUTE))",
    [id, hash],
  );
  return { ...body, captcha_id: id, captcha_answer: answer };
}
