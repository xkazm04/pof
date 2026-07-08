'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ChipButton } from '@/components/ui/ChipButton';
import {
  ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10,
} from '@/lib/chart-colors';
import type { EQSComponentDef, PropertyDef } from './types';
import { KIND_META } from './constants';

function PropertyRow({ prop }: { prop: PropertyDef }) {
  return (
    <div className="grid grid-cols-[120px_80px_1fr] gap-2 items-start py-1 border-b border-border/10 last:border-b-0">
      <span className="text-2xs font-mono font-bold text-text truncate" title={prop.name}>
        {prop.name}
      </span>
      <span className="text-2xs font-mono text-text-muted truncate" title={prop.type}>
        {prop.type}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-2xs font-mono px-1.5 py-0.5 rounded shrink-0"
          style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS }}
        >
          {prop.defaultValue}
        </span>
        {prop.meta && (
          <span
            className="text-2xs font-mono px-1.5 py-0.5 rounded shrink-0"
            style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
          >
            {prop.meta}
          </span>
        )}
      </div>
    </div>
  );
}

export function ComponentCard({ comp }: { comp: EQSComponentDef }) {
  const [expanded, setExpanded] = useState(false);
  const km = KIND_META[comp.kind];
  const KindIcon = km.icon;

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div
      className="rounded-lg border border-border/40 overflow-hidden"
      style={{ borderColor: `${km.color}25` }}
      data-testid={`eqs-component-${comp.id}`}
    >
      {/* Header */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/3 transition-colors"
        data-testid={`eqs-component-${comp.id}-toggle`}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
        }
        <span style={{ color: km.color }}><KindIcon className="w-3.5 h-3.5" /></span>
        <span className="text-xs font-bold text-text">{comp.displayName}</span>

        {/* Kind badge */}
        <ChipButton as="span" color={km.color} className="ml-auto shrink-0">
          {km.label}
        </ChipButton>

        {/* Cost badge (tests only) */}
        {comp.cost && (
          <ChipButton
            as="span"
            color={comp.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS}
            mono
            className="shrink-0"
          >
            Cost: {comp.cost}
          </ChipButton>
        )}

        {/* Property count */}
        <span className="text-2xs text-text-muted shrink-0">
          {comp.properties.length} props
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/20 space-y-2">
          <p className="text-2xs text-text-muted leading-relaxed">{comp.description}</p>

          {/* Class info */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xs font-mono" style={{ color: km.color }}>
              {comp.cppClass}
            </span>
            <span className="text-2xs text-text-muted">
              extends <span className="font-mono">{comp.parentClass}</span>
            </span>
          </div>

          {/* Output type */}
          {comp.outputType && (
            <div className="flex items-center gap-2">
              <span className="text-2xs text-text-muted">Output:</span>
              <span
                className="text-2xs font-mono px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${ACCENT_ORANGE}${OPACITY_10}`, color: ACCENT_ORANGE }}
              >
                {comp.outputType}
              </span>
            </div>
          )}

          {/* Properties table */}
          <div className="mt-1.5">
            <div className="grid grid-cols-[120px_80px_1fr] gap-2 pb-1 border-b border-border/30">
              <span className="text-2xs font-semibold text-text-muted">Property</span>
              <span className="text-2xs font-semibold text-text-muted">Type</span>
              <span className="text-2xs font-semibold text-text-muted">Default / Meta</span>
            </div>
            {comp.properties.map((p) => (
              <PropertyRow key={p.name} prop={p} />
            ))}
          </div>

          {/* Descriptions under props */}
          <div className="space-y-1 mt-1">
            {comp.properties.map((p) => (
              <div key={`desc-${p.name}`} className="flex gap-2 items-start">
                <span className="text-2xs font-mono text-text-muted shrink-0 w-28">{p.name}</span>
                <span className="text-2xs text-text-muted/70">{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
