import { GitBranch } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { WorkflowTemplate } from '@/types/task-dag';
import { TEMPLATE_ICONS } from './constants';

// ── Template Card ────────────────────────────────────────────────────────────

export function TemplateCard({
  template,
  isSelected,
  onClick,
}: {
  template: WorkflowTemplate;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = TEMPLATE_ICONS[template.icon] ?? GitBranch;

  return (
    <SurfaceCard
      interactive
      className={`p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-cyan-500/40 bg-cyan-500/5'
          : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isSelected ? 'bg-cyan-500/20' : 'bg-surface-deep'
        }`}>
          <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-text-muted'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text">{template.name}</div>
          <p className="text-2xs text-text-muted mt-0.5 line-clamp-2">{template.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge>{template.nodes.length} steps</Badge>
            {template.estimatedMinutesPerModule && (
              <span className="text-2xs text-text-muted">
                ~{template.estimatedMinutesPerModule}min/module
              </span>
            )}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
