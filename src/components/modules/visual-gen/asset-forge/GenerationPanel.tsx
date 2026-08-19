'use client';

import { useMemo, useState } from 'react';
import { Dna, Send, Upload, Sparkles, Monitor, Cpu } from 'lucide-react';
import {
  GENERATION_PROVIDERS,
  providerExecution,
  defaultProviderForMode,
  type GenerationMode,
} from '@/lib/visual-gen/providers';
import { StatusTag } from '@/components/ui/StatusTag';
import { POLYCOUNT_PRESETS } from '@/lib/visual-gen/polycount-presets';
import { composeVisualPrompt } from '@/lib/visual-gen/prompt-chips';
import { applyStyleFragment, styleDnaToPromptFragment } from '@/lib/visual-gen/style-dna';
import { useForgeStore } from './useForgeStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { PromptBuilder } from './PromptBuilder';

export function GenerationPanel() {
  const [mode, setMode] = useState<GenerationMode>('text-to-3d');
  const [imageFile, setImageFile] = useState<File | null>(null);
  /**
   * The grading budget this generation is held to. EMPTY IS A REAL CHOICE, not an
   * unset field: the route grades class-blind when no class arrives and states that in
   * `gradedAs`, which is rendered verbatim below. Defaulting the picker to some
   * "typical" class would grade an assembled character against a prop's component
   * budget and fail it for being assembled.
   */
  const [assetClass, setAssetClass] = useState<string>('');

  // Prompt builder state — chips compose the real prompt under the hood.
  const [subject, setSubject] = useState('');
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [rawPrompt, setRawPrompt] = useState('');

  const activeProviderId = useForgeStore((s) => s.activeProviderId);
  const setActiveProvider = useForgeStore((s) => s.setActiveProvider);
  const submitMcpJob = useForgeStore((s) => s.submitMcpJob);
  const submitLocalJob = useForgeStore((s) => s.submitLocalJob);
  const activeStyleDna = useForgeStore((s) => s.activeStyleDna);
  const applyStyleDna = useForgeStore((s) => s.applyStyleDna);
  const promptHistory = useForgeStore((s) => s.promptHistory);
  // Scalar selector on purpose: the newest job's `gradedAs` only changes on submit, so
  // this panel does not re-render on every progress tick of a running poll. Strictly
  // jobs[0] — showing an OLDER job's sentence beside a newer submission would attribute
  // a budget to a generation that never used it.
  const latestGradedAs = useForgeStore((s) => s.jobs[0]?.gradedAs);
  // Same rule as `gradedAs`: strictly jobs[0], scalar, so the Tier-0 input-gate sentence
  // can never be attributed to a submission that did not produce it.
  const latestInputGate = useForgeStore((s) => s.jobs[0]?.inputGateNote);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  const filteredProviders = GENERATION_PROVIDERS.filter((p) => p.modes.includes(mode));
  // The fallback is the provider that CAN run this mode, not whichever entry the
  // registry happens to list first. (That fallback resolved to `trellis2` for the
  // default text-to-3d mode — a metadata-only entry with no runner.)
  const activeProvider =
    filteredProviders.find((p) => p.id === activeProviderId) ?? defaultProviderForMode(mode);
  const execution = activeProvider ? providerExecution(activeProvider, mode) : null;
  const isMcpProvider = execution?.path === 'mcp';

  const composedPrompt = useMemo(
    () => composeVisualPrompt({ subject, chipIds: selectedChipIds, mode }),
    [subject, selectedChipIds, mode],
  );
  const effectivePrompt = (advanced ? rawPrompt : composedPrompt).trim();
  // Project style: append the active Style DNA fragment to the submitted prompt.
  // Through the SHARED helper, so this path is capped exactly like the Leonardo route —
  // it used to concatenate uncapped, i.e. the path with no server-side length check was
  // the one that could overrun a provider limit.
  const styleFragment = applyStyleDna && activeStyleDna ? styleDnaToPromptFragment(activeStyleDna.dna) : null;
  const styledPrompt = applyStyleFragment(effectivePrompt, styleFragment);

  /**
   * Why the submit button is off, in the user's terms — or null when it can run.
   * The provider clauses come FIRST: a provider with no execution path is refused
   * with the reason instead of accepting a click that enqueues a job nothing will
   * ever update.
   */
  const blockReason: string | null = (() => {
    if (!activeProvider || !execution) {
      return `No provider on this machine can run ${mode}. Every entry listed for this mode is registry metadata with no runner behind it.`;
    }
    if (!execution.executable) return execution.reason ?? 'This provider cannot run here.';
    if (execution.path === 'mcp' && !blenderConnected) {
      return 'Blender MCP is not connected — connect the bridge above to generate through it.';
    }
    if (mode === 'text-to-3d' && !effectivePrompt) return 'Describe what to generate first.';
    if (mode === 'image-to-3d' && !imageFile) return 'Upload a reference image first.';
    return null;
  })();
  const canSubmit = blockReason === null;

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
    // One gate for the button and the handler, so a click can never take a path the
    // button says is unavailable. There is no placeholder branch any more: if
    // nothing can execute the request, nothing is enqueued.
    if (!canSubmit || !activeProvider || !execution) return;

    // MCP-backed providers go through the Blender MCP pipeline.
    if (execution.path === 'mcp') {
      void submitMcpJob(activeProvider.id, styledPrompt, mode);
      resetBuilder();
      setImageFile(null);
      return;
    }

    // Runner-backed image-to-3D: read the reference image as a data URL the server
    // can decode, then submit + poll.
    if (mode === 'image-to-3d') {
      if (!imageFile) return;
      const providerId = activeProvider.id;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          void submitLocalJob(providerId, mode, reader.result, styledPrompt, assetClass || undefined);
        }
      };
      reader.readAsDataURL(imageFile);
      resetBuilder();
      setImageFile(null);
      return;
    }

    // Runner-backed text-to-3D (Tripo3D). Fully implemented server-side and, until
    // now, unreachable from this panel because the real path was gated on image mode.
    void submitLocalJob(activeProvider.id, mode, undefined, styledPrompt, assetClass || undefined);
    resetBuilder();
    setImageFile(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

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
            // Selectability is EXECUTABILITY, not price. `status: 'free'` said nothing
            // about whether anything on this machine can run the provider.
            const exec = providerExecution(provider, mode);
            return (
              <button
                key={provider.id}
                onClick={() => exec.executable && setActiveProvider(provider.id)}
                disabled={!exec.executable}
                title={exec.reason}
                data-testid={`forge-provider-${provider.id}`}
                data-executable={exec.executable}
                className={`relative px-3 py-2 rounded-lg text-left text-xs transition-colors border ${
                  activeProvider?.id === provider.id
                    ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10'
                    : exec.executable
                      ? 'border-border hover:border-text-muted'
                      : 'border-border opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-text">{provider.name}</span>
                  {exec.path === 'mcp' && (
                    <span className="flex items-center gap-0.5 text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
                      <Monitor size={10} />
                      MCP
                    </span>
                  )}
                  {exec.path === 'runner' && (
                    <span className="flex items-center gap-0.5 text-xs text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                      <Cpu size={10} />
                      Runner
                    </span>
                  )}
                  {!exec.executable && (
                    <StatusTag level="bad" word="NO RUNNER" iconClassName="w-2.5 h-2.5" />
                  )}
                </div>
                <p className="text-text-muted mt-0.5 line-clamp-2">{provider.description}</p>
                {provider.vramGb && (
                  <p className="text-text-muted mt-0.5">~{provider.vramGb}GB VRAM</p>
                )}
                {!exec.executable && (
                  <p className="text-amber-400 mt-1">{exec.reason}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Asset class — the budget the Tier-1 gate grades the delivered mesh against.
          Optional by design: the blank option is a REAL choice, and the server's own
          sentence about what it did with it is rendered underneath rather than assumed. */}
      <div>
        <label htmlFor="forge-asset-class" className="text-xs text-text-muted mb-1.5 block">
          Asset class (grading budget)
        </label>
        <select
          id="forge-asset-class"
          data-testid="forge-asset-class"
          value={assetClass}
          onChange={(e) => setAssetClass(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-xs bg-surface border border-border text-text focus-ring"
        >
          <option value="">No class — grade class-blind (default)</option>
          {POLYCOUNT_PRESETS.map((p) => (
            <option key={p.assetClass} value={p.assetClass}>
              {p.label} — {p.faceLimit.toLocaleString()} tri budget
            </option>
          ))}
        </select>
        {isMcpProvider && (
          <p className="mt-1 text-2xs text-amber-400" data-testid="forge-asset-class-mcp-note">
            The Blender MCP bridge takes a provider and a prompt only — this class is not
            sent on that path, and nothing on this server grades an MCP-generated mesh.
          </p>
        )}
        {latestGradedAs && (
          <p className="mt-1 text-2xs text-text-muted" data-testid="forge-graded-as">
            Last submission: {latestGradedAs}
          </p>
        )}
        {/* The Tier-0 INPUT gate's verdict on the reference image, verbatim. An
            "unavailable" gate reads as unavailable here — never as a quiet pass. */}
        {latestInputGate && (
          <p className="mt-1 text-2xs text-text-muted" data-testid="forge-input-gate">
            {latestInputGate}
          </p>
        )}
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

      {/* Submit — and, when it is off, the reason. A disabled button that never
          says why is how the unrunnable providers stayed invisible. */}
      <div className="space-y-1.5">
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
        {blockReason && (
          <p className="text-2xs text-amber-400" data-testid="forge-submit-block">{blockReason}</p>
        )}
      </div>
    </div>
  );
}
