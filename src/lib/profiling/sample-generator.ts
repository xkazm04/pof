import type {
  ProfilingSession,
  FrameTimingSample,
  ActorTickProfile,
  MemoryAllocation,
  GCPauseEvent,
} from '@/types/performance-profiling';
import { buildSessionFromStats } from './csv-parser';

// ── Sample Scenario Generator ───────────────────────────────────────────────
// Generates realistic profiling data for aRPG scenarios without needing a real trace

interface ScenarioParams {
  scenarioType: 'combat-heavy' | 'exploration' | 'menu' | 'loading' | 'custom';
  enemyCount: number;
  targetFPS: number;
  projectPath: string;
}

// aRPG actor class templates
const ACTOR_TEMPLATES = {
  'combat-heavy': [
    { className: 'AARPGEnemyCharacter', baseTickMs: 0.12, countMultiplier: 1.0, freqHz: 60 },
    { className: 'AARPGPlayerCharacter', baseTickMs: 0.25, countMultiplier: 0, fixedCount: 1, freqHz: 60 },
    { className: 'AARPGProjectile', baseTickMs: 0.03, countMultiplier: 0.5, freqHz: 60 },
    { className: 'AARPGDamageNumber', baseTickMs: 0.02, countMultiplier: 0.8, freqHz: 30 },
    { className: 'UARPGAbilitySystemComponent', baseTickMs: 0.08, countMultiplier: 1.1, freqHz: 60 },
    { className: 'AARPGWorldItem', baseTickMs: 0.015, countMultiplier: 0.4, freqHz: 10 },
    { className: 'UARPGAIController', baseTickMs: 0.1, countMultiplier: 1.0, freqHz: 30 },
    { className: 'AARPGVFXActor', baseTickMs: 0.01, countMultiplier: 2.0, freqHz: 60 },
    { className: 'UNavigationSystem', baseTickMs: 0.5, countMultiplier: 0, fixedCount: 1, freqHz: 20 },
    { className: 'AARPGLootContainer', baseTickMs: 0.005, countMultiplier: 0.1, freqHz: 5 },
  ],
  'exploration': [
    { className: 'AARPGPlayerCharacter', baseTickMs: 0.2, countMultiplier: 0, fixedCount: 1, freqHz: 60 },
    { className: 'AARPGEnemyCharacter', baseTickMs: 0.08, countMultiplier: 0.2, freqHz: 20 },
    { className: 'AARPGWorldItem', baseTickMs: 0.01, countMultiplier: 0.5, freqHz: 5 },
    { className: 'AARPGInteractable', baseTickMs: 0.005, countMultiplier: 0.3, freqHz: 10 },
    { className: 'AARPGLootContainer', baseTickMs: 0.005, countMultiplier: 0.3, freqHz: 5 },
    { className: 'UNavigationSystem', baseTickMs: 0.3, countMultiplier: 0, fixedCount: 1, freqHz: 20 },
    { className: 'AARPGAmbientCreature', baseTickMs: 0.02, countMultiplier: 0.4, freqHz: 10 },
  ],
  'menu': [
    { className: 'UARPGInventoryWidget', baseTickMs: 0.4, countMultiplier: 0, fixedCount: 1, freqHz: 60 },
    { className: 'UARPGHUDWidget', baseTickMs: 0.15, countMultiplier: 0, fixedCount: 1, freqHz: 60 },
    { className: 'UARPGTooltipWidget', baseTickMs: 0.05, countMultiplier: 0, fixedCount: 1, freqHz: 60 },
    { className: 'AARPGPlayerCharacter', baseTickMs: 0.1, countMultiplier: 0, fixedCount: 1, freqHz: 60 },
  ],
  'loading': [
    { className: 'UStreamableManager', baseTickMs: 2.0, countMultiplier: 0, fixedCount: 1, freqHz: 60 },
    { className: 'UAssetManager', baseTickMs: 1.5, countMultiplier: 0, fixedCount: 1, freqHz: 60 },
    { className: 'FGCObjectReferencer', baseTickMs: 0.8, countMultiplier: 0, fixedCount: 1, freqHz: 60 },
  ],
  'custom': [],
};

