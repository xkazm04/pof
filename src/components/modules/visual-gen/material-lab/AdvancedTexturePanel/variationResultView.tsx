import { AlertTriangle } from 'lucide-react';
import type { VariationResult } from './types';

/** Upscale and unzoom cannot take an id from a PoF run: PoF has already deleted that image. */
export function LiveImageIdNote() {
  return (
    <p className="text-xs text-[var(--text-muted)]">
      Needs an image that still exists on your Leonardo account. PoF deletes its own generations after download, so ids from PoF runs will be refused.
    </p>
  );
}

export function VariationResultView({ result, testId, filename }: { result: VariationResult; testId: string; filename: string }) {
  const src = `data:image/png;base64,${result.imageBase64}`;
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-testid={`${testId}-result`} src={src} alt={`${testId} result`} className="w-full rounded border border-white/10" />
      <a href={src} download={filename} className="text-xs text-[var(--visual-gen)] underline">
        Save image (this is the only copy)
      </a>
      {!result.variationDeleted && (
        <div data-testid={`${testId}-not-deleted`} className="flex items-start gap-1.5 text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Leonardo refused the delete: variation {result.variationId} is still on the account. Remove it there by hand.
        </div>
      )}
    </div>
  );
}
