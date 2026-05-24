'use client';

import { Terminal, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { useEcwStore } from '@/stores/ecwStore';
import { SessionList } from './cli/SessionList';

const WIDTH_BY_MODE: Record<string, string> = {
  auto: 'w-[360px]',
  wide: 'w-1/2',
  collapsed: 'w-[44px]',
};

/**
 * The persistent right-side CLI rail. Chrome only in Phase 1: header with the
 * current scope (`Project` when no entity selected, `catalogId ▸ entityId` when
 * one is) + a collapse toggle that cycles auto → wide → collapsed.
 *
 * Session list, dispatch UX, two-way binding land in Phase 4.
 */
export function CliRail() {
  const mode = useEcwStore((s) => s.cliRailMode);
  const toggle = useEcwStore((s) => s.toggleCliRail);
  const catalogId = useEcwStore((s) => s.activeCatalogId);
  const entityId = useEcwStore((s) => s.activeEntityId);
  const scope = catalogId && entityId ? `${catalogId} ▸ ${entityId}` : 'Project';

  const collapsed = mode === 'collapsed';

  return (
    <aside
      className={`${WIDTH_BY_MODE[mode]} flex flex-col border-l border-border bg-surface-deep transition-[width] duration-200 overflow-hidden`}
      data-testid="cli-rail"
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border/40 shrink-0">
        <Terminal className="w-4 h-4 text-text-muted shrink-0" />
        {!collapsed && (
          <>
            <span className="text-xs font-mono uppercase tracking-wider text-text-muted">CLI</span>
            <span className="text-2xs font-mono text-text-muted/70 truncate">· {scope}</span>
          </>
        )}
        <button
          onClick={toggle}
          className="ml-auto p-1 text-text-muted hover:text-text focus-ring rounded"
          aria-label="toggle CLI rail"
        >
          {collapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
        </button>
      </header>
      {!collapsed && (
        <div data-testid="cli-rail-body" className="flex-1 overflow-auto p-3">
          <SessionList />
        </div>
      )}
    </aside>
  );
}
