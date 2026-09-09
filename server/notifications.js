import { Router } from "express";
export function notificationRouter({
  query,
  demo,
  notifyUser = async () => {},
}) {
  const router = Router();
  router.use((req, res, next) => {
    if (req.method === "PUT")
      res.on("finish", () => {
        if (res.statusCode < 400)
          notifyUser(req.user.id).catch(() =>
            console.error("Notification sync failed."),
          );
      });
    next();
  });
  router.get("/", async (req, res) => {
    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      return res.status(400).json({ error: "Halaman tidak valid." });
    if (demo)
      return res.json({ items: [], unread: 0, total: 0, page, pageSize: 20 });
    const counts = (
      await query(
        "SELECT COUNT(*) AS total,COALESCE(SUM(read_at IS NULL),0) AS unread FROM notifications WHERE recipient_id=?",
        [req.user.id],
      )
    )[0];
    const items = await query(
      `SELECT n.id,n.topic_id,n.kind,n.created_at,n.read_at,u.name AS actor_name,t.title AS topic_title FROM notifications n JOIN users u ON u.id=n.actor_id JOIN forum_topics t ON t.id=n.topic_id WHERE n.recipient_id=? ORDER BY n.created_at DESC,n.id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`,
      [req.user.id],
    );
    res.json({
      items,
      unread: Number(counts.unread),
      total: Number(counts.total),
      page,
      pageSize: 20,
    });
  });
  router.put("/read-all", async (req, res) => {
    if (!demo)
      await query(
        "UPDATE notifications SET read_at=CURRENT_TIMESTAMP(3) WHERE recipient_id=? AND read_at IS NULL",
        [req.user.id],
      );
    res.json({ ok: true });
  });
  router.put("/:id/read", async (req, res) => {
    if (demo)
      return res.status(404).json({ error: "Notifikasi tidak ditemukan." });
    const found = (
      await query(
        "SELECT id FROM notifications WHERE id=? AND recipient_id=?",
        [req.params.id, req.user.id],
      )
    )[0];
    if (!found)
      return res.status(404).json({ error: "Notifikasi tidak ditemukan." });
    await query(
      "UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP(3)) WHERE id=? AND recipient_id=?",
      [req.params.id, req.user.id],
    );
    res.json({ ok: true });
  });
  return router;
}
