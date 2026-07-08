import { MousePointer2, Check } from 'lucide-react';
import type { InventoryConfig, InteractionMode } from '@/lib/prompts/inventory';
import { ALL_INTERACTIONS } from '@/lib/prompts/inventory';
import { InteractionIcon } from './InteractionIcon';

export function InteractSection({
  config,
  toggleInteraction,
}: {
  config: InventoryConfig;
  toggleInteraction: (id: InteractionMode) => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-violet-950/20 border border-violet-900/40 rounded-xl p-4 flex items-start gap-4 shadow-inner">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <MousePointer2 className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase text-violet-200 mb-1">UMG Interaction Protocol</h4>
          <p className="text-xs font-mono text-violet-400/60 leading-relaxed uppercase tracking-wider">
            Select input handling routines mapped to the inventory grid widget.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {ALL_INTERACTIONS.map((interaction) => {
          const enabled = config.interactions.includes(interaction.id);
          return (
            <button
              key={interaction.id}
              onClick={() => toggleInteraction(interaction.id)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-300 text-left group overflow-hidden relative"
              style={{
                borderColor: enabled ? 'rgba(167,139,250,0.5)' : 'rgba(49,46,129,0.4)',
                backgroundColor: enabled ? 'rgba(167,139,250,0.1)' : 'rgba(0,0,0,0.4)',
                boxShadow: enabled ? 'inset 0 0 20px rgba(167,139,250,0.05)' : 'none',
              }}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all border shadow-inner"
                style={{
                  borderColor: enabled ? '#a78bfa' : 'rgba(49,46,129,0.6)',
                  backgroundColor: enabled ? '#a78bfa' : 'rgba(0,0,0,0.5)',
                }}
              >
                {enabled && (
                  <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white font-bold uppercase mb-1 group-hover:text-violet-200 transition-colors">{interaction.label}</div>
                <div className="text-xs font-mono text-violet-300/50 uppercase tracking-wider">{interaction.description}</div>
              </div>
              <div className={`p-2 rounded-lg border transition-colors ${enabled ? 'bg-violet-500/20 border-violet-500/40' : 'bg-violet-950/20 border-violet-900/30'}`}>
                <InteractionIcon id={interaction.id} enabled={enabled} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
