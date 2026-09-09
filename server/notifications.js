import { Router } from "express";
export function notificationRouter({
  query,
  demo,
  notifyUser = async () => {},
  refreshReminders = async () => {},
}) {
  const router = Router();
  const list = `SELECT n.id,n.topic_id,n.kind,n.created_at,n.read_at,u.name AS actor_name,t.title AS topic_title,NULL AS event_id,NULL AS child_id,NULL AS due_date,NULL AS due_time,NULL AS phase FROM notifications n JOIN users u ON u.id=n.actor_id JOIN forum_topics t ON t.id=n.topic_id WHERE n.recipient_id=? UNION ALL SELECT r.id,NULL,'calendar',r.created_at,r.read_at,c.name,e.title,e.id,c.id,e.due_date,e.due_time,r.phase FROM calendar_reminders r JOIN calendar_events e ON e.id=r.event_id JOIN children c ON c.id=e.child_id WHERE c.user_id=? AND e.status='planned'`;
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
    await refreshReminders();
    const params = [req.user.id, req.user.id];
    const [counts] = await query(
      `SELECT COUNT(*) AS total,COALESCE(SUM(read_at IS NULL),0) AS unread FROM (${list}) all_notifications`,
      params,
    );
    const items = await query(
      `SELECT * FROM (${list}) all_notifications ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`,
      params,
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
    if (!demo) {
      await query(
        "UPDATE notifications SET read_at=CURRENT_TIMESTAMP(3) WHERE recipient_id=? AND read_at IS NULL",
        [req.user.id],
      );
      await query(
        "UPDATE calendar_reminders r JOIN calendar_events e ON e.id=r.event_id JOIN children c ON c.id=e.child_id SET r.read_at=CURRENT_TIMESTAMP(3) WHERE c.user_id=? AND r.read_at IS NULL",
        [req.user.id],
      );
    }
    res.json({ ok: true });
  });
  router.put("/:id/read", async (req, res) => {
    if (demo)
      return res.status(404).json({ error: "Notifikasi tidak ditemukan." });
    const found = await query(
      "SELECT id FROM notifications WHERE id=? AND recipient_id=?",
      [req.params.id, req.user.id],
    );
    if (found.length)
      await query(
        "UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP(3)) WHERE id=? AND recipient_id=?",
        [req.params.id, req.user.id],
      );
    else {
      const rows = await query(
        "SELECT r.id FROM calendar_reminders r JOIN calendar_events e ON e.id=r.event_id JOIN children c ON c.id=e.child_id WHERE r.id=? AND c.user_id=?",
        [req.params.id, req.user.id],
      );
      if (!rows.length)
        return res.status(404).json({ error: "Notifikasi tidak ditemukan." });
      await query(
        "UPDATE calendar_reminders SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP(3)) WHERE id=?",
        [req.params.id],
      );
    }
    res.json({ ok: true });
  });
  return router;
}
