export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const requestedIds = (): string[] | undefined =>
  arg('ids')?.split(',').map((value) => value.trim()).filter(Boolean);

export function promotionOptions(catalogId: string): {
  catalogId: string;
  entityIds?: string[];
  limit?: number;
} {
  const limit = arg('limit');
  return {
    catalogId,
    entityIds: requestedIds(),
    limit: limit ? Number(limit) : undefined,
  };
}
