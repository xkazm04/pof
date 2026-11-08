/**
 * Decode a route's `[name]` segment. `decodeURIComponent` throws a URIError on a malformed
 * escape, and the serve routes call it outside their try blocks, so this is what turns that
 * into an ordinary invalid name. Null when the segment is not valid percent-encoding.
 */
export function decodeRouteName(name: string): string | null {
  try {
    return decodeURIComponent(name);
  } catch {
    return null;
  }
}
