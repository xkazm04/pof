'use client';

import { useState, useCallback } from 'react';
import { Check, ChevronRight, FileCode, Loader2, ArrowRight, AlertTriangle, Link2, Zap, Play, Copy, Eye } from 'lucide-react';
import type { FeatureRow } from '@/types/feature-matrix';
import type { DependencyInfo } from '@/lib/feature-definitions';
import { MarkdownProse } from '@/components/ui/MarkdownProse';
import { UI_TIMEOUTS } from '@/lib/constants';
import { STATUS_ERROR, STATUS_BLOCKER, STATUS_SUCCESS, statusBg, statusBorder } from '@/lib/chart-colors';
import type { VerificationResult } from '@/types/pof-bridge';
import { slugifyForTestId } from '@/lib/test-ids';
import { STATUS_CONFIG } from './constants';
import { QualityStars } from './QualityStars';
import { VerificationBadge } from './VerificationBadge';
import { DependencyChain } from './DependencyChain';

export function FeatureRowItem({
  feature,
  isExpanded,
  onToggle,
  depInfo,
  onFix,
  isFixing,
  onReviewFeature,
  accentColor,
  showCategory,
  verificationResult,
}: {
  feature: FeatureRow;
  isExpanded: boolean;
  onToggle: () => void;
  depInfo?: DependencyInfo;
  onFix?: (feature: FeatureRow) => void;
  isFixing?: boolean;
  onReviewFeature?: (feature: FeatureRow) => void;
  accentColor: string;
  showCategory?: boolean;
  verificationResult?: VerificationResult;
}) {
  const cfg = STATUS_CONFIG[feature.status];
  const StatusGlyph = cfg.icon;
  const hasDeps = depInfo && depInfo.deps.length > 0;
  const isBlocked = depInfo?.isBlocked ?? false;
  const hasDetails = feature.reviewNotes || feature.filePaths.length > 0 || feature.nextSteps || hasDeps;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${feature.featureName} — ${cfg.label}${feature.qualityScore ? ` (${feature.qualityScore}/5)` : ''}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [feature.featureName, cfg.label, feature.qualityScore]);

  const handleReview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onReviewFeature?.(feature);
  }, [onReviewFeature, feature]);

  const handleViewFiles = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Expand the row to reveal file paths
    if (!isExpanded) onToggle();
  }, [isExpanded, onToggle]);

  const testIdSlug = slugifyForTestId(feature.featureName);

  return (
    <div
      data-testid={`pof-feature-matrix-row-${testIdSlug}`}
      className="group/row rounded-md overflow-hidden"
      style={{ borderLeft: `4px solid ${cfg.color}` }}
    >
      <button
        onClick={hasDetails ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
          hasDetails ? 'hover:bg-surface-hover cursor-pointer' : 'cursor-default'
        } ${isExpanded ? 'bg-surface-deep' : ''}`}
      >
        {/* Status indicator — shape (glyph) + color, so status is legible without
            relying on hue alone (WCAG 1.4.1). The status badge text carries the
            accessible name; the glyph + dot are decorative reinforcement. */}
        <span
          className="flex items-center gap-1 flex-shrink-0"
          title={`${cfg.label}: ${cfg.plain}. ${cfg.action}`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: cfg.color }}
          />
          <StatusGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: cfg.color }} />
        </span>

        {/* Feature name */}
        <span className="text-sm text-text w-[150px] flex-shrink-0 truncate">
          {feature.featureName}
        </span>

        {/* Inline category badge (flat view only) */}
        {showCategory && (
          <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface-hover text-text-muted flex-shrink-0">
            {feature.category}
          </span>
        )}

        {/* Description (truncated) */}
        <span className="text-xs text-text-muted-hover flex-1 min-w-0 truncate hidden sm:block">
          {feature.description}
        </span>

        {/* Hover action buttons — opacity reveal is the primary cue; the scale-up is
            gated behind motion-safe: so reduced-motion users just get the fade.
            Also revealed on keyboard focus-within, and made persistently visible on
            coarse/no-hover pointers (touch) where :hover never fires. */}
        <span className="flex items-center gap-0.5 flex-shrink-0 opacity-30 motion-safe:scale-95 group-hover/row:opacity-100 group-focus-within/row:opacity-100 motion-safe:group-hover/row:scale-100 motion-safe:group-focus-within/row:scale-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:scale-100 transition-all">
          {onReviewFeature && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleReview}
              onKeyDown={(e) => { if (e.key === 'Enter') handleReview(e as unknown as React.MouseEvent); }}
              className="p-1 rounded hover:bg-surface-hover transition-colors"
              style={{ color: accentColor }}
              title="Review this feature with Claude"
            >
              <Play className="w-3 h-3" />
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={handleCopy}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCopy(e as unknown as React.MouseEvent); }}
            className="p-1 rounded hover:bg-surface-hover transition-colors text-text-muted hover:text-text"
            title={copied ? 'Copied!' : 'Copy feature name & status'}
          >
            {copied ? <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} /> : <Copy className="w-3 h-3" />}
          </span>
          {feature.filePaths.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleViewFiles}
              onKeyDown={(e) => { if (e.key === 'Enter') handleViewFiles(e as unknown as React.MouseEvent); }}
              className="p-1 rounded hover:bg-surface-hover transition-colors text-text-muted hover:text-text"
              title="View source files"
            >
              <Eye className="w-3 h-3" />
            </span>
          )}
        </span>

        {/* Blocked badge */}
        {isBlocked && feature.status !== 'implemented' && (
          <span
            className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
            style={{ backgroundColor: statusBg(STATUS_ERROR), color: STATUS_BLOCKER }}
            title={`Blocked by: ${depInfo!.blockers.map((b) => b.featureName).join(', ')}`}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            blocked
          </span>
        )}

        {/* Dependency count */}
        {hasDeps && !isBlocked && (
          <span
            className="flex items-center gap-0.5 text-2xs text-text-muted flex-shrink-0"
            title={`Depends on ${depInfo!.deps.length} feature${depInfo!.deps.length > 1 ? 's' : ''}`}
          >
            <Link2 className="w-2.5 h-2.5" />
            {depInfo!.deps.length}
          </span>
        )}

        {/* Quality stars */}
        <span data-testid={`pof-feature-matrix-quality-${testIdSlug}`} className="contents">
          <QualityStars score={feature.qualityScore} />
        </span>

        {/* File count badge */}
        {feature.filePaths.length > 0 && (
          <span className="flex items-center gap-0.5 text-2xs text-text-muted-hover flex-shrink-0">
            <FileCode className="w-3 h-3" />
            {feature.filePaths.length}
          </span>
        )}

        {/* Verification badge — shown after auto-verify runs */}
        {verificationResult && (
          <VerificationBadge result={verificationResult} />
        )}

        {/* Status badge */}
        <span
          data-testid={`pof-feature-matrix-status-${testIdSlug}`}
          className="text-2xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label.toLowerCase()}
        </span>

        {/* Expand chevron */}
        {hasDetails && (
          <ChevronRight
            className="w-3 h-3 text-text-muted-hover flex-shrink-0 transition-transform duration-250 ease-out"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        )}
      </button>

      {/* Expanded detail — CSS grid-rows animation */}
      {hasDetails && (
        <div
          className="grid transition-[grid-template-rows] duration-250 ease-out"
          style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div
              className="pl-8 pr-4 pb-3 pt-1 space-y-3 bg-surface-deep"
              style={{ borderLeft: `3px solid ${cfg.color}` }}
            >
              {/* Dependency chain */}
              {hasDeps && (
                <DependencyChain depInfo={depInfo!} currentModuleId={feature.moduleId} />
              )}

              {/* Review notes */}
              {feature.reviewNotes && (
                <MarkdownProse content={feature.reviewNotes} className="leading-relaxed" />
              )}

              {/* Next steps */}
              {feature.nextSteps && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3 text-text-muted" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Next steps to pro
                    </span>
                  </div>
                  <MarkdownProse content={feature.nextSteps} className="leading-relaxed pl-[18px] text-text-muted-hover" />
                  {onFix && feature.status !== 'improved' && !(feature.status === 'implemented' && feature.qualityScore === 5 && !feature.nextSteps?.trim()) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFix(feature);
                      }}
                      disabled={isFixing}
                      className="ml-[18px] mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                      style={{ backgroundColor: statusBg(STATUS_SUCCESS, 0.05), color: STATUS_SUCCESS, border: `1px solid ${statusBorder(STATUS_SUCCESS, 0.20)}` }}
                    >
                      {isFixing ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Fixing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          Implement This
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* File paths */}
              {feature.filePaths.length > 0 && (
                <div className="space-y-0.5">
                  {feature.filePaths.map((fp) => (
                    <div key={fp} className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
                      <FileCode className="w-3 h-3 flex-shrink-0" />
                      {fp}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
