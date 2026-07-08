export function ZoomBtn({ onClick, title, ariaLabel, children }: {
  onClick: () => void; title: string; ariaLabel: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="flex items-center justify-center px-2 h-6 rounded-md uppercase tracking-wider text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
    >
      {children}
    </button>
  );
}
