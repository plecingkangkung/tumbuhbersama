import { Router } from "express";
import { milestoneIds } from "../shared/milestones.js";
export function milestoneRouter({ query, demo, owned, validDate, nowDate }) {
  const router = Router({ mergeParams: true }),
    memory = new Map();
  router.get("/", async (req, res) => {
    await owned(req.params.id, req.user);
    res.json(
      demo
        ? [...(memory.get(req.params.id)?.values() ?? [])]
        : await query(
            "SELECT milestone_id,observed_date FROM child_milestones WHERE child_id=?",
            [req.params.id],
          ),
    );
  });
  router.put("/:milestoneId", async (req, res) => {
    const child = await owned(req.params.id, req.user),
      id = req.params.milestoneId;
    if (!milestoneIds.has(id))
      return res.status(400).json({ error: "Milestone tidak tersedia." });
    if (typeof req.body.checked !== "boolean")
      return res.status(400).json({ error: "Status checklist tidak valid." });
    if (!req.body.checked) {
      if (demo) memory.get(child.id)?.delete(id);
      else
        await query(
          "DELETE FROM child_milestones WHERE child_id=? AND milestone_id=?",
          [child.id, id],
        );
      return res.json({ milestone_id: id, checked: false });
    }
    const date = validDate(req.body.observed_date);
    if (date < child.dob || date > nowDate())
      return res.status(400).json({
        error: "Tanggal pengamatan harus antara kelahiran dan hari ini.",
      });
    const entry = { milestone_id: id, observed_date: date };
    if (demo) {
      if (!memory.has(child.id)) memory.set(child.id, new Map());
      memory.get(child.id).set(id, entry);
    } else
      await query(
        "INSERT INTO child_milestones(child_id,milestone_id,observed_date) VALUES(?,?,?) ON DUPLICATE KEY UPDATE observed_date=?",
        [child.id, id, date, date],
      );
    res.json({ ...entry, checked: true });
  });
  return {
    entries: (id) => [...(memory.get(id)?.values() ?? [])],
    router,
    clear: (childId) => memory.delete(childId),
  };
}
