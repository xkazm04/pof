import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { DEFAULT_CONFIG, SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import { scanForLocalizableStrings, generateLOCTEXTReplacements, generateStringTable } from '@/lib/localization/scan-engine';
import { translateBatch, computeTranslationProgress } from '@/lib/localization/translation-engine';
import type { LocalizationConfig } from '@/types/localization-pipeline';

/* ---- GET: defaults ----------------------------------------------- */

export async function GET() {
  try {
    return apiSuccess({
      config: DEFAULT_CONFIG,
      supportedLocales: SUPPORTED_LOCALES,
    });
  } catch (err) {
    return apiError(`Failed to load defaults: ${err instanceof Error ? err.message : err}`, 500);
  }
}

/* ---- POST: actions ----------------------------------------------- */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    /* -- Scan for localizable strings -------------------------------- */
    if (action === 'scan') {
      const config = (body.config as LocalizationConfig) ?? DEFAULT_CONFIG;
      const result = scanForLocalizableStrings(config.scanModules);
      return apiSuccess(result);
    }

    /* -- Generate LOCTEXT replacements ------------------------------- */
    if (action === 'replacements') {
      const config = (body.config as LocalizationConfig) ?? DEFAULT_CONFIG;
      const scan = scanForLocalizableStrings(config.scanModules);
      const replacements = generateLOCTEXTReplacements(scan.strings, config.rootNamespace);
      return apiSuccess({ replacements, totalStrings: scan.strings.length });
    }

    /* -- Generate String Tables -------------------------------------- */
    if (action === 'string-tables') {
      const config = (body.config as LocalizationConfig) ?? DEFAULT_CONFIG;
      const scan = scanForLocalizableStrings(config.scanModules);
      const tables = generateStringTable(scan.strings, config.rootNamespace);
      return apiSuccess({ tables });
    }

    /* -- Translate --------------------------------------------------- */
    if (action === 'translate') {
      const config = (body.config as LocalizationConfig) ?? DEFAULT_CONFIG;
      const scan = scanForLocalizableStrings(config.scanModules);
      const translatable = scan.strings.filter(
        (s) => s.currentUsage !== 'nsloctext' && s.currentUsage !== 'loctext',
      );
      const result = translateBatch(translatable, config.targetLocales, config.glossary);
      const progress = computeTranslationProgress(result.entries, translatable.length, config.targetLocales);
      return apiSuccess({ translation: result, progress });
    }

    /* -- Full pipeline (scan + translate + replacements) ------------- */
    if (action === 'full-pipeline') {
      const config = (body.config as LocalizationConfig) ?? DEFAULT_CONFIG;
      const scan = scanForLocalizableStrings(config.scanModules);
      const translatable = scan.strings.filter(
        (s) => s.currentUsage !== 'nsloctext' && s.currentUsage !== 'loctext',
      );
      const replacements = generateLOCTEXTReplacements(scan.strings, config.rootNamespace);
      const tables = generateStringTable(scan.strings, config.rootNamespace);
      const translation = translateBatch(translatable, config.targetLocales, config.glossary);
      const progress = computeTranslationProgress(translation.entries, translatable.length, config.targetLocales);

      return apiSuccess({
        scan,
        replacements,
        tables,
        translation,
        progress,
      });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(`Localization pipeline error: ${err instanceof Error ? err.message : err}`, 500);
  }
}
