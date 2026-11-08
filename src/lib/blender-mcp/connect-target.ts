/**
 * The one rule for what the Blender bridge may be asked to dial. The route enforces it
 * server-side; the store and the connection bar apply the same function so a target the
 * route always refuses is caught before a request (and never retried).
 *
 * The bridge is a raw TCP client to a local Blender addon. A caller-chosen host would turn
 * connect into a probe of any address, so only loopback hosts and a valid port are
 * accepted; an absent value (`undefined`) falls back to the service default.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const HOST_LOOPBACK_ERROR =
  'host must be a loopback address (localhost, 127.0.0.1 or ::1)';
export const PORT_RANGE_ERROR = 'port must be an integer between 1 and 65535';

export function connectTargetError(host: unknown, port: unknown): string | null {
  if (host !== undefined && (typeof host !== 'string' || !LOOPBACK_HOSTS.has(host.toLowerCase()))) {
    return HOST_LOOPBACK_ERROR;
  }
  if (port !== undefined && !(Number.isInteger(port) && (port as number) >= 1 && (port as number) <= 65535)) {
    return PORT_RANGE_ERROR;
  }
  return null;
}
