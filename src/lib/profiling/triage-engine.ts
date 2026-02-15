import type {
  ProfilingSession,
  PerformanceFinding,
  TriageResult,
  ActorTickProfile,
  FrameBudgetCategory,
  OptimizationPriority,
} from '@/types/performance-profiling';

// ── AI Triage Engine ────────────────────────────────────────────────────────
// Analyzes profiling data and generates prioritized optimization findings
// with CLI fix prompts for the arpg-polish module

export function runTriage(session: ProfilingSession): TriageResult {
  const findings: PerformanceFinding[] = [];
  const { summary, actorProfiles, memoryAllocations, gcPauses, frameSamples } = session;

  // 1. Tick frequency optimization
  findings.push(...analyzeTickFrequencies(actorProfiles, summary.frameBudgetMs));

  // 2. Frame budget analysis
  findings.push(...analyzeFrameBudget(summary));

  // 3. Draw call analysis
  findings.push(...analyzeDrawCalls(summary));

  // 4. Memory analysis
  findings.push(...analyzeMemory(memoryAllocations, summary));

  // 5. GC analysis
  findings.push(...analyzeGC(gcPauses, summary));

  // 6. Widget/UI tick analysis
  findings.push(...analyzeUITicks(actorProfiles));

  // 7. Object pooling candidates
  findings.push(...analyzePoolingCandidates(actorProfiles));

  // Sort by estimated savings (highest first), deduplicate
  const unique = deduplicateFindings(findings);
  unique.sort((a, b) => b.estimatedSavingsMs - a.estimatedSavingsMs);

  // Compute overall score
  const overallScore = computeOverallScore(summary);
  const bottleneck = identifyBottleneck(summary);

  return {
    sessionId: session.id,
    findings: unique.slice(0, 15), // Top 15 findings
    overallScore,
    bottleneck,
    generatedAt: new Date().toISOString(),
  };
}

// ── Tick Frequency Analysis ─────────────────────────────────────────────────

function analyzeTickFrequencies(
  actors: ActorTickProfile[],
  budgetMs: number,
): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];

  for (const actor of actors) {
    // Skip small contributors
    if (actor.totalTickMs < 0.1) continue;

    // Actors ticking at 60Hz that could tick slower
    if (actor.tickFrequencyHz >= 60 && actor.instanceCount > 5) {
      const className = actor.className;

      // Enemy characters: 10Hz when not in combat
      if (className.includes('Enemy') || className.includes('AIController')) {
        const suggestedHz = 10;
        const savings = actor.totalTickMs * (1 - suggestedHz / actor.tickFrequencyHz);
        findings.push({
          id: `tick-freq-${className}`,
          priority: savings > 1 ? 'critical' : savings > 0.3 ? 'high' : 'medium',
          category: 'tick',
          title: `${className} ticks at ${actor.tickFrequencyHz}Hz unnecessarily`,
          description: `${className} has ${actor.instanceCount} instances ticking at ${actor.tickFrequencyHz}Hz, consuming ${actor.totalTickMs.toFixed(2)}ms/frame. Most enemy logic only needs ${suggestedHz}Hz when not in combat, saving ~${savings.toFixed(1)}ms per frame with ${actor.instanceCount} enemies.`,
          estimatedSavingsMs: round2(savings),
          involvedClasses: [className],
          fixPrompt: `Optimize ${className} tick frequency: Add a bIsInCombat flag. In BeginPlay set PrimaryActorTick.TickInterval to 0.1f (10Hz). When combat starts (OnCombatBegin), set TickInterval to 0.0f (every frame). When combat ends, revert to 0.1f. This saves ~${savings.toFixed(1)}ms/frame with ${actor.instanceCount} instances.`,
          checklistLabel: `Optimize ${className} tick rate (${actor.tickFrequencyHz}Hz → ${suggestedHz}Hz idle)`,
          metric: 'tickFrequencyHz',
          metricValue: actor.tickFrequencyHz,
          metricThreshold: suggestedHz,
        });
      }

      // VFX actors: pool them
      if (className.includes('VFX') || className.includes('Projectile') || className.includes('DamageNumber')) {
        const suggestedHz = 30;
        const savings = actor.totalTickMs * (1 - suggestedHz / actor.tickFrequencyHz);
        if (savings > 0.05) {
          findings.push({
            id: `tick-freq-${className}`,
            priority: savings > 0.5 ? 'high' : 'medium',
            category: 'tick',
            title: `${className} (${actor.instanceCount} instances) could tick at ${suggestedHz}Hz`,
            description: `${actor.instanceCount} ${className} instances tick at ${actor.tickFrequencyHz}Hz for ${actor.totalTickMs.toFixed(2)}ms/frame. These are cosmetic and can tick at ${suggestedHz}Hz without visible difference.`,
            estimatedSavingsMs: round2(savings),
            involvedClasses: [className],
            fixPrompt: `Reduce ${className} tick rate to ${suggestedHz}Hz: In the constructor, set PrimaryActorTick.TickInterval = ${(1 / suggestedHz).toFixed(3)}f. For ${className.includes('Projectile') ? 'projectiles' : 'VFX'}, consider using Timelines or Niagara systems instead of Tick for movement/interpolation.`,
            checklistLabel: `Reduce ${className} tick frequency to ${suggestedHz}Hz`,
            metric: 'tickFrequencyHz',
            metricValue: actor.tickFrequencyHz,
            metricThreshold: suggestedHz,
          });
        }
      }

      // Loot/interactables at 60Hz
      if (className.includes('WorldItem') || className.includes('LootContainer') || className.includes('Interactable')) {
        const suggestedHz = 5;
        const savings = actor.totalTickMs * (1 - suggestedHz / actor.tickFrequencyHz);
        if (savings > 0.02) {
          findings.push({
            id: `tick-freq-${className}`,
            priority: 'medium',
            category: 'tick',
            title: `${className} ticks at ${actor.tickFrequencyHz}Hz (should be ${suggestedHz}Hz)`,
            description: `${actor.instanceCount} ground items ticking at ${actor.tickFrequencyHz}Hz for ${actor.totalTickMs.toFixed(2)}ms. Ground loot only needs periodic proximity checks, not per-frame ticks.`,
            estimatedSavingsMs: round2(savings),
            involvedClasses: [className],
            fixPrompt: `Set ${className}::PrimaryActorTick.TickInterval to ${(1 / suggestedHz).toFixed(1)}f in the constructor. Replace per-frame distance checks with a Timer that checks player proximity every 0.2s. Better yet, disable tick entirely and use an overlap sphere.`,
            checklistLabel: `Disable per-frame tick on ${className}, use overlap sphere`,
            metric: 'tickFrequencyHz',
            metricValue: actor.tickFrequencyHz,
            metricThreshold: suggestedHz,
          });
        }
      }
    }
  }

  return findings;
}

