'use client';

import type { LabTheme } from './theme';
import type { LabGroup, LabCatalog, LabEntity } from './useLabCatalogData';

interface CatalogTreeProps {
  t: LabTheme;
  groups: LabGroup[];
  selectedCatalogId: string;
  entities: LabEntity[];
  selectedEntityId: string | null;
  onSelectCatalog: (id: string) => void;
  onSelectEntity: (id: string) => void;
}

function lifecycleDot(lifecycle: string, t: LabTheme): string {
  if (lifecycle === 'verified') return t.ok;
  if (lifecycle === 'failed') return t.bad;
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
        const isEntitySelected = entity.id === selectedEntityId;
        return (
          <button
            key={entity.id}
            onClick={() => onSelectEntity(entity.id)}
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
              style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: lifecycleDot(entity.lifecycle, t),
              }}
            />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entity.name}
            </span>
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
