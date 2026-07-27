import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import { MIXAMO_DOWNLOAD_CONTRACT } from '@/lib/prompts/_shared';
import { buildAnimationChecklistPrompt } from '@/lib/prompts/animation-checklist';
import { getEngineFacts } from '@/lib/engine-facts';
import type { ProjectContext } from '@/lib/prompt-context';
import type { ChecklistStep } from '@/components/modules/content/animations/AnimationChecklist';
import { Boxes } from 'lucide-react';

const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.8.0',
};

const STEP: ChecklistStep = {
  id: 'anim-1',
  number: 1,
  title: 'Import Mixamo clips',
  type: 'code',
  icon: Boxes,
  description: 'Import and retarget the dropped Mixamo FBX.',
  details: ['Import via the legacy FBX path.'],
  prompt: 'Wire the import commandlet.',
};

/**
 * Direction 2 rail: Substrate and the Mixamo download contract each exist as
 * exactly ONE literal, referenced everywhere else. Before this, the Mixamo
 * contract was stated twice in different words (the task handler + the animation
 * checklist builder) and the Substrate claim three times.
 */
describe('single-literal guidance', () => {
  it('both Mixamo surfaces render the SAME contract literal', () => {
    const task = TaskFactory.mixamoImport(
      'arpg-animation',
      { importDir: 'C:\\drops\\mixamo', targetSkeleton: '/Game/Characters/SK_Mannequin' },
      'http://localhost:3000',
      'Mixamo',
    );
    expect(buildTaskPrompt(task, CTX)).toContain(MIXAMO_DOWNLOAD_CONTRACT);
    expect(buildAnimationChecklistPrompt(STEP, CTX)).toContain(MIXAMO_DOWNLOAD_CONTRACT);
  });

  it('no source file re-states the contract or the Substrate claim as its own literal', () => {
    const roots = [
      path.join(process.cwd(), 'src', 'lib', 'prompts'),
      path.join(process.cwd(), 'src', 'lib'),
    ];
    const owners = new Set([
      path.join('src', 'lib', 'prompts', '_shared.ts'),
      path.join('src', 'lib', 'engine-facts.ts'),
    ]);
    const offenders: string[] = [];
    for (const root of roots) {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
        const rel = path.relative(process.cwd(), path.join(root, entry.name));
        if (owners.has(rel)) continue;
        const text = fs.readFileSync(path.join(root, entry.name), 'utf8');
        if (text.includes('Files come from mixamo.com as')) offenders.push(`${rel}: mixamo contract`);
        if (/Substrate is production-ready/.test(text)) offenders.push(`${rel}: substrate claim`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the animation checklist stamps the project engine, not a fixed 5.7', () => {
    const prompt = buildAnimationChecklistPrompt(STEP, CTX);
    expect(prompt).toContain(`this project builds on UE ${getEngineFacts(CTX.ueVersion).version}`);
    expect(prompt).not.toContain('### UE 5.7 Automation Notes (Verified)');
  });
});