// ── Frame Budget Analysis ───────────────────────────────────────────────────

function analyzeFrameBudget(summary: typeof dummySummary): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];
  const budget = summary.frameBudgetMs;

  if (summary.avgGameThreadMs > budget * 0.7) {
    findings.push({
      id: 'frame-budget-game-thread',
      priority: summary.avgGameThreadMs > budget ? 'critical' : 'high',
      category: 'game-thread',
      title: `Game thread averages ${summary.avgGameThreadMs.toFixed(1)}ms (budget: ${budget.toFixed(1)}ms)`,
      description: `Game thread consumes ${((summary.avgGameThreadMs / budget) * 100).toFixed(0)}% of frame budget. This is the primary bottleneck limiting FPS.`,
      estimatedSavingsMs: round2(summary.avgGameThreadMs - budget * 0.5),
      involvedClasses: [],
      fixPrompt: `Profile game thread hotspots using stat startfile / stat stopfile in UE5. Focus on reducing tick function costs: move expensive calculations to async tasks, use tick intervals > 0, and implement significance-based updates (tick less when off-screen or far from player).`,
      checklistLabel: 'Optimize game thread to under 50% frame budget',
      metric: 'avgGameThreadMs',
      metricValue: summary.avgGameThreadMs,
      metricThreshold: budget * 0.7,
    });
  }

  if (summary.avgRenderThreadMs > budget * 0.7) {
    findings.push({
      id: 'frame-budget-render-thread',
      priority: summary.avgRenderThreadMs > budget ? 'critical' : 'high',
      category: 'render-thread',
      title: `Render thread averages ${summary.avgRenderThreadMs.toFixed(1)}ms`,
      description: `Render thread at ${((summary.avgRenderThreadMs / budget) * 100).toFixed(0)}% of budget. Reduce draw calls, merge meshes, use LODs, and enable instanced rendering.`,
      estimatedSavingsMs: round2(summary.avgRenderThreadMs - budget * 0.5),
      involvedClasses: [],
      fixPrompt: `Reduce render thread cost: 1) Enable Instanced Static Mesh for repeated props, 2) Add LOD groups (4 levels: 0=full, 1=50%, 2=25%, 3=billboard at 100m), 3) Use HLOD for distant geometry, 4) Merge static meshes in world partition cells, 5) Reduce material complexity on distant objects.`,
      checklistLabel: 'Optimize render thread draw calls and LODs',
      metric: 'avgRenderThreadMs',
      metricValue: summary.avgRenderThreadMs,
      metricThreshold: budget * 0.7,
    });
  }

  if (summary.avgGpuMs > budget * 0.8) {
    findings.push({
      id: 'frame-budget-gpu',
      priority: summary.avgGpuMs > budget ? 'critical' : 'high',
      category: 'gpu',
      title: `GPU averages ${summary.avgGpuMs.toFixed(1)}ms (GPU-bound)`,
      description: `GPU is the bottleneck at ${summary.avgGpuMs.toFixed(1)}ms. Focus on shader complexity, overdraw, particle count, and resolution scaling.`,
      estimatedSavingsMs: round2(summary.avgGpuMs - budget * 0.6),
      involvedClasses: [],
      fixPrompt: `Reduce GPU cost: 1) Profile with GPU Visualizer (ctrl+shift+,), 2) Reduce Niagara particle counts by 50% with larger sprites, 3) Add r.ScreenPercentage auto-scaling, 4) Use simpler material shaders for distant objects (Quality Switch node), 5) Reduce shadow cascade count and resolution.`,
      checklistLabel: 'Optimize GPU: particles, shadows, shader complexity',
      metric: 'avgGpuMs',
      metricValue: summary.avgGpuMs,
      metricThreshold: budget * 0.8,
    });
  }

  // Low budget hit rate
  if (summary.budgetHitRate < 90) {
    findings.push({
      id: 'budget-hit-rate',
      priority: summary.budgetHitRate < 60 ? 'critical' : 'high',
      category: 'game-thread',
      title: `Only ${summary.budgetHitRate}% of frames hit ${Math.round(1000 / budget)}fps target`,
      description: `${(100 - summary.budgetHitRate).toFixed(1)}% of frames exceed the ${budget.toFixed(1)}ms budget, causing visible stutters and inconsistent framerate.`,
      estimatedSavingsMs: round2(summary.p99FrameMs - budget),
      involvedClasses: [],
      fixPrompt: `Address frame time spikes: 1) Move expensive operations off game thread (AsyncTask), 2) Spread work across multiple frames (time-slicing), 3) Use frame smoothing (t.MaxFPS with small buffer), 4) Profile worst-case frames with stat startfile during combat.`,
      checklistLabel: `Achieve ${Math.round(1000 / budget)}fps in ≥95% of frames`,
      metric: 'budgetHitRate',
      metricValue: summary.budgetHitRate,
      metricThreshold: 95,
    });
  }

  return findings;
}

