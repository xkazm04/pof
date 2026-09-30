'use client';
import React from 'react';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';
import type { SectionId } from '@/components/modules/core-engine/unique-tabs/feature-map-config';

interface VisibleSectionProps {
  moduleId: string;
  /** A declared Feature Map section (feature-map-config.ts); a typo fails typecheck. */
  sectionId: SectionId;
  children: React.ReactNode;
}

export function VisibleSection({ moduleId, sectionId, children }: VisibleSectionProps) {
  const { isVisible } = useFeatureVisibility(moduleId);
  if (!isVisible(sectionId)) return null;
  return <>{children}</>;
}
