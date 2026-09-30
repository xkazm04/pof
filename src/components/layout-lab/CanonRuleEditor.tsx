'use client';

/**
 * The canon law editor. Before Save it shows the law's REACH — exactly which Produce prompts it
 * will enter (`ruleReach`, the same resolvers the prompt builder uses) — so a category or scope
 * change that moves a law from 253 prompts to 77, or to none, is visible while it is authored.
 * Scope is a picker of `global` + the registered catalogs (a typo can no longer be typed), and a
 * refused save keeps the editor open with the server's reason instead of vanishing.
 */
import { useMemo, useState } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { reachSummary, ruleReach } from '@/lib/catalog/canon/ruleReach';
import { validateRuleDraft } from '@/lib/catalog/canon/validation';
import type { ProjectRule, RuleCategory } from '@/lib/catalog/canon/types';
import type { Result } from '@/types/result';
import type { LabTheme } from './theme';
import { Lbl, LabButton, LabInput, LabTextarea } from './steps/controls';

export const CANON_CATEGORIES: RuleCategory[] = ['game', 'art', 'project'];

export function CanonRuleEditor({ t, rule, onSave, onCancel }: {
  t: LabTheme;
  rule: ProjectRule;
  /** Resolves with the server's verdict; the editor closes only via the parent on success. */
  onSave: (r: ProjectRule) => Promise<Result<ProjectRule, string>>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(rule.title);
  const [body, setBody] = useState(rule.body);
  const [scope, setScope] = useState(rule.scope);
  const [category, setCategory] = useState<RuleCategory>(rule.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pipelines = useMemo(() => allCatalogPipelines(), []);
  const scopes = useMemo(() => {
    const ids = ['global', ...pipelines.map((p) => p.catalogId)];
    // A legacy row's unregistered scope stays visible (and is refused on Save) rather than silently rewritten.
    return ids.includes(rule.scope) ? ids : [...ids, rule.scope];
  }, [pipelines, rule.scope]);
  const reach = useMemo(
    () => ruleReach({ id: rule.id, profile: rule.profile, scope, category }, pipelines),
    [rule.id, rule.profile, scope, category, pipelines],
  );

  const save = async () => {
    const draft: ProjectRule = { ...rule, title, body, scope, category };
    const valid = validateRuleDraft(draft, pipelines);
    if (!valid.ok) { setError(valid.error); return; }
    setSaving(true);
    setError(null);
    const r = await onSave(draft);
    setSaving(false);
    if (!r.ok) setError(`Not saved — ${r.error}`);
  };

  const selectStyle = { width: '100%', background: t.bg, color: t.text, border: `1px solid ${t.line}`, borderRadius: t.glass ? 8 : 0, padding: '9px 12px', fontSize: 15, outline: 'none' } as const;
  return (
    <div role="group" aria-label="Canon rule editor" style={{ border: `1px solid ${t.ink}`, borderRadius: t.glass ? 10 : 0, padding: '14px 16px', background: t.panel, marginBottom: 10 }}>
      <div style={{ marginBottom: 8 }}>
        <Lbl t={t}>Title</Lbl>
        <div style={{ marginTop: 4 }}><LabInput t={t} value={title} onChange={setTitle} placeholder="Rule title" /></div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Lbl t={t}>Body</Lbl>
        <div style={{ marginTop: 4 }}><LabTextarea t={t} value={body} onChange={setBody} rows={3} placeholder="Rule body / guidance" /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Lbl t={t}>Scope</Lbl>
          <div style={{ marginTop: 4 }}>
            <select aria-label="Scope" value={scope} onChange={(e) => setScope(e.target.value)} className={t.fontBody} style={selectStyle}>
              {scopes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <Lbl t={t}>Category</Lbl>
          <div style={{ marginTop: 4 }}>
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as RuleCategory)} className={t.fontBody} style={selectStyle}>
              {CANON_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
      <p aria-label="Prompt reach" className={t.fontMono}
        style={{ fontSize: 13, margin: '0 0 12px', lineHeight: 1.5, color: reach.stepCount ? t.muted : t.warn }}>
        {reachSummary(reach)}
      </p>
      {error && (
        <p role="alert" className={t.fontBody} style={{ fontSize: 14, margin: '0 0 12px', color: t.bad }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <LabButton t={t} onClick={() => { void save(); }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</LabButton>
        <button onClick={onCancel} className={t.fontMono} style={{ fontSize: 14, cursor: 'pointer', background: 'transparent', border: `1px solid ${t.line}`, color: t.muted, padding: '10px 16px', borderRadius: t.glass ? 8 : 0 }}>Cancel</button>
      </div>
    </div>
  );
}
