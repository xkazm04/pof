'use client';

import { SurfaceCard } from '@/components/ui/SurfaceCard';

interface ManifestPreviewProps {
  json: string;
  onDismiss: () => void;
}

export function ManifestPreview({ json, onDismiss }: ManifestPreviewProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Environment Manifest
      </h2>
      <SurfaceCard className="p-4">
        <p className="text-xs text-text-muted mb-2">
          Share this manifest with teammates so they can replicate your exact dev environment setup.
        </p>
        <pre className="bg-background border border-border rounded-md p-3 text-xs text-text-muted-hover font-mono overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
          {json}
        </pre>
        <button
          onClick={onDismiss}
          className="mt-2 text-xs text-text-muted hover:text-text transition-colors"
        >
          Dismiss
        </button>
      </SurfaceCard>
    </div>
  );
}
