/**
 * The streaming planner's forms: one meaning per field, reachable by name.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { ZoneEditor } from '@/components/modules/content/level-design/StreamingZonePlanner/ZoneEditor';
import { TransitionList } from '@/components/modules/content/level-design/StreamingZonePlanner/TransitionList';
import { PaintPalette } from '@/components/modules/content/level-design/StreamingZonePlanner/PaintPalette';
import { PreflightPanel } from '@/components/modules/content/level-design/StreamingZonePlanner/PreflightPanel';
import type { StreamingZone } from '@/components/modules/content/level-design/StreamingZonePlanner/types';

afterEach(cleanup);

const ZONE: StreamingZone = {
  id: 'z', name: 'Town', type: 'town', gridX: 2, gridY: 3, loadPriority: 'always', alwaysLoaded: true, preloadRadius: 1,
};

describe('ZoneEditor always-loaded pair', () => {
  it('unticking Always loaded leaves the always priority too, as the priority buttons do', () => {
    const onUpdate = vi.fn();
    render(<ZoneEditor zone={ZONE} onUpdate={onUpdate} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onUpdate).toHaveBeenCalledWith({ alwaysLoaded: false, loadPriority: 'normal' });
  });
});

describe('ZoneEditor preload radius', () => {
  it('names its unit: the field is cells, not seconds', () => {
    render(<ZoneEditor zone={ZONE} onUpdate={() => {}} onClose={() => {}} />);
    expect(screen.queryByText(/SECS/i)).toBeNull();
    expect(screen.getByText(/PRELOAD RADIUS \(CELLS\)/)).toBeTruthy();
  });
});

describe('accessible names', () => {
  it('every ZoneEditor control can be found by name and states its selection', () => {
    render(<ZoneEditor zone={ZONE} onUpdate={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /zone type/i })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /preload radius/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /close zone editor/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'always' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'low' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('TransitionList names its remove button and style select after the link', () => {
    const zones = [ZONE, { ...ZONE, id: 'y', name: 'Forest', gridX: 3 }];
    const transitions = [{ id: 't', fromId: 'z', toId: 'y', style: 'seamless' as const, triggerType: 'proximity' as const, condition: '' }];
    render(<TransitionList transitions={transitions} zones={zones} deleteTransition={() => {}} updateTransition={() => {}} />);
    expect(screen.getByRole('button', { name: /remove transition town to forest/i })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /style of town to forest/i })).toBeTruthy();
  });

  it('PaintPalette states which tool is active', () => {
    render(<PaintPalette mode={{ kind: 'paint', zoneType: 'town' }} selectedZoneId={null} dispatch={() => {}} />);
    expect(screen.getByRole('button', { name: /Town$/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Forest$/ }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: /Erase/ }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('PreflightPanel on an empty plan', () => {
  it('does not certify a plan with no zones', () => {
    render(<PreflightPanel preflight={{ findings: [], blocksGenerate: false }} residency={{ byZone: {}, peak: null }} zones={[]} selectedZoneId={null} dispatch={() => {}} />);
    expect(screen.queryByText(/every zone is reachable/)).toBeNull();
    expect(screen.getByText(/No zones yet/)).toBeTruthy();
  });
});
