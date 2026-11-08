'use client';

import { type Dispatch, type SetStateAction } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LootTablePaginationProps {
  safePage: number;
  totalPages: number;
  totalCount: number;
  setPage: Dispatch<SetStateAction<number>>;
}

export function LootTablePagination({ safePage, totalPages, totalCount, setPage }: LootTablePaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => setPage(Math.max(0, safePage - 1))}
        disabled={safePage === 0}
        className="p-1 rounded border border-border/30 disabled:opacity-30 cursor-pointer"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
      </button>
      <span className="text-2xs font-mono text-text-muted">
        Page {safePage + 1} / {totalPages} ({totalCount} items)
      </span>
      <button
        type="button"
        aria-label="Next page"
        onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
        disabled={safePage >= totalPages - 1}
        className="p-1 rounded border border-border/30 disabled:opacity-30 cursor-pointer"
      >
        <ChevronRight className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
      </button>
    </div>
  );
}