// Dummy type reference for type inference
const dummySummary = null! as import('@/types/performance-profiling').ProfilingSummary;

// ── Draw Call Analysis ──────────────────────────────────────────────────────

function analyzeDrawCalls(summary: typeof dummySummary): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];

  if (summary.avgDrawCallsPerFrame > 2000) {
    findings.push({
      id: 'draw-calls-high',
      priority: summary.avgDrawCallsPerFrame > 3000 ? 'critical' : 'high',
      category: 'draw-calls',
      title: `${summary.avgDrawCallsPerFrame} draw calls/frame (target: <2000)`,
      description: `Average ${summary.avgDrawCallsPerFrame} draw calls with peak ${summary.peakDrawCalls}. Each draw call adds CPU overhead on the render thread.`,
      estimatedSavingsMs: round2((summary.avgDrawCallsPerFrame - 1500) * 0.005),
      involvedClasses: [],
      fixPrompt: `Reduce draw calls below 2000: 1) Merge static actors (Actor Merging tool in UE5), 2) Enable Hardware Instancing for repeated meshes, 3) Use Hierarchical LOD (HLOD) for distant clusters, 4) Reduce unique materials (atlas textures), 5) Use ISM/HISM components for foliage and props.`,
      checklistLabel: `Reduce draw calls from ${summary.avgDrawCallsPerFrame} to under 2000`,
      metric: 'avgDrawCallsPerFrame',
      metricValue: summary.avgDrawCallsPerFrame,
      metricThreshold: 2000,
    });
  }

  return findings;
}

// ── Memory Analysis ─────────────────────────────────────────────────────────

