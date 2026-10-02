'use client';

import { useMemo, useState } from 'react';
import { Eye, Grid3x3, Loader2 } from 'lucide-react';
import { useCRUD } from '@/hooks/useCRUD';
import { useIsMounted } from '@/hooks/useIsMounted';
import { usePaneHold } from '@/hooks/usePaneHold';
import type { CatalogSummary, EntitySummary } from '@/lib/catalog/headless';
import { iconsForEntityStep, type GeneratedIcon } from '@/lib/visual-gen/generated-icons';
import type { ImageProviderCapability } from '@/lib/visual-gen/image-providers';
import { SHEET_DEFAULTS, SHEET_PROVIDER_ID, iconCoverage, planIconSet, sheetPrompt, type IconSetEntity } from '@/lib/visual-gen/icon-set-plan';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { runIconSet, type IconSheetOutcome } from '@/components/modules/visual-gen/asset-forge/iconSetRun';
import { InlineErrorRetry } from '../../shared/InlineErrorRetry';

/**
 * Icon Set mode — see which entities of a (catalog, step) lack art of their own, plan the
 * contact sheets that fill exactly those, preview the exact prompts, then ONE paid click.
 *
 * Everything before the click is free and local: the catalogs and steps
 * (`GET /api/catalog/pipelines`), the cast (`GET /api/catalog/entities`), coverage from the icon
 * library's listing (`GET /api/visual-gen/icons`, read through the library door), the plan and the
 * prompt preview (`icon-set-plan.ts`, pure). The provider's capability comes from the server
 * (`GET /api/visual-gen/generate-2d`), so a keyless sheet provider disables the run WITH its reason.
 *
 * The run (`iconSetRun.ts`) posts one sheet at a time; the route files each cut through the icon
 * library door. Afterwards the listing is refetched and coverage re-derived from it — never from the
 * run report — so a reload mid-run loses only the report, never the cut art. A sheet the gate
 * refused to cut stays listed with its url and reasons: the credit was spent on it.
 */
const NO_CATALOGS: CatalogSummary[] = [];
const NO_ENTITIES: EntitySummary[] = [];
const NO_ICONS: { icons: GeneratedIcon[] } = { icons: [] };
const NO_CAPS: { providers: ImageProviderCapability[] } = { providers: [] };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const INPUT = 'bg-surface border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-[var(--visual-gen)]';

