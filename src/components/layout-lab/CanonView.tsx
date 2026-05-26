'use client';

import { useState } from 'react';
import type { LabTheme } from './theme';
import type { ProjectRule, RuleCategory } from '@/lib/catalog/canon/types';
import { useCanonStore } from './canonStore';
import { Lbl, LabButton, LabInput, LabTextarea } from './steps/controls';

const CATEGORIES: RuleCategory[] = ['game', 'art', 'project'];

function CanonRuleCard({ t, rule, onEdit, onDelete }: {
  t: LabTheme;
  rule: ProjectRule;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ border: `1px solid ${t.line}`, borderRadius: t.glass ? 10 : 0, padding: '14px 16px', background: t.panel, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <span className={t.fontBody} style={{ fontSize: 15, fontWeight: 600, color: t.inkDeep, flex: 1 }}>{rule.title || <em style={{ color: t.muted }}>Untitled</em>}</span>
        <span className={t.fontMono} style={{ fontSize: 12, padding: '2px 8px', border: `1px solid ${t.line}`, color: t.muted, borderRadius: t.glass ? 4 : 0 }}>{rule.scope}</span>
        <button onClick={onEdit} className={t.fontMono} style={{ fontSize: 13, cursor: 'pointer', background: 'transparent', border: `1px solid ${t.line}`, color: t.text, padding: '3px 10px', borderRadius: t.glass ? 6 : 0 }}>Edit</button>
        <button onClick={onDelete} className={t.fontMono} style={{ fontSize: 13, cursor: 'pointer', background: 'transparent', border: `1px solid ${t.bad}`, color: t.bad, padding: '3px 10px', borderRadius: t.glass ? 6 : 0 }}>Delete</button>
      </div>
      <p className={t.fontBody} style={{ fontSize: 14, color: t.text, margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{rule.body}</p>
    </div>
  );
}

function CanonRuleEditor({ t, rule, onSave, onCancel }: {
  t: LabTheme;
  rule: ProjectRule;
  onSave: (r: ProjectRule) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(rule.title);
  const [body, setBody] = useState(rule.body);
  const [scope, setScope] = useState(rule.scope);
  const [category, setCategory] = useState<RuleCategory>(rule.category);

  return (
    <div style={{ border: `1px solid ${t.ink}`, borderRadius: t.glass ? 10 : 0, padding: '14px 16px', background: t.panel, marginBottom: 10 }}>
      <div style={{ marginBottom: 8 }}>
        <Lbl t={t}>Title</Lbl>
        <div style={{ marginTop: 4 }}><LabInput t={t} value={title} onChange={setTitle} placeholder="Rule title" /></div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Lbl t={t}>Body</Lbl>
        <div style={{ marginTop: 4 }}><LabTextarea t={t} value={body} onChange={setBody} rows={3} placeholder="Rule body / guidance" /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <Lbl t={t}>Scope</Lbl>
          <div style={{ marginTop: 4 }}><LabInput t={t} value={scope} onChange={setScope} placeholder="global or a catalogId" /></div>
        </div>
        <div style={{ flex: 1 }}>
          <Lbl t={t}>Category</Lbl>
          <div style={{ marginTop: 4 }}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RuleCategory)}
              className={t.fontBody}
              style={{ width: '100%', background: t.bg, color: t.text, border: `1px solid ${t.line}`, borderRadius: t.glass ? 8 : 0, padding: '9px 12px', fontSize: 15, outline: 'none' }}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <LabButton t={t} onClick={() => onSave({ ...rule, title, body, scope, category })}>Save</LabButton>
        <button onClick={onCancel} className={t.fontMono} style={{ fontSize: 14, cursor: 'pointer', background: 'transparent', border: `1px solid ${t.line}`, color: t.muted, padding: '10px 16px', borderRadius: t.glass ? 8 : 0 }}>Cancel</button>
      </div>
    </div>
  );
}

export function CanonView({ t }: { t: LabTheme }) {
  const rules = useCanonStore((s) => s.rules);
  const upsert = useCanonStore((s) => s.upsert);
  const remove = useCanonStore((s) => s.remove);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = (category: RuleCategory) => {
    const id = `rule-${Date.now()}`;
    const newRule: ProjectRule = { id, category, scope: 'global', title: '', body: '' };
    void upsert(newRule);
    setEditingId(id);
  };

  const handleSave = (rule: ProjectRule) => {
    void upsert(rule);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    void remove(id);
    if (editingId === id) setEditingId(null);
  };

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: '28px 36px' }}>
      <div style={{ maxWidth: 820 }}>
        <h2 className={t.fontBody} style={{ fontSize: 22, fontWeight: 700, color: t.inkDeep, margin: '0 0 4px' }}>Project Canon</h2>
        <p className={t.fontBody} style={{ fontSize: 14, color: t.muted, marginBottom: 28 }}>
          Laws &amp; references injected into every Produce prompt.
        </p>

        {CATEGORIES.map((cat) => {
          const catRules = rules.filter((r) => r.category === cat);
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
              {catRules.length === 0 && (
                <p className={t.fontBody} style={{ fontSize: 14, color: t.muted, fontStyle: 'italic' }}>No {cat} rules yet.</p>
              )}
              {catRules.map((rule) =>
                editingId === rule.id ? (
                  <CanonRuleEditor key={rule.id} t={t} rule={rule} onSave={handleSave} onCancel={() => setEditingId(null)} />
                ) : (
                  <CanonRuleCard key={rule.id} t={t} rule={rule} onEdit={() => setEditingId(rule.id)} onDelete={() => handleDelete(rule.id)} />
                )
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