function analyzeMemory(
  allocations: import('@/types/performance-profiling').MemoryAllocation[],
  summary: typeof dummySummary,
): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];

  // High memory categories
  for (const alloc of allocations) {
    if (alloc.peakMB > 500) {
      findings.push({
        id: `memory-${alloc.category}`,
        priority: alloc.peakMB > 1000 ? 'high' : 'medium',
        category: 'memory',
        title: `${alloc.category} peaks at ${alloc.peakMB.toFixed(0)}MB`,
        description: `${alloc.category} uses ${alloc.currentMB.toFixed(0)}MB (peak ${alloc.peakMB.toFixed(0)}MB) with ${alloc.allocationCount} allocations. Consider texture streaming, compression, or LOD-based loading.`,
        estimatedSavingsMs: 0.1,
        involvedClasses: [],
        fixPrompt: `Reduce ${alloc.category} memory: 1) Use texture streaming with Virtual Textures, 2) Set max texture sizes per platform (2K for mid, 1K for low), 3) Use LOD-based asset loading (only load high-res when close), 4) Audit for duplicate/unused assets in Content Browser.`,
        checklistLabel: `Optimize ${alloc.category} memory (${alloc.peakMB.toFixed(0)}MB peak)`,
        metric: 'peakMemoryMB',
        metricValue: alloc.peakMB,
        metricThreshold: 500,
      });
    }

    // High allocation rate = GC pressure
    if (alloc.allocationRateMBps > 5) {
      findings.push({
        id: `alloc-rate-${alloc.category}`,
        priority: 'medium',
        category: 'gc',
        title: `${alloc.category} allocates ${alloc.allocationRateMBps.toFixed(1)}MB/s`,
        description: `High allocation rate in ${alloc.category} creates GC pressure. Use object pooling or pre-allocated buffers.`,
        estimatedSavingsMs: 0.5,
        involvedClasses: [],
        fixPrompt: `Reduce allocation rate in ${alloc.category}: 1) Pre-allocate arrays with Reserve(), 2) Use object pooling for frequently created/destroyed objects, 3) Reuse containers instead of creating new ones, 4) Use TInlineAllocator for small temporary arrays.`,
        checklistLabel: `Reduce ${alloc.category} allocation rate`,
        metric: 'allocationRateMBps',
        metricValue: alloc.allocationRateMBps,
        metricThreshold: 5,
      });
    }
  }

  return findings;
}

// ── GC Analysis ─────────────────────────────────────────────────────────────

function analyzeGC(
  gcPauses: import('@/types/performance-profiling').GCPauseEvent[],
  summary: typeof dummySummary,
): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];

  if (summary.maxGcPauseMs > 3) {
    findings.push({
      id: 'gc-pause-long',
      priority: summary.maxGcPauseMs > 8 ? 'critical' : summary.maxGcPauseMs > 5 ? 'high' : 'medium',
      category: 'gc',
      title: `GC pauses up to ${summary.maxGcPauseMs.toFixed(1)}ms (${summary.gcPauseCount} total)`,
      description: `Garbage collection causes ${summary.maxGcPauseMs.toFixed(1)}ms hitches. Total GC time: ${summary.totalGcTimeMs.toFixed(1)}ms across ${summary.gcPauseCount} collections. This causes visible frame drops during gameplay.`,
      estimatedSavingsMs: round2(summary.maxGcPauseMs - 2),
      involvedClasses: [],
      fixPrompt: `Reduce GC stutters: 1) Set gc.TimeBetweenPurgingPendingKillObjects higher (60s instead of default), 2) Use Incremental GC (gc.IncrementalBeDestructionEnabled=1), 3) Implement object pooling for projectiles/VFX/damage numbers, 4) Avoid creating UObjects in hot paths — use structs, 5) Pre-spawn and reuse instead of SpawnActor/DestroyActor patterns.`,
      checklistLabel: `Reduce GC pause from ${summary.maxGcPauseMs.toFixed(1)}ms to under 3ms`,
      metric: 'maxGcPauseMs',
      metricValue: summary.maxGcPauseMs,
      metricThreshold: 3,
    });
  }

  return findings;
}

// ── UI Tick Analysis ────────────────────────────────────────────────────────

