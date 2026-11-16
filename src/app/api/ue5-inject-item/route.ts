/**
 * UE5 Item Injection Endpoint
 *
 * POST /api/ue5-inject-item
 *   Takes a crafted item (base + affixes + magnitudes) and injects it into a
 *   running PIE session via UE5 Remote Control API. Calls UARPGAffixRoller::RollAffixes
 *   with pre-determined values (bypassing randomness) and adds the resulting
 *   UARPGItemInstance to the player inventory.
 *
 *   The batch sequence:
 *     1. Call UARPGAffixRoller::CreatePreRolledItem with definition, level, and affixes
 *     2. Call AddToInventory on the player's inventory component
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { ue5Connection } from '@/lib/ue5-bridge/connection-manager';
import type { InjectItemRequest } from '@/types/ue5-bridge';

/** A well-formed affix; `null` here used to throw into the 500 path. */
function isAffix(a: unknown): boolean {
  if (typeof a !== 'object' || a === null) return false;
  const { tag, displayName, magnitude, bIsPrefix } = a as Record<string, unknown>;
  return typeof tag === 'string' && typeof displayName === 'string'
    && typeof magnitude === 'number' && typeof bIsPrefix === 'boolean';
}

export async function POST(request: NextRequest) {
  const denied = requireOperator(request);
  if (denied) return denied;
  try {
    const raw = await readJsonObject(request);
    if (!raw) return apiError(MALFORMED_BODY_ERROR, 400);
    const body = raw as unknown as InjectItemRequest;

    // ── Validate payload ──
    if (!body.definitionAsset || !body.affixes || !Array.isArray(body.affixes)) {
      return apiError('definitionAsset and affixes[] are required', 400);
    }
    // It lands after `/Game/Items/`, so a separator or `..` would name some other asset.
    if (typeof body.definitionAsset !== 'string' || /[\\/]|\.\./.test(body.definitionAsset)) {
      return apiError('definitionAsset must be an asset name, not a path', 400);
    }
    if (!Number.isInteger(body.itemLevel) || body.itemLevel < 1) {
      return apiError('itemLevel must be a positive integer', 400);
    }
    if (!body.affixes.every(isAffix)) {
      return apiError('each affix needs tag, displayName, magnitude and bIsPrefix', 400);
    }

    // ── Require active UE5 connection ──
    const client = ue5Connection.getClient();
    if (!client || ue5Connection.getState().status !== 'connected') {
      return apiError('Not connected to UE5. Connect via Project Setup first.', 503);
    }

    // ── Build the affix array for UE5 ──
    const ue5Affixes = body.affixes.map((a) => ({
      AffixTag: a.tag,
      DisplayName: a.displayName,
      Magnitude: a.magnitude,
      bIsPrefix: a.bIsPrefix,
    }));

    logger.info('[ue5-inject-item]', 'inject', body.definitionAsset);

    // ── Step 1: Create the pre-rolled item instance via AffixRoller subsystem ──
    const createResult = await client.callFunction({
      objectPath: '/Script/PoF.Default__ARPGAffixRoller',
      functionName: 'CreatePreRolledItem',
      parameters: {
        DefinitionAsset: `/Game/Items/${body.definitionAsset}`,
        ItemLevel: body.itemLevel,
        PreRolledAffixes: ue5Affixes,
      },
    });

    if (!createResult.ok) {
      return apiError(`Failed to create item: ${createResult.error}`, 502);
    }

    // ── Step 2: Add the item to player inventory ──
    const addResult = await client.callFunction({
      objectPath: '/Game/Maps/PersistentLevel.PlayerCharacter_0.InventoryComponent',
      functionName: 'ServerAddItemFromExternal',
      parameters: {
        ItemDefinitionPath: `/Game/Items/${body.definitionAsset}`,
        ItemLevel: body.itemLevel,
        PreRolledAffixes: ue5Affixes,
        StackCount: 1,
      },
    });

    if (!addResult.ok) {
      return apiError(`Item created but failed to add to inventory: ${addResult.error}`, 502);
    }

    return apiSuccess({
      injected: true,
      itemName: body.definitionAsset,
      affixCount: body.affixes.length,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error');
  }
}
