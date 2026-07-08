import { RefreshCw } from 'lucide-react';
import { AccentButton } from '@/components/ui/AccentButton';
import type { FeatureRow } from '@/types/feature-matrix';
import { ReviewProgressBar } from './ReviewProgressBar';

export function NeverReviewedState({
  features,
  isReviewing,
  reviewProgress,
  onReview,
  accentColor,
}: {
  features: FeatureRow[];
  isReviewing: boolean;
  reviewProgress: { scanned: number; total: number } | null;
  onReview: () => void;
  accentColor: string;
}) {
  return (
    <div className="flex items-center justify-center py-10">
      <div
        className="flex flex-col items-center gap-3 px-10 py-8 rounded-xl max-w-sm"
        style={{
          border: `1.5px dashed ${accentColor}38`,
          backgroundColor: `${accentColor}14`,
        }}
      >
        <RefreshCw className="w-8 h-8" style={{ color: accentColor, opacity: 0.7 }} />

        <h3 className="text-sm font-semibold text-text">No review yet</h3>

        <p className="text-xs text-text-muted text-center leading-relaxed">
          Claude will scan your project source files, evaluate each feature&apos;s implementation status, and assign quality scores with actionable next steps.
        </p>

        <span className="text-xs text-text-muted">
          {features.length} feature{features.length !== 1 ? 's' : ''} to analyze
        </span>

        <AccentButton
          data-testid="pof-feature-matrix-scan-btn"
          onClick={onReview}
          disabled={isReviewing}
          loading={isReviewing}
          accentColor={accentColor}
          size="md"
          className="mt-1"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          loadingLabel={<>Reviewing...</>}
        >
          Review with Claude
        </AccentButton>

        {isReviewing && reviewProgress && reviewProgress.total > 0 && (
          <ReviewProgressBar
            scanned={reviewProgress.scanned}
            total={reviewProgress.total}
            accentColor={accentColor}
          />
        )}
      </div>
    </div>
  );
}
