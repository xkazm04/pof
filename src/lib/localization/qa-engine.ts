/* ------------------------------------------------------------------ */
/*  Localization Pipeline — Translation QA Validator                   */
/* ------------------------------------------------------------------ */
/*                                                                     */
/*  The scan engine (scan-engine.ts) only flags SOURCE-side hazards.   */
/*  This pass validates the translated OUTPUT — the half memoQ QA /    */
/*  Xbench / Verifika / Lokalise run — so a dropped {0} placeholder    */
/*  (which crashes UE5's FText::Format at runtime), a mistranslated    */
/*  number, or a silently-untranslated segment can't ship green.       */
/*                                                                     */
/*  validateTranslations() is pure and deterministic so it can run     */
/*  server-side in the API route and be unit-tested without a DOM.     */
/* ------------------------------------------------------------------ */

import type {
  TranslationEntry,
  LocalizableString,
  GlossaryEntry,
  TranslationQACheck,
  TranslationQAFinding,
  TranslationQAResult,
  LocaleQAStatus,
} from '@/types/localization-pipeline';
import { QA_CHECKS, qaBlocksShip } from './definitions';
import { hashString } from './hash';

/* ---- Token extraction -------------------------------------------- */

/** UE5 FText::Format tokens: numbered `{0}` and named `{PlayerName}`. */
const PLACEHOLDER_RE = /\{[^}]*\}/g;
/** Number-ish runs, incl. grouped/decimal forms (1,000.00 / 1.000,00 / 30). */
const NUMBER_RE = /\d[\d.,]*/g;

function extract(text: string, re: RegExp): string[] {
  return text.match(re) ?? [];
}

/** Strip locale-specific grouping/decimal separators to a comparable digit run. */
function normalizeNumber(token: string): string {
  return token.replace(/[.,]/g, '');
}

/**
 * Multiset difference: tokens in `a` missing from `b`, and tokens in `b` that
 * are not in `a`. Honors repeats — `{0} {0}` vs `{0}` reports one missing.
 */
function multisetDiff(a: string[], b: string[]): { missing: string[]; extra: string[] } {
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const ca = count(a);
  const cb = count(b);
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [k, n] of ca) {
    for (let i = 0; i < n - (cb.get(k) ?? 0); i++) missing.push(k);
  }
  for (const [k, n] of cb) {
    for (let i = 0; i < n - (ca.get(k) ?? 0); i++) extra.push(k);
  }
  return { missing, extra };
}

/* ---- Suppression helpers ----------------------------------------- */

/** A source with nothing to translate (single char, pure number/punctuation). */
function isUntranslatable(source: string): boolean {
  const t = source.trim();
  if (t.length <= 1) return true;
  return /^[\d\s\p{P}\p{S}]+$/u.test(t);
}

/**
 * Whether an identical-to-source translation is legitimately explained by the
 * glossary — a do-not-translate term (GAS, AttributeSet) or a term whose
 * approved translation for this locale IS the source spelling (Mana→Mana).
 */
function isGlossaryExplained(
  source: string,
  translated: string,
  locale: string,
  glossary: GlossaryEntry[],
): boolean {
  const match = glossary.find(
    (g) => g.sourceTerm.trim().toLowerCase() === source.trim().toLowerCase(),
  );
  if (!match) return false;
  if (match.doNotTranslate) return true;
  const expected = match.translations[locale];
  return expected !== undefined && expected.trim().toLowerCase() === translated.trim().toLowerCase();
}

/* ---- Per-entry checks -------------------------------------------- */

function makeFinding(
  entry: TranslationEntry,
  source: string,
  check: TranslationQACheck,
  message: string,
  suggestion: string,
): TranslationQAFinding {
  return {
    id: `qa_${hashString(`${entry.stringId}:${entry.locale}:${check}`).toString(36)}`,
    stringId: entry.stringId,
    locale: entry.locale,
    check,
    severity: QA_CHECKS[check].severity,
    message,
    sourceText: source,
    translatedText: entry.translatedText,
    suggestion,
    fixPrompt:
      `Fix the ${QA_CHECKS[check].label.toLowerCase()} QA failure in the ${entry.locale} translation of ` +
      `"${source}" → "${entry.translatedText}". ${suggestion}`,
  };
}

