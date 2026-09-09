// Group replies beneath visible parents, retaining context when the parent is on another page.
export function threadComments(items) {
  const ids = new Set(items.map((item) => item.id)),
    children = new Map(),
    roots = [];
  for (const item of items) {
    if (item.parent_id && ids.has(item.parent_id)) {
      const list = children.get(item.parent_id) || [];
      list.push(item);
      children.set(item.parent_id, list);
    } else roots.push(item);
  }
  const result = [],
    visited = new Set();
  function visit(item, depth) {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    result.push({ ...item, depth: Math.min(depth, 2) });
    for (const child of children.get(item.id) || []) visit(child, depth + 1);
  }
  for (const item of roots) visit(item, item.is_reply ? 1 : 0);
  for (const item of items) if (!visited.has(item.id)) visit(item, 0);
  return result;
}
