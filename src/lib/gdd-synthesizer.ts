/**
 * GDD Synthesizer — Queries all POF data sources and produces a structured
 * Game Design Document with Mermaid diagrams.
 */

import { getDb } from './db';
import { ensureLevelDesignTable } from './level-design-db';
import { SUB_MODULE_MAP, CATEGORIES, getCategoryForSubModule } from './module-registry';
import { countChecklist, countAllChecklists } from './checklist-progress';
import type { FeatureStatus } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';
import { formatBytes, formatDuration } from '@/lib/format';

// ─── GDD Section Types ──────────────────────────────────────────────────────

export interface GDDSection {
  id: string;
  title: string;
  content: string;
  mermaid?: string;
  subsections?: GDDSection[];
  updatedAt: string;
}

export interface GDDDocument {
  title: string;
  generatedAt: string;
  sections: GDDSection[];
  stats: {
    totalFeatures: number;
    implementedFeatures: number;
    checklistTotal: number;
    checklistDone: number;
    levelCount: number;
    audioSceneCount: number;
    buildCount: number;
    evalFindingCount: number;
  };
}

// ─── Data Fetchers ──────────────────────────────────────────────────────────

interface FeatureSummaryRow {
  module_id: string;
  status: string;
  cnt: number;
}

interface FeatureDetailRow {
  module_id: string;
  feature_name: string;
  status: string;
  description: string;
  quality_score: number | null;
}

interface EvalFindingRow {
  module_id: string;
  pass: string;
  severity: string;
  category: string;
  description: string;
  cnt?: number;
}

interface LevelDocRow {
  name: string;
  description: string;
  rooms: string;
  connections: string;
  difficulty_arc: string;
  pacing_notes: string;
}

interface AudioSceneRow {
  name: string;
  description: string;
  zones: string;
  emitters: string;
}

interface BuildRow {
  platform: string;
  config: string;
  status: string;
  size_bytes: number | null;
  duration_ms: number | null;
  created_at: string;
}

interface SnapshotRow {
  module_id: string;
  reviewed_at: string;
  total: number;
  implemented: number;
  partial: number;
  avg_quality: number | null;
}

// ─── Synthesizer ────────────────────────────────────────────────────────────

