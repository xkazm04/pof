import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AudioEventCatalog } from '@/components/modules/content/audio/AudioEventCatalog';
import { clampEventCooldown, MAX_EVENT_COOLDOWN_MS } from '@/components/modules/content/audio/AudioEventCatalog/EventEditor';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';

/** Generate must not hand the prompt blank or duplicate trigger bindings. */

const SCENE = 'scene-validate';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: false, error: 'offline' }) })));
  useAudioEventCatalogStore.setState({ byScene: { [SCENE]: [] }, legacyEvents: null });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); cleanup(); });

const flush = () => act(async () => { await Promise.resolve(); });
const generate = () => screen.getByRole('button', { name: /Generate Audio Manager/ }) as HTMLButtonElement;

describe('AudioEventCatalog - Generate validation', () => {
  it('two added rows share OnCustomEvent: Generate is blocked with a reason', async () => {
    const onGenerate = vi.fn();
    render(<AudioEventCatalog sceneId={SCENE} onGenerate={onGenerate} isGenerating={false} />);
    const add = screen.getByRole('button', { name: 'Add Combat event' });
    fireEvent.click(add);
    fireEvent.click(add);
    await flush();
    expect(generate().disabled).toBe(true);
    fireEvent.click(generate());
    expect(onGenerate).not.toHaveBeenCalled();
    expect(document.getElementById('audio-events-generate-hint')?.textContent).toContain('OnCustomEvent');
  });

  it('a renamed trigger unblocks Generate; a cleared one blocks it again', async () => {
    const onGenerate = vi.fn();
    render(<AudioEventCatalog sceneId={SCENE} onGenerate={onGenerate} isGenerating={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Combat event' }));
    await flush();
    expect(generate().disabled).toBe(false);
    const input = screen.getByLabelText('Trigger') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    await flush();
    expect(generate().disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'OnSwing' } });
    await flush();
    expect(generate().disabled).toBe(false);
    fireEvent.click(generate());
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

describe('clampEventCooldown', () => {
  it('is whole, non-negative and capped', () => {
    expect(clampEventCooldown(-5)).toBe(0);
    expect(clampEventCooldown(Number.NaN)).toBe(0);
    expect(clampEventCooldown(12.6)).toBe(13);
    expect(clampEventCooldown(9e9)).toBe(MAX_EVENT_COOLDOWN_MS);
  });
});
