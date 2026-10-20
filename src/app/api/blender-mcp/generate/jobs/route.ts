import { apiSuccess, withRoute } from '@/lib/api-utils';
import { ledger } from '@/lib/blender-mcp/generation-ledger';

// A live view — never prerendered or cached.
export const dynamic = 'force-dynamic';

// GET /api/blender-mcp/generate/jobs — the paid Blender-MCP generations this server
// process is still holding (generating, or completed but not yet imported), plus the
// process's ownerEpoch. A reloaded forge queue re-adopts `jobs`; a CHANGED ownerEpoch
// means tracking was lost; `restored: true` means the ledger and its epoch came back
// from disk after a restart.
export const GET = withRoute(async () => {
  return apiSuccess({ jobs: ledger.listResumable(), ownerEpoch: ledger.ownerEpoch, restored: ledger.restored });
}, 'Blender generation ledger read failed');
