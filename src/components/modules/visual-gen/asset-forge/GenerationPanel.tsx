'use client';

import { useMemo, useState } from 'react';
import { Send, Upload, Sparkles, Lock, Monitor } from 'lucide-react';
import { GENERATION_PROVIDERS, type GenerationMode } from '@/lib/visual-gen/providers';
import { composeVisualPrompt } from '@/lib/visual-gen/prompt-chips';
import { useForgeStore } from './useForgeStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { PromptBuilder } from './PromptBuilder';

export function GenerationPanel() {
  const [mode, setMode] = useState<GenerationMode>('text-to-3d');
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Prompt builder state — chips compose the real prompt under the hood.
  const [subject, setSubject] = useState('');
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [rawPrompt, setRawPrompt] = useState('');

  const activeProviderId = useForgeStore((s) => s.activeProviderId);
  const setActiveProvider = useForgeStore((s) => s.setActiveProvider);
  const addJob = useForgeStore((s) => s.addJob);
  const addToHistory = useForgeStore((s) => s.addToHistory);
  const submitMcpJob = useForgeStore((s) => s.submitMcpJob);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  const filteredProviders = GENERATION_PROVIDERS.filter((p) => p.modes.includes(mode));
  const activeProvider = filteredProviders.find((p) => p.id === activeProviderId) ?? filteredProviders[0];
  const isMcpProvider = activeProvider?.mcpBacked === true;

  const composedPrompt = useMemo(
    () => composeVisualPrompt({ subject, chipIds: selectedChipIds, mode }),
    [subject, selectedChipIds, mode],
  );
  const effectivePrompt = (advanced ? rawPrompt : composedPrompt).trim();

  const toggleChip = (id: string) =>
    setSelectedChipIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAdvanced = () => {
    // Seed the raw editor from the composed prompt the first time it's opened.
    if (!advanced && !rawPrompt) setRawPrompt(composedPrompt);
    setAdvanced((a) => !a);
  };

  const resetBuilder = () => {
    setSubject('');
    setSelectedChipIds([]);
    setRawPrompt('');
    setAdvanced(false);
  };

  const handleSubmit = () => {
    if (!effectivePrompt && mode === 'text-to-3d') return;
    if (!imageFile && mode === 'image-to-3d') return;
    if (!activeProvider) return;

    // MCP-backed providers go through the Blender MCP pipeline
    if (activeProvider.mcpBacked) {
      if (!blenderConnected) return;
      submitMcpJob(activeProvider.id, effectivePrompt, mode);
      resetBuilder();
      setImageFile(null);
      return;
    }

    // Non-MCP providers: must be free status
    if (activeProvider.status !== 'free') return;

    const imageUrl = imageFile ? URL.createObjectURL(imageFile) : undefined;

    addJob({
      mode,
      prompt: effectivePrompt,
      imageUrl,
      providerId: activeProvider.id,
    });

    if (effectivePrompt) {
      addToHistory(effectivePrompt);
    }

    resetBuilder();
    setImageFile(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

  const canSubmit = (() => {
    if (!activeProvider) return false;
    if (!effectivePrompt && mode === 'text-to-3d') return false;
    if (!imageFile && mode === 'image-to-3d') return false;
    if (activeProvider.mcpBacked) return blenderConnected;
    return activeProvider.status === 'free';
  })();

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('text-to-3d')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
            mode === 'text-to-3d'
              ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10 text-[var(--visual-gen)]'
              : 'border-border text-text-muted hover:text-text'
          }`}
        >
          <Sparkles size={14} className="inline mr-1.5" />
          Text to 3D
        </button>
        <button
          onClick={() => setMode('image-to-3d')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
            mode === 'image-to-3d'
              ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10 text-[var(--visual-gen)]'
              : 'border-border text-text-muted hover:text-text'
          }`}
        >
          <Upload size={14} className="inline mr-1.5" />
          Image to 3D
        </button>
      </div>

      {/* Provider selector */}
      <div>
        <label className="text-xs text-text-muted mb-1.5 block">Provider</label>
        <div className="grid grid-cols-2 gap-2">
          {filteredProviders.map((provider) => {
            const isSelectable = provider.status === 'free' || provider.mcpBacked;
            return (
              <button
                key={provider.id}
                onClick={() => isSelectable && setActiveProvider(provider.id)}
                disabled={!isSelectable}
                className={`relative px-3 py-2 rounded-lg text-left text-xs transition-colors border ${
                  activeProvider?.id === provider.id
                    ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10'
                    : isSelectable
                      ? 'border-border hover:border-text-muted'
                      : 'border-border opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-text">{provider.name}</span>
                  {provider.status === 'coming-soon' && !provider.mcpBacked && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      <Lock size={10} />
                      Coming Soon
                    </span>
                  )}
                  {provider.mcpBacked && (
                    <span className="flex items-center gap-0.5 text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                      <Monitor size={10} />
                      MCP
                    </span>
                  )}
                  {provider.status === 'free' && !provider.mcpBacked && (
                    <span className="text-xs text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                      Free
                    </span>
                  )}
                </div>
                <p className="text-text-muted mt-0.5 line-clamp-2">{provider.description}</p>
                {provider.vramGb && (
                  <p className="text-text-muted mt-0.5">~{provider.vramGb}GB VRAM</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Blender connection bar for MCP providers */}
      {isMcpProvider && !blenderConnected && <BlenderConnectionBar />}

      {/* Reference image upload (image-to-3d only) */}
      {mode === 'image-to-3d' && (
        <div>
          <label className="text-xs text-text-muted mb-1.5 block">Upload reference image</label>
          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-[var(--visual-gen)] transition-colors">
              <Upload size={16} className="text-text-muted" />
              <span className="text-xs text-text-muted">
                {imageFile ? imageFile.name : 'Click or drag to upload PNG/JPG'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
            {imageFile && (
              <button onClick={() => setImageFile(null)} className="text-xs text-text-muted hover:text-text">
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* No-jargon prompt builder */}
      <PromptBuilder
        mode={mode}
        subject={subject}
        onSubjectChange={setSubject}
        selectedChipIds={selectedChipIds}
        onToggleChip={toggleChip}
        advanced={advanced}
        onToggleAdvanced={toggleAdvanced}
        rawPrompt={rawPrompt}
        onRawPromptChange={setRawPrompt}
        composedPrompt={composedPrompt}
        onSubmit={handleSubmit}
      />

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                   bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send size={14} />
        {isMcpProvider ? 'Generate via Blender MCP' : 'Generate 3D Model'}
      </button>
    </div>
  );
}
