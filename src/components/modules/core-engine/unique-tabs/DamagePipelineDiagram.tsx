'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, STAGGER_DEFAULT } from './_shared';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';

// ── Element colors (matching requirement spec) ───────────────────────────────

const ELEMENT_COLORS = {
  Physical: '#ef4444',   // red
  Fire:     '#f97316',   // orange
  Ice:      '#06b6d4',   // cyan
  Lightning:'#eab308',   // yellow
  Heal:     '#22c55e',   // green
} as const;

type ElementType = keyof typeof ELEMENT_COLORS;

// ── Pipeline node types ──────────────────────────────────────────────────────

type NodeKind = 'entry' | 'action' | 'branch' | 'broadcast' | 'event' | 'terminal';

interface PipelineNode {
  id: string;
  label: string;
  detail: string;
  kind: NodeKind;
  cppRef?: string;
  element?: ElementType;
}

// ── Three entry pipelines from PostGameplayEffectExecute ─────────────────────

const DAMAGE_PIPELINE: PipelineNode[] = [
  { id: 'entry-dmg', label: 'IncomingDamage', detail: 'Meta attribute set by damage execution calculation', kind: 'entry', cppRef: 'Data.EvaluatedData.Attribute == GetIncomingDamageAttribute()' },
  { id: 'consume-meta', label: 'Consume Meta', detail: 'SetIncomingDamage(0) + SetIncomingCrit(0)', kind: 'action', cppRef: 'SetIncomingDamage(0.f); SetIncomingCrit(0.f);' },
  { id: 'check-crit', label: 'IncomingCrit > 0.5?', detail: 'Check if this hit was a critical strike', kind: 'branch', cppRef: 'const bool bIsCrit = GetIncomingCrit() > 0.5f;' },
  { id: 'sub-health', label: 'Health -= Damage', detail: 'Clamp(OldHealth - DamageAmount, 0, MaxHealth)', kind: 'action', cppRef: 'SetHealth(FMath::Clamp(OldHealth - DamageAmount, 0.f, GetMaxHealth()));' },
  { id: 'detect-type', label: 'Detect DamageType', detail: 'Read dynamic asset tags from EffectSpec', kind: 'branch', cppRef: 'const FGameplayTagContainer& AssetTags = Data.EffectSpec.GetDynamicAssetTags();' },
  { id: 'broadcast-dmg', label: 'Broadcast Damage Number', detail: 'Per-instance + global static delegate', kind: 'broadcast', cppRef: 'OnDamageNumberRequested.Broadcast(...); OnDamageNumberRequestedGlobal.Broadcast(...);' },
  { id: 'check-dead', label: 'Health <= 0?', detail: 'Branch: death vs hit react', kind: 'branch', cppRef: 'if (GetHealth() <= 0.f)' },
  { id: 'check-already-dead', label: 'Already State_Dead?', detail: 'Prevent duplicate death events', kind: 'branch', cppRef: 'const bool bAlreadyDead = OwnerASC->HasMatchingGameplayTag(ARPGGameplayTags::State_Dead);' },
  { id: 'health-depleted', label: 'OnHealthDepleted', detail: 'Broadcast delegate with Instigator', kind: 'event', cppRef: 'OnHealthDepleted.Broadcast(Instigator);' },
  { id: 'event-death', label: 'Event_Death', detail: 'HandleGameplayEvent with death payload', kind: 'terminal', cppRef: 'OwnerASC->HandleGameplayEvent(ARPGGameplayTags::Event_Death, &DeathPayload);' },
  { id: 'event-hitreact', label: 'Event_HitReact', detail: 'HandleGameplayEvent with hit react payload', kind: 'terminal', cppRef: 'OwnerASC->HandleGameplayEvent(ARPGGameplayTags::Event_HitReact, &HitReactPayload);' },
];

