import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { AdvancedTexturePanel } from '@/components/modules/visual-gen/material-lab/AdvancedTexturePanel';

// fetch is always mocked here: no test in this file may reach a paid provider.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AdvancedTexturePanel — Scenario generate guard', () => {
  it('cannot spend a paid Scenario call on an empty or blank prompt', () => {
    const fetchMock = mockFetch({ body: { success: true, data: {} } });
    render(<AdvancedTexturePanel />);
    const generate = screen.getByTestId('scenario-generate') as HTMLButtonElement;

    expect(generate.disabled).toBe(true);
    fireEvent.click(generate);
    fireEvent.change(screen.getByTestId('scenario-prompt'), { target: { value: '   ' } });
    expect(generate.disabled).toBe(true);
    fireEvent.click(generate);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('scenario-prompt'), { target: { value: 'dungeon stone' } });
    expect(generate.disabled).toBe(false);
  });
});