const MEMORY_TEMPLATES = {
  'combat-heavy': [
    { category: 'Textures', baseMB: 512, peakMul: 1.3 },
    { category: 'Static Meshes', baseMB: 256, peakMul: 1.2 },
    { category: 'Skeletal Meshes', baseMB: 180, peakMul: 1.4 },
    { category: 'Particles/Niagara', baseMB: 95, peakMul: 2.0 },
    { category: 'Animation', baseMB: 64, peakMul: 1.3 },
    { category: 'Audio', baseMB: 48, peakMul: 1.1 },
    { category: 'Physics', baseMB: 32, peakMul: 1.5 },
    { category: 'AI/BehaviorTree', baseMB: 24, peakMul: 1.8 },
    { category: 'GAS/GameplayEffects', baseMB: 16, peakMul: 2.5 },
    { category: 'UI/Slate', baseMB: 28, peakMul: 1.2 },
  ],
  'exploration': [
    { category: 'Textures', baseMB: 640, peakMul: 1.4 },
    { category: 'Static Meshes', baseMB: 384, peakMul: 1.3 },
    { category: 'Skeletal Meshes', baseMB: 80, peakMul: 1.2 },
    { category: 'World Partition', baseMB: 128, peakMul: 1.6 },
    { category: 'Landscape', baseMB: 96, peakMul: 1.1 },
    { category: 'Audio', baseMB: 64, peakMul: 1.2 },
    { category: 'UI/Slate', baseMB: 20, peakMul: 1.1 },
  ],
  'menu': [
    { category: 'UI/Slate', baseMB: 64, peakMul: 1.5 },
    { category: 'Textures', baseMB: 128, peakMul: 1.1 },
    { category: 'Audio', baseMB: 16, peakMul: 1.0 },
  ],
  'loading': [
    { category: 'Streaming', baseMB: 256, peakMul: 3.0 },
    { category: 'Textures', baseMB: 400, peakMul: 2.0 },
    { category: 'Static Meshes', baseMB: 300, peakMul: 2.0 },
  ],
  'custom': [],
};

