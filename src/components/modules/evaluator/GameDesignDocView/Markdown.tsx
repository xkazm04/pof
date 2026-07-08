import { memo, useMemo } from 'react';

// ─── Markdown renderer (lightweight — tables, headings, lists, bold, italic)

// Pure markdown parser — deterministic in `content`, so its output can be
// memoized and only recomputed when the source text changes.
function parseMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1]?.includes('---')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
      continue;
    }

    // Heading
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-xs font-semibold text-text mt-3 mb-1.5">{line.slice(4)}</h4>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-sm font-semibold text-text mt-3 mb-1.5">{line.slice(3)}</h3>);
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-sm font-bold text-text mt-2 mb-1">{line.slice(2)}</h2>);
      i++;
      continue;
    }

    // List item
    if (line.startsWith('- ')) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-text-muted leading-relaxed ml-1">
          <span className="text-text-muted flex-shrink-0">•</span>
          <span><InlineMarkdown text={line.slice(2)} /></span>
        </div>
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-xs text-text-muted leading-relaxed">
        <InlineMarkdown text={line} />
      </p>
    );
    i++;
  }

  return elements;
}

export const MarkdownBlock = memo(function MarkdownBlock({ content }: { content: string }) {
  // Re-parse only when the source text changes, not on unrelated parent re-renders.
  const elements = useMemo(() => (content ? parseMarkdown(content) : null), [content]);
  if (!elements) return null;
  return <>{elements}</>;
});

function InlineMarkdown({ text }: { text: string }) {
  // Handle **bold** and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-text font-medium">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} className="text-text-muted-hover">{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MarkdownTable({ lines }: { lines: string[] }) {
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line.split('|').map((c) => c.trim()).filter(Boolean);

  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow); // skip separator row

  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-1.5 px-2 text-text-muted font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50">
              {row.map((cell, ci) => (
                <td key={ci} className="py-1 px-2 text-text-muted">
                  <InlineMarkdown text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