const HEAL_PIPELINE: PipelineNode[] = [
  { id: 'entry-heal', label: 'IncomingHeal', detail: 'Meta attribute for healing effects', kind: 'entry', element: 'Heal', cppRef: 'Data.EvaluatedData.Attribute == GetIncomingHealAttribute()' },
  { id: 'consume-heal', label: 'Consume Meta', detail: 'SetIncomingHeal(0)', kind: 'action', cppRef: 'SetIncomingHeal(0.f);' },
  { id: 'add-health', label: 'Health += Heal', detail: 'Clamp(OldHealth + HealAmount, 0, MaxHealth)', kind: 'action', element: 'Heal', cppRef: 'SetHealth(FMath::Clamp(OldHealth + HealAmount, 0.f, GetMaxHealth()));' },
  { id: 'broadcast-heal', label: 'Broadcast Heal Number', detail: 'bIsHeal=true, per-instance + global', kind: 'broadcast', element: 'Heal', cppRef: 'OnDamageNumberRequested.Broadcast(TargetActor, ActualHeal, false, true, FGameplayTag(), Location);' },
];

const DIRECT_PIPELINE: PipelineNode[] = [
  { id: 'entry-direct', label: 'Direct Health Mod', detail: 'Non-execution GE modifies Health directly', kind: 'entry', cppRef: 'Data.EvaluatedData.Attribute == GetHealthAttribute()' },
  { id: 'clamp-direct', label: 'Clamp Health', detail: 'Clamp(Health, 0, MaxHealth)', kind: 'action', cppRef: 'SetHealth(FMath::Clamp(GetHealth(), 0.f, GetMaxHealth()));' },
  { id: 'check-sign', label: 'Magnitude > 0?', detail: 'Positive = heal, Negative = damage', kind: 'branch', cppRef: 'if (Data.EvaluatedData.Magnitude > 0.f)' },
  { id: 'direct-heal-broadcast', label: 'Broadcast Heal', detail: 'bIsHeal=true, Damage.Physical fallback', kind: 'broadcast', element: 'Heal', cppRef: 'OnDamageNumberRequested.Broadcast(TargetActor, Magnitude, false, true, ...);' },
  { id: 'direct-dmg-broadcast', label: 'Broadcast Physical Damage', detail: 'Damage.Physical tag, |Magnitude|', kind: 'broadcast', element: 'Physical', cppRef: 'OnDamageNumberRequested.Broadcast(TargetActor, Abs(Magnitude), false, false, Damage_Physical, ...);' },
  { id: 'direct-check-dead', label: 'Health <= 0?', detail: 'Same death/hitreact logic as damage path', kind: 'branch', cppRef: 'if (GetHealth() <= 0.f)' },
];

// ── Element type tag detection order ─────────────────────────────────────────

const ELEMENT_TAGS: { tag: string; element: ElementType }[] = [
  { tag: 'Damage.Fire', element: 'Fire' },
  { tag: 'Damage.Ice', element: 'Ice' },
  { tag: 'Damage.Lightning', element: 'Lightning' },
  { tag: 'Damage.Physical', element: 'Physical' },
];

// ── Node kind styling ────────────────────────────────────────────────────────

const KIND_STYLE: Record<NodeKind, { bg: string; border: string; text: string }> = {
  entry:     { bg: '#3b82f615', border: '#3b82f6', text: '#60a5fa' },
  action:    { bg: '#8b5cf615', border: '#8b5cf6', text: '#a78bfa' },
  branch:    { bg: '#f59e0b15', border: '#f59e0b', text: '#fbbf24' },
  broadcast: { bg: '#06b6d415', border: '#06b6d4', text: '#22d3ee' },
  event:     { bg: '#10b98115', border: '#10b981', text: '#34d399' },
  terminal:  { bg: '#ef444415', border: '#ef4444', text: '#f87171' },
};

// ── SVG Flow Diagram ─────────────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 40;
const GAP_Y = 12;
const BRANCH_OFFSET_X = 130;

interface FlowNodeProps {
  node: PipelineNode;
  x: number;
  y: number;
  delay: number;
  expanded: boolean;
  onToggle: () => void;
}

// Helper: detect node behavior from label/id
function isConsumeNode(node: PipelineNode): boolean {
  return node.label.toLowerCase().includes('consume');
}
function isClampNode(node: PipelineNode): boolean {
  return node.label.toLowerCase().includes('clamp') ||
    (node.kind === 'action' && node.detail.toLowerCase().includes('clamp'));
}

