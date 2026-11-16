/**
 * UE5 Bridge Query Endpoint
 *
 * POST /api/ue5-bridge/query
 *   Action-based handler for UE5 Remote Control operations:
 *     - connect       — connect to UE5 at { host, httpPort }
 *     - disconnect    — tear down connection
 *     - getProperty   — read a UObject property
 *     - setProperty   — write a UObject property
 *     - callFunction  — invoke a UFUNCTION
 *     - searchAssets  — search project assets
 *     - describeObject — describe a UObject's schema
 *     - consoleCommand — execute a UE5 console command
 *
 *   The connection itself is server-owned (see
 *   `@/lib/ue5-bridge/connection-manager`), so this route is the ONLY way
 *   browser code can reach it. Every action either executes against a live
 *   connection or returns a 503 naming the reason — nothing is buffered or
 *   retried behind the caller's back.
 *
 * GET /api/ue5-bridge/query
 *   Returns current connection state (quick status check).
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { ue5Connection } from '@/lib/ue5-bridge/connection-manager';
import type { UE5FunctionCall } from '@/types/ue5-bridge';

const ACTIONS = new Set([
  'connect', 'disconnect', 'getProperty', 'setProperty', 'callFunction', 'searchAssets', 'describeObject', 'consoleCommand',
]);
/** A bare host name or IPv4 address: it is spliced into `http://<host>:<port>`. */
const HOST_RE = /^[A-Za-z0-9.-]+$/;

const isStringIfSet = (v: unknown) => v === undefined || typeof v === 'string';

export async function GET() {
  return apiSuccess(ue5Connection.getState());
}

export async function POST(request: NextRequest) {
  const denied = requireOperator(request);
  if (denied) return denied;
  try {
    const body = await readJsonObject(request);
    if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
    const action = body.action as string;
    // Before the connection check: a bad action is the caller's error whatever the editor is doing.
    if (!ACTIONS.has(action)) return apiError(`Unknown action: ${action}`, 400);
    for (const field of ['objectPath', 'propertyName', 'functionName', 'query', 'className']) {
      if (!isStringIfSet(body[field])) return apiError(`${field} must be a string`, 400);
    }

    // ── Connection lifecycle actions (no client required) ──

    if (action === 'connect') {
      if (body.host !== undefined && (typeof body.host !== 'string' || !HOST_RE.test(body.host))) {
        return apiError('host must be a bare host name or IPv4 address', 400);
      }
      const rawPort = body.httpPort;
      if (rawPort !== undefined && (!Number.isInteger(rawPort) || (rawPort as number) < 1 || (rawPort as number) > 65535)) {
        return apiError('httpPort must be an integer in 1-65535', 400);
      }
      const host = (body.host as string) || '127.0.0.1';
      const httpPort = (rawPort as number) || 30010;
      await ue5Connection.connect(host, httpPort);
      return apiSuccess(ue5Connection.getState());
    }

    if (action === 'disconnect') {
      ue5Connection.disconnect(typeof body.reason === 'string' ? body.reason : undefined);
      return apiSuccess(ue5Connection.getState());
    }

    // ── All remaining actions require an active connection ──

    const client = ue5Connection.getClient();
    if (!client || ue5Connection.getState().status !== 'connected') {
      return apiError('Not connected to UE5. Call "connect" first.', 503);
    }

    switch (action) {
      case 'getProperty': {
        const { objectPath, propertyName } = body as unknown as {
          objectPath: string;
          propertyName: string;
        };
        if (!objectPath || !propertyName) {
          return apiError('objectPath and propertyName are required', 400);
        }
        const result = await client.getProperty(objectPath, propertyName);
        if (!result.ok) return apiError(result.error, 502);
        return apiSuccess(result.data);
      }

      case 'setProperty': {
        const { objectPath, propertyName, value } = body as unknown as {
          objectPath: string;
          propertyName: string;
          value: unknown;
        };
        // `undefined`, not falsy: 0, false, '' and null are all values a property can be set to.
        if (!objectPath || !propertyName || value === undefined) {
          return apiError('objectPath, propertyName, and value are required', 400);
        }
        logger.info('[ue5-bridge]', 'setProperty', `${objectPath}.${propertyName}`);
        const result = await client.setProperty(objectPath, propertyName, value);
        if (!result.ok) return apiError(result.error, 502);
        return apiSuccess(result.data);
      }

      case 'callFunction': {
        const call = body as unknown as UE5FunctionCall & { action: string };
        if (!call.objectPath || !call.functionName) {
          return apiError('objectPath and functionName are required', 400);
        }
        const params: unknown = call.parameters;
        if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) {
          return apiError('parameters must be an object', 400);
        }
        logger.info('[ue5-bridge]', 'callFunction', `${call.objectPath}::${call.functionName}`);
        const result = await client.callFunction({
          objectPath: call.objectPath,
          functionName: call.functionName,
          parameters: call.parameters,
        });
        if (!result.ok) return apiError(result.error, 502);
        return apiSuccess(result.data);
      }

      case 'searchAssets': {
        const { query, className } = body as unknown as {
          query: string;
          className?: string;
        };
        if (!query) {
          return apiError('query is required', 400);
        }
        const result = await client.searchAssets(query, className);
        if (!result.ok) return apiError(result.error, 502);
        return apiSuccess(result.data);
      }

      case 'describeObject': {
        const { objectPath } = body as unknown as { objectPath: string };
        if (!objectPath) {
          return apiError('objectPath is required', 400);
        }
        const result = await client.describeObject(objectPath);
        if (!result.ok) return apiError(result.error, 502);
        return apiSuccess(result.data);
      }

      case 'consoleCommand': {
        const { command } = body as unknown as { command: string };
        if (typeof command !== 'string' || !command.trim()) {
          return apiError('command is required', 400);
        }
        // The command text is an operator-typed value; the first word names it without echoing arguments.
        logger.info('[ue5-bridge]', 'consoleCommand', command.trim().split(/\s+/)[0]);
        const result = await client.executeConsoleCommand(command.trim());
        if (!result.ok) return apiError(result.error, 502);
        return apiSuccess(result.data);
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error');
  }
}
