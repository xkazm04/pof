/** Repo rule: colors come from chart-colors. ESLint does not see hex inside Tailwind brackets. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src/components/modules/evaluator/ProjectHealthDashboard');
const FILES = ['ScanHistoryTimeline.tsx', 'HealthRadarChart.tsx', 'SelectedModuleDetail.tsx', 'TopRecommendations.tsx'];

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('ProjectHealthDashboard class names', () => {
  it.each(FILES)('%s has no arbitrary hex color class', (file) => {
    const src = stripComments(readFileSync(join(DIR, file), 'utf-8'));
    expect(src.match(/\[#[0-9a-fA-F]{3,8}\]/g) ?? []).toEqual([]);
  });
});
