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
 *
 * GET /api/ue5-bridge/query
 *   Returns current connection state (quick status check).
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { ue5Connection } from '@/lib/ue5-bridge/connection-manager';
import type { UE5FunctionCall } from '@/types/ue5-bridge';

export async function GET() {
  return apiSuccess(ue5Connection.getState());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;

    // ── Connection lifecycle actions (no client required) ──

    if (action === 'connect') {
      const host = (body.host as string) || '127.0.0.1';
      const httpPort = (body.httpPort as number) || 30010;
      await ue5Connection.connect(host, httpPort);
      return apiSuccess(ue5Connection.getState());
    }

    if (action === 'disconnect') {
      ue5Connection.disconnect(body.reason as string | undefined);
      return apiSuccess(ue5Connection.getState());
    }

    // ── All remaining actions require an active connection ──

    const client = ue5Connection.getClient();
    if (!client || ue5Connection.getState().status !== 'connected') {
      return apiError('Not connected to UE5. Call "connect" first.', 503);
    }

    switch (action) {
      case 'getProperty': {
        const { objectPath, propertyName } = body as {
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
        const { objectPath, propertyName, value } = body as {
          objectPath: string;
          propertyName: string;
          value: unknown;
        };
        if (!objectPath || !propertyName) {
          return apiError('objectPath, propertyName, and value are required', 400);
        }
        const result = await client.setProperty(objectPath, propertyName, value);
        if (!result.ok) return apiError(result.error, 502);
        return apiSuccess(result.data);
      }

      case 'callFunction': {
        const call = body as UE5FunctionCall & { action: string };
        if (!call.objectPath || !call.functionName) {
          return apiError('objectPath and functionName are required', 400);
        }
        const result = await client.callFunction({
          objectPath: call.objectPath,
          functionName: call.functionName,
          parameters: call.parameters,
        });
        if (!result.ok) return apiError(result.error, 502);
        return apiSuccess(result.data);
      }

      case 'searchAssets': {
        const { query, className } = body as {
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
        const { objectPath } = body as { objectPath: string };
        if (!objectPath) {
          return apiError('objectPath is required', 400);
        }
        const result = await client.describeObject(objectPath);
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