export function synthesizeGDD(projectName: string, checklistProgress: Record<string, Record<string, boolean>>): GDDDocument {
  const db = getDb();
  // The synthesizer reads level_design_docs directly; ensure its owning module's table
  // exists so the GDD works on a fresh project DB (the table is otherwise only created
  // when a level-design API is first hit). Surfaced by the pof-mcp integration suite.
  ensureLevelDesignTable();
  const now = new Date().toISOString();

  // 1. Feature Matrix
  const featureSummary = db.prepare(
    "SELECT module_id, status, COUNT(*) as cnt FROM feature_matrix GROUP BY module_id, status"
  ).all() as FeatureSummaryRow[];

  const featureDetails = db.prepare(
    "SELECT module_id, feature_name, status, description, quality_score FROM feature_matrix ORDER BY module_id, feature_name"
  ).all() as FeatureDetailRow[];

  let totalFeatures = 0;
  let implementedFeatures = 0;
  for (const row of featureSummary) {
    totalFeatures += row.cnt;
    if (row.status === 'implemented') implementedFeatures += row.cnt;
  }

  // 2. Checklist progress — registry-based tally (single source of truth,
  //    shared with the compliance audit and the per-section counts below).
  const { done: checklistDone, total: checklistTotal } = countAllChecklists(checklistProgress);

  // 3. Level design docs
  const levelDocs = db.prepare(
    "SELECT name, description, rooms, connections, difficulty_arc, pacing_notes FROM level_design_docs ORDER BY name"
  ).all() as LevelDocRow[];

  // 4. Audio scenes
  let audioScenes: AudioSceneRow[] = [];
  try {
    audioScenes = db.prepare(
      "SELECT name, description, zones, emitters FROM audio_scenes ORDER BY name"
    ).all() as AudioSceneRow[];
  } catch { /* table may not exist */ }

  // 5. Eval findings
  const evalFindings = db.prepare(
    "SELECT module_id, pass, severity, category, description FROM eval_findings ORDER BY severity, module_id"
  ).all() as EvalFindingRow[];

  const evalBySeverity = db.prepare(
    "SELECT severity, COUNT(*) as cnt FROM eval_findings GROUP BY severity"
  ).all() as { severity: string; cnt: number }[];

  // 6. Build history
  const builds = db.prepare(
    "SELECT platform, config, status, size_bytes, duration_ms, created_at FROM build_history ORDER BY created_at DESC LIMIT 20"
  ).all() as BuildRow[];

  // 7. Review snapshots (latest per module)
  const snapshots = db.prepare(
    `SELECT module_id, reviewed_at, total, implemented, partial, avg_quality
     FROM review_snapshots
     WHERE id IN (SELECT MAX(id) FROM review_snapshots GROUP BY module_id)
     ORDER BY module_id`
  ).all() as SnapshotRow[];

  // ─── Build Sections ─────────────────────────────────────────────────────

  const sections: GDDSection[] = [];

  // Section 1: Project Overview
  sections.push(buildOverviewSection(projectName, totalFeatures, implementedFeatures, checklistTotal, checklistDone, now));

  // Section 2: Core Systems
  sections.push(buildCoreSystemsSection(featureDetails, checklistProgress, now));

  // Section 3: Development Roadmap
  sections.push(buildRoadmapSection(checklistProgress, snapshots, now));

  // Section 4: Level Design
  if (levelDocs.length > 0) {
    sections.push(buildLevelDesignSection(levelDocs, now));
  }

  // Section 5: Audio Design
  if (audioScenes.length > 0) {
    sections.push(buildAudioSection(audioScenes, now));
  }

  // Section 6: Technical Architecture
  if (evalFindings.length > 0) {
    sections.push(buildArchitectureSection(evalFindings, evalBySeverity, now));
  }

  // Section 7: Build & Deployment
  if (builds.length > 0) {
    sections.push(buildDeploymentSection(builds, now));
  }

  return {
    title: `${projectName} — Game Design Document`,
    generatedAt: now,
    sections,
    stats: {
      totalFeatures,
      implementedFeatures,
      checklistTotal,
      checklistDone,
      levelCount: levelDocs.length,
      audioSceneCount: audioScenes.length,
      buildCount: builds.length,
      evalFindingCount: evalFindings.length,
    },
  };
}

// ─── Section Builders ───────────────────────────────────────────────────────

function buildOverviewSection(
  projectName: string,
  totalFeatures: number,
  implemented: number,
  checklistTotal: number,
  checklistDone: number,
  now: string,
): GDDSection {
  const featurePct = totalFeatures > 0 ? Math.round((implemented / totalFeatures) * 100) : 0;
  const checklistPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const content = [
    `# ${projectName}`,
    '',
    `**Genre:** Action RPG (aRPG)  `,
    `**Engine:** Unreal Engine 5 (C++)  `,
    `**Last Updated:** ${new Date(now).toLocaleDateString()}`,
    '',
    '## Project Status',
    '',
    `| Metric | Progress |`,
    `|--------|----------|`,
    `| Feature Implementation | ${implemented}/${totalFeatures} (${featurePct}%) |`,
    `| Development Checklist | ${checklistDone}/${checklistTotal} (${checklistPct}%) |`,
  ].join('\n');

  // Pie chart for feature status
  const mermaid = totalFeatures > 0 ? [
    'pie title Feature Implementation Status',
    `    "Implemented" : ${implemented}`,
    `    "Remaining" : ${totalFeatures - implemented}`,
  ].join('\n') : undefined;

  return { id: 'overview', title: 'Project Overview', content, mermaid, updatedAt: now };
}

