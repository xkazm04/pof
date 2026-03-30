'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Paintbrush, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { ReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { PBREditor } from './PBREditor';
import { useMaterialStore } from './useMaterialStore';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { ViewportPreview } from '@/components/blender-mcp/ViewportPreview';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

const MaterialPreview = dynamic(
  () => import('./MaterialPreview').then((mod) => ({ default: mod.MaterialPreview })),
  { ssr: false },
);

function EditorTab() {
  const params = useMaterialStore((s) => s.params);
  const previewMesh = useMaterialStore((s) => s.previewMesh);
  const albedoTexture = useMaterialStore((s) => s.albedoTexture);
  const sendToBlender = useMaterialStore((s) => s.sendToBlender);
  const connected = useBlenderMCPStore((s) => s.connection.connected);

  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<'success' | 'error' | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSendToBlender = async () => {
    setIsSending(true);
    setSendResult(null);
    setSendError(null);

    const result = await sendToBlender();

    if (result.ok) {
      setSendResult('success');
    } else {
      setSendResult('error');
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

          {sendResult === 'success' && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Material created in Blender
            </div>
          )}

          {sendResult === 'error' && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1.5">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{sendError ?? 'Failed to send material'}</span>
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
