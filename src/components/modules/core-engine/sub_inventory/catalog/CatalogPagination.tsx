'use client';

interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (fn: (p: number) => number) => void;
}

export function CatalogPagination({ currentPage, totalPages, setCurrentPage }: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-border/30">
      <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
        className="px-3 py-1.5 rounded-lg text-sm font-bold border border-border/40 hover:bg-surface-hover disabled:opacity-30 transition-all cursor-pointer">Prev</button>
      <span className="text-sm font-mono text-text-muted">Page <span className="font-bold text-text">{currentPage + 1}</span> of {totalPages}</span>
      <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}
        className="px-3 py-1.5 rounded-lg text-sm font-bold border border-border/40 hover:bg-surface-hover disabled:opacity-30 transition-all cursor-pointer">Next</button>
    </div>
  );
}
