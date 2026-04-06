'use client';
import React from 'react';
import { useFeatureVisibility } from '@/hooks/useFeatureVisibility';

interface VisibleSectionProps {
  moduleId: string;
  sectionId: string;
  children: React.ReactNode;
}

export function VisibleSection({ moduleId, sectionId, children }: VisibleSectionProps) {
  const { isVisible } = useFeatureVisibility(moduleId);
  if (!isVisible(sectionId)) return null;
  return <>{children}</>;
}