export function IconSetPanel() {
  const applyStyleDna = useForgeStore((s) => s.applyStyleDna);
  const activeStyleDna = useForgeStore((s) => s.activeStyleDna);
  const [pickedCatalog, setPickedCatalog] = useState<string | null>(null);
  const [pickedStep, setPickedStep] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<Record<string, string>>({});
  const [reroll, setReroll] = useState(false);
  const [preview, setPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<IconSheetOutcome[] | null>(null);
  const isMounted = useIsMounted();
  usePaneHold(running, 'Icon set: paid contact sheets generating');

  const catalogsQ = useCRUD('/api/catalog/pipelines', NO_CATALOGS, { errorMessage: 'the catalog list did not load' });
  const catalogs = catalogsQ.data.filter((c) => c.steps.length > 0);
  const catalog = catalogs.find((c) => c.catalogId === pickedCatalog) ?? catalogs[0] ?? null;
  const catalogId = catalog?.catalogId ?? '';
  const step = pickedStep && catalog?.steps.includes(pickedStep) ? pickedStep : catalog?.steps[0] ?? '';
  const entitiesQ = useCRUD(`/api/catalog/entities?catalogId=${encodeURIComponent(catalogId)}`, NO_ENTITIES, { skipInitialFetch: !catalogId });
  const iconsQ = useCRUD('/api/visual-gen/icons', NO_ICONS, { errorMessage: 'the icon library did not load' });
  const capsQ = useCRUD('/api/visual-gen/generate-2d', NO_CAPS, { errorMessage: 'the server did not answer' });

  const entities: IconSetEntity[] = useMemo(
    () => entitiesQ.data.map((e) => ({ id: e.id, name: e.name, canonProfile: e.canonProfile })),
    [entitiesQ.data],
  );
  const icons = iconsQ.data.icons;
  const loadError = catalogsQ.error ?? entitiesQ.error ?? iconsQ.error;
  const ready = !!catalogId && !!step && !catalogsQ.isLoading && !entitiesQ.isLoading && !iconsQ.isLoading && !loadError;
  const plan = ready ? planIconSet({ catalogId, step, entities, icons, briefs, reroll }) : null;
  const coverage = ready ? iconCoverage(catalogId, step, entities, icons) : null;
  const castIds = new Set(reroll ? entities.map((e) => e.id) : coverage?.missing ?? []);

  const provider = capsQ.data.providers.find((p) => p.id === SHEET_PROVIDER_ID);
  const blockReason: string | null = (() => {
    if (loadError) return `Could not read the catalog or the icon library: ${loadError}`;
    if (!ready) return catalogsQ.isLoading || entitiesQ.isLoading || iconsQ.isLoading ? 'Reading which entities lack art…' : 'No catalog with pipeline steps.';
    if (capsQ.error) return `Could not check the sheet provider: ${capsQ.error}`;
    if (capsQ.isLoading) return 'Checking whether this server can run the sheet provider…';
    if (!provider) return `The sheet provider "${SHEET_PROVIDER_ID}" is not in this server's 2D registry.`;
    if (!provider.executable) return provider.reason ?? `${provider.name} cannot run on this server.`;
    if (plan && !plan.ok) return plan.error;
    if (plan?.ok && plan.data.sheets.length === 0) return 'Every entity at this step has its own art. Tick "re-draw" to redo them.';
    return null;
  })();
  const canRun = blockReason === null && !running && !!plan?.ok;

  const run = async () => {
    if (!canRun || !plan?.ok) return;
    setRunning(true);
    setOutcomes([]);
    const out = await runIconSet(plan.data, (input, init) => fetch(input, init), {
      applyStyleDna,
      onSheet: (o) => { if (isMounted()) setOutcomes((prev) => [...(prev ?? []), o]); },
    });
    if (!isMounted()) return;
    setOutcomes(out);
    setRunning(false);
    await iconsQ.refetch(); // coverage is re-derived from the library, never from this report
  };

  const sheets = plan?.ok ? plan.data.sheets : [];
  const icons1 = plan?.ok ? plan.data.perEntityCalls : 0;
  return (
    <div className="space-y-3 border-t border-border pt-4" data-testid="icon-set-panel">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-text"><Grid3x3 size={14} className="text-[var(--visual-gen)]" /> Icon set — one sheet, many entities</h3>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Catalog" data-testid="icon-set-catalog" className={INPUT} value={catalogId}
          onChange={(e) => { setPickedCatalog(e.target.value); setPickedStep(null); setBriefs({}); setOutcomes(null); }}>
          {catalogs.map((c) => <option key={c.catalogId} value={c.catalogId}>{c.label}</option>)}
        </select>
        <select aria-label="Step" data-testid="icon-set-step" className={INPUT} value={step} onChange={(e) => setPickedStep(e.target.value)}>
          {(catalog?.steps ?? []).map((st) => (
            <option key={st} value={st}>
              {ready ? `${st} — ${iconCoverage(catalogId, st, entities, icons).missing.length} of ${entities.length} lack art` : st}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-2xs text-text-muted">
          <input type="checkbox" data-testid="icon-set-reroll" checked={reroll} onChange={(e) => setReroll(e.target.checked)} /> re-draw entities that have art
        </label>
      </div>
      {loadError && <InlineErrorRetry dense message={loadError} onRetry={() => { void catalogsQ.refetch(); void entitiesQ.refetch(); void iconsQ.refetch(); }} />}
      {coverage && (
        <p className="text-2xs text-text-muted" data-testid="icon-set-coverage" data-covered={coverage.covered.length} data-missing={coverage.missing.length}>
          {coverage.covered.length} of {entities.length} have their own art at “{step}”; {coverage.missing.length} lack it (a step-wide icon does not count).
        </p>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {entities.filter((e) => castIds.has(e.id)).map((e) => {
          const own = iconsForEntityStep(icons, catalogId, step, e.id)[0];
          return (
            <label key={e.id} className="flex items-center gap-1.5 text-2xs text-text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by /api/visual-gen/icon/:name */}
              {own && <img src={own.url} alt={e.name} className="w-5 h-5 rounded" />}
              <input aria-label={`Brief for ${e.id}`} data-testid={`icon-set-brief-${e.id}`} className={`${INPUT} flex-1`}
                value={briefs[e.id] ?? e.name} onChange={(ev) => setBriefs((b) => ({ ...b, [e.id]: ev.target.value }))} />
            </label>
          );
        })}
      </div>
      {plan?.ok && sheets.length > 0 && (
        <p className="text-xs text-text" data-testid="icon-set-plan">
          {plural(icons1, 'icon')} → {plural(sheets.length, 'generation')} instead of {icons1} ({sheets.map((s) => `${s.cols}×${s.rows}`).join(' + ')})
        </p>
      )}
      {sheets.length > 0 && (
        <button type="button" data-testid="icon-set-preview-toggle" onClick={() => setPreview((v) => !v)} className="flex items-center gap-1 text-2xs text-text-muted hover:text-text">
          <Eye size={11} /> {preview ? 'Hide' : 'Preview'} the exact prompts (free)
        </button>
      )}
      {preview && sheets.length > 0 && (
        <div className="space-y-2" data-testid="icon-set-preview">
          <p className="text-2xs text-amber-400" data-testid="icon-set-style-line" data-style-source={applyStyleDna ? 'style-dna' : 'default'}>
            {applyStyleDna
              ? `Style/medium line: replaced on the server by the resolved Style DNA (${activeStyleDna ? `“${activeStyleDna.name}”` : 'the active project style'} for project entities, a canon's own style for canon entities). The line below is used only when none resolves.`
              : `Style/medium line: the default medium (“${SHEET_DEFAULTS.style}”). The forge's Style DNA switch is off, so this is exactly what is sent.`}
          </p>
          {sheets.map((s, i) => {
            const p = sheetPrompt(s);
            return <pre key={i} className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface p-2 text-2xs text-text-muted">{p.ok ? p.data : p.error}</pre>;
          })}
        </div>
      )}
      <button type="button" data-testid="icon-set-run" disabled={!canRun} onClick={() => void run()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--visual-gen)] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
        {running && <Loader2 size={14} className="animate-spin" />}
        {running
          ? `Generating sheet ${Math.min((outcomes?.length ?? 0) + 1, sheets.length)} of ${sheets.length}…`
          : `Generate ${plural(sheets.length, 'sheet')} → ${plural(icons1, 'icon')} (${plural(sheets.length, 'paid generation')})`}
      </button>
      {blockReason && !running && <p className="text-2xs text-amber-400" data-testid="icon-set-run-block">{blockReason}</p>}
      {outcomes && outcomes.length > 0 && (
        <ul className="space-y-1.5 text-2xs">
          {outcomes.map((o, i) => (
            <li key={i} data-testid={`icon-set-outcome-${i}`} data-kind={o.kind} className="rounded border border-border p-2">
              {o.kind === 'cut' && (
                <div className="space-y-1">
                  <p className="text-text">Sheet {i + 1}: cut {plural(o.icons.length, 'icon')}{o.styleDnaApplied ? ` · styled with “${o.styleDnaApplied}”` : ''}</p>
                  {o.styleDnaWithheld && <p className="text-amber-400">{o.styleDnaWithheld}</p>}
                  <div className="flex flex-wrap gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by /api/visual-gen/icon/:name */}
                    {o.icons.map((c) => <img key={c.file} src={c.url} alt={c.entityId} title={c.entityId} className="w-8 h-8 rounded" />)}
                  </div>
                </div>
              )}
              {o.kind === 'uncut' && (
                <div className="text-amber-400">
                  <p>Sheet {i + 1} generated but was not cut — <a href={o.sheetUrl} target="_blank" rel="noreferrer" className="underline">open the sheet</a> ({o.sheetUrl})</p>
                  <ul className="list-disc pl-4">{o.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                </div>
              )}
              {(o.kind === 'refused' || o.kind === 'failed') && <p className="text-amber-400">Sheet {i + 1} {o.kind}: {o.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