function buildCoreSystemsSection(
  features: FeatureDetailRow[],
  checklistProgress: Record<string, Record<string, boolean>>,
  now: string,
): GDDSection {
  const subsections: GDDSection[] = [];

  // Group features by module
  const byModule = new Map<string, FeatureDetailRow[]>();
  for (const f of features) {
    const list = byModule.get(f.module_id) ?? [];
    list.push(f);
    byModule.set(f.module_id, list);
  }

  // Build per-category subsections
  for (const cat of Object.values(CATEGORIES)) {
    if (cat.id === 'evaluator' || cat.id === 'project-setup' || cat.id === 'game-director') continue;

    const moduleIds = cat.subModules;
    const catFeatures: string[] = [];

    for (const modId of moduleIds) {
      const mod = SUB_MODULE_MAP[modId];
      if (!mod) continue;

      const modFeatures = byModule.get(modId) ?? [];
      const { done, total } = countChecklist(mod, checklistProgress[modId]);

      catFeatures.push(`### ${mod.label}`);
      catFeatures.push(`*${mod.description}*`);
      if (total > 0) {
        catFeatures.push(`\nChecklist: ${done}/${total} complete`);
      }

      if (modFeatures.length > 0) {
        catFeatures.push('');
        catFeatures.push('| Feature | Status | Quality |');
        catFeatures.push('|---------|--------|---------|');
        for (const f of modFeatures) {
          const statusIcon = statusEmoji(f.status as FeatureStatus);
          const quality = f.quality_score != null ? meter(f.quality_score, 5, '★', '☆') : '—';
          catFeatures.push(`| ${f.feature_name} | ${statusIcon} ${f.status} | ${quality} |`);
        }
      }
      catFeatures.push('');
    }

    if (catFeatures.length > 0) {
      subsections.push({
        id: `systems-${cat.id}`,
        title: cat.label,
        content: catFeatures.join('\n'),
        updatedAt: now,
      });
    }
  }

  // System architecture diagram
  const mermaid = buildSystemArchitectureDiagram();

  return {
    id: 'core-systems',
    title: 'Core Systems',
    content: 'Overview of all game systems, their implementation status, and feature coverage.',
    mermaid,
    subsections,
    updatedAt: now,
  };
}

function buildRoadmapSection(
  checklistProgress: Record<string, Record<string, boolean>>,
  snapshots: SnapshotRow[],
  now: string,
): GDDSection {
  const lines: string[] = [];

  // Per-module progress
  lines.push('| Module | Progress | Status |');
  lines.push('|--------|----------|--------|');

  for (const mod of Object.values(SUB_MODULE_MAP)) {
    const { done, total } = countChecklist(mod, checklistProgress[mod.id]);
    if (total === 0) continue;
    const pct = Math.round((done / total) * 100);
    const bar = progressBar(pct);
    const status = pct === 100 ? 'Complete' : pct > 50 ? 'In Progress' : pct > 0 ? 'Started' : 'Not Started';
    lines.push(`| ${mod.label} | ${bar} ${pct}% | ${status} |`);
  }

  // Trend from snapshots
  let mermaid: string | undefined;
  if (snapshots.length > 0) {
    const mermaidLines = ['xychart-beta', '    title "Feature Implementation Trend"', '    x-axis ['];
    const implData: number[] = [];
    for (const s of snapshots) {
      const mod = SUB_MODULE_MAP[s.module_id as SubModuleId];
      const label = mod?.label ?? s.module_id;
      mermaidLines.push(`        "${label.slice(0, 12)}",`);
      implData.push(s.total > 0 ? Math.round((s.implemented / s.total) * 100) : 0);
    }
    mermaidLines.push('    ]');
    mermaidLines.push(`    y-axis "Implementation %" 0 --> 100`);
    mermaidLines.push(`    bar [${implData.join(', ')}]`);
    mermaid = mermaidLines.join('\n');
  }

  return {
    id: 'roadmap',
    title: 'Development Roadmap',
    content: lines.join('\n'),
    mermaid,
    updatedAt: now,
  };
}

