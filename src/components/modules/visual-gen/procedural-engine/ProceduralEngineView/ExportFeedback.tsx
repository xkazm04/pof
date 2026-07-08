export function ExportFeedback({ isExporting, result, error }: {
  isExporting: boolean;
  result: string | null;
  error: string | null;
}) {
  if (isExporting) {
    return (
      <div className="text-xs text-amber-400 bg-amber-500/5 rounded px-2 py-1.5 animate-pulse">
        Exporting to Blender...
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-xs text-red-400 bg-red-500/5 rounded px-2 py-1.5">
        Export failed: {error}
      </div>
    );
  }
  if (result) {
    return (
      <div className="text-xs text-emerald-400 bg-emerald-500/5 rounded px-2 py-1.5">
        {result}
      </div>
    );
  }
  return null;
}
