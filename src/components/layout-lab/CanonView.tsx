'use client';

import { useEffect, useState } from 'react';
import type { LabTheme } from './theme';
import type { ProjectRule, RuleCategory } from '@/lib/catalog/canon/types';
import { CANON_PROFILES, DEFAULT_CANON_PROFILE, profileOfRule } from '@/lib/catalog/canon/profiles';
import { TabBar } from '@/components/ui/TabBar';
import { useCanonStore } from './canonStore';
import { CanonDriftPanel, driftCount } from './CanonDriftPanel';
import { LabButton } from './steps/controls';
import { CANON_CATEGORIES as CATEGORIES, CanonRuleEditor } from './CanonRuleEditor';
const PROFILE_TABS = Object.values(CANON_PROFILES).map((profile) => ({ id: profile.id, label: profile.title }));

function CanonRuleCard({ t, rule, onEdit, onDelete }: {
  t: LabTheme;
  rule: ProjectRule;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div style={{ border: `1px solid ${t.line}`, borderRadius: t.glass ? 10 : 0, padding: '14px 16px', background: t.panel, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <span className={t.fontBody} style={{ fontSize: 15, fontWeight: 600, color: t.inkDeep, flex: 1 }}>{rule.title || <em style={{ color: t.muted }}>Untitled</em>}</span>
        <span className={t.fontMono} style={{ fontSize: 12, padding: '2px 8px', border: `1px solid ${t.line}`, color: t.muted, borderRadius: t.glass ? 4 : 0 }}>{rule.scope}</span>
        {onEdit && <button onClick={onEdit} className={t.fontMono} style={{ fontSize: 13, cursor: 'pointer', background: 'transparent', border: `1px solid ${t.line}`, color: t.text, padding: '3px 10px', borderRadius: t.glass ? 6 : 0 }}>Edit</button>}
        {onDelete && <button onClick={onDelete} className={t.fontMono} style={{ fontSize: 13, cursor: 'pointer', background: 'transparent', border: `1px solid ${t.bad}`, color: t.bad, padding: '3px 10px', borderRadius: t.glass ? 6 : 0 }}>Delete</button>}
      </div>
      <p className={t.fontBody} style={{ fontSize: 14, color: t.text, margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{rule.body}</p>
    </div>
  );
}

export function CanonView({ t }: { t: LabTheme }) {
  const rules = useCanonStore((s) => s.rules);
  const upsert = useCanonStore((s) => s.upsert);
  const remove = useCanonStore((s) => s.remove);
  const drift = useCanonStore((s) => s.drift);
  const loadDrift = useCanonStore((s) => s.loadDrift);
  const [reviewOpen, setReviewOpen] = useState(false);
  useEffect(() => { void loadDrift(); }, [loadDrift]);
  const [selectedProfileId, setSelectedProfileId] = useState(DEFAULT_CANON_PROFILE);
  const [editingId, setEditingId] = useState<string | null>(null);
  // '+ Add rule' opens a LOCAL draft: nothing is POSTed (or enters a prompt) until Save succeeds.
  const [draft, setDraft] = useState<ProjectRule | null>(null);
  const selectedProfile = CANON_PROFILES[selectedProfileId];
  const drifted = driftCount(drift?.byProfile[selectedProfileId]);
  const undoable = (drift?.adopted ?? []).filter((a) => a.profile === selectedProfileId).length;
  const inheritedIds = new Set(selectedProfile.inheritsPof);
  const inheritedRules = selectedProfileId === DEFAULT_CANON_PROFILE
    ? []
    : rules.filter((rule) => profileOfRule(rule) === DEFAULT_CANON_PROFILE && inheritedIds.has(rule.id));

  const handleAdd = (category: RuleCategory) => {
    const id = `rule-${Date.now()}`;
    setDraft({
      id, category, scope: 'global', title: '', body: '',
      ...(selectedProfileId === DEFAULT_CANON_PROFILE ? {} : { profile: selectedProfileId }),
    });
    setEditingId(id);
  };

  const closeEditor = () => { setEditingId(null); setDraft(null); };

  // The store commits only what the server stored; a refusal is returned to the editor, which stays open.
  const handleSave = async (rule: ProjectRule) => {
    const r = await upsert(rule);
    if (r.ok) closeEditor();
    return r;
  };

  const handleDelete = (id: string) => {
    void remove(id);
    if (editingId === id) setEditingId(null);
  };

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: '28px 36px' }}>
      <div style={{ maxWidth: 820 }}>
        <h2 className={t.fontBody} style={{ fontSize: 22, fontWeight: 700, color: t.inkDeep, margin: '0 0 4px' }}>{selectedProfile.title} Canon</h2>
        <p className={t.fontBody} style={{ fontSize: 14, color: t.muted, marginBottom: 28 }}>
          Laws &amp; references are injected only into Produce prompts for entities written for this profile&mdash;PoF&rsquo;s own entities for PoF, or ingested reference entities such as Diablo I for another profile.
        </p>
        <TabBar
          tabs={PROFILE_TABS}
          activeId={selectedProfileId}
          onChange={(profileId) => { setSelectedProfileId(profileId); closeEditor(); setReviewOpen(false); }}
          layoutId="canon-profile-tab"
          accent={t.ink}
          ariaLabel="Canon profile"
          className="mb-7"
        />

        {(drifted > 0 || undoable > 0) && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: `1px solid ${t.warn}`, borderRadius: t.glass ? 10 : 0, padding: '10px 14px', marginBottom: 16 }}>
            <span className={t.fontBody} style={{ fontSize: 14, color: t.text, flex: 1, minWidth: 220 }}>
              {drifted > 0
                ? `${drifted} laws changed upstream since this DB was seeded; your produce prompts still cite the old text.`
                : `Canon matches the shipped laws. ${undoable} adopted law(s) can still be undone.`}
            </span>
            <LabButton t={t} onClick={() => setReviewOpen((o) => !o)}>{reviewOpen ? 'Hide review' : 'Review drift'}</LabButton>
          </div>
        )}
        {(drifted > 0 || undoable > 0) && reviewOpen && <CanonDriftPanel t={t} profileId={selectedProfileId} />}

        {CATEGORIES.map((cat) => {
          const catRules = rules.filter((r) => r.category === cat && profileOfRule(r) === selectedProfileId);
          return (
            <section key={cat} style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className={t.fontMono} style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink, fontWeight: 600 }}>{cat}</span>
                <span style={{ flex: 1, height: 1, background: t.line }} />
                <button
                  onClick={() => handleAdd(cat)}
                  className={t.fontMono}
                  style={{ fontSize: 13, cursor: 'pointer', background: 'transparent', border: `1px solid ${t.line}`, color: t.muted, padding: '4px 12px', borderRadius: t.glass ? 6 : 0 }}
                >
                  + Add rule
                </button>
              </div>
              {draft?.category === cat && editingId === draft.id && (
                <CanonRuleEditor key={draft.id} t={t} rule={draft} onSave={handleSave} onCancel={closeEditor} />
              )}
              {catRules.length === 0 && !(draft?.category === cat) && (
                <p className={t.fontBody} style={{ fontSize: 14, color: t.muted, fontStyle: 'italic' }}>No {cat} rules yet.</p>
              )}
              {catRules.map((rule) =>
                editingId === rule.id ? (
                  <CanonRuleEditor key={rule.id} t={t} rule={rule} onSave={handleSave} onCancel={closeEditor} />
                ) : (
                  <CanonRuleCard key={rule.id} t={t} rule={rule} onEdit={() => { setDraft(null); setEditingId(rule.id); }} onDelete={() => handleDelete(rule.id)} />
                )
              )}
            </section>
          );
        })}

        {selectedProfileId !== DEFAULT_CANON_PROFILE && (
          <section aria-label="Inherited from PoF" style={{ borderTop: `1px solid ${t.line}`, paddingTop: 20, marginBottom: 36 }}>
            <h3 className={t.fontMono} style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink, fontWeight: 600, margin: '0 0 4px' }}>Inherited from PoF</h3>
            <p className={t.fontBody} style={{ fontSize: 14, color: t.muted, margin: '0 0 12px' }}>Shared rules are read-only in this profile.</p>
            {inheritedRules.length === 0 && (
              <p className={t.fontBody} style={{ fontSize: 14, color: t.muted, fontStyle: 'italic' }}>No inherited rules available.</p>
            )}
            {inheritedRules.map((rule) => <CanonRuleCard key={rule.id} t={t} rule={rule} />)}
          </section>
        )}
      </div>
    </div>
  );
}