function analyzeUITicks(actors: ActorTickProfile[]): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];

  const uiActors = actors.filter((a) =>
    a.className.includes('Widget') || a.className.includes('HUD') || a.className.includes('Tooltip'),
  );

  for (const actor of uiActors) {
    if (actor.avgTickMs > 0.1 && actor.tickFrequencyHz >= 30) {
      findings.push({
        id: `ui-tick-${actor.className}`,
        priority: actor.avgTickMs > 0.3 ? 'high' : 'medium',
        category: 'tick',
        title: `${actor.className} rebuilds every frame (${actor.avgTickMs.toFixed(2)}ms)`,
        description: `${actor.className} ticks at ${actor.tickFrequencyHz}Hz costing ${actor.avgTickMs.toFixed(2)}ms/tick. UI widgets should use event-driven updates instead of per-frame rebuilds.`,
        estimatedSavingsMs: round2(actor.totalTickMs * 0.9),
        involvedClasses: [actor.className],
        fixPrompt: `Switch ${actor.className} to event-driven updates: 1) Remove NativeTick/Tick override, 2) Bind to attribute change delegates (OnAttributeChanged for health/mana), 3) Use SetTimerByFunction for periodic updates (0.25s for non-critical stats), 4) Invalidate only changed widgets with InvalidateLayoutAndVolatility(). Cost should drop from ${actor.avgTickMs.toFixed(2)}ms to ~0ms.`,
        checklistLabel: `Convert ${actor.className} from tick-based to event-driven`,
        metric: 'avgTickMs',
        metricValue: actor.avgTickMs,
        metricThreshold: 0.1,
      });
    }
  }

  return findings;
}

// ── Object Pooling Candidates ───────────────────────────────────────────────

function analyzePoolingCandidates(actors: ActorTickProfile[]): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];

  const poolCandidates = actors.filter((a) =>
    a.instanceCount > 10 && (
      a.className.includes('Projectile') ||
      a.className.includes('VFX') ||
      a.className.includes('DamageNumber') ||
      a.className.includes('WorldItem')
    ),
  );

  for (const actor of poolCandidates) {
    findings.push({
      id: `pool-${actor.className}`,
      priority: actor.instanceCount > 30 ? 'high' : 'medium',
      category: 'tick',
      title: `Pool ${actor.className} (${actor.instanceCount} instances)`,
      description: `${actor.instanceCount} ${actor.className} instances are spawned/destroyed frequently. Object pooling eliminates Spawn/Destroy overhead and reduces GC pressure.`,
      estimatedSavingsMs: round2(actor.instanceCount * 0.02),
      involvedClasses: [actor.className],
      fixPrompt: `Implement object pool for ${actor.className}: Create a UARPGActorPool<${actor.className}> component that pre-spawns ${Math.min(actor.instanceCount * 2, 100)} instances, hides and disables tick on "return", shows and enables on "acquire". Use SetActorHiddenInGame, SetActorEnableCollision, SetActorTickEnabled. Pool manager auto-grows if exhausted. This eliminates SpawnActor overhead (~0.5ms each) and reduces GC from DestroyActor.`,
      checklistLabel: `Implement object pooling for ${actor.className}`,
      metric: 'instanceCount',
      metricValue: actor.instanceCount,
      metricThreshold: 10,
    });
  }

  return findings;
}

// ── Scoring & Identification ────────────────────────────────────────────────

function computeOverallScore(summary: typeof dummySummary): number {
  let score = 100;
  const budget = summary.frameBudgetMs;

  // FPS penalty
  if (summary.avgFrameMs > budget) score -= Math.min(30, (summary.avgFrameMs - budget) * 3);

  // Budget hit rate penalty
  if (summary.budgetHitRate < 95) score -= Math.min(20, (95 - summary.budgetHitRate) * 0.5);

  // GC penalty
  if (summary.maxGcPauseMs > 3) score -= Math.min(15, (summary.maxGcPauseMs - 3) * 2);

  // Draw call penalty
  if (summary.avgDrawCallsPerFrame > 2000) score -= Math.min(15, (summary.avgDrawCallsPerFrame - 2000) * 0.005);

  // Memory penalty
  if (summary.peakMemoryMB > 2000) score -= Math.min(10, (summary.peakMemoryMB - 2000) * 0.005);

  return Math.max(0, Math.round(score));
}

function identifyBottleneck(summary: typeof dummySummary): FrameBudgetCategory | 'balanced' {
  const threads = [
    { cat: 'game-thread' as const, ms: summary.avgGameThreadMs },
    { cat: 'render-thread' as const, ms: summary.avgRenderThreadMs },
    { cat: 'gpu' as const, ms: summary.avgGpuMs },
  ];
  threads.sort((a, b) => b.ms - a.ms);

  // If top is >30% more than second, it's the bottleneck
  if (threads[0].ms > threads[1].ms * 1.3) return threads[0].cat;
  return 'balanced';
}

// ── Utilities ───────────────────────────────────────────────────────────────

function deduplicateFindings(findings: PerformanceFinding[]): PerformanceFinding[] {
  const seen = new Map<string, PerformanceFinding>();
  for (const f of findings) {
    if (!seen.has(f.id) || f.estimatedSavingsMs > (seen.get(f.id)?.estimatedSavingsMs ?? 0)) {
      seen.set(f.id, f);
    }
  }
  return [...seen.values()];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
