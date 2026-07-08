'use client';
import { Loader2 } from 'lucide-react';
import { FetchError } from '@/components/modules/shared/FetchError';
import { useLevelDesignView } from './useLevelDesignView';
import { DocSidebar } from './DocSidebar';
import { ActiveDocView } from './ActiveDocView';
import { EmptyState } from './EmptyState';

export { SyncDot } from './SyncDot';

export function LevelDesignView() {
  const vm = useLevelDesignView();
  const { activeDoc, isLoading, error, retry } = vm;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted-hover" />
      </div>
    );
  }

  if (error) {
    return <FetchError message={error} onRetry={retry} />;
  }

  return (
    <div className="flex h-full relative">
      {/* Left sidebar — Document list */}
      <DocSidebar vm={vm} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeDoc ? <ActiveDocView vm={vm} /> : <EmptyState vm={vm} />}
      </div>
    </div>
  );
}