function checkEntry(
  entry: TranslationEntry,
  source: LocalizableString | undefined,
  glossary: GlossaryEntry[],
): TranslationQAFinding[] {
  const src = source?.sourceText ?? '';
  const tgt = entry.translatedText ?? '';
  const findings: TranslationQAFinding[] = [];

  // Empty — a blank translation renders nothing; no other check is meaningful.
  if (tgt.trim() === '') {
    findings.push(
      makeFinding(entry, src, 'empty', 'Translation is empty.', `Provide a ${entry.locale} translation for "${src}".`),
    );
    return findings;
  }

  // Placeholder parity — dropped/added {0}/{Name} tokens crash FText::Format.
  const { missing, extra } = multisetDiff(extract(src, PLACEHOLDER_RE), extract(tgt, PLACEHOLDER_RE));
  if (missing.length || extra.length) {
    const parts: string[] = [];
    if (missing.length) parts.push(`dropped ${missing.join(', ')}`);
    if (extra.length) parts.push(`added ${extra.join(', ')}`);
    findings.push(
      makeFinding(
        entry,
        src,
        'placeholder_parity',
        `Format placeholder mismatch (${parts.join('; ')}).`,
        `Restore the exact format tokens [${extract(src, PLACEHOLDER_RE).join(', ') || 'none'}] from the source.`,
      ),
    );
  }

  // Number parity — a number lost/changed in the target (damage, cost, duration).
  const numDiff = multisetDiff(
    extract(src, NUMBER_RE).map(normalizeNumber),
    extract(tgt, NUMBER_RE).map(normalizeNumber),
  );
  if (numDiff.missing.length || numDiff.extra.length) {
    const parts: string[] = [];
    if (numDiff.missing.length) parts.push(`missing ${numDiff.missing.join(', ')}`);
    if (numDiff.extra.length) parts.push(`extra ${numDiff.extra.join(', ')}`);
    findings.push(
      makeFinding(
        entry,
        src,
        'number_parity',
        `Number mismatch vs source (${parts.join('; ')}).`,
        'Keep every numeric value from the source; use FText::AsNumber for locale formatting.',
      ),
    );
  }

  // Untranslated — identical to source and not a known glossary / DNT term.
  if (
    !isUntranslatable(src) &&
    tgt.trim().toLowerCase() === src.trim().toLowerCase() &&
    !isGlossaryExplained(src, tgt, entry.locale, glossary)
  ) {
    findings.push(
      makeFinding(
        entry,
        src,
        'untranslated',
        'Translation is identical to the English source — likely untranslated.',
        `Translate "${src}" into ${entry.locale}, or add it to the glossary as do-not-translate if intentional.`,
      ),
    );
  }

  // Whitespace — leading/trailing or doubled/tab whitespace.
  if (tgt !== tgt.trim() || /\s{2,}/.test(tgt) || /\t/.test(tgt)) {
    findings.push(
      makeFinding(entry, src, 'whitespace', 'Leading/trailing or doubled whitespace.', 'Trim and collapse whitespace.'),
    );
  }

  // Glossary compliance — whole-string term must use its approved translation.
  const term = glossary.find(
    (g) =>
      !g.doNotTranslate &&
      g.translations[entry.locale] &&
      g.sourceTerm.trim().toLowerCase() === src.trim().toLowerCase(),
  );
  if (term) {
    const expected = term.translations[entry.locale];
    if (tgt.trim().toLowerCase() !== expected.trim().toLowerCase()) {
      findings.push(
        makeFinding(
          entry,
          src,
          'glossary',
          `Glossary term "${term.sourceTerm}" should be "${expected}" in ${entry.locale} but got "${tgt}".`,
          `Use the approved glossary translation "${expected}".`,
        ),
      );
    }
  }

  return findings;
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Validate translated output against its source. Returns every QA finding plus
 * a per-locale roll-up that gates the "ready to ship" badge (a locale is ready
 * when it has translations and zero blocking — critical/warning — findings).
 *
 * @param entries        translated entries to validate
 * @param strings        source strings, matched to entries by `stringId`
 * @param glossary       game glossary for term-compliance + identical-OK suppression
 * @param targetLocales  optional locales to always include in the roll-up
 */
export function validateTranslations(
  entries: TranslationEntry[],
  strings: LocalizableString[],
  glossary: GlossaryEntry[] = [],
  targetLocales?: string[],
): TranslationQAResult {
  const byId = new Map(strings.map((s) => [s.id, s]));
  const findings: TranslationQAFinding[] = [];
  for (const entry of entries) {
    findings.push(...checkEntry(entry, byId.get(entry.stringId), glossary));
  }

  const locales = new Set<string>(targetLocales ?? []);
  for (const e of entries) locales.add(e.locale);

  const byLocale: Record<string, LocaleQAStatus> = {};
  for (const locale of locales) {
    const localeEntries = entries.filter((e) => e.locale === locale);
    const localeFindings = findings.filter((f) => f.locale === locale);
    const criticalCount = localeFindings.filter((f) => f.severity === 'critical').length;
    const blockingCount = localeFindings.filter((f) => qaBlocksShip(f.severity)).length;
    byLocale[locale] = {
      locale,
      totalEntries: localeEntries.length,
      findingCount: localeFindings.length,
      criticalCount,
      blockingCount,
      readyToShip: localeEntries.length > 0 && blockingCount === 0,
    };
  }

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  return {
    findings,
    byLocale,
    criticalCount,
    warningCount,
    infoCount,
    clean: criticalCount === 0 && warningCount === 0,
  };
}
