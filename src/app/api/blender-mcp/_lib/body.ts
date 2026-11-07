/**
 * Read a POST body that must be a JSON object. A body that does not parse, or parses to
 * something other than a plain object (`null`, a string, an array), is the caller's mistake
 * and answers 400 — not a SyntaxError/TypeError thrown into `withRoute`'s 500 path.
 */
export async function readJsonObject(
  req: Request,
): Promise<Record<string, unknown> | null> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export const MALFORMED_BODY_ERROR = 'request body must be a JSON object';