function buildLevelDesignSection(docs: LevelDocRow[], now: string): GDDSection {
  const subsections: GDDSection[] = [];

  for (const doc of docs) {
    const rooms = JSON.parse(doc.rooms || '[]') as { id: string; name: string; type: string; difficulty: number; pacing: string }[];
    const connections = JSON.parse(doc.connections || '[]') as { from: string; to: string; type?: string }[];

    const lines: string[] = [];
    if (doc.description) lines.push(doc.description, '');

    if (rooms.length > 0) {
      lines.push('| Room | Type | Difficulty | Pacing |');
      lines.push('|------|------|------------|--------|');
      for (const r of rooms) {
        lines.push(`| ${r.name} | ${r.type} | ${meter(r.difficulty, 5, '●', '○')} | ${r.pacing} |`);
      }
    }

    if (doc.pacing_notes) {
      lines.push('', '**Pacing Notes:** ' + doc.pacing_notes);
    }

    // Mermaid flowchart for room connections
    let mermaid: string | undefined;
    if (rooms.length > 0 && connections.length > 0) {
      const mLines = ['graph LR'];
      for (const r of rooms) {
        const shape = r.type === 'boss' ? `{{${r.name}}}` : r.type === 'safe' ? `(${r.name})` : `[${r.name}]`;
        mLines.push(`    ${r.id}${shape}`);
      }
      for (const c of connections) {
        const label = c.type ? `-- ${c.type} -->` : '-->';
        mLines.push(`    ${c.from} ${label} ${c.to}`);
      }
      mermaid = mLines.join('\n');
    }

    subsections.push({
      id: `level-${doc.name.toLowerCase().replace(/\s+/g, '-')}`,
      title: doc.name,
      content: lines.join('\n'),
      mermaid,
      updatedAt: now,
    });
  }

  return {
    id: 'level-design',
    title: 'Level Design & World Flow',
    content: `${docs.length} level design document${docs.length !== 1 ? 's' : ''} define the game world.`,
    subsections,
    updatedAt: now,
  };
}

function buildAudioSection(scenes: AudioSceneRow[], now: string): GDDSection {
  const lines: string[] = [];

  let totalZones = 0;
  let totalEmitters = 0;
  const emitterTypes: Record<string, number> = {};

  for (const scene of scenes) {
    const zones = JSON.parse(scene.zones || '[]') as { name: string; reverbPreset: string }[];
    const emitters = JSON.parse(scene.emitters || '[]') as { name: string; type: string }[];
    totalZones += zones.length;
    totalEmitters += emitters.length;
    for (const e of emitters) {
      emitterTypes[e.type] = (emitterTypes[e.type] ?? 0) + 1;
    }

    lines.push(`### ${scene.name}`);
    if (scene.description) lines.push(scene.description);
    lines.push(`- **Zones:** ${zones.length} | **Emitters:** ${emitters.length}`);
    lines.push('');
  }

  const mermaid = Object.keys(emitterTypes).length > 0
    ? ['pie title Sound Emitter Types', ...Object.entries(emitterTypes).map(([type, count]) => `    "${type}" : ${count}`)].join('\n')
    : undefined;

  return {
    id: 'audio-design',
    title: 'Audio & Soundscape Design',
    content: [
      `**${scenes.length}** audio scenes with **${totalZones}** zones and **${totalEmitters}** emitters.`,
      '',
      ...lines,
    ].join('\n'),
    mermaid,
    updatedAt: now,
  };
}

function buildArchitectureSection(
  findings: EvalFindingRow[],
  bySeverity: { severity: string; cnt: number }[],
  now: string,
): GDDSection {
  const lines: string[] = [];

  // Summary table
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const s of bySeverity) {
    lines.push(`| ${severityIcon(s.severity)} ${s.severity} | ${s.cnt} |`);
  }
  lines.push('');

  // Group by module
  const byModule = new Map<string, EvalFindingRow[]>();
  for (const f of findings) {
    const list = byModule.get(f.module_id) ?? [];
    list.push(f);
    byModule.set(f.module_id, list);
  }

  const subsections: GDDSection[] = [];
  for (const [moduleId, modFindings] of byModule) {
    const mod = SUB_MODULE_MAP[moduleId as SubModuleId];
    const label = mod?.label ?? moduleId;
    const critical = modFindings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    const fLines = critical.slice(0, 5).map((f) => `- **[${f.severity}]** ${f.description.slice(0, 120)}`);
    if (critical.length > 5) fLines.push(`- ...and ${critical.length - 5} more`);
    subsections.push({
      id: `arch-${moduleId}`,
      title: `${label} (${modFindings.length} findings)`,
      content: fLines.join('\n') || 'No critical/high findings.',
      updatedAt: now,
    });
  }

  return {
    id: 'architecture',
    title: 'Technical Architecture & Code Quality',
    content: lines.join('\n'),
    subsections,
    updatedAt: now,
  };
}

