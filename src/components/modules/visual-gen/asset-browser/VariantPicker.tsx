'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { formatBytes } from '@/lib/format';
import { VISUAL_GEN_FOCUS_RING } from '@/lib/visual-gen/ui';
import type { DownloadVariant } from '@/lib/visual-gen/download-variants';
import {
  useAssetBrowserStore,
  variantKey,
  type PickTarget,
} from '@/components/modules/visual-gen/asset-browser/useAssetBrowserStore';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';

interface VariantPickerProps {
  /** The asset to choose a file for; null = closed. */
  target: PickTarget | null;
  onClose: () => void;
}

const filesLabel = (n: number) => (n === 1 ? '1 file' : `${n} files`);

/** Variants grouped by format, in first-seen order (the lists arrive smallest resolution first). */
function byFormat(variants: DownloadVariant[]): [string, DownloadVariant[]][] {
  const groups = new Map<string, DownloadVariant[]>();
  for (const v of variants) groups.set(v.format, [...(groups.get(v.format) ?? []), v]);
  return [...groups.entries()];
}

/**
 * Download = choose the file. Lists the source's real format x resolution variants, each with
 * its file count and total size, BEFORE anything is fetched: opening costs one listing call
 * (Poly Haven) or none (ambientCG). A pick saves that variant and records its main file in
 * the library — the URL pipeline prompts later cite as the acquired asset.
 */
export function VariantPicker({ target, onClose }: VariantPickerProps) {
  const loadVariants = useAssetBrowserStore((s) => s.loadVariants);
  const saveVariant = useAssetBrowserStore((s) => s.saveVariant);
  const saving = useAssetBrowserStore((s) => s.saving);
  const list = useAssetBrowserStore((s) => (target ? s.variantLists[variantKey(target)] : undefined));
  const recordDownload = useAssetLibraryStore((s) => s.recordDownload);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<{ variant: DownloadVariant; message: string } | null>(null);

  useEffect(() => {
    if (target) void loadVariants(target);
  }, [target, loadVariants]);

  const close = useCallback(() => {
    setSaveError(null);
    onClose();
  }, [onClose]);

  const choose = useCallback(async (variant: DownloadVariant) => {
    if (!target) return;
    setBusy(true);
    setSaveError(null);
    const saved = await saveVariant(variant);
    if (!saved.ok) {
      setSaveError({ variant, message: saved.error });
      setBusy(false);
      return;
    }
    await recordDownload(target, variant.mainUrl);
    setBusy(false);
    close();
  }, [target, saveVariant, recordDownload, close]);

  return (
    <Modal
      open={target !== null}
      onClose={close}
      title={target ? `Download ${target.name}` : 'Download'}
      icon={<Download size={16} className="text-[var(--visual-gen)]" />}
      className="max-w-md"
    >
      <p className="text-xs text-text-muted mb-3">
        {target?.license || 'CC0'} · <span className="capitalize">{target?.source}</span> — pick a format and
        resolution. Sizes are the full download.
      </p>

      {(!list || list.status === 'loading') && (
        <p role="status" className="flex items-center gap-2 text-xs text-text-muted py-4">
          <Loader2 size={14} className="animate-spin" /> Listing files…
        </p>
      )}

      {list?.status === 'error' && target && (
        <InlineErrorRetry
          message={`Could not list files — ${list.error}`}
          onRetry={() => void loadVariants(target, true)}
        />
      )}

      {list?.status === 'ready' && list.variants.length === 0 && (
        <p className="text-xs text-text-muted py-4">This asset lists no downloadable files.</p>
      )}

      {list?.status === 'ready' && list.variants.length > 0 && (
        <div className="space-y-3">
          {byFormat(list.variants).map(([format, variants]) => (
            <section key={format}>
              <h3 className="text-2xs uppercase tracking-wide text-text-muted mb-1">{format}</h3>
              <ul className="space-y-1">
                {variants.map((v) => {
                  const size = formatBytes(v.totalBytes);
                  const progress = saving?.variantId === v.id ? ` · saving ${saving.done}/${saving.total}` : '';
                  return (
                    <li key={v.id}>
                      <button
                        onClick={() => void choose(v)}
                        disabled={busy}
                        title={`${v.totalBytes.toLocaleString()} bytes`}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border text-left text-xs hover:border-[var(--visual-gen)] disabled:opacity-50 ${VISUAL_GEN_FOCUS_RING}`}
                      >
                        <span className="font-medium text-text">{v.label}</span>
                        <span className="text-text-muted tabular-nums">
                          {filesLabel(v.files.length)} · {size}{progress}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {saveError && (
        <InlineErrorRetry
          className="mt-3"
          message={`Download failed — ${saveError.message}`}
          onRetry={() => void choose(saveError.variant)}
          onDismiss={() => setSaveError(null)}
          dense
        />
      )}
    </Modal>
  );
}