function FlowNode({ node, x, y, delay, expanded, onToggle }: FlowNodeProps) {
  const style = KIND_STYLE[node.kind];
  const elemColor = node.element ? ELEMENT_COLORS[node.element] : undefined;
  const borderColor = elemColor ?? style.border;
  const textColor = elemColor ?? style.text;

  const consume = isConsumeNode(node);
  const clamp = isClampNode(node);

  return (
    <motion.g
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      {/* Clamp node: bounding box glow pulses */}
      {clamp && (
        <>
          {/* Outer glow rect that pulses */}
          <rect
            x={x - NODE_W / 2 - 3} y={y - 3}
            width={NODE_W + 6} height={NODE_H + 6}
            rx={8}
            fill="none"
            stroke={STATUS_WARNING}
            strokeWidth={2}
            strokeDasharray="8 4"
            opacity={0.5}
          >
            <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
          </rect>
          {/* Corner clamp brackets - top-left */}
          <path d={`M ${x - NODE_W / 2 - 1} ${y + 8} L ${x - NODE_W / 2 - 1} ${y - 1} L ${x - NODE_W / 2 + 10} ${y - 1}`}
            fill="none" stroke={STATUS_WARNING} strokeWidth={2} opacity={0.7} />
          {/* Corner clamp brackets - top-right */}
          <path d={`M ${x + NODE_W / 2 - 10} ${y - 1} L ${x + NODE_W / 2 + 1} ${y - 1} L ${x + NODE_W / 2 + 1} ${y + 8}`}
            fill="none" stroke={STATUS_WARNING} strokeWidth={2} opacity={0.7} />
          {/* Corner clamp brackets - bottom-left */}
          <path d={`M ${x - NODE_W / 2 - 1} ${y + NODE_H - 8} L ${x - NODE_W / 2 - 1} ${y + NODE_H + 1} L ${x - NODE_W / 2 + 10} ${y + NODE_H + 1}`}
            fill="none" stroke={STATUS_WARNING} strokeWidth={2} opacity={0.7} />
          {/* Corner clamp brackets - bottom-right */}
          <path d={`M ${x + NODE_W / 2 - 10} ${y + NODE_H + 1} L ${x + NODE_W / 2 + 1} ${y + NODE_H + 1} L ${x + NODE_W / 2 + 1} ${y + NODE_H - 8}`}
            fill="none" stroke={STATUS_WARNING} strokeWidth={2} opacity={0.7} />
          {/* Clamp limit labels */}
          <text x={x - NODE_W / 2 - 6} y={y + NODE_H / 2 + 3} textAnchor="end"
            className="text-[7px] font-mono font-bold" fill={STATUS_WARNING} opacity={0.8}>
            0
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
          </text>
          <text x={x + NODE_W / 2 + 6} y={y + NODE_H / 2 + 3} textAnchor="start"
            className="text-[7px] font-mono font-bold" fill={STATUS_WARNING} opacity={0.8}>
            MAX
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" begin="1s" repeatCount="indefinite" />
          </text>
        </>
      )}

      {/* Consume meta: drain animation */}
      {consume && (
        <>
          {/* Draining bar that shrinks repeatedly */}
          <rect
            x={x - NODE_W / 2 + 4} y={y + NODE_H - 5}
            width={NODE_W - 8} height={3}
            rx={1.5}
            fill={borderColor}
            opacity={0.15}
          />
          <rect
            x={x - NODE_W / 2 + 4} y={y + NODE_H - 5}
            height={3}
            rx={1.5}
            fill={borderColor}
          >
            <animate attributeName="width" values={`${NODE_W - 8};0`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0.1" dur="2s" repeatCount="indefinite" />
          </rect>
          {/* Drain particles rising from the bar */}
          {[0, 1, 2, 3, 4].map(i => {
            const px = x - NODE_W / 2 + 20 + i * ((NODE_W - 40) / 4);
            return (
              <circle key={`drain-${i}`} cx={px} r={1.5} fill={borderColor}>
                <animate attributeName="cy" values={`${y + NODE_H - 4};${y - 6}`} dur="1.8s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0" dur="1.8s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
              </circle>
            );
          })}
          {/* "→ 0" label */}
          <text x={x + NODE_W / 2 + 6} y={y + NODE_H - 1} textAnchor="start"
            className="text-[7px] font-mono font-bold" fill={STATUS_ERROR}>
            → 0
            <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" />
          </text>
        </>
      )}

      {/* Node box */}
      <rect
        x={x - NODE_W / 2} y={y}
        width={NODE_W} height={NODE_H}
        rx={node.kind === 'branch' ? 2 : 6}
        fill={elemColor ? `${elemColor}15` : style.bg}
        stroke={borderColor}
        strokeWidth={clamp ? 2 : 1.5}
        strokeDasharray={node.kind === 'branch' ? '6 3' : undefined}
        className="cursor-pointer"
        onClick={onToggle}
        data-testid={`pipeline-node-${node.id}`}
      />

      {/* Kind badge */}
      <rect
        x={x + NODE_W / 2 - 52} y={y + 2}
        width={50} height={14} rx={3}
        fill={borderColor} fillOpacity={0.2}
      />
      <text
        x={x + NODE_W / 2 - 27} y={y + 12}
        textAnchor="middle"
        className="text-[7px] font-mono font-bold uppercase"
        fill={borderColor}
      >
        {node.kind}
      </text>

      {/* Label */}
      <text
        x={x} y={y + 24}
        textAnchor="middle"
        className="text-[11px] font-mono font-bold cursor-pointer"
        fill={textColor}
        onClick={onToggle}
      >
        {node.label}
      </text>

      {/* Detail subtitle */}
      <text
        x={x} y={y + 36}
        textAnchor="middle"
        className="text-[8px] font-mono fill-[var(--text-muted)]"
      >
        {node.detail.length > 44 ? node.detail.slice(0, 42) + '...' : node.detail}
      </text>

      {/* Expand indicator */}
      {node.cppRef && (
        <text
          x={x - NODE_W / 2 + 8} y={y + 13}
          className="text-[10px] fill-[var(--text-muted)] cursor-pointer"
          onClick={onToggle}
        >
          {expanded ? '▾' : '▸'}
        </text>
      )}
    </motion.g>
  );
}

function FlowArrow({ x1, y1, x2, y2, color, label, delay, dashed }: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; label?: string; delay: number; dashed?: boolean;
}) {
  // Draw an L-shaped or straight arrow
  const isStraight = x1 === x2;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.7 }}
      transition={{ delay, duration: 0.2 }}
    >
      {isStraight ? (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color} strokeWidth={1.5}
            strokeDasharray={dashed ? '4 3' : undefined}
          />
          <polygon
            points={`${x2 - 4},${y2 - 6} ${x2},${y2} ${x2 + 4},${y2 - 6}`}
            fill={color}
          />
        </>
      ) : (
        <>
          {/* L-shaped: go down from y1 to midpoint, then horizontal to x2, then down to y2 */}
          <path
            d={`M ${x1} ${y1} L ${x1} ${(y1 + y2) / 2} L ${x2} ${(y1 + y2) / 2} L ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth={1.5}
            strokeDasharray={dashed ? '4 3' : undefined}
          />
          <polygon
            points={`${x2 - 4},${y2 - 6} ${x2},${y2} ${x2 + 4},${y2 - 6}`}
            fill={color}
          />
        </>
      )}
      {label && (
        <text
          x={(x1 + x2) / 2 + (x1 === x2 ? 8 : 0)}
          y={(y1 + y2) / 2 - 3}
          className="text-[8px] font-mono font-bold"
          fill={color}
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </motion.g>
  );
}

// ── Main Damage Pipeline Diagram ─────────────────────────────────────────────

function DamagePipelineFlow() {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpandedNode((prev) => (prev === id ? null : id));
  }, []);

  // Layout constants
  const centerX = 260;
  const rightX = centerX + BRANCH_OFFSET_X;
  let row = 0;
  const rowY = (r: number) => 10 + r * (NODE_H + GAP_Y);

  // Row assignments for the damage pipeline
  const rows = {
    entry: row++,        // 0: IncomingDamage
    consume: row++,      // 1: Consume Meta
    crit: row++,         // 2: Check Crit
    subHealth: row++,    // 3: Health -= Damage
    detectType: row++,   // 4: Detect DamageType
    broadcast: row++,    // 5: Broadcast Damage Number
    checkDead: row++,    // 6: Health <= 0?
    alreadyDead: row++,  // 7: Already State_Dead?
    depleted: row++,     // 8: OnHealthDepleted
    death: row++,        // 9: Event_Death
  };
  const hitReactRow = rows.alreadyDead; // Event_HitReact on right branch at same level as alreadyDead

  const totalH = rowY(row) + 20;

  return (
    <div className="relative">
      <svg
        width="100%"
        height={totalH}
        viewBox={`0 0 ${centerX * 2 + 20} ${totalH}`}
        className="overflow-visible"
        data-testid="damage-pipeline-svg"
      >
        {/* ── Nodes ── */}
        {DAMAGE_PIPELINE.map((node, i) => {
          let nx = centerX;
          let ny: number;

          switch (node.id) {
            case 'entry-dmg':        ny = rowY(rows.entry); break;
            case 'consume-meta':     ny = rowY(rows.consume); break;
            case 'check-crit':       ny = rowY(rows.crit); break;
            case 'sub-health':       ny = rowY(rows.subHealth); break;
            case 'detect-type':      ny = rowY(rows.detectType); break;
            case 'broadcast-dmg':    ny = rowY(rows.broadcast); break;
            case 'check-dead':       ny = rowY(rows.checkDead); break;
            case 'check-already-dead': ny = rowY(rows.alreadyDead); break;
            case 'health-depleted':  ny = rowY(rows.depleted); break;
            case 'event-death':      ny = rowY(rows.death); break;
            case 'event-hitreact':   nx = rightX; ny = rowY(hitReactRow); break;
            default: return null;
          }

          return (
            <FlowNode
              key={node.id}
              node={node}
              x={nx}
              y={ny}
              delay={i * STAGGER_DEFAULT}
              expanded={expandedNode === node.id}
              onToggle={() => toggle(node.id)}
            />
          );
        })}

        {/* ── Arrows (main vertical flow) ── */}
        {[
          [rows.entry, rows.consume],
          [rows.consume, rows.crit],
          [rows.crit, rows.subHealth],
          [rows.subHealth, rows.detectType],
          [rows.detectType, rows.broadcast],
          [rows.broadcast, rows.checkDead],
        ].map(([from, to], i) => (
          <FlowArrow
            key={`arrow-${from}-${to}`}
            x1={centerX} y1={rowY(from) + NODE_H}
            x2={centerX} y2={rowY(to)}
            color="rgba(255,255,255,0.25)"
            delay={i * STAGGER_DEFAULT + 0.1}
          />
        ))}

        {/* checkDead → alreadyDead (YES branch, left/center) */}
        <FlowArrow
          x1={centerX} y1={rowY(rows.checkDead) + NODE_H}
          x2={centerX} y2={rowY(rows.alreadyDead)}
          color={STATUS_ERROR}
          label="YES"
          delay={0.5}
        />

        {/* checkDead → hitReact (NO branch, right) */}
        <FlowArrow
          x1={centerX + NODE_W / 2} y1={rowY(rows.checkDead) + NODE_H / 2}
          x2={rightX} y2={rowY(hitReactRow)}
          color={STATUS_SUCCESS}
          label="NO (alive)"
          delay={0.55}
          dashed
        />

        {/* alreadyDead → depleted (NOT dead yet) */}
        <FlowArrow
          x1={centerX} y1={rowY(rows.alreadyDead) + NODE_H}
          x2={centerX} y2={rowY(rows.depleted)}
          color={STATUS_WARNING}
          label="NOT dead yet"
          delay={0.6}
        />

        {/* depleted → death */}
        <FlowArrow
          x1={centerX} y1={rowY(rows.depleted) + NODE_H}
          x2={centerX} y2={rowY(rows.death)}
          color={STATUS_ERROR}
          delay={0.65}
        />
      </svg>

      {/* Expanded C++ reference overlay */}
      <AnimatePresence>
        {expandedNode && (() => {
          const node = DAMAGE_PIPELINE.find((n) => n.id === expandedNode);
          if (!node?.cppRef) return null;
          return (
            <motion.div
              key={expandedNode}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-2 px-3 py-2 rounded-lg border border-border/40 bg-surface-deep/80"
              data-testid="pipeline-cpp-ref"
            >
              <div className="text-2xs text-text-muted mb-1 font-bold uppercase tracking-wider">C++ Reference</div>
              <code className="text-xs font-mono text-text break-all">{node.cppRef}</code>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

// ── Heal Pipeline (compact) ──────────────────────────────────────────────────

function HealPipelineFlow() {
  const centerX = 180;
  const rowY = (r: number) => 10 + r * (NODE_H + GAP_Y);
  const totalH = rowY(HEAL_PIPELINE.length) + 10;

  return (
    <svg
      width="100%"
      height={totalH}
      viewBox={`0 0 ${centerX * 2} ${totalH}`}
      className="overflow-visible"
      data-testid="heal-pipeline-svg"
    >
      {HEAL_PIPELINE.map((node, i) => (
        <FlowNode
          key={node.id}
          node={node}
          x={centerX}
          y={rowY(i)}
          delay={i * STAGGER_DEFAULT}
          expanded={false}
          onToggle={() => {}}
        />
      ))}
      {HEAL_PIPELINE.slice(0, -1).map((_, i) => (
        <FlowArrow
          key={`heal-arrow-${i}`}
          x1={centerX} y1={rowY(i) + NODE_H}
          x2={centerX} y2={rowY(i + 1)}
          color={ELEMENT_COLORS.Heal}
          delay={i * STAGGER_DEFAULT + 0.1}
        />
      ))}
    </svg>
  );
}

// ── Direct Health Pipeline (compact) ─────────────────────────────────────────

function DirectHealthFlow() {
  const centerX = 200;
  const leftX = centerX - 110;
  const rightXp = centerX + 110;
  const rowY = (r: number) => 10 + r * (NODE_H + GAP_Y);

  // Rows: entry(0), clamp(1), checkSign(2), then branches
  const branchRow = 3;
  const deathRow = 4;
  const totalH = rowY(deathRow + 1) + 10;

  return (
    <svg
      width="100%"
      height={totalH}
      viewBox={`0 0 ${centerX * 2 + 40} ${totalH}`}
      className="overflow-visible"
      data-testid="direct-pipeline-svg"
    >
      {/* First 3 nodes: entry, clamp, checkSign */}
      {DIRECT_PIPELINE.slice(0, 3).map((node, i) => (
        <FlowNode
          key={node.id}
          node={node}
          x={centerX}
          y={rowY(i)}
          delay={i * STAGGER_DEFAULT}
          expanded={false}
          onToggle={() => {}}
        />
      ))}

      {/* Arrows for first 3 */}
      {[0, 1].map((i) => (
        <FlowArrow
          key={`direct-arrow-${i}`}
          x1={centerX} y1={rowY(i) + NODE_H}
          x2={centerX} y2={rowY(i + 1)}
          color="rgba(255,255,255,0.25)"
          delay={i * STAGGER_DEFAULT + 0.1}
        />
      ))}

      {/* Branch: heal (left) */}
      <FlowNode
        node={DIRECT_PIPELINE[3]}
        x={leftX}
        y={rowY(branchRow)}
        delay={0.3}
        expanded={false}
        onToggle={() => {}}
      />
      <FlowArrow
        x1={centerX - NODE_W / 2} y1={rowY(2) + NODE_H / 2}
        x2={leftX} y2={rowY(branchRow)}
        color={ELEMENT_COLORS.Heal}
        label="Positive"
        delay={0.35}
        dashed
      />

      {/* Branch: damage (right) */}
      <FlowNode
        node={DIRECT_PIPELINE[4]}
        x={rightXp}
        y={rowY(branchRow)}
        delay={0.35}
        expanded={false}
        onToggle={() => {}}
      />
      <FlowArrow
        x1={centerX + NODE_W / 2} y1={rowY(2) + NODE_H / 2}
        x2={rightXp} y2={rowY(branchRow)}
        color={ELEMENT_COLORS.Physical}
        label="Negative"
        delay={0.4}
        dashed
      />

      {/* Death check after damage broadcast */}
      <FlowNode
        node={DIRECT_PIPELINE[5]}
        x={rightXp}
        y={rowY(deathRow)}
        delay={0.45}
        expanded={false}
        onToggle={() => {}}
      />
      <FlowArrow
        x1={rightXp} y1={rowY(branchRow) + NODE_H}
        x2={rightXp} y2={rowY(deathRow)}
        color={ELEMENT_COLORS.Physical}
        delay={0.5}
      />
    </svg>
  );
}

// ── Collapsible section wrapper ──────────────────────────────────────────────

function PipelineSection({ title, color, children, defaultOpen = false, testId }: {
  title: string; color: string; children: React.ReactNode; defaultOpen?: boolean; testId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden" data-testid={testId}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover/30 transition-colors"
        data-testid={`${testId}-toggle`}
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        }
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
        <span className="text-xs font-bold text-text">{title}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function DamagePipelineDiagram() {
  return (
    <SurfaceCard level={2} className="p-3 relative overflow-hidden" data-testid="damage-pipeline-diagram">
      <div className="absolute right-0 top-0 w-40 h-40 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
      <SectionLabel icon={Flame} label="PostGameplayEffectExecute Pipeline" color="#ef4444" />
      <p className="text-xs text-text-muted mt-1 mb-3 max-w-2xl leading-relaxed">
        The complete damage/heal flow from <code className="font-mono text-text">UARPGAttributeSet::PostGameplayEffectExecute</code>.
        Three entry points converge on health modification with element-type detection, dual broadcast patterns, and duplicate death prevention.
      </p>

      {/* Element color legend */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {(Object.entries(ELEMENT_COLORS) as [ElementType, string][]).map(([element, color]) => (
          <div key={element} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `${color}${OPACITY_15}`, border: `1.5px solid ${color}` }}
            />
            <span className="text-2xs font-mono font-bold" style={{ color }}>{element}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {/* 1. Damage pipeline (main — open by default) */}
        <PipelineSection
          title="IncomingDamage Path (meta attribute)"
          color={ELEMENT_COLORS.Physical}
          defaultOpen
          testId="pipeline-section-damage"
        >
          <DamagePipelineFlow />

          {/* Element detection detail */}
          <div
            className="mt-3 px-3 py-2 rounded-lg text-2xs"
            style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}` }}
            data-testid="element-detection-detail"
          >
            <div className="font-bold text-text mb-1.5">DamageType Detection Order (from AssetTags)</div>
            <div className="flex items-center gap-2 flex-wrap">
              {ELEMENT_TAGS.map((et, i) => (
                <div key={et.tag} className="flex items-center gap-1">
                  <span className="font-mono px-1.5 py-0.5 rounded" style={{
                    backgroundColor: `${ELEMENT_COLORS[et.element]}${OPACITY_15}`,
                    color: ELEMENT_COLORS[et.element],
                    border: `1px solid ${ELEMENT_COLORS[et.element]}30`,
                  }}>
                    {et.tag}
                  </span>
                  {i < ELEMENT_TAGS.length - 1 && (
                    <span className="text-text-muted font-mono">{i < ELEMENT_TAGS.length - 2 ? '→' : '→ fallback'}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </PipelineSection>

        {/* 2. Heal pipeline */}
        <PipelineSection
          title="IncomingHeal Path (meta attribute)"
          color={ELEMENT_COLORS.Heal}
          testId="pipeline-section-heal"
        >
          <HealPipelineFlow />
        </PipelineSection>

        {/* 3. Direct Health modification */}
        <PipelineSection
          title="Direct Health Modification (non-execution)"
          color="#8b5cf6"
          testId="pipeline-section-direct"
        >
          <DirectHealthFlow />
          <div
            className="mt-2 text-2xs text-text-muted px-2 py-1.5 rounded-lg bg-surface-deep/50 border border-border/30"
          >
            Backward-compatible path for <code className="font-mono text-text">GE_Heal</code> and other effects
            that modify Health directly without going through an execution calculation.
            Negative magnitude triggers the same death/hitreact logic as the IncomingDamage path.
          </div>
        </PipelineSection>
      </div>

      {/* Dual broadcast pattern note */}
      <div
        className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-2xs"
        style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS }}
        data-testid="dual-broadcast-note"
      >
        <span className="font-bold shrink-0 mt-0.5">Dual Broadcast:</span>
        <span className="text-text-muted">
          All three paths fire both <code className="font-mono text-text">OnDamageNumberRequested</code> (per-instance delegate) and{' '}
          <code className="font-mono text-text">OnDamageNumberRequestedGlobal</code> (static delegate) for floating damage/heal numbers.
        </span>
      </div>
    </SurfaceCard>
  );
}