function buildDeploymentSection(builds: BuildRow[], now: string): GDDSection {
  const lines: string[] = [];

  // Platform summary
  const platforms = new Map<string, { successes: number; failures: number; lastSize: number | null; avgDuration: number }>();
  for (const b of builds) {
    const p = platforms.get(b.platform) ?? { successes: 0, failures: 0, lastSize: null, avgDuration: 0 };
    if (b.status === 'success') p.successes++;
    else p.failures++;
    if (p.lastSize === null && b.size_bytes) p.lastSize = b.size_bytes;
    if (b.duration_ms) p.avgDuration = (p.avgDuration + b.duration_ms) / 2;
    platforms.set(b.platform, p);
  }

  lines.push('| Platform | Builds | Success Rate | Last Size | Avg Duration |');
  lines.push('|----------|--------|-------------|-----------|-------------|');
  for (const [platform, data] of platforms) {
    const total = data.successes + data.failures;
    const rate = total > 0 ? Math.round((data.successes / total) * 100) : 0;
    const size = data.lastSize ? formatBytes(data.lastSize) : '—';
    const duration = data.avgDuration > 0 ? formatDuration(data.avgDuration) : '—';
    lines.push(`| ${platform} | ${total} | ${rate}% | ${size} | ${duration} |`);
  }

  return {
    id: 'deployment',
    title: 'Build & Deployment',
    content: lines.join('\n'),
    updatedAt: now,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSystemArchitectureDiagram(): string {
  const lines = ['graph TD'];
  // Build a dependency graph from core engine modules
  const coreModules = ['arpg-character', 'arpg-animation', 'arpg-gas', 'arpg-combat', 'arpg-enemy-ai',
    'arpg-inventory', 'arpg-loot', 'arpg-ui', 'arpg-progression', 'arpg-world', 'arpg-save', 'arpg-polish'];

  for (const id of coreModules) {
    const mod = SUB_MODULE_MAP[id as SubModuleId];
    if (mod) lines.push(`    ${id.replace(/-/g, '_')}["${mod.label}"]`);
  }

  // Logical dependency edges
  const deps: [string, string][] = [
    ['arpg-character', 'arpg-animation'],
    ['arpg-character', 'arpg-gas'],
    ['arpg-gas', 'arpg-combat'],
    ['arpg-combat', 'arpg-enemy-ai'],
    ['arpg-inventory', 'arpg-loot'],
    ['arpg-loot', 'arpg-progression'],
    ['arpg-ui', 'arpg-inventory'],
    ['arpg-world', 'arpg-enemy-ai'],
    ['arpg-save', 'arpg-inventory'],
    ['arpg-save', 'arpg-progression'],
    ['arpg-polish', 'arpg-ui'],
  ];

  for (const [from, to] of deps) {
    lines.push(`    ${from.replace(/-/g, '_')} --> ${to.replace(/-/g, '_')}`);
  }

  return lines.join('\n');
}

function statusEmoji(status: FeatureStatus): string {
  switch (status) {
    case 'implemented': return '✅';
    case 'partial': return '🟡';
    case 'missing': return '❌';
    default: return '❓';
  }
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

/**
 * Render a clamped fill meter (★★★☆☆ / ●●○○○ / ███░░). Values come from
 * stored data with no schema bound — String.repeat throws RangeError on a
 * negative or NaN count, and one bad row would crash the entire GDD
 * synthesis (and every export action with it). Every meter-style .repeat
 * in this file must go through this clamp.
 */
function meter(value: unknown, max: number, fullChar: string, emptyChar: string): string {
  const v = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
  return fullChar.repeat(v) + emptyChar.repeat(max - v);
}

function progressBar(pct: number): string {
  return meter(pct / 10, 10, '█', '░');
}

// ─── Markdown Export ────────────────────────────────────────────────────────

export function exportGDDAsMarkdown(gdd: GDDDocument): string {
  const lines: string[] = [];
  lines.push(`# ${gdd.title}`);
  lines.push(`> Auto-generated by POF on ${new Date(gdd.generatedAt).toLocaleString()}`);
  lines.push('');

  for (const section of gdd.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(section.content);
    if (section.mermaid) {
      lines.push('');
      lines.push('```mermaid');
      lines.push(section.mermaid);
      lines.push('```');
    }
    lines.push('');

    if (section.subsections) {
      for (const sub of section.subsections) {
        lines.push(`### ${sub.title}`);
        lines.push('');
        lines.push(sub.content);
        if (sub.mermaid) {
          lines.push('');
          lines.push('```mermaid');
          lines.push(sub.mermaid);
          lines.push('```');
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
