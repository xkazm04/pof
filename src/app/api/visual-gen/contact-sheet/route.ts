import { NextRequest } from 'next/server';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { GENERATED_IMAGE_DIR, generateTwoDImage } from '@/lib/visual-gen/image-providers';
import { DEFAULT_SHEET_PX, type ContactSheetSpec } from '@/lib/visual-gen/contact-sheet';
import { runContactSheet, type SheetImageOps } from '@/lib/visual-gen/sheet-slice';

/**
 * One generation -> a whole SET of per-entity icons.
 *
 * The app's other 2D front (`/api/visual-gen/generate-2d`) makes one image per call, so
 * a 16-entity catalog costs 16 generations and gets 16 independently-styled results —
 * `kit-coherence.ts` measures that spread. This route asks for all of them in one grid
 * image, cuts it on the DELIVERED dimensions, and files each cell under
 * `iconFileBase(catalog, step, entity)` so the existing icon library resolves it
 * entity-first with no other change.
 *
 * Refusals keep their own reason: a cast that does not fill the grid is a 400 that never
 * reaches a provider; a provider failure is a 502; a sheet that generated but could not
 * be cut is a 502 that still hands back the sheet url and the verdict, because the art
 * exists and a human can look at it.
 */

function imageDir(): string {
  return join(process.cwd(), 'generated', GENERATED_IMAGE_DIR).split(/[\\/]/).join('/');
}
function iconDir(): string {
  return join(process.cwd(), 'generated', 'icons').split(/[\\/]/).join('/');
}

export const sharpImageOps: SheetImageOps = {
  async dimensions(path) {
    const m = await sharp(path).metadata();
    return { width: m.width ?? 0, height: m.height ?? 0 };
  },
  async stats(path, cells, seamXs) {
    const cellStdev: number[] = [];
    for (const c of cells) {
      // `.stats()` reads the INPUT image, not the pipeline built in front of it: an
      // `extract()` before it is silently ignored and every cell reports the whole
      // sheet's stdev. Materialize the crop first, then re-open it. Caught on a live
      // run (every one of 16 cells came back 24.8); no fixture-fed test can see it.
      const crop = await sharp(path)
        .extract({ left: c.x, top: c.y, width: c.w, height: c.h })
        .png()
        .toBuffer();
      const s = await sharp(crop).greyscale().stats();
      cellStdev.push(+s.channels[0].stdev.toFixed(2));
    }
    const { data, info } = await sharp(path).greyscale().raw().toBuffer({ resolveWithObject: true });
    const colGrad = (x: number) => {
      let sum = 0;
      for (let y = 0; y < info.height; y++) {
        sum += Math.abs(data[y * info.width + x] - data[y * info.width + x - 1]);
      }
      return sum / info.height;
    };
    const seamSet = new Set(seamXs);
    const seams = seamXs.filter((x) => x > 0).map((x) => +colGrad(x).toFixed(3));
    let interior = 0;
    let n = 0;
    for (let x = 1; x < info.width; x++) {
      if (!seamSet.has(x)) {
        interior += colGrad(x);
        n++;
      }
    }
    return { cellStdev, seams, interior: n > 0 ? +(interior / n).toFixed(3) : 0 };
  },
  async cut(path, cell, outPath) {
    await sharp(path)
      .extract({ left: cell.x, top: cell.y, width: cell.w, height: cell.h })
      .png()
      .toFile(outPath);
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      catalogId?: string;
      step?: string;
      cols?: number;
      rows?: number;
      cellSubject?: string;
      style?: string;
      background?: string;
      accent?: string;
      cast?: { entityId?: string; brief?: string }[];
      providerId?: string;
      size?: string;
    };

    const catalogId = typeof body?.catalogId === 'string' ? body.catalogId : '';
    const step = typeof body?.step === 'string' ? body.step : '';
    if (!catalogId || !step) {
      return apiError('a contact sheet is filed under a (catalogId, step) — both are required', 400);
    }
    const cast = Array.isArray(body?.cast) ? body.cast : [];
    if (cast.some((c) => !c?.entityId || !c?.brief)) {
      return apiError('every cast member needs an entityId and a brief — a blank brief buys a random cell', 400);
    }

    const spec: ContactSheetSpec = {
      cols: Number(body?.cols) || 4,
      rows: Number(body?.rows) || 4,
      cellSubject: body?.cellSubject ?? 'game entity icon',
      style: body?.style ?? 'painterly dark-fantasy ARPG art',
      background: body?.background ?? 'subtle deep charcoal atmospheric background',
      accent: typeof body?.accent === 'string' ? body.accent : undefined,
      cast: cast.map((c) => ({ id: c.entityId!, brief: c.brief! })),
      width: DEFAULT_SHEET_PX,
      height: DEFAULT_SHEET_PX,
    };

    const outDir = imageDir();
    const icons = iconDir();
    await mkdir(outDir, { recursive: true });
    await mkdir(icons, { recursive: true });

    const result = await runContactSheet(
      { spec, catalogId, step },
      {
        generate: async (prompt) => {
          const g = await generateTwoDImage(
            {
              prompt,
              providerId: typeof body?.providerId === 'string' ? body.providerId : 'qwen-image',
              size: typeof body?.size === 'string' ? body.size : `${DEFAULT_SHEET_PX}*${DEFAULT_SHEET_PX}`,
              width: DEFAULT_SHEET_PX,
              height: DEFAULT_SHEET_PX,
            },
            { env: process.env as Record<string, string | undefined>, outDir },
          );
          return {
            ok: g.ok,
            error: g.error,
            refused: g.refused,
            path: g.name ? `${outDir}/${g.name}` : undefined,
            url: g.url,
            model: g.model,
          };
        },
        image: sharpImageOps,
        iconDir: icons,
      },
    );

    if (!result.ok) {
      return apiError(result.error, result.refused ? 400 : 502);
    }
    return apiSuccess(result);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to process contact sheet request', 500);
  }
}
