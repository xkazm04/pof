'use client';

import type { LabTheme } from './theme';
import type { LabGroup, LabCatalog, LabEntity } from './useLabCatalogData';
import { STATUS_GLYPH, lifecycleStatus, statusAriaLabel, type StatusKind } from './statusLanguage';
import { useCatalogStore } from '@/stores/catalogStore';

interface CatalogTreeProps {
  t: LabTheme;
  groups: LabGroup[];
  selectedCatalogId: string;
  entities: LabEntity[];
  selectedEntityId: string | null;
  onSelectCatalog: (id: string) => void;
  onSelectEntity: (id: string) => void;
}

function lifecycleColor(status: StatusKind, t: LabTheme, isDraft: boolean): string {
  if (isDraft) return t.warn;
  if (status === 'pass') return t.ok;
  if (status === 'fail') return t.bad;
  return t.muted;
}

function CatalogRow({
  t, catalog, isSelected, entities, selectedEntityId, onSelectCatalog, onSelectEntity,
}: {
  t: LabTheme;
  catalog: LabCatalog;
  isSelected: boolean;
  entities: LabEntity[];
  selectedEntityId: string | null;
  onSelectCatalog: (id: string) => void;
  onSelectEntity: (id: string) => void;
}) {
  return (
    <>
      <button
        onClick={() => onSelectCatalog(catalog.catalogId)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', textAlign: 'left', padding: '7px 12px 7px 20px',
          cursor: 'pointer', border: 'none',
          borderLeft: isSelected ? `3px solid ${t.ink}` : '3px solid transparent',
          background: isSelected ? t.accentBg : 'transparent',
          color: isSelected ? t.inkDeep : t.text,
          fontWeight: isSelected ? 600 : 400,
          fontSize: 14,
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {catalog.label}
        </span>
        <span
          className={t.fontMono}
          style={{ fontSize: 12, color: t.muted, flexShrink: 0, marginLeft: 8 }}
        >
          {catalog.verified}/{catalog.total}
        </span>
      </button>
      {isSelected && entities.map((entity) => {
        const isDraft = entity.id.startsWith('draft-');
        const isEntitySelected = entity.id === selectedEntityId;
        const status = lifecycleStatus(entity.lifecycle);
        const dotColor = lifecycleColor(status, t, isDraft);
        // Pass fills the dot; fail/pending use a glyph-bearing capsule so the status
        // is readable in grayscale and announces a plain-language word to AT.
        // Drafts always use the warn capsule style regardless of lifecycle status.
        const isPass = !isDraft && status === 'pass';
        return (
          <button
            key={entity.id}
            onClick={() => onSelectEntity(entity.id)}
            aria-label={statusAriaLabel(entity.name, status)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', textAlign: 'left', padding: '6px 12px 6px 36px',
              cursor: 'pointer', border: 'none',
              background: isEntitySelected ? t.accentBg : 'transparent',
              color: isEntitySelected ? t.inkDeep : t.text,
              fontWeight: isEntitySelected ? 600 : 400,
              fontSize: 14,
            }}
          >
            <span
              aria-hidden="true"
              title={`${entity.name}: ${entity.lifecycle}`}
              style={{
                minWidth: 14, height: 14, padding: isPass ? 0 : '0 3px',
                flexShrink: 0, borderRadius: isPass ? '50%' : 4,
                background: isPass ? dotColor : 'transparent',
                border: isPass ? 'none' : `1px solid ${dotColor}`,
                color: dotColor,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, lineHeight: 1,
              }}
            >{isPass ? '' : STATUS_GLYPH[status]}</span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entity.name}
            </span>
            {isDraft && (
              <button
                aria-label="discard draft"
                onClick={(e) => {
                  e.stopPropagation();
                  useCatalogStore.getState().removeDraft(catalog.catalogId, entity.id);
                }}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 14, padding: '0 4px' }}
              >
                ×
              </button>
            )}
          </button>
        );
      })}
    </>
  );
}

/** Category → Catalog → Entity collapsible tree for the Baseline left column. */
export function CatalogTree({
  t, groups, selectedCatalogId, entities, selectedEntityId, onSelectCatalog, onSelectEntity,
}: CatalogTreeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
      {groups.map((group) => (
        <div key={group.category}>
          <div
            className={t.fontMono}
            style={{
              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: t.muted, padding: '12px 12px 4px 12px',
              borderBottom: `1px solid ${t.line}`,
            }}
          >
            {group.category}
          </div>
          {group.catalogs.map((catalog) => (
            <CatalogRow
              key={catalog.catalogId}
              t={t}
              catalog={catalog}
              isSelected={catalog.catalogId === selectedCatalogId}
              entities={catalog.catalogId === selectedCatalogId ? entities : []}
              selectedEntityId={selectedEntityId}
              onSelectCatalog={onSelectCatalog}
              onSelectEntity={onSelectEntity}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
