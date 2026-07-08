/** Sanitize a project name into a UE C++ module identifier. */
export function sanitizeModule(name: string): string {
  const cleaned = (name || '').replace(/[^A-Za-z0-9_]/g, '');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : 'Game';
}
