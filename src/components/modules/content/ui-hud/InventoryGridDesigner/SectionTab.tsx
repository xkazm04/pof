export function SectionTab({
  label,
  icon,
  active,
  onClick,
  id,
  panelId,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  /** Tab id — referenced by the panel's `aria-labelledby`. */
  id: string;
  /** Id of the panel this tab controls. */
  panelId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={panelId}
      // Roving tabindex: only the selected tab is in the tab order; the rest are
      // reached with Arrow/Home/End (handled by the tablist container).
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`focus-ring-inset flex flex-col items-center justify-center gap-1.5 px-6 py-3 text-xs font-bold uppercase transition-all relative overflow-hidden group border-r border-violet-900/40 last:border-r-0 flex-1 hover:bg-white/5 ${active ? 'text-violet-200' : 'text-violet-500/50 hover:text-violet-300'
        }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110 drop-shadow-[0_0_8px_currentColor]' : 'group-hover:scale-110'}`} aria-hidden="true">
        {icon}
      </div>
      {label}
      {active && (
        <>
          <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-violet-500 shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
          <span className="absolute inset-0 bg-gradient-to-t from-violet-500/10 to-transparent pointer-events-none" />
        </>
      )}
    </button>
  );
}
