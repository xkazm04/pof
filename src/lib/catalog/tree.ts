import type { CatalogEntityBase } from '@/lib/catalog/types';

/** A flattened, renderable row of the catalog tree. */
export interface TreeRow {
  kind: 'group' | 'entity';
  depth: number;            // 0-based indent level
  key: string;              // group: joined categoryPath prefix; entity: entity id
  label: string;            // group segment, or entity name
  count?: number;           // group only: descendant entity count
  entity?: CatalogEntityBase; // entity rows only
}

interface TreeNode {
  children: Map<string, TreeNode>;
  entities: CatalogEntityBase[]; // entities whose categoryPath ends at this node
}

function emptyNode(): TreeNode {
  return { children: new Map(), entities: [] };
}

/** Build an N-level tree keyed by each `categoryPath` segment. */
export function buildEntityTree(entities: CatalogEntityBase[]): TreeNode {
  const root = emptyNode();
  for (const ent of entities) {
    const path = ent.categoryPath.length > 0 ? ent.categoryPath : ['Uncategorized'];
    let node = root;
    for (const seg of path) {
      if (!node.children.has(seg)) node.children.set(seg, emptyNode());
      node = node.children.get(seg)!;
    }
    node.entities.push(ent);
  }
  return root;
}

function countEntities(node: TreeNode): number {
  let n = node.entities.length;
  for (const child of node.children.values()) n += countEntities(child);
  return n;
}

function matches(node: TreeNode, filter: string): boolean {
  if (node.entities.some((e) => e.name.toLowerCase().includes(filter))) return true;
  for (const child of node.children.values()) if (matches(child, filter)) return true;
  return false;
}

/**
 * Flatten the tree to visible rows: group headers (a collapsed group hides its
 * descendants) followed by entity rows. A non-empty filter prunes to entities
 * whose name matches and keeps their ancestor groups (auto-expanded).
 */
export function flattenVisible(root: TreeNode, collapsed: Set<string>, filter: string): TreeRow[] {
  const rows: TreeRow[] = [];
  const f = filter.trim().toLowerCase();

  const walk = (node: TreeNode, depth: number, prefix: string) => {
    const groupKeys = [...node.children.keys()].sort((a, b) => a.localeCompare(b));
    for (const seg of groupKeys) {
      const child = node.children.get(seg)!;
      if (f && !matches(child, f)) continue;
      const key = prefix ? `${prefix}/${seg}` : seg;
      rows.push({ kind: 'group', depth, key, label: seg, count: countEntities(child) });
      // While filtering, ignore collapse (auto-expand matching ancestors); else respect it.
      if (f || !collapsed.has(key)) walk(child, depth + 1, key);
    }
    const ents = [...node.entities]
      .filter((e) => !f || e.name.toLowerCase().includes(f))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of ents) {
      rows.push({ kind: 'entity', depth, key: ent.id, label: ent.name, entity: ent });
    }
  };

  walk(root, 0, '');
  return rows;
}
