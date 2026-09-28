import type { VariantLineageNode } from '@/types/prompt-evolution';
import { VersionNode } from './VersionNode';

/** Recursive renderer that resolves each node's live compare slot. */
export function CompareTree({
  node,
  compareSlot,
  onToggleCompare,
  onRestore,
  onChallenge,
  isRestoring,
}: {
  node: VariantLineageNode;
  compareSlot: (id: string) => number;
  onToggleCompare: (id: string) => void;
  onRestore: (id: string) => void;
  onChallenge: (id: string) => void;
  isRestoring: boolean;
}) {
  return (
    <>
      <VersionNode
        node={node}
        compareSlot={compareSlot(node.variant.id)}
        onToggleCompare={onToggleCompare}
        onRestore={onRestore}
        onChallenge={onChallenge}
        isRestoring={isRestoring}
      />
      {node.children.map((child) => (
        <CompareTree
          key={child.variant.id}
          node={child}
          compareSlot={compareSlot}
          onToggleCompare={onToggleCompare}
          onRestore={onRestore}
          onChallenge={onChallenge}
          isRestoring={isRestoring}
        />
      ))}
    </>
  );
}