export function generateSampleSession(params: ScenarioParams): ProfilingSession {
  const { scenarioType, enemyCount, targetFPS, projectPath } = params;
  const budgetMs = 1000 / targetFPS;
  const templates = ACTOR_TEMPLATES[scenarioType] || ACTOR_TEMPLATES['combat-heavy'];
  const memTemplates = MEMORY_TEMPLATES[scenarioType] || MEMORY_TEMPLATES['combat-heavy'];

  // Build actor profiles
  const actorProfiles: ActorTickProfile[] = [];
  let totalActorTickMs = 0;

  for (const tpl of templates) {
    const count = tpl.fixedCount ?? Math.max(1, Math.round(enemyCount * tpl.countMultiplier));
    const totalTick = tpl.baseTickMs * count;
    totalActorTickMs += totalTick;

    actorProfiles.push({
      className: tpl.className,
      instanceCount: count,
      avgTickMs: round2(tpl.baseTickMs),
      maxTickMs: round2(tpl.baseTickMs * 2.5),
      totalTickMs: round2(totalTick),
      tickFrequencyHz: tpl.freqHz,
      gameThreadPercent: 0, // Computed after loop
    });
  }

  // Compute percentages
  for (const p of actorProfiles) {
    p.gameThreadPercent = round2((p.totalTickMs / Math.max(totalActorTickMs, 0.01)) * 100);
  }

  // Overhead: physics, GC, engine, etc.
  const overheadMs = scenarioType === 'combat-heavy' ? 3 + enemyCount * 0.02
    : scenarioType === 'loading' ? 8
    : 2;
  const gameThreadMs = totalActorTickMs + overheadMs;

  // Render thread: scales with draw calls
  const baseDrawCalls = scenarioType === 'combat-heavy' ? 400 + enemyCount * 8
    : scenarioType === 'exploration' ? 600
    : 200;
  const renderThreadMs = baseDrawCalls * 0.008 + (scenarioType === 'exploration' ? 3 : 1);
  const gpuMs = renderThreadMs * 0.9 + (scenarioType === 'exploration' ? 2 : 0.5);

  // Generate frame samples with realistic variance
  const frameCount = 300;
  const frameSamples: FrameTimingSample[] = [];
  for (let i = 0; i < frameCount; i++) {
    const v = () => 0.75 + Math.random() * 0.5;
    // Occasional spikes (GC, streaming)
    const spike = Math.random() < 0.03 ? 2 + Math.random() * 3 : 1;
    const gt = gameThreadMs * v() * spike;
    const rt = renderThreadMs * v();
    const g = gpuMs * v();

    frameSamples.push({
      frameIndex: i,
      timestampMs: i * budgetMs,
      gameThreadMs: round2(gt),
      renderThreadMs: round2(rt),
      gpuMs: round2(g),
      rhiMs: round2(g * 0.3),
      totalFrameMs: round2(Math.max(gt, rt, g)),
      drawCalls: Math.round(baseDrawCalls * v()),
      triangleCount: Math.round(baseDrawCalls * 800 * v()),
    });
  }

  // Memory allocations
  const memoryAllocations: MemoryAllocation[] = memTemplates.map((tpl) => ({
    category: tpl.category,
    currentMB: round2(tpl.baseMB * (0.9 + Math.random() * 0.2)),
    peakMB: round2(tpl.baseMB * tpl.peakMul),
    allocationCount: Math.round(tpl.baseMB * 50 + Math.random() * 1000),
    allocationRateMBps: round2(tpl.baseMB * 0.01 * Math.random()),
  }));

  // GC pauses
  const gcPauses: GCPauseEvent[] = [];
  const gcFreq = scenarioType === 'combat-heavy' ? 8 : scenarioType === 'loading' ? 12 : 3;
  for (let i = 0; i < gcFreq; i++) {
    gcPauses.push({
      timestampMs: Math.round((i / gcFreq) * frameCount * budgetMs),
      durationMs: round2(1 + Math.random() * (scenarioType === 'combat-heavy' ? 5 : 2)),
      objectsCollected: Math.round(500 + Math.random() * 2000),
      memoryFreedMB: round2(2 + Math.random() * 10),
    });
  }

  // Compute summary
  const frameTimes = frameSamples.map((f) => f.totalFrameMs).sort((a, b) => a - b);
  const avgFrame = frameTimes.reduce((s, t) => s + t, 0) / frameTimes.length;
  const drawCalls = frameSamples.map((f) => f.drawCalls);
  const gcDurations = gcPauses.map((g) => g.durationMs);

  return {
    id: `sample-${scenarioType}-${Date.now()}`,
    name: `${scenarioType} (${enemyCount} enemies, ${targetFPS}fps target)`,
    source: 'manual',
    projectPath,
    importedAt: new Date().toISOString(),
    durationMs: frameCount * budgetMs,
    frameCount,
    summary: {
      avgFrameMs: round2(avgFrame),
      p99FrameMs: round2(frameTimes[Math.floor(frameTimes.length * 0.99)]),
      minFPS: round2(1000 / Math.max(...frameTimes)),
      avgFPS: round2(1000 / avgFrame),
      maxFPS: round2(1000 / Math.min(...frameTimes)),
      avgGameThreadMs: round2(frameSamples.reduce((s, f) => s + f.gameThreadMs, 0) / frameCount),
      avgRenderThreadMs: round2(frameSamples.reduce((s, f) => s + f.renderThreadMs, 0) / frameCount),
      avgGpuMs: round2(frameSamples.reduce((s, f) => s + f.gpuMs, 0) / frameCount),
      totalDrawCalls: drawCalls.reduce((s, d) => s + d, 0),
      avgDrawCallsPerFrame: Math.round(drawCalls.reduce((s, d) => s + d, 0) / frameCount),
      peakDrawCalls: Math.max(...drawCalls),
      totalMemoryMB: round2(memoryAllocations.reduce((s, m) => s + m.currentMB, 0)),
      peakMemoryMB: round2(memoryAllocations.reduce((s, m) => s + m.peakMB, 0)),
      gcPauseCount: gcPauses.length,
      avgGcPauseMs: gcDurations.length > 0 ? round2(gcDurations.reduce((s, d) => s + d, 0) / gcDurations.length) : 0,
      maxGcPauseMs: gcDurations.length > 0 ? round2(Math.max(...gcDurations)) : 0,
      totalGcTimeMs: round2(gcDurations.reduce((s, d) => s + d, 0)),
      frameBudgetMs: round2(budgetMs),
      budgetHitRate: round2((frameTimes.filter((t) => t <= budgetMs).length / frameTimes.length) * 100),
    },
    frameSamples,
    actorProfiles: actorProfiles.sort((a, b) => b.totalTickMs - a.totalTickMs),
    memoryAllocations,
    gcPauses,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
