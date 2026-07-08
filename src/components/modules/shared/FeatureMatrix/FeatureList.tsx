import { ChevronDown, ChevronRight } from 'lucide-react';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import type { FeatureRow } from '@/types/feature-matrix';
import { FeatureRowItem } from './FeatureRowItem';
import type { FeatureMatrixState } from './useFeatureMatrixState';

export function FeatureList({
  state,
  accentColor,
  onFix,
  isFixing,
  onReviewFeature,
}: {
  state: FeatureMatrixState;
  accentColor: string;
  onFix?: (feature: FeatureRow) => void;
  isFixing?: boolean;
  onReviewFeature?: (feature: FeatureRow) => void;
}) {
  const {
    viewMode,
    filtered,
    expandedRows,
    toggleRow,
    depMap,
    verificationMap,
    categories,
    grouped,
    collapsedCategories,
    toggleCategory,
    features,
  } = state;

  return (
    <>
      {/* Feature table — grouped or flat based on viewMode */}
      <div className="space-y-1">
        {viewMode === 'flat' ? (
          /* Flat sorted list — no category grouping */
          <StaggerContainer className="space-y-px">
            {filtered.map((feature) => {
              const featureKey = `${feature.moduleId}::${feature.featureName}`;
              const depInfo = depMap.get(featureKey);
              return (
                <StaggerItem key={feature.featureName}>
                  <FeatureRowItem
                    feature={feature}
                    isExpanded={expandedRows.has(feature.featureName)}
                    onToggle={() => toggleRow(feature.featureName)}
                    depInfo={depInfo}
                    onFix={onFix}
                    isFixing={isFixing}
                    onReviewFeature={onReviewFeature}
                    accentColor={accentColor}
                    verificationResult={verificationMap.get(feature.featureName)}
                    showCategory
                  />
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        ) : (
          /* Grouped by category */
          categories.map((cat) => {
            const catFeatures = grouped[cat];
            const isCollapsed = collapsedCategories.has(cat);
            const catImplemented = catFeatures.filter((f) => f.status === 'implemented' || f.status === 'improved').length;

            return (
              <div key={cat}>
                {/* Category header — sticky within scroll */}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors sticky top-[40px] z-[5] bg-background"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-text-muted-hover" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-text-muted-hover" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {cat}
                  </span>
                  <span className="text-2xs text-text-muted">
                    {catImplemented}/{catFeatures.length}
                  </span>
                </button>

                {/* Feature rows */}
                {!isCollapsed && (
                  <StaggerContainer className="ml-2 space-y-px">
                    {catFeatures.map((feature) => {
                      const featureKey = `${feature.moduleId}::${feature.featureName}`;
                      const depInfo = depMap.get(featureKey);
                      return (
                        <StaggerItem key={feature.featureName}>
                          <FeatureRowItem
                            feature={feature}
                            isExpanded={expandedRows.has(feature.featureName)}
                            onToggle={() => toggleRow(feature.featureName)}
                            depInfo={depInfo}
                            onFix={onFix}
                            isFixing={isFixing}
                            onReviewFeature={onReviewFeature}
                            accentColor={accentColor}
                            verificationResult={verificationMap.get(feature.featureName)}
                          />
                        </StaggerItem>
                      );
                    })}
                  </StaggerContainer>
                )}
              </div>
            );
          })
        )}
      </div>

      {filtered.length === 0 && features.length > 0 && (
        <p className="text-xs text-text-muted-hover text-center py-8">
          No features match your filters.
        </p>
      )}
      {features.length === 0 && (
        <p className="text-xs text-text-muted-hover text-center py-8">
          No features defined for this module.
        </p>
      )}
    </>
  );
}
