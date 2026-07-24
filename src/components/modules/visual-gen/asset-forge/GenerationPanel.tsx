'use client';

import { useMemo, useState } from 'react';
import { Dna, Send, Upload, Sparkles, Lock, Monitor } from 'lucide-react';
import { GENERATION_PROVIDERS, type GenerationMode } from '@/lib/visual-gen/providers';
import { composeVisualPrompt } from '@/lib/visual-gen/prompt-chips';
import { styleDnaToPromptFragment } from '@/lib/visual-gen/style-dna';
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
  const submitLocalJob = useForgeStore((s) => s.submitLocalJob);
  const activeStyleDna = useForgeStore((s) => s.activeStyleDna);
  const applyStyleDna = useForgeStore((s) => s.applyStyleDna);
  const promptHistory = useForgeStore((s) => s.promptHistory);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  const filteredProviders = GENERATION_PROVIDERS.filter((p) => p.modes.includes(mode));
  const activeProvider = filteredProviders.find((p) => p.id === activeProviderId) ?? filteredProviders[0];
  const isMcpProvider = activeProvider?.mcpBacked === true;

  const composedPrompt = useMemo(
    () => composeVisualPrompt({ subject, chipIds: selectedChipIds, mode }),
    [subject, selectedChipIds, mode],
  );
  const effectivePrompt = (advanced ? rawPrompt : composedPrompt).trim();
  // Project style: append the active Style DNA fragment to the submitted prompt.
  const styleFragment = applyStyleDna && activeStyleDna ? styleDnaToPromptFragment(activeStyleDna.dna) : null;
  const styledPrompt = styleFragment && effectivePrompt ? `${effectivePrompt}. ${styleFragment}` : effectivePrompt;

  const toggleChip = (id: string) =>
    setSelectedChipIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAdvanced = () => {
    // Seed the raw editor from the composed prompt the first time it's opened.
    if (!advanced && !rawPrompt) setRawPrompt(composedPrompt);
    setAdvanced((a) => !a);
  };

  // Recall a past prompt: drop it into the raw editor (a stored prompt is a full
  // technical string, so the advanced raw field — not the chip builder — is where
  // it round-trips faithfully).
  const applyHistoryPrompt = (prompt: string) => {
    setRawPrompt(prompt);
    setAdvanced(true);
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
      submitMcpJob(activeProvider.id, styledPrompt, mode);
      resetBuilder();
      setImageFile(null);
      return;
    }

    // Non-MCP providers: must be free status
    if (activeProvider.status !== 'free') return;

    // Runner-backed local providers (TripoSR) actually execute via the generate API:
    // read the reference image as a data URL the server can decode, then submit + poll.
    if (activeProvider.runnerBacked && mode === 'image-to-3d' && imageFile) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          void submitLocalJob(activeProvider.id, mode, reader.result);
        }
      };
      reader.readAsDataURL(imageFile);
      resetBuilder();
      setImageFile(null);
      return;
    }

    // Other local providers aren't wired to execute yet — queue a placeholder job.
    const imageUrl = imageFile ? URL.createObjectURL(imageFile) : undefined;
    addJob({ mode, prompt: styledPrompt, imageUrl, providerId: activeProvider.id });
    if (effectivePrompt) addToHistory(effectivePrompt);
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
        promptHistory={promptHistory}
        onApplyHistory={applyHistoryPrompt}
      />

      {/* Project-style indicator: the DNA fragment rides along invisibly, so say so. */}
      {styleFragment && effectivePrompt && (
        <p className="flex items-center gap-1.5 text-2xs text-text-muted" data-testid="style-dna-indicator">
          <Dna size={11} className="text-[var(--visual-gen)]" />
          Project style “{activeStyleDna?.name}” will be appended to the prompt
        </p>
      )}

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
