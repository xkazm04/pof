import { apiFetch } from '@/lib/api-utils';

export async function getHomeDir(): Promise<string | null> {
  try {
    const data = await apiFetch<{ path: string }>('/api/filesystem/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', path: '~' }),
    });
    return data.path ?? null;
  } catch {
    return null;
  }
}
