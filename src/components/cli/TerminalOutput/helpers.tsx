import { Bot } from 'lucide-react';
import type { LogEntry } from '../types';
import { CLI_COLORS } from '@/lib/chart-colors';
import {
  LOG_ICON_SIZE, LOG_TYPE_ICONS, TOOL_ICONS, TOOL_BATCH_THRESHOLD,
  UE_CLASS_RE, UE_CLASS_EXCLUDE, FILE_RE, WARNING_RE, UE_CONCEPTS_SET, UE_CONCEPT_LABELS,
} from './constants';
import type { GroupedLogEntry, InlineEntity } from './types';

// --- Helpers ---

export const getLogIcon = (type: LogEntry['type'], toolName?: string) => {
  if (type === 'tool_use' && toolName) {
    const toolIcon = TOOL_ICONS[toolName];
    if (toolIcon) {
      const Icon = toolIcon.icon;
      return <Icon className={`${LOG_ICON_SIZE} ${toolIcon.colorClass}`} />;
    }
  }
  const config = LOG_TYPE_ICONS[type];
  if (config) {
    const Icon = config.icon;
    return <Icon className={`${LOG_ICON_SIZE} ${config.colorClass}`} />;
  }
  return <Bot className={`${LOG_ICON_SIZE} ${CLI_COLORS.fallback}`} />;
};

export const formatLogContent = (log: LogEntry) => {
  if (log.type === 'tool_use' && log.toolInput?.file_path) {
    const fileName = String(log.toolInput.file_path).split(/[/\\]/).pop();
    return `${log.toolName}: ${fileName}`;
  }
  if (log.type === 'tool_result') {
    return log.content.length > 120 ? log.content.slice(0, 120) + '...' : log.content;
  }
  return log.content.length > 200 ? log.content.slice(0, 200) + '...' : log.content;
};

export const getLogTextClass = (type: LogEntry['type']) => {
  switch (type) {
    case 'error': return CLI_COLORS.error;
    case 'user': return CLI_COLORS.userText;
    case 'tool_result': return 'text-text-muted font-mono';
    case 'system': return CLI_COLORS.info;
    default: return 'text-text';
  }
};

export function groupLogs(logs: LogEntry[]): GroupedLogEntry[] {
  const result: GroupedLogEntry[] = [];
  let i = 0;

  while (i < logs.length) {
    if (logs[i].type === 'tool_use' && i + 1 < logs.length && logs[i + 1].type === 'tool_result') {
      const pairs: { toolUse: LogEntry; toolResult: LogEntry }[] = [];
      while (i < logs.length && logs[i].type === 'tool_use' && i + 1 < logs.length && logs[i + 1].type === 'tool_result') {
        pairs.push({ toolUse: logs[i], toolResult: logs[i + 1] });
        i += 2;
      }
      if (pairs.length >= TOOL_BATCH_THRESHOLD) {
        result.push({ kind: 'tool_batch', pairs, id: `batch-${pairs[0].toolUse.id}` });
      } else {
        for (const pair of pairs) {
          result.push({ kind: 'tool_pair', toolUse: pair.toolUse, toolResult: pair.toolResult, id: `pair-${pair.toolUse.id}` });
        }
      }
    } else {
      result.push({ kind: 'single', log: logs[i] });
      i++;
    }
  }

  return result;
}

export function extractInlineEntities(text: string): InlineEntity[] {
  if (text.length < 20) return [];
  const entities: InlineEntity[] = [];
  const seen = new Set<string>();

  // Classes
  UE_CLASS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UE_CLASS_RE.exec(text)) !== null) {
    const name = m[1];
    if (name.length >= 4 && !UE_CLASS_EXCLUDE.has(name) && !seen.has(name)) {
      seen.add(name);
      entities.push({ type: 'class', value: name });
    }
  }

  // Files
  FILE_RE.lastIndex = 0;
  while ((m = FILE_RE.exec(text)) !== null) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      entities.push({ type: 'file', value: m[0] });
    }
  }

  // Concepts
  const lower = text.toLowerCase();
  for (const concept of UE_CONCEPTS_SET) {
    if (lower.includes(concept) && !seen.has(concept)) {
      seen.add(concept);
      entities.push({ type: 'concept', value: UE_CONCEPT_LABELS[concept] ?? concept });
    }
  }

  // Warnings (max 3)
  WARNING_RE.lastIndex = 0;
  let warnCount = 0;
  while ((m = WARNING_RE.exec(text)) !== null && warnCount < 3) {
    const w = m[1].trim();
    if (!seen.has(w)) {
      seen.add(w);
      entities.push({ type: 'warning', value: w });
      warnCount++;
    }
  }

  return entities.slice(0, 12);
}
