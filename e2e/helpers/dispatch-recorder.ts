import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type DispatchKind = 'cli-prompt' | 'cook-execute' | 'cook-event' | 'unknown';

export interface DispatchRecord {
  kind: DispatchKind;
  url?: string;
  method?: string;
  body: unknown;
  timestamp: number;
  /** Populated by setStepLabel before each test.step. */
  stepLabel?: string;
}

export class DispatchRecorder {
  private records: DispatchRecord[] = [];
  private currentStepLabel = '';

  setStepLabel(label: string): void {
    this.currentStepLabel = label;
  }

  record(r: Omit<DispatchRecord, 'timestamp' | 'stepLabel'>): void {
    this.records.push({
      ...r,
      timestamp: Date.now(),
      stepLabel: this.currentStepLabel || undefined,
    });
  }

  all(): DispatchRecord[] {
    return [...this.records];
  }

  byKind(kind: DispatchKind): DispatchRecord[] {
    return this.records.filter((r) => r.kind === kind);
  }

  async writeJSON(path: string, meta: { runMode: 'stub' | 'live'; startedAt: string; finishedAt: string }): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const payload = {
      runMode: meta.runMode,
      startedAt: meta.startedAt,
      finishedAt: meta.finishedAt,
      counts: {
        total: this.records.length,
        cliPrompt: this.byKind('cli-prompt').length,
        cookExecute: this.byKind('cook-execute').length,
        cookEvent: this.byKind('cook-event').length,
      },
      dispatches: this.records,
    };
    await writeFile(path, JSON.stringify(payload, null, 2), 'utf-8');
  }
}
