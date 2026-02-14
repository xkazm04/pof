/**
 * Generic dynamic SQL UPDATE builder.
 *
 * Iterates `allowedFields`, checks each key on `payload` for `!== undefined`,
 * and builds parameterized SET clauses. Fields listed in `jsonFields` are
 * JSON-stringified before being added as values. Always appends
 * `updated_at = datetime('now')`.
 *
 * Returns `null` when no fields in the payload are set (nothing to update).
 */
export function buildUpdateQuery<T>(
  tableName: string,
  id: number,
  payload: T,
  allowedFields: { key: keyof T & string; column: string }[],
  jsonFields?: Set<keyof T & string>,
): { sql: string; values: unknown[] } | null {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const { key, column } of allowedFields) {
    if ((payload as Record<string, unknown>)[key] !== undefined) {
      setClauses.push(`${column} = ?`);
      const val = (payload as Record<string, unknown>)[key];
      values.push(jsonFields?.has(key) ? JSON.stringify(val) : val);
    }
  }

  if (setClauses.length === 0) return null;

  setClauses.push("updated_at = datetime('now')");
  values.push(id);

  return {
    sql: `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`,
    values,
  };
}
