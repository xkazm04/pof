'use client';

import { useCallback, useState } from 'react';
import { Send } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/constants';

/**
 * The Ask tab, owning its own CLI session AND its own draft state.
 *
 * The draft used to live on MaterialsView, so every keystroke re-rendered the
 * whole module view — and with it all six CLI hooks and every tab closure.
 * Scoped here, typing re-renders one input.
 */
export function AskTab() {
  const [draft, setDraft] = useState('');

  const cli = useModuleCLI({
    moduleId: 'materials',
    sessionKey: 'materials-custom',
    label: 'Materials',
    accentColor: MODULE_COLORS.content,
  });

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    void cli.execute(TaskFactory.askClaude('materials', text, 'Materials'));
    setDraft('');
  }, [draft, cli]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Send className="w-3.5 h-3.5 text-text-muted" />
        <h3 className="text-xs font-medium text-text">Ask Claude</h3>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Ask about materials, shaders, post-process..."
          className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: `${MODULE_COLORS.content}15`,
            color: MODULE_COLORS.content,
            border: `1px solid ${MODULE_COLORS.content}30`,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
