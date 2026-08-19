'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Paintbrush, Send, Loader2, CheckCircle2, XCircle, AlertTriangle, Sparkles, FileUp } from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { PBREditor } from './PBREditor';
import { AdvancedTexturePanel } from './AdvancedTexturePanel';
import { UE5ExportPanel } from './UE5ExportPanel';
import { useMaterialStore, type SendToBlenderResult } from './useMaterialStore';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { ViewportPreview } from '@/components/blender-mcp/ViewportPreview';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

const MaterialPreview = dynamic(
  () => import('./MaterialPreview').then((mod) => ({ default: mod.MaterialPreview })),
  { ssr: false },
);

/**
 * What the send ACTUALLY carried. The old copy said "Material created in
 * Blender" after transmitting three of the lab's parameters and dropping the
 * rest; this names both halves, so a success can never cover a dropped edit.
 */
function BlenderSendReport({ result }: { result: SendToBlenderResult }) {
  const { plan } = result;
  return (
    <div data-testid="blender-send-report" className="space-y-1.5">
      <div className="flex items-start gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 rounded px-2 py-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Created <span className="font-mono">{result.name}</span> in Blender with {plan.sent.join(', ')}.
        </span>
      </div>
      {plan.notSent.length > 0 && (
        <div className="flex items-start gap-1.5 text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Not sent:</p>
            <ul className="mt-0.5 space-y-0.5">
              {plan.notSent.map((dropped) => (
                <li key={dropped.label}>
                  <span className="font-medium">{dropped.label}</span> — {dropped.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorTab() {
  const params = useMaterialStore((s) => s.params);
  const previewMesh = useMaterialStore((s) => s.previewMesh);
  const albedoTexture = useMaterialStore((s) => s.albedoTexture);
  const normalTexture = useMaterialStore((s) => s.normalTexture);
  const metallicTexture = useMaterialStore((s) => s.metallicTexture);
  const roughnessTexture = useMaterialStore((s) => s.roughnessTexture);
  const aoTexture = useMaterialStore((s) => s.aoTexture);
  const sendToBlender = useMaterialStore((s) => s.sendToBlender);
  const connected = useBlenderMCPStore((s) => s.connection.connected);

  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState<SendToBlenderResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSendToBlender = async () => {
    setIsSending(true);
    setSent(null);
    setSendError(null);

    const result = await sendToBlender();

    if (result.ok) {
      setSent(result.data);
    } else {
      setSendError(result.error);
    }
    setIsSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Blender Connection */}
      <BlenderConnectionBar />

      <div className="flex gap-4 h-full">
        {/* Left: PBR Editor controls */}
        <div className="w-72 shrink-0 overflow-y-auto pr-2 space-y-3">
          <PBREditor />

          {/* Send to Blender button */}
          <button
            onClick={handleSendToBlender}
            disabled={!connected || isSending}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-[var(--visual-gen)]/10 text-[var(--visual-gen)] hover:bg-[var(--visual-gen)]/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {isSending ? 'Sending...' : 'Send to Blender'}
          </button>

          {sent && <BlenderSendReport result={sent} />}

          {sendError !== null && (
            <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{sendError}</span>
            </div>
          )}
        </div>

        {/* Right: Live 3D preview + Blender viewport */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="min-h-[400px]">
            <MaterialPreview
              params={params}
              previewMesh={previewMesh}
              albedoTexture={albedoTexture}
              normalTexture={normalTexture}
              metallicTexture={metallicTexture}
              roughnessTexture={roughnessTexture}
              aoTexture={aoTexture}
            />
          </div>

          {/* Blender Viewport Preview */}
          <ViewportPreview />
        </div>
      </div>
    </div>
  );
}

export function MaterialLabView() {
  const mod = SUB_MODULE_MAP['material-lab'];
  const cat = getCategoryForSubModule('material-lab');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'editor',
      label: 'Editor',
      icon: Paintbrush,
      render: () => <EditorTab />,
    },
    {
      id: 'advanced',
      label: 'Advanced',
      icon: Sparkles,
      render: () => <AdvancedTexturePanel />,
    },
    {
      id: 'ue5-export',
      label: 'UE5 Export',
      icon: FileUp,
      render: () => <UE5ExportPanel />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="material-lab"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('material-lab')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
