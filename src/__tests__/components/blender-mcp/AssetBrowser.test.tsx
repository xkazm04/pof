import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { AssetBrowser } from '@/components/modules/visual-gen/blender-pipeline/AssetBrowser';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

/**
 * Route-aware fetch mock for the Asset Browser:
 *  - the two parallel source searches (distinguished by `source=`)
 *  - the download endpoint
 *  - the screenshot endpoint (returns no payload → snapshot is a no-op)
 */
function mockAssetFetch() {
  const mock = vi.fn().mockImplementation((url: string) => {
    let body: unknown = { success: true, data: {} };
    if (url.includes('/assets/download')) {
      body = { success: true, data: { objectName: 'Imported_Object' } };
    } else if (url.includes('/screenshot')) {
      body = { success: true, data: { screenshot: '' } };
    } else if (url.includes('source=polyhaven')) {
      body = {
        success: true,
        data: {
          assets: [
            {
              id: 'rock_01',
              name: 'Mossy Rock',
              source: 'polyhaven',
              category: 'rock',
              thumbnailUrl: 'https://cdn/rock.png',
            },
          ],
        },
      };
    } else if (url.includes('source=sketchfab')) {
      body = {
        success: true,
        data: {
          assets: [
            {
              id: 'crate_99',
              name: 'Sci-fi Crate',
              source: 'sketchfab',
              category: '',
            },
          ],
        },
      };
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

function setConnected(connected: boolean) {
  useBlenderMCPStore.setState({
    host: '127.0.0.1',
    port: 9876,
    autoConnect: false,
    connection: { host: '127.0.0.1', port: 9876, connected },
    isConnecting: false,
    lastError: null,
    recentScreenshots: [],
    retryAttempt: 0,
    autoRetrying: false,
    autoConnectAttempted: false,
  });
}

afterEach(cleanup);
beforeEach(() => setConnected(true));

describe('AssetBrowser — search', () => {
  it('disables the Search button until Blender is connected', () => {
    setConnected(false);
    mockAssetFetch();
    render(<AssetBrowser />);
    const btn = screen.getByTestId('asset-browser-search-button');
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/connect to blender mcp/i)).toBeTruthy();
  });

  it('queries PolyHaven and Sketchfab in parallel and renders both with source badges', async () => {
    const fetchMock = mockAssetFetch();
    render(<AssetBrowser />);

    fireEvent.change(screen.getByTestId('asset-browser-search-input'), {
      target: { value: 'rock' },
    });
    fireEvent.click(screen.getByTestId('asset-browser-search-button'));

    await waitFor(() => {
      expect(screen.getByTestId('asset-card-polyhaven:rock_01')).toBeTruthy();
    });
    expect(screen.getByTestId('asset-card-sketchfab:crate_99')).toBeTruthy();

    // Both sources were queried.
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('source=polyhaven'))).toBe(true);
    expect(urls.some((u) => u.includes('source=sketchfab'))).toBe(true);
    // The user query rode along on both.
    expect(urls.filter((u) => u.includes('query=rock'))).toHaveLength(2);

    // Source badges are visible (not color-only).
    expect(screen.getByText('PolyHaven')).toBeTruthy();
    expect(screen.getByText('Sketchfab')).toBeTruthy();
  });
});

describe('AssetBrowser — import', () => {
  it('imports an asset via the download endpoint with the selected resolution', async () => {
    const fetchMock = mockAssetFetch();
    render(<AssetBrowser />);

    fireEvent.click(screen.getByTestId('asset-browser-search-button'));
    await waitFor(() =>
      expect(screen.getByTestId('asset-import-polyhaven:rock_01')).toBeTruthy(),
    );

    // Pick a non-default resolution before importing.
    fireEvent.click(screen.getByTestId('asset-res-4k'));
    fireEvent.click(screen.getByTestId('asset-import-polyhaven:rock_01'));

    await waitFor(() => {
      const downloadCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('/assets/download'),
      );
      expect(downloadCall).toBeTruthy();
      const body = JSON.parse((downloadCall![1] as RequestInit).body as string);
      expect(body).toMatchObject({
        source: 'polyhaven',
        id: 'rock_01',
        resolution: '4k',
      });
    });

    // The card reflects the imported state.
    await waitFor(() =>
      expect(
        screen.getByTestId('asset-import-polyhaven:rock_01').textContent,
      ).toMatch(/in scene/i),
    );
  });

  it('omits resolution for Sketchfab downloads', async () => {
    const fetchMock = mockAssetFetch();
    render(<AssetBrowser />);

    fireEvent.click(screen.getByTestId('asset-browser-search-button'));
    await waitFor(() =>
      expect(screen.getByTestId('asset-import-sketchfab:crate_99')).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId('asset-import-sketchfab:crate_99'));

    await waitFor(() => {
      const downloadCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('/assets/download'),
      );
      expect(downloadCall).toBeTruthy();
      const body = JSON.parse((downloadCall![1] as RequestInit).body as string);
      expect(body).toMatchObject({ source: 'sketchfab', id: 'crate_99' });
      expect(body.resolution).toBeUndefined();
    });
  });
});
